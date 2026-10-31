import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { CalendarNav, EmptyState, PageHeading, SubjectBadge } from '../../components/PlannerUI'
import { usePlanner } from '../../contexts/PlannerContext'
import { addDays, dateKey, dayLabels, formatDate, moveMonth, slotsOnDate, vietnamToday, weekDates } from '../../utils/planner'

type CalendarView = 'day' | 'week' | 'month'

export function CalendarPage() {
  const { data, tasks, openTask } = usePlanner()
  const [view, setView] = useState<CalendarView>('month')
  const [date, setDate] = useState(() => vietnamToday())
  const [show, setShow] = useState('all')
  const todayKey = dateKey(vietnamToday())
  const dates = view === 'month' ? Array.from({ length: 42 }, (_, index) => addDays(weekDates(new Date(date.getFullYear(), date.getMonth(), 1, 12))[0], index)) : view === 'week' ? weekDates(date) : [date]
  function events(day: Date) {
    const key = dateKey(day)
    const scheduleEvents = show === 'tasks' ? [] : slotsOnDate(data, day).map((slot) => ({ id: `slot-${slot.id}`, title: slot.title, time: slot.start, end: slot.end, subjectId: slot.subjectId, type: 'schedule' as const, done: false, note: slot.room, task: undefined }))
    const taskEvents = show === 'schedule' ? [] : tasks.filter((task) => task.dueDate === key).map((task) => ({ id: `task-${task.id}`, title: task.title, time: task.dueTime, end: '', subjectId: task.subjectId, type: 'task' as const, done: task.status === 'done', note: 'Hạn nhiệm vụ', task }))
    return [...scheduleEvents, ...taskEvents].sort((a, b) => a.time.localeCompare(b.time))
  }
  function move(direction: number) { setDate(view === 'month' ? moveMonth(date, direction) : addDays(date, direction * (view === 'week' ? 7 : 1))) }
  const label = view === 'month' ? `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}` : view === 'week' ? `${formatDate(dateKey(dates[0]))} — ${formatDate(dateKey(dates[6]), true)}` : date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return <>
    <CalendarNav />
    <PageHeading title="Lịch"><label className="calendar-filter">Hiển thị<select value={show} onChange={(event) => setShow(event.target.value)}><option value="all">Lịch học & nhiệm vụ cần làm</option><option value="schedule">Chỉ lịch học</option><option value="tasks">Chỉ hạn nhiệm vụ</option></select></label></PageHeading>
    <section className="paper-panel data-panel"><div className="view-toolbar"><div className="date-navigation"><button className="icon-button" aria-label="Khoảng thời gian trước" onClick={() => move(-1)}><Icon name="chevron-left" size={18} /></button><strong>{label}</strong><button className="icon-button" aria-label="Khoảng thời gian sau" onClick={() => move(1)}><Icon name="chevron-right" size={18} /></button><button className="subtle-button" onClick={() => setDate(vietnamToday())}>Hôm nay</button></div><div className="segmented-control" role="group" aria-label="Chế độ xem lịch">{(['day', 'week', 'month'] as const).map((value) => <button key={value} aria-pressed={view === value} className={view === value ? 'active' : ''} onClick={() => setView(value)}>{{ day: 'Ngày', week: 'Tuần', month: 'Tháng' }[value]}</button>)}</div></div>
      {view !== 'day' ? <><div className="calendar-weekday-header">{dayLabels.map((label) => <span key={label}>{label}</span>)}</div><div className={`calendar-grid calendar-${view}`}>{dates.map((day) => {
        const daily = events(day)
        const key = dateKey(day)
        return <div key={key} className={`calendar-cell${view === 'month' && day.getMonth() !== date.getMonth() ? ' outside-month' : ''}${key === todayKey ? ' calendar-today' : ''}`}><button className="calendar-day-number" aria-label={`Xem ngày ${formatDate(key, true)}`} onClick={() => { setDate(day); setView('day') }}>{day.getDate()}{key === todayKey && <span>Hôm nay</span>}</button><div className="calendar-events">{daily.slice(0, view === 'month' ? 3 : daily.length).map((event) => {
          const color = data.subjects.find((subject) => subject.id === event.subjectId)?.color ?? 'sage'
          return event.task ? <button key={event.id} className={`calendar-event ${color}${event.done ? ' event-done' : ''}`} title={`${event.time} · ${event.title}`} onClick={() => openTask(event.task)}><i className="task-event-dot" /><span>{event.time}</span><strong>{event.title}</strong></button> : <div key={event.id} className={`calendar-event ${color}`} title={`${event.time}–${event.end} · ${event.title} · ${event.note}`}><Icon name="book" size={10} /><span>{event.time}</span><strong>{event.title}</strong></div>
        })}{view === 'month' && daily.length > 3 && <button className="more-events" onClick={() => { setDate(day); setView('day') }}>+{daily.length - 3} sự kiện khác</button>}</div></div>
      })}</div></> : events(date).length ? <div className="day-agenda">{events(date).map((event) => <article className="day-event" key={event.id}><div className="day-event-time"><strong>{event.time}</strong><span>{event.end || 'Hạn nộp'}</span></div><div className="day-event-content"><SubjectBadge id={event.subjectId} />{event.task ? <button className="table-title" onClick={() => openTask(event.task)}>{event.title}</button> : <h3>{event.title}</h3>}<p>{event.note}{event.done ? ' · Đã hoàn thành' : ''}</p></div><span className={`event-kind ${event.type}`}>{event.type === 'task' ? 'Nhiệm vụ' : 'Lịch học'}</span></article>)}</div> : <EmptyState title="Không có lịch học hoặc nhiệm vụ trong ngày" />}
      <div className="calendar-legend"><span><i className="legend-square" />Lịch học</span><span><i className="task-event-dot" />Hạn nhiệm vụ</span><span><Icon name="check" size={13} />Nhiệm vụ hoàn thành được làm mờ</span></div>
    </section>
  </>
}
