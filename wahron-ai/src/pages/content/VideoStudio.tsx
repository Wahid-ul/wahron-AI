import { useEffect, useState, type ChangeEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowDown,
  ArrowUp,
  Download,
  Film,
  ImagePlus,
  Save,
  Sparkles,
  X,
} from 'lucide-react'

import { useAppSelector } from '../../app/hooks'
import { useGetBusinessesQuery } from '../../features/business/businessApi'
import {
  useGetContentMediaQuery,
  useGetVideoGenerationJobsQuery,
  useGetVideoProjectsQuery,
  useSaveVideoProjectMutation,
  useStartVideoGenerationMutation,
  useUploadContentMediaMutation,
} from '../../features/content/contentApi'
import type {
  ContentMedia,
  ContentMediaRole,
  VideoAspectRatio,
  VideoProject,
} from '../../features/content/contentTypes'

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
).replace(/\/$/, '')

const mediaRoleLabels: Record<ContentMediaRole, string> = {
  content_photo: 'Content photo',
  face_reference: 'Face/reference photo',
  video_clip: 'Video clip',
}

const mediaRoleOptions: ContentMediaRole[] = [
  'content_photo',
  'face_reference',
  'video_clip',
]

function formatFileSize(sizeBytes: number) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function VideoStudio() {
  const workspace = useAppSelector(
    (state) => state.workspace.currentWorkspace,
  )
  const [businessId, setBusinessId] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('9:16')
  const [durationSeconds, setDurationSeconds] = useState<15 | 30>(15)
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [faceReferenceConsent, setFaceReferenceConsent] = useState(false)
  const [generationError, setGenerationError] = useState('')

  const {
    data: businesses,
    isError: businessesError,
    isLoading: businessesLoading,
  } = useGetBusinessesQuery(workspace?.id ?? '', {
    skip: !workspace,
  })

  const selectedBusinessId = businessId || businesses?.[0]?.id || ''
  const queryArgs = {
    workspaceId: workspace?.id ?? '',
    businessId: selectedBusinessId,
  }
  const {
    data: media,
    isError: mediaError,
    isLoading: mediaLoading,
  } = useGetContentMediaQuery(queryArgs, {
    skip: !workspace || !selectedBusinessId,
  })
  const {
    data: projects,
    isError: projectsError,
    isLoading: projectsLoading,
  } = useGetVideoProjectsQuery(queryArgs, {
    skip: !workspace || !selectedBusinessId,
  })
  const {
    data: jobs,
    isError: jobsError,
  } = useGetVideoGenerationJobsQuery(queryArgs, {
    skip: !workspace || !selectedBusinessId,
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  })
  const [uploadContentMedia, uploadState] = useUploadContentMediaMutation()
  const [saveVideoProject, saveState] = useSaveVideoProjectMutation()
  const [startVideoGeneration, generationState] =
    useStartVideoGenerationMutation()

  useEffect(() => {
    setSelectedMediaIds([])
  }, [selectedBusinessId])

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    mediaRole: ContentMediaRole,
  ) => {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!workspace || !selectedBusinessId || files.length === 0) return

    setUploadError('')
    setNotice('')
    if (files.length + selectedMediaIds.length > 12) {
      setUploadError('A video brief can include up to 12 selected media files.')
      return
    }

    const maxBytes =
      mediaRole === 'video_clip' ? 100 * 1024 * 1024 : 15 * 1024 * 1024
    const invalidFile = files.find((file) => {
      const expectedType =
        mediaRole === 'video_clip' ? 'video/' : 'image/'
      return (
        !file.type.startsWith(expectedType) ||
        file.size > maxBytes ||
        file.size === 0
      )
    })
    if (invalidFile) {
      setUploadError(
        `${invalidFile.name} is empty, the wrong media type, or exceeds the ${mediaRole === 'video_clip' ? '100 MB' : '15 MB'} limit.`,
      )
      return
    }

    try {
      for (const file of files) {
        const uploaded = await uploadContentMedia({
          workspaceId: workspace.id,
          businessId: selectedBusinessId,
          mediaRole,
          file,
        }).unwrap()
        setSelectedMediaIds((current) =>
          current.includes(uploaded.id) ? current : [...current, uploaded.id],
        )
      }
      setNotice('Media uploaded and added to this video brief.')
    } catch {
      setUploadError(
        'Some files could not be uploaded. Any completed uploads remain in the media library.',
      )
    }
  }

  const handleSaveProject = async () => {
    if (!workspace || !selectedBusinessId || selectedMediaIds.length === 0) {
      return
    }
    setNotice('')
    try {
      await saveVideoProject({
        workspaceId: workspace.id,
        body: {
          business_id: selectedBusinessId,
          title: title.trim(),
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
          duration_seconds: durationSeconds,
          media_ids: selectedMediaIds,
        },
      }).unwrap()
      setNotice('Video brief saved. Generate it from the saved briefs below.')
      setTitle('')
      setPrompt('')
      setSelectedMediaIds([])
    } catch {
      setNotice('')
    }
  }

  const handleGenerateVideo = async (project: VideoProject) => {
    if (!workspace) return
    setGenerationError('')
    try {
      await startVideoGeneration({
        workspaceId: workspace.id,
        projectId: project.id,
        body: { face_reference_consent: faceReferenceConsent },
      }).unwrap()
    } catch {
      setGenerationError(
        'Could not queue video generation. Check that the backend has GEMINI_API_KEY and FFmpeg configured, and that face-reference permission is confirmed when needed.',
      )
    }
  }

  const toggleMedia = (assetId: string) => {
    setSelectedMediaIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : current.length < 12
          ? [...current, assetId]
          : current,
    )
  }

  const moveMedia = (assetId: string, direction: -1 | 1) => {
    setSelectedMediaIds((current) => {
      const currentIndex = current.indexOf(assetId)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const reordered = [...current]
      ;[reordered[currentIndex], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[currentIndex],
      ]
      return reordered
    })
  }

  const loadProject = (project: VideoProject) => {
    setTitle(project.title)
    setPrompt(project.prompt)
    setAspectRatio(project.aspect_ratio)
    setDurationSeconds(project.duration_seconds)
    setSelectedMediaIds(project.media_ids)
    setNotice('Brief loaded as a starting point. Saving creates a new brief.')
  }

  if (!workspace || businessesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (businessesError || !businesses) {
    return <Alert severity="error">Business profiles could not be loaded.</Alert>
  }

  if (businesses.length === 0) {
    return (
      <Alert severity="info">
        Create a business profile before preparing a video brief.
      </Alert>
    )
  }

  const mediaById = new Map((media ?? []).map((asset) => [asset.id, asset]))
  const selectedMedia = selectedMediaIds
    .map((id) => mediaById.get(id))
    .filter((asset): asset is ContentMedia => asset !== undefined)

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Video Studio
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Collect content photos, face/reference photos, and video clips, then
          save an ordered prompt brief for video generation.
        </Typography>
      </Box>

      {notice && (
        <Alert severity="success" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {uploadError && (
        <Alert severity="error" onClose={() => setUploadError('')}>
          {uploadError}
        </Alert>
      )}
      {previewError && <Alert severity="warning">{previewError}</Alert>}

      <Alert severity="warning">
        Only upload face/reference photos when you have permission from the
        people shown. Files are stored privately for this workspace. Saving a
        brief does not generate a video; generation sends up to six selected
        image references (photos and sampled video frames) to Gemini and may
        incur API charges. Full video files stay local for FFmpeg assembly.
        This first output has no audio track.
      </Alert>
      {generationError && (
        <Alert severity="error" onClose={() => setGenerationError('')}>
          {generationError}
        </Alert>
      )}
      <FormControlLabel
        control={
          <Checkbox
            checked={faceReferenceConsent}
            onChange={(event) =>
              setFaceReferenceConsent(event.target.checked)
            }
          />
        }
        label="I have permission from the people shown to use any face/reference photos in generated content."
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Video brief
            </Typography>
            <TextField
              select
              label="Business"
              value={selectedBusinessId}
              onChange={(event) => setBusinessId(event.target.value)}
            >
              {businesses.map((business) => (
                <MenuItem key={business.id} value={business.id}>
                  {business.name} · {business.industry}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Brief title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 150 } }}
            />
            <TextField
              label="Describe the video you want"
              placeholder="Describe the story, scene order, mood, camera movement, and how the photos and clips should be used."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              required
              multiline
              minRows={4}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label="Aspect ratio"
                value={aspectRatio}
                onChange={(event) =>
                  setAspectRatio(event.target.value as VideoAspectRatio)
                }
              >
                <MenuItem value="9:16">9:16 · Vertical</MenuItem>
                <MenuItem value="1:1">1:1 · Square</MenuItem>
                <MenuItem value="16:9">16:9 · Landscape</MenuItem>
              </TextField>
              <TextField
                select
                fullWidth
                label="Target duration"
                value={durationSeconds}
                onChange={(event) =>
                  setDurationSeconds(Number(event.target.value) as 15 | 30)
                }
              >
                <MenuItem value={15}>15 seconds</MenuItem>
                <MenuItem value={30}>30 seconds</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Add source media
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Photos: JPEG, PNG, or WebP up to 15 MB each. Clips: MP4, WebM, or
              MOV up to 100 MB each.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {mediaRoleOptions.map((role) => (
                <Button
                  key={role}
                  component="label"
                  variant="outlined"
                  startIcon={
                    role === 'video_clip' ? (
                      <Film size={18} />
                    ) : (
                      <ImagePlus size={18} />
                    )
                  }
                  disabled={uploadState.isLoading}
                >
                  {role === 'content_photo'
                    ? 'Upload content photos'
                    : role === 'face_reference'
                      ? 'Upload face/reference photos'
                      : 'Upload video clips'}
                  <input
                    hidden
                    type="file"
                    multiple
                    accept={
                      role === 'video_clip'
                        ? 'video/mp4,video/webm,video/quicktime'
                        : 'image/jpeg,image/png,image/webp'
                    }
                    onChange={(event) => void handleUpload(event, role)}
                  />
                </Button>
              ))}
            </Stack>
            {uploadState.isLoading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2">Uploading media…</Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          Media library
        </Typography>
        {mediaLoading && <CircularProgress size={24} />}
        {mediaError && (
          <Alert severity="error">Media library could not be loaded.</Alert>
        )}
        {!mediaLoading && !mediaError && media?.length === 0 && (
          <Typography color="text.secondary">
            Uploaded source files will appear here.
          </Typography>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
            mt: 1,
          }}
        >
          {media?.map((asset) => {
            const isSelected = selectedMediaIds.includes(asset.id)
            return (
              <Card key={asset.id} variant="outlined">
                {asset.media_type === 'photo' ? (
                  <Box
                    component="img"
                    src={`${apiBaseUrl}${asset.file_url}`}
                    crossOrigin="use-credentials"
                    alt={asset.original_filename}
                    onError={() =>
                      setPreviewError(
                        'Some media previews could not be loaded. Try refreshing the library.',
                      )
                    }
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 180,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box
                    component="video"
                    src={`${apiBaseUrl}${asset.file_url}`}
                    crossOrigin="use-credentials"
                    controls
                    preload="metadata"
                    onError={() =>
                      setPreviewError(
                        'Some media previews could not be loaded. Try refreshing the library.',
                      )
                    }
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 180,
                      objectFit: 'cover',
                    }}
                  />
                )}
                <CardContent>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                  >
                    {asset.original_filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {mediaRoleLabels[asset.media_role]} ·{' '}
                    {formatFileSize(asset.size_bytes)}
                  </Typography>
                  <Button
                    fullWidth
                    sx={{ mt: 1 }}
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => toggleMedia(asset.id)}
                    disabled={
                      !isSelected && selectedMediaIds.length >= 12
                    }
                  >
                    {isSelected ? 'Selected · Remove from brief' : 'Add to brief'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Selected media order ({selectedMediaIds.length}/12)
            </Typography>
            {selectedMedia.length === 0 && (
              <Typography color="text.secondary">
                Select photos and/or clips from the media library. Use the
                arrows to change their order in the brief.
              </Typography>
            )}
            {selectedMedia.map((asset, index) => (
              <Stack
                key={asset.id}
                direction="row"
                alignItems="center"
                spacing={1}
              >
                <Typography sx={{ flex: 1, overflowWrap: 'anywhere' }}>
                  {index + 1}. {asset.original_filename}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    {' '}
                    · {mediaRoleLabels[asset.media_role]}
                  </Typography>
                </Typography>
                <IconButton
                  aria-label="Move media up"
                  disabled={index === 0}
                  onClick={() => moveMedia(asset.id, -1)}
                >
                  <ArrowUp size={18} />
                </IconButton>
                <IconButton
                  aria-label="Move media down"
                  disabled={index === selectedMedia.length - 1}
                  onClick={() => moveMedia(asset.id, 1)}
                >
                  <ArrowDown size={18} />
                </IconButton>
                <IconButton
                  aria-label="Remove media from brief"
                  onClick={() => toggleMedia(asset.id)}
                >
                  <X size={18} />
                </IconButton>
              </Stack>
            ))}
            <Button
              variant="contained"
              startIcon={
                saveState.isLoading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <Save size={18} />
                )
              }
              onClick={() => void handleSaveProject()}
              disabled={
                saveState.isLoading ||
                title.trim().length < 2 ||
                prompt.trim().length < 5 ||
                selectedMediaIds.length === 0
              }
            >
              Save video brief
            </Button>
            {saveState.isError && (
              <Alert severity="error">
                Could not save the brief. Check the selected business and media,
                then try again.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          Saved video briefs
        </Typography>
        {projectsLoading && <CircularProgress size={24} />}
        {projectsError && (
          <Alert severity="error">Saved briefs could not be loaded.</Alert>
        )}
        {!projectsLoading && !projectsError && projects?.length === 0 && (
          <Typography color="text.secondary">
            Saved briefs for this business will appear here.
          </Typography>
        )}
        {jobsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Video generation status could not be loaded.
          </Alert>
        )}
        <Stack spacing={1}>
          {projects?.map((project) => {
            const job = jobs?.find((item) => item.project_id === project.id)
            const isRunning =
              job?.status === 'queued' || job?.status === 'processing'

            return (
              <Card key={project.id} variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {project.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {project.duration_seconds}s · {project.aspect_ratio} ·{' '}
                          {project.media_ids.length} source files · Draft
                        </Typography>
                      </Box>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                      >
                        <Button
                          variant="outlined"
                          startIcon={<Save size={18} />}
                          onClick={() => loadProject(project)}
                        >
                          Use as starting point
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={
                            generationState.isLoading || isRunning ? (
                              <CircularProgress size={18} color="inherit" />
                            ) : (
                              <Sparkles size={18} />
                            )
                          }
                          disabled={generationState.isLoading || isRunning}
                          onClick={() => void handleGenerateVideo(project)}
                        >
                          {isRunning ? 'Generating…' : 'Generate video'}
                        </Button>
                      </Stack>
                    </Stack>
                    {job && (
                      <Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mb: 1 }}
                        >
                          <Chip
                            size="small"
                            color={
                              job.status === 'failed'
                                ? 'error'
                                : job.status === 'completed'
                                  ? 'success'
                                  : 'primary'
                            }
                            label={
                              job.status === 'processing'
                                ? job.stage.replaceAll('_', ' ')
                                : job.status
                            }
                          />
                          {isRunning && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {job.progress}%
                            </Typography>
                          )}
                        </Stack>
                        {isRunning && (
                          <LinearProgress
                            variant="determinate"
                            value={job.progress}
                          />
                        )}
                        {job.error_message && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            {job.error_message}
                          </Alert>
                        )}
                        {job.storyboard && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2">
                              Storyboard
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {job.storyboard.media_analysis}
                            </Typography>
                            {job.storyboard.scenes.map((scene, index) => (
                              <Typography
                                key={`${job.id}-${index}`}
                                variant="body2"
                                sx={{ mt: 0.5 }}
                              >
                                Scene {index + 1}: {scene.description} ·{' '}
                                {scene.camera_movement}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        {job.status === 'completed' && job.output_url && (
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            <Box
                              component="video"
                              src={`${apiBaseUrl}${job.output_url}`}
                              crossOrigin="use-credentials"
                              controls
                              sx={{
                                width: '100%',
                                maxHeight: 480,
                                bgcolor: 'black',
                              }}
                            />
                            <Button
                              component="a"
                              href={`${apiBaseUrl}${job.output_url}`}
                              download
                              startIcon={<Download size={18} />}
                              sx={{ alignSelf: 'flex-start' }}
                            >
                              Download MP4
                            </Button>
                          </Stack>
                        )}
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      </Box>
    </Stack>
  )
}
