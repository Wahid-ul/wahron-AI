import { useEffect } from 'react'
import { Alert, Box, Button, CircularProgress } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'

import { useAppDispatch, useAppSelector } from '../app/hooks'
import { useGetBusinessesQuery } from '../features/business/businessApi'
import { setBusiness } from '../features/business/businessSlice'

export default function BusinessGate() {
  const dispatch = useAppDispatch()
  const workspace = useAppSelector(
    (state) => state.workspace.currentWorkspace,
  )
  const {
    data: businesses,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useGetBusinessesQuery(workspace?.id ?? '', { skip: !workspace })

  useEffect(() => {
    if (businesses && businesses.length > 0) {
      dispatch(setBusiness(businesses[0]))
    }
  }, [businesses, dispatch])

  if (!workspace || isLoading || isFetching) {
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

  if (isError || !businesses) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 4 }}>
        <Alert
          severity="error"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          We couldn't load your business profiles. Please try again.
        </Alert>
      </Box>
    )
  }

  if (businesses.length === 0) {
    return <Navigate to="/onboarding/business" replace />
  }

  return <Outlet />
}
