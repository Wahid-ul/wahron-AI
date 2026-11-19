import { baseApi } from '../../services/baseApi'

import {
  setAuthenticated,
  setUnauthenticated,
  clearAuth,
} from './authSlice'

import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from './authTypes'

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),

      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setAuthenticated(data.user))
        } catch {
          dispatch(setUnauthenticated())
        }
      },
    }),

    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),

      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setAuthenticated(data.user))
        } catch {
          dispatch(setUnauthenticated())
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),

      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          dispatch(clearAuth())
        }
      },
    }),

    getMe: builder.query<User, void>({
      query: () => '/auth/me',

      providesTags: ['CurrentUser'],

      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setAuthenticated(data))
        } catch {
          dispatch(setUnauthenticated())
        }
      },
    }),

  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi