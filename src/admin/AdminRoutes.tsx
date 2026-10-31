import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { AdminLoginPage } from './AdminLoginPage'
import { StudentAccountsPage } from './StudentAccountsPage'
import { hasAdminSession, matchesAdminAccount, saveAdminSession } from './adminAuth'
import './admin.css'

export function AdminRoutes() {
  const [loggedIn, setLoggedIn] = useState(hasAdminSession)
  const navigate = useNavigate()

  function login(email: string, password: string) {
    if (!matchesAdminAccount(email, password)) return false
    saveAdminSession(true)
    setLoggedIn(true)
    navigate('/admin/students', { replace: true })
    return true
  }

  function logout() {
    saveAdminSession(false)
    setLoggedIn(false)
    navigate('/admin', { replace: true })
  }

  return <Routes>
    <Route index element={<AdminLoginPage onLogin={login} />} />
    <Route element={loggedIn ? <AdminLayout onLogout={logout} /> : <Navigate to="/admin" replace />}>
      <Route path="students" element={<StudentAccountsPage />} />
    </Route>
    <Route path="*" element={<Navigate to={loggedIn ? '/admin/students' : '/admin'} replace />} />
  </Routes>
}
