import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { StudentAccountsPage } from './StudentAccountsPage'
import { StudentDetailsPage } from './StudentDetails'
import { AdminOverviewPage } from './AdminOverviewPage'
import { AdminPriorityRulesPage } from './AdminPriorityRulesPage'
import { useAuth } from '../contexts/AuthContext'
import { RequireAuth } from '../components/RequireAuth'
import { roleHome } from '../auth/session'
import './admin.css'

export function AdminRoutes() {
  const auth = useAuth()
  const navigate = useNavigate()

  function logout() {
    auth.logout()
    navigate('/login', { replace: true })
  }

  return <Routes>
    <Route element={<RequireAuth role="admin" />}>
     <Route index element={<Navigate to={roleHome('admin')} replace />} />
     <Route element={<AdminLayout onLogout={logout} />}>
      <Route path="overview" element={<AdminOverviewPage />} />
      <Route path="students" element={<StudentAccountsPage />} />
      <Route path="students/:studentId" element={<StudentDetailsPage />} />
      <Route path="priority-rules" element={<AdminPriorityRulesPage />} />
    </Route>
    </Route>
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>
}
