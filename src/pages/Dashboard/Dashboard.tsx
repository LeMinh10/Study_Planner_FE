import { Link } from 'react-router-dom'
import { usePlanner } from '../../contexts/PlannerContext'
import { EmptyState, NoSubjectsNotice, PageHeading } from '../../components/PlannerUI'
import { StudentTaskList } from '../../components/StudentTasks'
import { Icon } from '../../components/Icon'
import { dateKey, deadline, formatDate, slotsOnDate, taskStatus, vietnamToday } from '../../utils/planner'
import { taskDueLabel, upcomingClasses } from '../../utils/studentView'

export function Dashboard() {
  const { data, tasks, now, openTask } = usePlanner()
  const today = vietnamToday(new Date(now))
  const key = dateKey(today)
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId)
  const todaySlots = slotsOnDate(data, today)
  const todayTasks = tasks.filter((task) => task.dueDate === key)
  const dueToday = todayTasks.filter((task) => task.status !== 'done').sort((a, b) => deadline(a) - deadline(b))
  const doneToday = todayTasks.filter((task) => task.status === 'done').length
  const overdue = tasks.filter((task) => taskStatus(task, now) === 'overdue')
  const upcoming = tasks.filter((task) => task.status !== 'done' && task.dueDate > key).sort((a, b) => deadline(a) - deadline(b))
  const next = upcomingClasses(data, now, undefined, 1)[0]
  const progress = todayTasks.length ? Math.round(doneToday / todayTasks.length * 100) : 0

  return <>
    <PageHeading eyebrow={today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })} title="Hôm nay"><button className="button button-primary" onClick={() => openTask()}><Icon name="plus" size={17} />Thêm nhiệm vụ</button></PageHeading>
    {!subjects.length && <NoSubjectsNotice />}
    <div className="student-today-grid">
      <div className="student-day-main">
        <section className="next-class-card" aria-labelledby="next-class-heading"><div className="next-class-kicker"><span><Icon name="book" size={16} />{next && next.startsAt <= now ? 'ĐANG HỌC' : 'BUỔI HỌC TIẾP THEO'}</span><Link to="/calendar">Lịch của tôi<Icon name="arrow-right" size={14} /></Link></div>{next ? <>
          <div className="next-class-content"><div><span className="next-class-date">{dateKey(next.date) === key ? 'Hôm nay' : next.date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span><h2 id="next-class-heading"><Link to={`/subjects/${next.subject.id}`}>{next.subject.name}</Link></h2><p>{next.slot.title}</p><span className="next-class-room">{next.slot.room || 'Chưa có địa điểm'}{next.slot.note && <span> · {next.slot.note}</span>}</span></div><div className="next-class-time"><strong>{next.slot.start}</strong><span>đến {next.slot.end}</span></div></div>
          <Link className="next-class-subject-link" to={`/subjects/${next.subject.id}`}>Vào môn học<Icon name="arrow-right" size={15} /></Link>
        </> : <div className="next-class-empty"><h2 id="next-class-heading">Chưa có buổi học tiếp theo.</h2><Link to="/schedule" className="next-class-subject-link">Sắp xếp lịch học<Icon name="arrow-right" size={15} /></Link></div>}</section>

        <section className="student-day-tasks" aria-labelledby="today-tasks-heading"><div className="student-section-heading"><div><h2 id="today-tasks-heading">Hôm nay cần làm</h2></div><Link to="/tasks?view=today" className="text-button">Xem tất cả<Icon name="arrow-right" size={14} /></Link></div>
          {dueToday.length ? <StudentTaskList tasks={dueToday} /> : <div className="today-clear"><Icon name="check" size={21} /><div><strong>{todayTasks.length ? 'Đã hoàn thành nhiệm vụ hôm nay' : 'Không có nhiệm vụ đến hạn hôm nay'}</strong></div></div>}
          {todayTasks.length > 0 && <div className="today-small-progress"><span>Đã xong <strong>{doneToday}/{todayTasks.length}</strong> nhiệm vụ đến hạn hôm nay</span><progress max="100" value={progress} aria-label="Tiến độ nhiệm vụ đến hạn hôm nay" /></div>}
        </section>
        {overdue.length > 0 && <Link className="student-overdue-note" to="/tasks?view=overdue"><Icon name="clock" size={17} /><span><strong>{overdue.length} nhiệm vụ quá hạn</strong></span><Icon name="arrow-right" size={16} /></Link>}
        {upcoming.length > 0 && <section className="start-early-section"><div className="student-section-heading"><div><h2>Nhiệm vụ sắp tới</h2></div><Link to="/tasks?view=upcoming" className="text-button">Nhiệm vụ sắp tới<Icon name="arrow-right" size={14} /></Link></div><StudentTaskList tasks={upcoming.slice(0, 2)} /></section>}
      </div>

      <aside className="student-day-aside"><section className="today-agenda-panel" aria-labelledby="today-agenda-heading"><div className="student-section-heading"><div><span className="student-small-date">{formatDate(key)}</span><h2 id="today-agenda-heading">Lịch hôm nay</h2></div><Link to="/schedule" className="icon-button" aria-label="Xem thời khóa biểu"><Icon name="calendar" size={18} /></Link></div>{todaySlots.length ? <div className="student-agenda">{todaySlots.map((slot) => {
        const subject = data.subjects.find((item) => item.id === slot.subjectId)!
        const ended = new Date(`${key}T${slot.end}:00+07:00`).getTime() <= now
        return <Link key={slot.id} to={`/subjects/${subject.id}`} className={`student-agenda-item ${subject.color}${ended ? ' class-ended' : ''}`}><span className="student-agenda-time"><strong>{slot.start}</strong><span>{slot.end}</span></span><span className="student-agenda-course"><strong>{subject.name}</strong><span>{slot.room || 'Chưa có địa điểm'}</span>{ended && <small>Đã qua giờ học</small>}</span></Link>
      })}</div> : <EmptyState title="Hôm nay chưa có lịch học" />}<Link to="/calendar" className="student-aside-link">Xem cả tuần<Icon name="arrow-right" size={15} /></Link></section>
      <section className="student-remember-panel"><h2>Hạn nộp sắp tới</h2>{upcoming.length ? upcoming.slice(0, 2).map((task) => <button className="student-upcoming-note" key={task.id} onClick={() => openTask(task)}><strong>{task.title}</strong><span>{taskDueLabel(task, now)}</span></button>) : <p className="student-note-empty">Chưa có hạn nộp nào sắp tới.</p>}<Link to="/tasks?view=priority" className="text-button">Nhiệm vụ ưu tiên<Icon name="arrow-right" size={14} /></Link></section></aside>
    </div>
  </>
}
