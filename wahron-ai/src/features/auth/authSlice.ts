import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from './authTypes'

interface AuthState {
  user: User | null
  status: 'checking' | 'authenticated' | 'unauthenticated'
}

const initialState: AuthState = {
  user: null,
  status: 'checking',
}

const authSlice = createSlice({
  name: 'auth',
  initialState,

  reducers: {
    setAuthenticated: (state, action: PayloadAction<User>) => {
      state.user = action.payload
      state.status = 'authenticated'
    },

    setUnauthenticated: (state) => {
      state.user = null
      state.status = 'unauthenticated'
    },

    clearAuth: (state) => {
      state.user = null
      state.status = 'unauthenticated'
    },
  },
})

export const {
  setAuthenticated,
  setUnauthenticated,
  clearAuth,
} = authSlice.actions

export default authSlice.reducer