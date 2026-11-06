import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../contexts/AuthContext'

export function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const { search } = useLocation()
  const isOverview = useMatch('/admin/overview')
  const isPriorityRules = useMatch('/admin/priority-rules')
  const isStudentDetails = useMatch('/admin/students/:studentId')
  const pageTitle = isOverview ? 'Tổng quan' : isPriorityRules ? 'Quy tắc ưu tiên' : isStudentDetails ? 'Chi tiết sinh viên' : 'Tài khoản sinh viên'
  return <div className="admin-layout">
    <a className="skip-link" href="#admin-content">Đến nội dung chính</a>
    <aside className="admin-sidebar">
      <div className="admin-brand"><span><Icon name="book" size={25} /></span><div><strong>studyplanner.</strong><small>Trang quản trị</small></div></div>
      <span className="admin-nav-caption">QUẢN LÝ</span>
      <nav aria-label="Menu quản trị">
        <NavLink to="/admin/overview" className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}><Icon name="overview" size={19} />Tổng quan</NavLink>
        <NavLink to="/admin/students" className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}><Icon name="user" size={19} />Tài khoản sinh viên</NavLink>
        <NavLink to="/admin/priority-rules" className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}><Icon name="flag" size={19} />Quy tắc ưu tiên</NavLink>
      </nav>
      <div className="admin-sidebar-account"><span className="admin-avatar"><Icon name="user" size={20} /></span><div><strong>{user?.name || 'Quản trị viên'}</strong><small>{user?.email}</small></div></div>
      <button type="button" className="admin-logout" onClick={onLogout}><Icon name="logout" size={18} />Đăng xuất</button>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <nav className="admin-breadcrumb" aria-label="Đường dẫn quản trị">
          <span>Quản trị</span><span aria-hidden="true">/</span>
          {isStudentDetails && <><Link to={'/admin/students' + search}>Tài khoản sinh viên</Link><span aria-hidden="true">/</span></>}
          <strong aria-current="page">{pageTitle}</strong>
        </nav>
      </header>
      <main id="admin-content" tabIndex={-1}><Outlet /></main>
    </div>
  </div>
}
