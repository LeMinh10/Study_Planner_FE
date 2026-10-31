import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { usePlanner } from '../contexts/PlannerContext'
import { SubjectEditor } from '../pages/AcademicPages'
import { NotificationBell } from '../components/NotificationBell'

const destinations: { path: string; title: string; icon: IconName }[] = [
  { path: '/tasks', title: 'Nhiệm vụ của tôi', icon: 'list' },
  { path: '/today', title: 'Hôm nay', icon: 'sun' },
  { path: '/calendar', title: 'Lịch học', icon: 'calendar' },
]
const secondaryDestinations: typeof destinations = [
  { path: '/subjects', title: 'Các môn học', icon: 'book' },
  { path: '/statistics', title: 'Tiến độ học tập', icon: 'chart' },
  { path: '/schedule', title: 'Thời khóa biểu', icon: 'clock' },
]
const searchPages = [...destinations, ...secondaryDestinations, { path: '/semesters', title: 'Học kỳ', icon: 'layers' as const }, { path: '/profile', title: 'Hồ sơ của tôi', icon: 'user' as const }]

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return 'nav-item' + (isActive ? ' active' : '')
}

export function AppLayout() {
  const { data, dispatch, tasks, canMutate, openTask, createTask, loggedIn, logout } = usePlanner()
  const [addingSubject, setAddingSubject] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const workspaceMode = location.pathname === '/' || location.pathname === '/tasks'
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId)
  const scopedSubject = workspaceMode ? subjects.find((subject) => subject.id === params.get('subject')) : undefined
  const detailSubject = data.subjects.find((subject) => location.pathname === '/subjects/' + subject.id)
  const layout = ['board', 'calendar'].includes(params.get('layout') ?? '') ? params.get('layout')! : 'list'
  const title = scopedSubject?.name ?? detailSubject?.name ?? searchPages.find((page) => page.path === location.pathname)?.title ?? 'Nhiệm vụ của tôi'
  const semester = data.semesters.find((item) => item.id === data.selectedSemesterId)
  const normalized = query.trim().toLocaleLowerCase('vi')
  const matches = searchPages.filter((page) => page.title.toLocaleLowerCase('vi').includes(normalized))
  const taskMatches = tasks.filter((task) => task.title.toLocaleLowerCase('vi').includes(normalized)).slice(0, 5)
  const subjectMatches = subjects.filter((subject) => `${subject.name} ${subject.code}`.toLocaleLowerCase('vi').includes(normalized)).slice(0, 3)
  const initials = data.profile.name.split(' ').filter(Boolean).slice(-2).map((word) => word.charAt(0)).join('').toLocaleUpperCase('vi')

  function subjectLink(id: string) { return '/tasks?' + new URLSearchParams({ subject: id, ...(layout !== 'list' ? { layout } : {}) }).toString() }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) { event.preventDefault(); inputRef.current?.focus() }
      if (event.key === 'Escape') setQuery('')
    }
    function onPointer(event: PointerEvent) { if (!searchRef.current?.contains(event.target as Node)) setQuery('') }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer) }
  }, [])

  return <div className={'app-layout student-layout flow-layout' + (workspaceMode ? ' workspace-mode' : '')}>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <aside className="sidebar" aria-label="Không gian học tập">
      <div className="flow-sidebar-brand"><Link to="/" className="brand" aria-label="Study Planner – Nhiệm vụ của tôi">Study Planner</Link></div>
      <nav aria-label="Menu chính">{destinations.map((page) => <NavLink key={page.path} to={page.path} className={sidebarLinkClass}><Icon name={page.icon} size={17} /><span className="sidebar-label">{page.title}</span></NavLink>)}</nav>
      <section className="flow-space-tree sidebar-label" aria-label="Danh sách môn học">
        <div className="flow-tree-caption"><span>Môn học trong kỳ</span></div>
        <NavLink to="/semesters" className={({ isActive }) => 'student-semester-link ' + sidebarLinkClass({ isActive })}>{semester?.name ?? 'Chưa có học kỳ'}</NavLink>
        <div className="flow-subject-tree">{subjects.map((subject) => {
          const selected = scopedSubject?.id === subject.id || detailSubject?.id === subject.id
          return <Link key={subject.id} to={subjectLink(subject.id)} className={'flow-subject-link' + (selected ? ' active' : '')} aria-current={selected ? 'page' : undefined}><span>{subject.name}</span><small>{tasks.filter((task) => task.subjectId === subject.id && task.status !== 'done').length || ''}</small></Link>
        })}{!subjects.length && <p className="flow-no-subjects">Chưa có môn học.</p>}<button className="flow-new-list" onClick={() => { if (canMutate) setAddingSubject(true) }}><Icon name="plus" size={13} />Thêm môn học</button></div>
      </section>
      <div className="sidebar-bottom">
        <div className="flow-sidebar-tools sidebar-label">{secondaryDestinations.map((page) => <NavLink key={page.path} to={page.path} className={sidebarLinkClass}><Icon name={page.icon} size={17} />{page.title}</NavLink>)}</div>
        <div className="sidebar-profile">
          <NavLink to="/profile" className={({ isActive }) => 'student-profile-link' + (isActive ? ' active' : '')} aria-label="Mở hồ sơ của tôi"><span className="avatar">{initials || <Icon name="user" size={18} />}</span><span className="student-profile-info"><strong>{data.profile.name || 'Chưa đăng nhập'}</strong><small>Hồ sơ cá nhân</small></span></NavLink>
          <Link to="/login" replace={loggedIn} onClick={loggedIn ? logout : undefined} className="flow-sign-in sidebar-label" title={loggedIn ? 'Đăng xuất' : 'Đăng nhập'} aria-label={loggedIn ? 'Đăng xuất' : 'Đăng nhập'}><Icon name="arrow-right" size={16} /></Link>
        </div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="flow-top-location"><strong>{title}</strong></div>
        <div className="topbar-actions">
          <NotificationBell key={location.key} />
          <div className="search-container" ref={searchRef}>
            <label className="search-box"><Icon name="search" size={15} /><input ref={inputRef} type="search" aria-label="Tìm nhiệm vụ, môn học hoặc trang" placeholder="Tìm kiếm…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {normalized && <div className="search-results">{taskMatches.length > 0 && <span className="search-caption">NHIỆM VỤ</span>}{taskMatches.map((task) => <button className="search-task-result" key={task.id} onClick={() => { setQuery(''); openTask(task) }}><Icon name="list" size={15} />{task.title}</button>)}{subjectMatches.length > 0 && <span className="search-caption search-task-caption">MÔN HỌC</span>}{subjectMatches.map((subject) => <Link key={subject.id} to={subjectLink(subject.id)} onClick={() => setQuery('')}><Icon name="book" size={15} />{subject.name}</Link>)}{matches.length > 0 && <span className="search-caption search-task-caption">ĐI ĐẾN</span>}{matches.map((page) => <Link key={page.path} to={page.path} onClick={() => setQuery('')}><Icon name={page.icon} size={15} />{page.title}</Link>)}{!taskMatches.length && !subjectMatches.length && !matches.length && <p>Không tìm thấy kết quả phù hợp.</p>}</div>}
          </div>
          <label className="flow-active-semester"><span className="sr-only">Học kỳ đang xem</span><select value={data.selectedSemesterId} disabled={!data.semesters.length} onChange={(event) => dispatch({ type: 'select-semester', id: event.target.value })}>{!data.semesters.length && <option value="">Chưa có học kỳ</option>}{data.semesters.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <button className="flow-global-create" onClick={() => createTask(scopedSubject?.id)} title="Thêm nhiệm vụ đầy đủ"><Icon name="plus" size={15} /><span>Tạo nhiệm vụ</span></button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}><Outlet /></main>

    </div>
    {addingSubject && <SubjectEditor subject={null} onClose={() => setAddingSubject(false)} />}
  </div>
}
