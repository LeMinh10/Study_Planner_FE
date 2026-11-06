import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { AdminLoginPage } from './AdminLoginPage'
import { StudentAccountsPage } from './StudentAccountsPage'
import { StudentDetailsPage } from './StudentDetails'
import { AdminOverviewPage } from './AdminOverviewPage'
import { AdminPriorityRulesPage } from './AdminPriorityRulesPage'
import { useAuth } from '../contexts/AuthContext'
import { RequireAuth } from '../components/RequireAuth'
import './admin.css'

export function AdminRoutes() {
  const auth = useAuth()
  const navigate = useNavigate()

  async function login(taiKhoan: string, password: string) {
    await auth.login(taiKhoan, password, 'admin')
    navigate('/admin/students', { replace: true })
  }

  function logout() {
    auth.logout()
    navigate('/admin', { replace: true })
  }

  return <Routes>
    <Route index element={<AdminLoginPage onLogin={login} />} />
    <Route element={<RequireAuth role="admin" />}>
     <Route element={<AdminLayout onLogout={logout} />}>
      <Route path="overview" element={<AdminOverviewPage />} />
      <Route path="students" element={<StudentAccountsPage />} />
      <Route path="students/:studentId" element={<StudentDetailsPage />} />
      <Route path="priority-rules" element={<AdminPriorityRulesPage />} />
    </Route>
    </Route>
    <Route path="*" element={<Navigate to={auth.user?.role === 'admin' ? '/admin/students' : '/admin'} replace />} />
  </Routes>
}
