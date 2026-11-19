import { configureStore } from '@reduxjs/toolkit'

import authReducer from '../features/auth/authSlice'
import workspaceReducer from '../features/workspace/workspaceSlice'
import businessReducer from '../features/business/businessSlice'
import uiReducer from '../features/ui/uiSlice'

import { baseApi } from '../services/baseApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
    business: businessReducer,
    ui: uiReducer,

    [baseApi.reducerPath]: baseApi.reducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),

  devTools: import.meta.env.DEV,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch