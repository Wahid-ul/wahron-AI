import { useGetMeQuery } from './features/auth/authApi'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  // Automatically checks the current user's session.
  useGetMeQuery()

  return <AppRoutes />
}