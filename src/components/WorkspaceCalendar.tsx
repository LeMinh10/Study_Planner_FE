import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PlannerTask } from '../types/planner'
import { usePlanner } from '../contexts/PlannerContext'
import { addDays, dateKey, dayLabels, formatDate, moveMonth, slotsOnDate, vietnamToday, weekDates } from '../utils/planner'
import { rescheduleTask, TASK_DRAG_TYPE } from '../utils/workspace'
import { Icon } from './Icon'
import { startTaskDrag } from './WorkspaceTasks'

export function WorkspaceCalendar({ tasks, subjectId, onCreate }: { tasks: PlannerTask[]; subjectId?: string; onCreate: (date: string) => void }) {
  const { canMutate, data, dispatch, openTask } = usePlanner()
  const [date, setDate] = useState(() => vietnamToday())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [showClasses, setShowClasses] = useState(true)
  const [dropDate, setDropDate] = useState('')
  const [notice, setNotice] = useState('')
  const todayKey = dateKey(vietnamToday())
  const first = weekDates(new Date(date.getFullYear(), date.getMonth(), 1, 12))[0]
  const dates = view === 'month' ? Array.from({ length: 42 }, (_, index) => addDays(first, index)) : view === 'week' ? weekDates(date) : [date]
  const label = view === 'month' ? `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}` : view === 'week' ? `${formatDate(dateKey(dates[0]))} – ${formatDate(dateKey(dates[6]), true)}` : date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })
  function move(count: number) { setDate(view === 'month' ? moveMonth(date, count) : addDays(date, count * (view === 'week' ? 7 : 1))) }

  return <div className="flow-calendar">
    <div className="flow-calendar-toolbar"><div><button className="icon-button" aria-label="Khoảng thời gian trước" onClick={() => move(-1)}><Icon name="chevron-left" size={16} /></button><button className="icon-button" aria-label="Khoảng thời gian sau" onClick={() => move(1)}><Icon name="chevron-right" size={16} /></button><h2>{label}</h2><button className="flow-text-button" onClick={() => setDate(vietnamToday())}>Hôm nay</button></div><div><label className="flow-show-classes"><input type="checkbox" checked={showClasses} onChange={(event) => setShowClasses(event.target.checked)} />Giờ học</label><select aria-label="Khoảng thời gian xem lịch" value={view} onChange={(event) => setView(event.target.value as typeof view)}><option value="month">Tháng</option><option value="week">Tuần</option><option value="day">Ngày</option></select></div></div>
    {view !== 'day' && <div className="flow-calendar-weekdays">{dayLabels.map((day) => <span key={day}>{day}</span>)}</div>}
    <div className={'flow-calendar-days calendar-layout-' + view}>{dates.map((day) => {
      const key = dateKey(day)
      const daily = tasks.filter((task) => task.dueDate === key).sort((a, b) => a.dueTime.localeCompare(b.dueTime))
      const classes = showClasses ? slotsOnDate(data, day).filter((slot) => !subjectId || slot.subjectId === subjectId) : []
      return <section key={key} className={'flow-calendar-day' + (day.getMonth() !== date.getMonth() && view === 'month' ? ' outside-month' : '') + (key === todayKey ? ' is-today' : '') + (dropDate === key ? ' calendar-drop-target' : '')} aria-label={formatDate(key, true)} onDragOver={(event) => { if (canMutate && event.dataTransfer.types.includes(TASK_DRAG_TYPE)) { event.preventDefault(); setDropDate(key) } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropDate('') }} onDrop={(event) => {
        event.preventDefault()
        if (!canMutate) return
        const task = rescheduleTask(tasks, event.dataTransfer.getData(TASK_DRAG_TYPE), key)
        if (task) { dispatch({ type: 'save-task', value: task }); setNotice(`Đã chuyển hạn “${task.title}” sang ${formatDate(key)}.`) }
        setDropDate('')
      }}><div className="flow-calendar-day-heading"><button aria-label={'Xem ngày ' + formatDate(key, true)} onClick={() => { setDate(day); setView('day') }}>{day.getDate()}{key === todayKey && <span>Hôm nay</span>}</button><button className="flow-calendar-add" aria-label={'Thêm nhiệm vụ ngày ' + formatDate(key, true)} onClick={() => { if (canMutate) onCreate(key) }}><Icon name="plus" size={14} /></button></div>
        {classes.map((slot) => <Link key={slot.id} className="flow-calendar-class" to={'/subjects/' + slot.subjectId}><Icon name="book" size={11} /><span>{slot.start}</span><strong>{data.subjects.find((subject) => subject.id === slot.subjectId)?.name}</strong></Link>)}
        {daily.map((task) => <button key={task.id} className={'flow-calendar-task flow-' + task.status} draggable={canMutate} onDragStart={(event) => startTaskDrag(event, task)} onDragEnd={() => setDropDate('')} onClick={() => openTask(task)} title={task.title + ' · ' + task.dueTime}><span className={'flow-status-dot flow-' + task.status} /><strong>{task.title}</strong>{view !== 'month' && <small>{task.dueTime}</small>}</button>)}
        {!daily.length && !classes.length && view === 'day' && <p className="flow-calendar-no-events">Chưa có nhiệm vụ hoặc lịch học.</p>}
      </section>
    })}</div>
    {canMutate && <p className="flow-calendar-hint">Kéo nhiệm vụ sang ngày khác để đổi hạn.</p>}<span className="sr-only" role="status">{notice}</span>
  </div>
}
