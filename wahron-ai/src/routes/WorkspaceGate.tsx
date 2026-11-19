import { useEffect } from 'react'
import { Alert, Box, Button, CircularProgress } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'

import { useAppDispatch } from '../app/hooks'
import { useGetWorkspacesQuery } from '../features/workspace/workspaceApi'
import { useAppSelector } from '../app/hooks'
import { setWorkspace } from '../features/workspace/workspaceSlice'

export default function WorkspaceGate() {
  const dispatch = useAppDispatch()
  const currentWorkspace = useAppSelector(
    (state) => state.workspace.currentWorkspace,
  )
  const {
    data: workspaces,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useGetWorkspacesQuery()

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && currentWorkspace?.id !== workspaces[0].id) {
      dispatch(setWorkspace(workspaces[0]))
    }
  }, [currentWorkspace?.id, dispatch, workspaces])

  if (isLoading || isFetching) {
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

  if (isError || !workspaces) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 4 }}>
        <Alert
          severity="error"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          We couldn't load your workspaces. Please try again.
        </Alert>
      </Box>
    )
  }

  if (workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  if (currentWorkspace?.id !== workspaces[0].id) {
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

  return <Outlet />
}
