import base64
import json
import logging
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.content_media import ContentMedia
from app.models.video_generation_job import VideoGenerationJob
from app.models.video_project import VideoProject
from app.services.media_storage import get_media_path, get_media_storage_root


logger = logging.getLogger(__name__)

GEMINI_INTERACTIONS_URL = (
    "https://generativelanguage.googleapis.com/v1beta/interactions"
)
MAX_REFERENCE_IMAGES = 6
MAX_REFERENCE_BYTES = 20 * 1024 * 1024
MAX_GENERATED_VIDEO_BYTES = 250 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 900


class StoryboardScene(BaseModel):
    description: str = Field(min_length=8, max_length=800)
    camera_movement: str = Field(min_length=3, max_length=300)


class VideoStoryboard(BaseModel):
    media_analysis: str = Field(min_length=8, max_length=2000)
    scenes: List[StoryboardScene] = Field(min_length=1, max_length=2)


class VideoGenerationError(Exception):
    def __init__(self, stage: str, message: str):
        super().__init__(message)
        self.stage = stage
        self.public_message = message


def _update_job(
    job_id: str,
    *,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    progress: Optional[int] = None,
    storyboard: Optional[Dict[str, Any]] = None,
    generated_clip_keys: Optional[List[str]] = None,
    output_storage_key: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    with SessionLocal() as db:
        job = db.get(VideoGenerationJob, job_id)
        if job is None:
            raise RuntimeError("Video generation job no longer exists.")
        if status is not None:
            job.status = status
        if stage is not None:
            job.stage = stage
        if progress is not None:
            job.progress = progress
        if storyboard is not None:
            job.storyboard = storyboard
        if generated_clip_keys is not None:
            job.generated_clip_keys = generated_clip_keys
        if output_storage_key is not None:
            job.output_storage_key = output_storage_key
        if error_message is not None:
            job.error_message = error_message
        db.commit()


def _gemini_interaction(payload: Dict[str, Any], stage: str) -> Dict[str, Any]:
    request = urllib.request.Request(
        GEMINI_INTERACTIONS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.gemini_api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            raw_response = response.read(MAX_GENERATED_VIDEO_BYTES * 2)
    except urllib.error.HTTPError as error:
        logger.error(
            "Gemini request failed during %s with HTTP %s.",
            stage,
            error.code,
        )
        raise VideoGenerationError(
            stage,
            "Gemini could not complete the {} step. Check the API key, "
            "model access, billing, and input limits.".format(stage),
        ) from error
    except (urllib.error.URLError, TimeoutError) as error:
        logger.exception("Gemini request failed during %s.", stage)
        raise VideoGenerationError(
            stage,
            "Could not reach Gemini while processing the {} step.".format(stage),
        ) from error

    try:
        return json.loads(raw_response.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise VideoGenerationError(
            stage,
            "Gemini returned an unreadable response during the {} step.".format(
                stage
            ),
        ) from error


def _model_text(response: Dict[str, Any], stage: str) -> str:
    for step in response.get("steps", []):
        if step.get("type") != "model_output":
            continue
        for content in step.get("content", []):
            if content.get("type") == "text":
                return str(content.get("text", ""))
    raise VideoGenerationError(
        stage,
        "Gemini did not return text for the {} step.".format(stage),
    )


def _model_video(response: Dict[str, Any]) -> bytes:
    if response.get("status") not in (None, "completed"):
        raise VideoGenerationError(
            "scene_generation",
            "Gemini did not finish video generation.",
        )
    for step in response.get("steps", []):
        if step.get("type") != "model_output":
            continue
        for content in step.get("content", []):
            if (
                content.get("type") == "video"
                and content.get("mime_type") == "video/mp4"
                and content.get("data")
            ):
                try:
                    video_bytes = base64.b64decode(
                        content["data"],
                        validate=True,
                    )
                except (ValueError, TypeError) as error:
                    raise VideoGenerationError(
                        "scene_generation",
                        "Gemini returned invalid video data.",
                    ) from error
                if not video_bytes or len(video_bytes) > MAX_GENERATED_VIDEO_BYTES:
                    raise VideoGenerationError(
                        "scene_generation",
                        "The generated video exceeded the supported output size.",
                    )
                return video_bytes
    raise VideoGenerationError(
        "scene_generation",
        "Gemini completed without returning an MP4 scene.",
    )


def _reference_images(
    media: List[ContentMedia],
) -> List[Dict[str, str]]:
    references = media[:MAX_REFERENCE_IMAGES]
    reference_payloads = []
    inputs: List[Dict[str, str]] = []
    ffmpeg = shutil.which(settings.ffmpeg_binary)
    for asset in references:
        image_path = get_media_path(asset.storage_key)
        if not image_path.is_file():
            raise VideoGenerationError(
                "media_analysis",
                "A selected reference file is missing from private storage.",
            )

        if asset.media_type == "photo":
            image_bytes = image_path.read_bytes()
            mime_type = asset.content_type
        else:
            if ffmpeg is None:
                raise VideoGenerationError(
                    "media_analysis",
                    "FFmpeg is required to sample video clips for Gemini analysis.",
                )
            image_bytes = _extract_video_frame(ffmpeg, image_path)
            mime_type = "image/jpeg"

        reference_payloads.append((asset, image_bytes, mime_type))

    if sum(len(item[1]) for item in reference_payloads) > MAX_REFERENCE_BYTES:
        raise VideoGenerationError(
            "media_analysis",
            "The first six photo/video references exceed the combined 20 MB limit.",
        )

    for index, (asset, image_bytes, mime_type) in enumerate(
        reference_payloads,
        start=1,
    ):
        inputs.append(
            {
                "type": "text",
                "text": "Reference {}: {} ({}, {}).".format(
                    index,
                    asset.original_filename,
                    asset.media_role,
                    "sampled video frame" if asset.media_type == "video" else "photo",
                ),
            }
        )
        inputs.append(
            {
                "type": "image",
                "data": base64.b64encode(image_bytes).decode("ascii"),
                "mime_type": mime_type,
            }
        )
    return inputs


def _extract_video_frame(ffmpeg: str, video_path: Path) -> bytes:
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-vf",
        "scale=1024:1024:force_original_aspect_ratio=decrease",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
    ]
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired as error:
        raise VideoGenerationError(
            "media_analysis",
            "FFmpeg timed out while sampling a video clip.",
        ) from error
    except subprocess.CalledProcessError as error:
        logger.error(
            "FFmpeg could not sample a video frame: %s",
            error.stderr.decode("utf-8", errors="replace")[-2000:],
        )
        raise VideoGenerationError(
            "media_analysis",
            "FFmpeg could not sample a selected video clip.",
        ) from error

    if not result.stdout:
        raise VideoGenerationError(
            "media_analysis",
            "FFmpeg did not find a readable frame in a selected video clip.",
        )
    return result.stdout


def _analyze_media(
    project: VideoProject,
    media: List[ContentMedia],
    image_inputs: List[Dict[str, str]],
) -> str:
    media_inventory = [
        {
            "id": asset.id,
            "filename": asset.original_filename,
            "role": asset.media_role,
            "kind": asset.media_type,
        }
        for asset in media
    ]
    instruction = (
        "Analyze the supplied photo references and sampled video frames for "
        "visible subjects, setting, colors, and useful visual continuity. "
        "Full video files stay local and will be used during editing. "
        "User brief: {}\n"
        "Business ID: {}\nMedia inventory: {}\n"
        "Return concise factual visual notes. Do not identify people or infer "
        "sensitive traits."
    ).format(
        project.prompt,
        project.business_id,
        json.dumps(media_inventory),
    )
    payload = {
        "model": settings.gemini_storyboard_model,
        "input": image_inputs + [{"type": "text", "text": instruction}],
        "store": False,
    }
    response = _gemini_interaction(payload, "media analysis")
    return _model_text(response, "media_analysis")


def _generate_storyboard(
    project: VideoProject,
    media: List[ContentMedia],
    media_analysis: str,
) -> VideoStoryboard:
    requested_scene_count = 1 if project.duration_seconds == 15 else 2
    media_inventory = [
        {
            "id": asset.id,
            "filename": asset.original_filename,
            "role": asset.media_role,
            "kind": asset.media_type,
        }
        for asset in media
    ]
    instruction = (
        "Create a concise marketing-video storyboard as JSON. User brief: {}\n"
        "Aspect ratio: {}\nFinal duration: {} seconds.\n"
        "Media analysis: {}\nMedia inventory: {}\n"
        "Return exactly {} generated-scene descriptions. Each scene is "
        "rendered separately; uploaded non-face-reference media will be "
        "inserted as cutaways during final assembly. Keep scenes visually "
        "coherent with the reference analysis. Do not invent claims, text "
        "overlays, brands, or people not requested. Match the JSON schema."
    ).format(
        project.prompt,
        project.aspect_ratio,
        project.duration_seconds,
        media_analysis,
        json.dumps(media_inventory),
        requested_scene_count,
    )
    payload = {
        "model": settings.gemini_storyboard_model,
        "input": [{"type": "text", "text": instruction}],
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": VideoStoryboard.model_json_schema(),
        },
        "store": False,
    }
    response = _gemini_interaction(payload, "storyboarding")
    try:
        storyboard = VideoStoryboard.model_validate_json(
            _model_text(response, "storyboarding")
        )
    except VideoGenerationError:
        raise
    except Exception as error:
        logger.exception("Gemini returned an invalid storyboard.")
        raise VideoGenerationError(
            "storyboarding",
            "Gemini returned a storyboard that did not match the required format.",
        ) from error
    if len(storyboard.scenes) != requested_scene_count:
        raise VideoGenerationError(
            "storyboarding",
            "Gemini returned an unexpected number of scenes.",
        )
    return storyboard


def _scene_durations(
    project: VideoProject,
    media: List[ContentMedia],
) -> List[int]:
    scene_count = 1 if project.duration_seconds == 15 else 2
    source_assets = [
        asset for asset in media if asset.media_role != "face_reference"
    ]
    if not source_assets:
        return [15] * scene_count
    if scene_count == 1:
        return [7]
    return [8, 7]


def _generate_scene(
    project: VideoProject,
    scene: StoryboardScene,
    scene_index: int,
    duration_seconds: int,
    image_inputs: List[Dict[str, str]],
) -> bytes:
    prompt = (
        "Create a polished marketing video scene. Overall brief: {}\n"
        "Scene {} of {}. Visual description: {}\nCamera movement: {}\n"
        "Use the supplied reference images for visual continuity. Do not add "
        "unrequested text or logos."
    ).format(
        project.prompt,
        scene_index + 1,
        1 if project.duration_seconds == 15 else 2,
        scene.description,
        scene.camera_movement,
    )
    model_aspect_ratio = (
        "9:16" if project.aspect_ratio == "9:16" else "16:9"
    )
    payload = {
        "model": settings.gemini_video_model,
        "input": image_inputs + [{"type": "text", "text": prompt}],
        "response_format": {
            "type": "video",
            "duration": "{}s".format(duration_seconds),
            "aspect_ratio": model_aspect_ratio,
        },
        "store": False,
    }
    return _model_video(_gemini_interaction(payload, "video scene generation"))


def _dimensions(aspect_ratio: str) -> tuple:
    if aspect_ratio == "9:16":
        return 720, 1280
    if aspect_ratio == "1:1":
        return 720, 720
    return 1280, 720


def _normalize_segment(
    ffmpeg: str,
    source_path: Path,
    destination_path: Path,
    duration_seconds: float,
    width: int,
    height: int,
    is_photo: bool,
) -> None:
    filter_graph = (
        "scale={}:{}:force_original_aspect_ratio=increase,"
        "crop={}:{},setsar=1,fps=30,format=yuv420p"
    ).format(width, height, width, height)
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    if is_photo:
        command.extend(["-loop", "1", "-framerate", "30"])
    else:
        command.extend(["-stream_loop", "-1"])
    command.extend(
        [
            "-i",
            str(source_path),
            "-t",
            "{:.3f}".format(duration_seconds),
            "-vf",
            filter_graph,
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-movflags",
            "+faststart",
            str(destination_path),
        ]
    )
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired as error:
        raise VideoGenerationError(
            "assembly",
            "FFmpeg timed out while preparing a scene.",
        ) from error
    except subprocess.CalledProcessError as error:
        logger.error("FFmpeg failed: %s", error.stderr[-4000:])
        raise VideoGenerationError(
            "assembly",
            "FFmpeg could not prepare one of the source scenes.",
        ) from error


def _assemble_video(
    job_id: str,
    project: VideoProject,
    media: List[ContentMedia],
    generated_paths: List[Path],
) -> str:
    ffmpeg = shutil.which(settings.ffmpeg_binary)
    if ffmpeg is None:
        raise VideoGenerationError(
            "assembly",
            "FFmpeg was not found. Install FFmpeg and add it to PATH.",
        )

    root = get_media_storage_root()
    work_dir = root / "work" / job_id
    work_dir.mkdir(parents=True, exist_ok=True)
    width, height = _dimensions(project.aspect_ratio)
    scene_count = len(generated_paths)
    source_assets = [
        asset for asset in media if asset.media_role != "face_reference"
    ]
    if not source_assets:
        generated_durations = [project.duration_seconds // scene_count] * scene_count
        generated_durations[-1] += (
            project.duration_seconds - sum(generated_durations)
        )
        source_durations: List[float] = []
    elif scene_count == 1:
        generated_durations = [7]
        source_durations = [
            8 / len(source_assets) for _ in source_assets
        ]
    else:
        generated_durations = [8, 7]
        source_durations = [
            15 / len(source_assets) for _ in source_assets
        ]

    normalized_paths: List[Path] = []
    segment_index = 0
    for generated_path, duration in zip(generated_paths, generated_durations):
        normalized = work_dir / "segment-{:03d}.mp4".format(segment_index)
        _normalize_segment(
            ffmpeg,
            generated_path,
            normalized,
            duration,
            width,
            height,
            False,
        )
        normalized_paths.append(normalized)
        segment_index += 1

    for asset, duration in zip(source_assets, source_durations):
        source_path = get_media_path(asset.storage_key)
        if not source_path.is_file():
            raise VideoGenerationError(
                "assembly",
                "A selected source file is missing from private storage.",
            )
        normalized = work_dir / "segment-{:03d}.mp4".format(segment_index)
        _normalize_segment(
            ffmpeg,
            source_path,
            normalized,
            duration,
            width,
            height,
            asset.media_type == "photo",
        )
        normalized_paths.append(normalized)
        segment_index += 1

    concat_file = work_dir / "concat.txt"
    concat_file.write_text(
        "".join(
            "file '{}'\n".format(path.name)
            for path in normalized_paths
        ),
        encoding="utf-8",
    )
    output_directory = root / "generated" / job_id
    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / "final.mp4"
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-t",
        str(project.duration_seconds),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=str(work_dir),
        )
    except subprocess.TimeoutExpired as error:
        raise VideoGenerationError(
            "assembly",
            "FFmpeg timed out while assembling the final video.",
        ) from error
    except subprocess.CalledProcessError as error:
        logger.error("FFmpeg concat failed: %s", error.stderr[-4000:])
        raise VideoGenerationError(
            "assembly",
            "FFmpeg could not assemble the final video.",
        ) from error
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    return "generated/{}/final.mp4".format(job_id)


def process_video_generation(job_id: str) -> None:
    generated_directory = get_media_storage_root() / "generated" / job_id
    try:
        with SessionLocal() as db:
            job = db.get(VideoGenerationJob, job_id)
            if job is None:
                raise RuntimeError("Video generation job no longer exists.")
            project = db.get(VideoProject, job.project_id)
            if project is None:
                raise VideoGenerationError(
                    "validation",
                    "The saved video project no longer exists.",
                )
            media_by_id = {
                asset.id: asset
                for asset in db.query(ContentMedia)
                .filter(
                    ContentMedia.workspace_id == job.workspace_id,
                    ContentMedia.business_id == project.business_id,
                    ContentMedia.id.in_(project.media_ids),
                )
                .all()
            }
            if len(media_by_id) != len(project.media_ids):
                raise VideoGenerationError(
                    "validation",
                    "One or more selected source files are unavailable.",
                )
            media = [media_by_id[media_id] for media_id in project.media_ids]
            project_data = project
            media_data = media
            requested_by = job.requested_by_user_id

        _update_job(
            job_id,
            status="processing",
            stage="media_analysis",
            progress=10,
        )
        image_inputs = _reference_images(media_data)
        media_analysis = _analyze_media(
            project_data,
            media_data,
            image_inputs,
        )
        _update_job(
            job_id,
            stage="storyboarding",
            progress=18,
        )
        storyboard = _generate_storyboard(
            project_data,
            media_data,
            media_analysis,
        )
        storyboard_data = storyboard.model_dump()
        _update_job(
            job_id,
            stage="storyboarding",
            progress=25,
            storyboard=storyboard_data,
        )

        generated_directory.mkdir(parents=True, exist_ok=True)
        durations = _scene_durations(project_data, media_data)
        generated_paths: List[Path] = []
        generated_keys: List[str] = []
        total_scenes = len(storyboard.scenes)
        for index, (scene, duration) in enumerate(
            zip(storyboard.scenes, durations)
        ):
            _update_job(
                job_id,
                stage="scene_generation",
                progress=30 + int(index * 35 / total_scenes),
            )
            clip_bytes = _generate_scene(
                project_data,
                scene,
                index,
                duration,
                image_inputs,
            )
            clip_path = generated_directory / "scene-{}.mp4".format(index + 1)
            clip_path.write_bytes(clip_bytes)
            generated_paths.append(clip_path)
            generated_keys.append(
                "generated/{}/scene-{}.mp4".format(job_id, index + 1)
            )
            _update_job(
                job_id,
                generated_clip_keys=generated_keys,
                progress=30 + int((index + 1) * 35 / total_scenes),
            )

        _update_job(job_id, stage="assembly", progress=75)
        output_key = _assemble_video(
            job_id,
            project_data,
            media_data,
            generated_paths,
        )
        _update_job(
            job_id,
            status="completed",
            stage="completed",
            progress=100,
            output_storage_key=output_key,
            error_message=None,
        )
        logger.info(
            "Completed video generation job %s requested by user %s.",
            job_id,
            requested_by,
        )
    except VideoGenerationError as error:
        logger.exception("Video generation job %s failed at %s.", job_id, error.stage)
        shutil.rmtree(generated_directory, ignore_errors=True)
        shutil.rmtree(
            get_media_storage_root() / "work" / job_id,
            ignore_errors=True,
        )
        _update_job(
            job_id,
            status="failed",
            stage=error.stage,
            error_message=error.public_message,
        )
    except Exception:
        logger.exception("Unexpected video generation failure for job %s.", job_id)
        shutil.rmtree(generated_directory, ignore_errors=True)
        shutil.rmtree(
            get_media_storage_root() / "work" / job_id,
            ignore_errors=True,
        )
        _update_job(
            job_id,
            status="failed",
            stage="failed",
            error_message="Video generation failed unexpectedly. Check the backend logs.",
        )
