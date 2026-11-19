import { baseApi } from '../../services/baseApi'

import type {
  Business,
  CreateBusinessRequest,
  UpdateBusinessRequest,
} from './businessTypes'

export const businessApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBusinesses: builder.query<Business[], string>({
      query: (workspaceId) => `/workspaces/${workspaceId}/businesses`,
      transformResponse: (response: { businesses: Business[] }) =>
        response.businesses,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Business' as const, id })),
              { type: 'Business', id: 'LIST' },
            ]
          : [{ type: 'Business', id: 'LIST' }],
    }),

    createBusiness: builder.mutation<
      Business,
      { workspaceId: string; body: CreateBusinessRequest }
    >({
      query: ({ workspaceId, body }) => ({
        url: `/workspaces/${workspaceId}/businesses`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Business', id: 'LIST' }],
    }),

    updateBusiness: builder.mutation<
      Business,
      { businessId: string; body: UpdateBusinessRequest }
    >({
      query: ({ businessId, body }) => ({
        url: `/businesses/${businessId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Business', id: businessId },
        { type: 'Business', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetBusinessesQuery,
  useCreateBusinessMutation,
  useUpdateBusinessMutation,
} = businessApi
