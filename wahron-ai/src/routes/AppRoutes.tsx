import { Navigate, Route, Routes } from 'react-router-dom'

import AuthLayout from '../layouts/AuthLayout'
import AppLayout from '../layouts/AppLayout'

import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import Dashboard from '../pages/dashboard/Dashboard'
import ContentStudio from '../pages/content/ContentStudio'
import VideoStudio from '../pages/content/VideoStudio'
import BusinessOnboarding from '../pages/onboarding/BusinessOnboarding'
import WorkspaceOnboarding from '../pages/onboarding/WorkspaceOnboarding'

import BusinessGate from './BusinessGate'
import ProtectedRoute from './ProtectedRoute'
import WorkspaceGate from './WorkspaceGate'

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/onboarding" element={<WorkspaceOnboarding />} />
        </Route>

        <Route element={<WorkspaceGate />}>
          <Route element={<AuthLayout />}>
            <Route
              path="/onboarding/business"
              element={<BusinessOnboarding />}
            />
          </Route>

          <Route element={<BusinessGate />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="content" element={<ContentStudio />} />
              <Route path="content/video" element={<VideoStudio />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}