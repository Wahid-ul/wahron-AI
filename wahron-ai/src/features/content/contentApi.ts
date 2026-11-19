import { baseApi } from '../../services/baseApi'

import type {
  ContentDraft,
  ContentMedia,
  GenerateCaptionsRequest,
  GenerateCaptionsResponse,
  SaveContentDraftRequest,
  StartVideoGenerationRequest,
  SaveVideoProjectRequest,
  VideoGenerationJob,
  VideoProject,
} from './contentTypes'

interface ContentDraftListResponse {
  drafts: ContentDraft[]
}

interface DraftListQuery {
  workspaceId: string
  businessId: string
}

interface UpdateDraftRequest {
  caption?: string
  status?: 'draft' | 'archived'
}

interface MediaListQuery {
  workspaceId: string
  businessId: string
}

interface ContentMediaListResponse {
  media: ContentMedia[]
}

interface VideoProjectListResponse {
  projects: VideoProject[]
}

interface VideoGenerationJobListResponse {
  jobs: VideoGenerationJob[]
}

export const contentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateCaptions: builder.mutation<
      GenerateCaptionsResponse,
      { workspaceId: string; body: GenerateCaptionsRequest }
    >({
      query: ({ workspaceId, body }) => ({
        url: `/workspaces/${workspaceId}/content/generate`,
        method: 'POST',
        body,
      }),
    }),

    getContentDrafts: builder.query<ContentDraft[], DraftListQuery>({
      query: ({ workspaceId, businessId }) => ({
        url: `/workspaces/${workspaceId}/content/drafts`,
        params: { business_id: businessId },
      }),
      transformResponse: (response: ContentDraftListResponse) =>
        response.drafts,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Content' as const, id })),
              { type: 'Content', id: 'LIST' },
            ]
          : [{ type: 'Content', id: 'LIST' }],
    }),

    saveContentDraft: builder.mutation<
      ContentDraft,
      { workspaceId: string; body: SaveContentDraftRequest }
    >({
      query: ({ workspaceId, body }) => ({
        url: `/workspaces/${workspaceId}/content/drafts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Content', id: 'LIST' }],
    }),

    updateContentDraft: builder.mutation<
      ContentDraft,
      { draftId: string; body: UpdateDraftRequest }
    >({
      query: ({ draftId, body }) => ({
        url: `/content/drafts/${draftId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { draftId }) => [
        { type: 'Content', id: draftId },
        { type: 'Content', id: 'LIST' },
      ],
    }),

    getContentMedia: builder.query<ContentMedia[], MediaListQuery>({
      query: ({ workspaceId, businessId }) => ({
        url: `/workspaces/${workspaceId}/media`,
        params: { business_id: businessId },
      }),
      transformResponse: (response: ContentMediaListResponse) =>
        response.media,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: 'ContentMedia' as const,
                id,
              })),
              { type: 'ContentMedia', id: 'LIST' },
            ]
          : [{ type: 'ContentMedia', id: 'LIST' }],
    }),

    uploadContentMedia: builder.mutation<
      ContentMedia,
      {
        workspaceId: string
        businessId: string
        mediaRole: ContentMedia['media_role']
        file: File
      }
    >({
      query: ({ workspaceId, businessId, mediaRole, file }) => {
        const body = new FormData()
        body.append('business_id', businessId)
        body.append('media_role', mediaRole)
        body.append('file', file)
        return {
          url: `/workspaces/${workspaceId}/media`,
          method: 'POST',
          body,
        }
      },
      invalidatesTags: [{ type: 'ContentMedia', id: 'LIST' }],
    }),

    deleteContentMedia: builder.mutation<
      void,
      { workspaceId: string; mediaId: string }
    >({
      query: ({ workspaceId, mediaId }) => ({
        url: `/workspaces/${workspaceId}/media/${mediaId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'ContentMedia', id: 'LIST' }],
    }),

    getVideoProjects: builder.query<VideoProject[], MediaListQuery>({
      query: ({ workspaceId, businessId }) => ({
        url: `/workspaces/${workspaceId}/video-projects`,
        params: { business_id: businessId },
      }),
      transformResponse: (response: VideoProjectListResponse) =>
        response.projects,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Content' as const, id })),
              { type: 'Content', id: 'VIDEO_PROJECTS' },
            ]
          : [{ type: 'Content', id: 'VIDEO_PROJECTS' }],
    }),

    saveVideoProject: builder.mutation<
      VideoProject,
      { workspaceId: string; body: SaveVideoProjectRequest }
    >({
      query: ({ workspaceId, body }) => ({
        url: `/workspaces/${workspaceId}/video-projects`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Content', id: 'VIDEO_PROJECTS' }],
    }),

    startVideoGeneration: builder.mutation<
      VideoGenerationJob,
      {
        workspaceId: string
        projectId: string
        body: StartVideoGenerationRequest
      }
    >({
      query: ({ workspaceId, projectId, body }) => ({
        url: `/workspaces/${workspaceId}/video-projects/${projectId}/generate`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Content', id: 'VIDEO_JOBS' }],
    }),

    getVideoGenerationJobs: builder.query<VideoGenerationJob[], MediaListQuery>(
      {
        query: ({ workspaceId, businessId }) => ({
          url: `/workspaces/${workspaceId}/video-jobs`,
          params: { business_id: businessId },
        }),
        transformResponse: (response: VideoGenerationJobListResponse) =>
          response.jobs,
        providesTags: [{ type: 'Content', id: 'VIDEO_JOBS' }],
      },
    ),
  }),
})

export const {
  useGenerateCaptionsMutation,
  useGetContentDraftsQuery,
  useSaveContentDraftMutation,
  useUpdateContentDraftMutation,
  useGetContentMediaQuery,
  useUploadContentMediaMutation,
  useDeleteContentMediaMutation,
  useGetVideoProjectsQuery,
  useSaveVideoProjectMutation,
  useStartVideoGenerationMutation,
  useGetVideoGenerationJobsQuery,
} = contentApi
