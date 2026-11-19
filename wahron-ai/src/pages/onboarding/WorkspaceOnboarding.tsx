import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAppDispatch } from '../../app/hooks'
import {
  useCreateOrganizationMutation,
  useGetWorkspacesQuery,
} from '../../features/workspace/workspaceApi'
import { setWorkspace } from '../../features/workspace/workspaceSlice'

export default function WorkspaceOnboarding() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const {
    data: workspaces,
    isError: isWorkspaceLoadError,
    isFetching,
    isLoading: isLoadingWorkspaces,
  } = useGetWorkspacesQuery()
  const [createOrganization, { isError, isLoading }] =
    useCreateOrganizationMutation()
  const [organizationName, setOrganizationName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = await createOrganization({
      name: organizationName.trim(),
      workspace_name: workspaceName.trim() || undefined,
    })

    if (!result.data) {
      return
    }

    dispatch(setWorkspace(result.data.workspace))
    navigate('/app', { replace: true })
  }

  if (isLoadingWorkspaces || isFetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isWorkspaceLoadError || !workspaces) {
    return (
      <Alert severity="error">
        We couldn't check your workspaces. Refresh the page to try again.
      </Alert>
    )
  }

  if (workspaces.length > 0) {
    return <Navigate to="/app" replace />
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Set up your workspace
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Create an organization and its first workspace to get started.
      </Typography>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          We couldn't create your workspace. Check the details and try again.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Organization name"
            autoComplete="organization"
            required
            slotProps={{ htmlInput: { minLength: 2, maxLength: 150 } }}
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
          />
          <TextField
            label="Workspace name (optional)"
            helperText="Defaults to your organization name."
            slotProps={{ htmlInput: { minLength: 2, maxLength: 150 } }}
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isLoading}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Create workspace'
            )}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
