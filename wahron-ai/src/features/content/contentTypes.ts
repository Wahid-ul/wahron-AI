export type ContentTone =
  | 'friendly'
  | 'playful'
  | 'professional'
  | 'inspiring'

export type ContentDraftStatus = 'draft' | 'archived'

export interface CaptionVariant {
  label: string
  caption: string
  hashtags: string[]
}

export interface GenerateCaptionsRequest {
  business_id: string
  topic: string
  audience?: string
  tone: ContentTone
  call_to_action?: string
}

export interface GenerateCaptionsResponse {
  business_id: string
  topic: string
  variants: CaptionVariant[]
}

export interface ContentDraft {
  id: string
  workspace_id: string
  platform: 'instagram'
  title: string
  business_id: string
  topic: string
  audience: string | null
  tone: ContentTone
  call_to_action: string | null
  caption: string
  hashtags: string[]
  status: ContentDraftStatus
}

export interface SaveContentDraftRequest extends GenerateCaptionsRequest {
  caption: string
  hashtags: string[]
}

export type ContentMediaRole =
  | 'content_photo'
  | 'face_reference'
  | 'video_clip'

export interface ContentMedia {
  id: string
  workspace_id: string
  business_id: string
  original_filename: string
  media_type: 'photo' | 'video'
  media_role: ContentMediaRole
  content_type: string
  size_bytes: number
  file_url: string
}

export type VideoAspectRatio = '9:16' | '1:1' | '16:9'

export interface VideoProject {
  id: string
  workspace_id: string
  business_id: string
  title: string
  prompt: string
  aspect_ratio: VideoAspectRatio
  duration_seconds: 15 | 30
  media_ids: string[]
  status: 'draft'
}

export type VideoGenerationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export interface VideoGenerationJob {
  id: string
  project_id: string
  workspace_id: string
  status: VideoGenerationStatus
  stage: string
  progress: number
  storyboard: {
    media_analysis: string
    scenes: Array<{
      description: string
      camera_movement: string
    }>
  } | null
  output_url: string | null
  error_message: string | null
}

export interface SaveVideoProjectRequest {
  business_id: string
  title: string
  prompt: string
  aspect_ratio: VideoAspectRatio
  duration_seconds: 15 | 30
  media_ids: string[]
}

export interface StartVideoGenerationRequest {
  face_reference_consent: boolean
}
