import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { roleHome } from '../auth/session'
import type { UserRole } from '../types/auth'

export function RequireAuth({ role }: { role: UserRole }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <div className="auth-session-state" role="status">Đang kiểm tra phiên đăng nhập…</div>
  if (auth.status === 'error') return <div className="auth-session-state"><p role="alert">{auth.error}</p><button type="button" className="button button-primary" onClick={auth.retry}>Thử lại</button><button type="button" className="button button-secondary" onClick={auth.logout}>Đăng nhập lại</button></div>
  if (!auth.user || auth.status !== 'authenticated') return <Navigate to={role === 'admin' ? '/admin' : '/login'} state={{ from: location.pathname + location.search }} replace />
  if (auth.user.role !== role) return <Navigate to={roleHome(auth.user.role)} replace />
  return <Outlet />
}
