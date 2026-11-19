import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { Business } from './businessTypes'

interface BusinessState {
  currentBusiness: Business | null
}

const initialState: BusinessState = {
  currentBusiness: null,
}

const businessSlice = createSlice({
  name: 'business',
  initialState,

  reducers: {
    setBusiness: (state, action: PayloadAction<Business>) => {
      state.currentBusiness = action.payload
    },

    clearBusiness: (state) => {
      state.currentBusiness = null
    },
  },
})

export const { setBusiness, clearBusiness } = businessSlice.actions

export default businessSlice.reducer