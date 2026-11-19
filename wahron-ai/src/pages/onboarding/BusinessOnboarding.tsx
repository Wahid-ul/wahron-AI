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

import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useCreateBusinessMutation, useGetBusinessesQuery } from '../../features/business/businessApi'
import { setBusiness } from '../../features/business/businessSlice'

export default function BusinessOnboarding() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const workspace = useAppSelector(
    (state) => state.workspace.currentWorkspace,
  )
  const {
    data: businesses,
    isError: isBusinessLoadError,
    isFetching,
    isLoading: isLoadingBusinesses,
  } = useGetBusinessesQuery(workspace?.id ?? '', { skip: !workspace })
  const [createBusiness, { isError, isLoading }] =
    useCreateBusinessMutation()
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workspace) {
      return
    }

    const result = await createBusiness({
      workspaceId: workspace.id,
      body: {
        name: name.trim(),
        industry: industry.trim(),
        description: description.trim() || undefined,
        website: website.trim() || undefined,
      },
    })

    if (!result.data) {
      return
    }

    dispatch(setBusiness(result.data))
    navigate('/app', { replace: true })
  }

  if (isLoadingBusinesses || isFetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isBusinessLoadError || !businesses) {
    return (
      <Alert severity="error">
        We couldn't check your business profiles. Refresh the page to try again.
      </Alert>
    )
  }

  if (businesses.length > 0) {
    return <Navigate to="/app" replace />
  }

  if (!workspace) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Tell us about your business
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Add a profile for {workspace.name}. You can add more businesses later.
      </Typography>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          We couldn't save your business profile. Check the details and try again.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Business name"
            autoComplete="organization"
            required
            slotProps={{ htmlInput: { minLength: 2, maxLength: 150 } }}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Industry"
            placeholder="For example, restaurant or retail"
            required
            slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }}
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          />
          <TextField
            label="Website (optional)"
            type="url"
            autoComplete="url"
            slotProps={{ htmlInput: { maxLength: 255 } }}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <TextField
            label="Short description (optional)"
            multiline
            minRows={3}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isLoading || !workspace}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Save business profile'
            )}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
