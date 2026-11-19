import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  PenSquare,
  ChartNoAxesCombined,
  Settings,
  Sparkles,
  Bell,
} from 'lucide-react'

import {
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  IconButton,
  Box,
} from '@mui/material'

import { motion } from 'motion/react'

const navigation = [
  {
    label: 'Dashboard',
    path: '/app',
    icon: LayoutDashboard,
  },
  {
    label: 'Campaigns',
    path: '/app/campaigns',
    icon: CalendarDays,
  },
  {
    label: 'Content Studio',
    path: '/app/content',
    icon: PenSquare,
  },
  {
    label: 'Analytics',
    path: '/app/analytics',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Settings',
    path: '/app/settings',
    icon: Settings,
  },
]

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Sparkles size={20} />
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight">Wahron AI</h1>
            <p className="text-xs text-slate-400">AI Growth Platform</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          {navigation.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/app'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={19} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="m-4 rounded-xl bg-indigo-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-indigo-700">
            <Sparkles size={18} />
            <span className="text-sm font-semibold">AI Assistant</span>
          </div>

          <p className="text-xs leading-5 text-slate-600">
            Your AI marketing teammate is ready to help grow your brand.
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <AppBar
          position="sticky"
          elevation={0}
          color="inherit"
          sx={{
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Toolbar className="flex justify-between">
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Marketing Workspace
            </Typography>

            <Box className="flex items-center gap-3">
              <IconButton>
                <Bell size={20} />
              </IconButton>

              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: '#5145CD',
                  fontSize: 14,
                }}
              >
                FA
              </Avatar>
            </Box>
          </Toolbar>
        </AppBar>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-5 md:p-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}