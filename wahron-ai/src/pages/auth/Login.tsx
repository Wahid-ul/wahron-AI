import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { useLoginMutation } from '../../features/auth/authApi'

export default function Login() {
  const navigate = useNavigate()

  const [login, { isLoading, error }] = useLoginMutation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      await login({ email, password }).unwrap()
      navigate('/app')
    } catch {
      // RTK Query exposes the error for the form.
    }
  }

  const errorMessage = (() => {
    if (!error) return null

    if ('data' in error) {
      if (typeof error.data === 'string') return error.data
      if (
        typeof error.data === 'object' &&
        error.data !== null &&
        'detail' in error.data &&
        typeof error.data.detail === 'string'
      ) {
        return error.data.detail
      }
      return 'Unable to sign in. Please check your credentials.'
    }

    if ('status' in error && error.status === 'FETCH_ERROR') {
      return 'Cannot reach the Wahron AI API. Start the backend and check VITE_API_BASE_URL.'
    }

    if ('status' in error && error.status === 'TIMEOUT_ERROR') {
      return 'The sign-in request timed out. Check the backend and try again.'
    }

    return 'Unable to sign in right now. Please try again.'
  })()

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        Welcome back
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
        Sign in to continue to your Wahron AI workspace.
      </Typography>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Box sx={{ textAlign: 'right' }}>
            <Link component={RouterLink} to="/forgot-password">
              Forgot password?
            </Link>
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isLoading}
            sx={{ py: 1.5 }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Sign in'
            )}
          </Button>
        </Stack>
      </Box>

      <Typography sx={{ mt: 4, textAlign: 'center' }}>
        Don't have an account?{' '}
        <Link component={RouterLink} to="/register" sx={{ fontWeight: 700 }}>
          Create account
        </Link>
      </Typography>
    </Box>
  )
}