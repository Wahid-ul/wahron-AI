import { baseApi } from '../../services/baseApi'

import type {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  Workspace,
} from './workspaceTypes'

export const workspaceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaces: builder.query<Workspace[], void>({
      query: () => '/workspaces',
      transformResponse: (response: { workspaces: Workspace[] }) =>
        response.workspaces,
      providesTags: ['Workspace'],
    }),

    createOrganization: builder.mutation<
      CreateOrganizationResponse,
      CreateOrganizationRequest
    >({
      query: (body) => ({
        url: '/organizations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Workspace'],
    }),
  }),
})

export const {
  useGetWorkspacesQuery,
  useCreateOrganizationMutation,
} = workspaceApi
