
import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',

    primary: {
      main: '#5145CD',
      light: '#756AE8',
      dark: '#39309E',
      contrastText: '#FFFFFF',
    },

    secondary: {
      main: '#0D9488',
    },

    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },

    text: {
      primary: '#172033',
      secondary: '#64748B',
    },

    success: {
      main: '#16A34A',
    },

    warning: {
      main: '#D97706',
    },

    error: {
      main: '#DC2626',
    },
  },

  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',

    h1: {
      fontWeight: 700,
    },

    h2: {
      fontWeight: 700,
    },

    h3: {
      fontWeight: 700,
    },

    h4: {
      fontWeight: 700,
    },

    h5: {
      fontWeight: 600,
    },

    h6: {
      fontWeight: 600,
    },

    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: 'none',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          boxShadow: 'none',
        },
      },
    },
  },
})

export default theme
