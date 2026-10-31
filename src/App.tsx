import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PlannerProvider, usePlanner } from './contexts/PlannerContext'
import { AppLayout } from './layouts/AppLayout'
import { TaskEditor } from './components/TaskEditor'
import { ConfirmDelete } from './components/PlannerUI'
import { Icon } from './components/Icon'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { SemestersPage, SubjectsPage } from './pages/AcademicPages'
import { SubjectDetailPage } from './pages/SubjectDetailPage'
import { TaskDetails } from './components/StudentTasks'
import { TasksPage } from './pages/Tasks/TasksPage'
import { SchedulePage } from './pages/Schedule/SchedulePage'
import { CalendarPage } from './pages/Calendar/CalendarPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { AuthPage } from './pages/Auth/AuthPage'
import { AdminRoutes } from './admin/AdminRoutes'
import './App.css'
import './planner.css'
import './student.css'
import './workspace.css'
import './theme.css'
import './task-menu.css'
import './student-simple.css'

function AppRoutes() {
  const { data, taskEditor, taskSubjectId, closeTask, loggedIn } = usePlanner()
  const location = useLocation()
  const content = <>
    <Routes>
      <Route index element={<Navigate to={loggedIn ? '/tasks' + location.search : '/login'} replace />} />
      <Route path="login" element={<AuthPage key="login" />} />
      <Route path="register" element={<AuthPage key="register" register />} />
      <Route path="admin/*" element={<AdminRoutes />} />
      <Route element={<AppLayout />}>
        <Route path="today" element={<Dashboard />} />
        <Route path="semesters" element={<SemestersPage />} />
        <Route path="subjects" element={<SubjectsPage key={data.selectedSemesterId} />} />
        <Route path="subjects/:subjectId" element={<SubjectDetailPage key={data.selectedSemesterId} />} />
        <Route path="schedule" element={<SchedulePage key={data.selectedSemesterId} />} />
        <Route path="tasks" element={<TasksPage key={data.selectedSemesterId} />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="notifications" element={<Navigate to="/tasks" replace />} />
        <Route path="statistics" element={<StatisticsPage key={data.selectedSemesterId} />} />
        <Route path="priorities" element={<Navigate to="/tasks?view=priority" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="plans" element={<Navigate to="/tasks" replace />} />
        <Route path="*" element={<section className="empty-page"><h1>Không tìm thấy trang</h1><Link to="/" className="button button-primary">Trang chủ<Icon name="arrow-right" size={17} /></Link></section>} />
      </Route>
    </Routes>
    {taskEditor !== undefined && <TaskEditor task={taskEditor} initialSubjectId={taskSubjectId} onClose={closeTask} />}
    <TaskDetails />
    <ConfirmDelete />
  </>
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  return isAdmin ? content : <div className="student-app">{content}</div>
}

export default function App() { return <PlannerProvider><AppRoutes /></PlannerProvider> }
