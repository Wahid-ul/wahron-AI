import { Box, Container, Typography } from '@mui/material'
import { motion } from 'motion/react'
import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: '#F8F9FC',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '50%',
          minHeight: '100vh',
          background:
            'linear-gradient(135deg, #17152F 0%, #34277B 55%, #6554D9 100%)',
          color: '#fff',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 7,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Wahron AI.
          </Typography>

          <Typography variant="body2" sx={{ color: '#C5C0E8', mt: 1 }}>
            Plan smarter. Create better. Grow faster.
          </Typography>
        </Box>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <Typography
            variant="h2"
            sx={{ maxWidth: 520, lineHeight: 1.15, fontWeight: 700 }}
          >
            Your AI marketing team, working alongside you.
          </Typography>

          <Typography
            variant="h6"
            sx={{
              mt: 3,
              color: '#D0CCEC',
              fontWeight: 400,
              maxWidth: 460,
              lineHeight: 1.7,
            }}
          >
            Understand your audience, create meaningful content and grow your
            business with intelligent marketing.
          </Typography>
        </motion.div>

        <Typography variant="caption" sx={{ color: '#B8B3D6' }}>
          © 2026 Wahron AI. All rights reserved.
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          py: 5,
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
              Wahron AI.
            </Typography>
            <Typography color="text.secondary">
              Plan smarter. Create better. Grow faster.
            </Typography>
          </Box>

          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
