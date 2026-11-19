import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'

import { useAppSelector } from '../app/hooks'

export default function ProtectedRoute() {
  const status = useAppSelector((state) => state.auth.status)

  if (status === 'checking') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}