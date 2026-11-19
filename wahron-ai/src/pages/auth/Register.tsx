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

import { useRegisterMutation } from '../../features/auth/authApi'

export default function Register() {
  const navigate = useNavigate()

  const [register, { isLoading, error }] = useRegisterMutation()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError('')

    if (password.length < 8) {
      setValidationError('Password must contain at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.')
      return
    }

    try {
      await register({
        full_name: fullName,
        email,
        password,
      }).unwrap()

      navigate('/app')
    } catch {
      // RTK Query handles the API error.
    }
  }

  const errorMessage =
    error && 'data' in error
      ? typeof error.data === 'string'
        ? error.data
        : (error.data as { detail?: string })?.detail ||
          'Unable to create your account.'
      : null

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        Create your account
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
        Start building smarter marketing with Wahron AI.
      </Typography>

      {(validationError || errorMessage) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {validationError || errorMessage}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Full name"
            fullWidth
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <TextField
            label="Confirm password"
            type="password"
            fullWidth
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

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
              'Create account'
            )}
          </Button>
        </Stack>
      </Box>

      <Typography sx={{ mt: 4, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
          Sign in
        </Link>
      </Typography>
    </Box>
  )
}