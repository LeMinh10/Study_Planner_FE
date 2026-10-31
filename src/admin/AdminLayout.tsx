import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ADMIN_ACCOUNT } from './adminAuth'

export function AdminLayout({ onLogout }: { onLogout: () => void }) {
  return <div className="admin-layout">
    <a className="skip-link" href="#admin-content">Đến nội dung chính</a>
    <aside className="admin-sidebar">
      <div className="admin-brand"><span><Icon name="book" size={25} /></span><div><strong>studyplanner.</strong><small>Trang quản trị</small></div></div>
      <span className="admin-nav-caption">QUẢN LÝ</span>
      <nav aria-label="Menu quản trị">
        <NavLink to="/admin/students" className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}><Icon name="user" size={19} />Tài khoản sinh viên</NavLink>
      </nav>
      <div className="admin-sidebar-account"><span className="admin-avatar"><Icon name="user" size={20} /></span><div><strong>Quản trị viên</strong><small>{ADMIN_ACCOUNT.email}</small></div></div>
      <button type="button" className="admin-logout" onClick={onLogout}><Icon name="logout" size={18} />Đăng xuất</button>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><span>Quản trị / <strong>Tài khoản sinh viên</strong></span><span className="admin-role">Admin</span></header>
      <main id="admin-content" tabIndex={-1}><Outlet /></main>
    </div>
  </div>
}
