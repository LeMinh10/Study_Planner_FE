import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { CalendarNav, EmptyState, FormActions, Modal, NoSubjectsNotice, PageHeading } from '../../components/PlannerUI'
import { usePlanner } from '../../contexts/PlannerContext'
import type { ScheduleSlot } from '../../types/planner'
import { addDays, dateKey, dayLabels, formatDate, minutes, slotsOnDate, slotsOverlap, vietnamToday, weekDates } from '../../utils/planner'

export function SchedulePage() {
  const { canMutate, data, requestDelete, now } = usePlanner()
  const [date, setDate] = useState(() => vietnamToday())
  const [editing, setEditing] = useState<ScheduleSlot | null | undefined>()
  const [view, setView] = useState<'board' | 'list'>('board')
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId)
  const dates = weekDates(date)
  const weekSlots = dates.map((day) => slotsOnDate(data, day))
  const allSlots = data.schedule.filter((slot) => subjects.some((subject) => subject.id === slot.subjectId)).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
  const startHour = Math.min(7, ...weekSlots.flat().map((slot) => Math.floor(minutes(slot.start) / 60)))
  const endHour = Math.max(20, ...weekSlots.flat().map((slot) => Math.ceil(minutes(slot.end) / 60)))
  const height = (endHour - startHour) * 46

  return <>
    <CalendarNav />
    <PageHeading title="Thời khóa biểu"><button className="button button-primary" onClick={() => { if (canMutate) setEditing(null) }}><Icon name="plus" size={17} />Thêm lịch học</button></PageHeading>
    {!subjects.length && <NoSubjectsNotice />}
    <section className="paper-panel data-panel"><div className="view-toolbar"><div className="date-navigation"><button className="icon-button" aria-label="Tuần trước" onClick={() => setDate(addDays(date, -7))}><Icon name="chevron-left" size={18} /></button><strong>{formatDate(dateKey(dates[0]))} — {formatDate(dateKey(dates[6]), true)}</strong><button className="icon-button" aria-label="Tuần sau" onClick={() => setDate(addDays(date, 7))}><Icon name="chevron-right" size={18} /></button><button className="subtle-button" onClick={() => setDate(vietnamToday())}>Tuần này</button></div><div className="segmented-control" role="group" aria-label="Kiểu thời khóa biểu"><button className={view === 'board' ? 'active' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}>Bảng tuần</button><button className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>Danh sách</button></div></div>
      {view === 'board' ? <div className="timetable"><div className="timetable-header"><span>GIỜ</span>{dates.map((day, index) => <div key={dateKey(day)} className={dateKey(day) === dateKey(vietnamToday(new Date(now))) ? 'today-column' : ''}><span>{dayLabels[index]}</span><strong>{formatDate(dateKey(day))}</strong></div>)}</div><div className="timetable-grid" style={{ height }}><div className="time-axis">{Array.from({ length: endHour - startHour }, (_, index) => <span key={index} style={{ top: index * 46 }}>{String(startHour + index).padStart(2, '0')}:00</span>)}</div>{weekSlots.map((slots, index) => <div className="timetable-day" key={dateKey(dates[index])}>{slots.map((slot) => {
        const subject = data.subjects.find((item) => item.id === slot.subjectId)!
        return <button key={slot.id} className={`timetable-slot ${subject.color}`} style={{ top: (minutes(slot.start) - startHour * 60) / 60 * 46, height: Math.max(28, (minutes(slot.end) - minutes(slot.start)) / 60 * 46 - 3) }} onClick={() => { if (canMutate) setEditing(slot) }} title={`${subject.name} · ${slot.start}–${slot.end} · ${slot.room}`}><span>{slot.start} — {slot.end}</span><strong>{subject.name}</strong><small>{slot.room || 'Chưa có phòng'}</small></button>
      })}</div>)}</div>{!weekSlots.flat().length && <p className="calendar-empty-note">Tuần này chưa có lịch học trong học kỳ đang chọn.</p>}</div> : allSlots.length ? <table className="data-table"><thead><tr><th>Môn học / nội dung</th><th>Ngày học</th><th>Thời gian</th><th>Phòng học</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{allSlots.map((slot) => <tr key={slot.id}><td><button className="table-title" onClick={() => { if (canMutate) setEditing(slot) }}>{data.subjects.find((subject) => subject.id === slot.subjectId)?.name}</button><small>{slot.title}</small></td><td>{slot.date ? formatDate(slot.date, true) : `${dayLabels[slot.weekday - 1]} hằng tuần`}</td><td>{slot.start} — {slot.end}</td><td>{slot.room || 'Chưa cập nhật'}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Sửa ${slot.title}`} onClick={() => { if (canMutate) setEditing(slot) }}><Icon name="edit" size={16} /></button><button className="icon-button danger-icon" aria-label={`Xóa ${slot.title}`} onClick={() => requestDelete('slot', slot.id)}><Icon name="trash" size={16} /></button></div></td></tr>)}</tbody></table> : <EmptyState title="Chưa có lịch học" />}
    </section>
    {editing !== undefined && <SlotEditor slot={editing} onClose={() => setEditing(undefined)} />}
  </>
}

function SlotEditor({ slot, onClose }: { slot: ScheduleSlot | null; onClose: () => void }) {
  const { canMutate, data, dispatch, requestDelete } = usePlanner()
  const [error, setError] = useState('')
  const [repeat, setRepeat] = useState(slot?.date ? 'date' : 'weekly')
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canMutate) return
    const form = new FormData(event.currentTarget)
    const subjectId = String(form.get('subjectId'))
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) { setError('Chọn một môn học hợp lệ.'); return }
    const semester = data.semesters.find((item) => item.id === subject.semesterId)!
    const date = repeat === 'date' ? String(form.get('date')) : undefined
    const value: ScheduleSlot = { id: slot?.id ?? crypto.randomUUID(), subjectId, title: String(form.get('title')).trim() || subject.name, weekday: date ? (new Date(`${date}T12:00:00`).getDay() + 6) % 7 + 1 : Number(form.get('weekday')), date, start: String(form.get('start')), end: String(form.get('end')), room: String(form.get('room')).trim(), note: String(form.get('note')).trim() }
    if (value.end <= value.start) { setError('Giờ kết thúc phải sau giờ bắt đầu.'); return }
    if (date && (date < semester.startDate || date > semester.endDate)) { setError('Ngày học cần nằm trong khoảng thời gian của học kỳ.'); return }
    const conflict = data.schedule.find((item) => subjects.some((subject) => subject.id === item.subjectId) && (!item.date || (item.date >= semester.startDate && item.date <= semester.endDate)) && slotsOverlap(value, item))
    if (conflict) { setError(`Trùng với lịch “${conflict.title}” (${conflict.start}–${conflict.end}). Vui lòng chọn khung giờ khác.`); return }
    dispatch({ type: 'save-slot', value })
    onClose()
  }
  return <Modal title={slot ? 'Chỉnh sửa lịch học' : 'Thêm lịch học'} onClose={onClose}><form className="session-form" onSubmit={submit}><label>Môn học<select name="subjectId" defaultValue={slot?.subjectId ?? subjects[0]?.id} required>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label>Nội dung buổi học<input name="title" defaultValue={slot?.title} maxLength={120} placeholder="Để trống để dùng tên môn học" /></label><label>Lặp lại<select value={repeat} onChange={(event) => setRepeat(event.target.value)}><option value="weekly">Hằng tuần trong học kỳ</option><option value="date">Một ngày cụ thể</option></select></label>{repeat === 'weekly' ? <label>Ngày trong tuần<select name="weekday" defaultValue={slot?.weekday ?? 1}>{dayLabels.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}</select></label> : <label>Ngày học<input type="date" name="date" defaultValue={slot?.date ?? dateKey(vietnamToday())} required /></label>}<div className="form-grid"><label>Bắt đầu<input name="start" type="time" defaultValue={slot?.start ?? '08:00'} required /></label><label>Kết thúc<input name="end" type="time" defaultValue={slot?.end ?? '09:30'} required /></label></div><label>Phòng học / địa điểm<input name="room" defaultValue={slot?.room} maxLength={100} placeholder="Ví dụ: A.203 hoặc học trực tuyến" /></label><label>Ghi chú<textarea name="note" defaultValue={slot?.note} rows={2} maxLength={500} /></label>{error && <p className="form-error" role="alert">{error}</p>}<FormActions onClose={onClose} />{slot && <button type="button" className="text-button danger-text" onClick={() => { onClose(); requestDelete('slot', slot.id) }}>Xóa lịch học này</button>}</form></Modal>
}
