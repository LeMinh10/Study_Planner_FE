import type { DisplayStatus, PlannerAction, PlannerData, PlannerTask, ScheduleSlot } from '../types/planner'

export const statusLabels = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Hoàn thành', overdue: 'Quá hạn' }
export const kindLabels = { assignment: 'Bài tập', exam: 'Lịch thi', deadline: 'Deadline', project: 'Đồ án' }
export const importanceLabels = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' }
export const dayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function vietnamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return new Date(`${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}T12:00:00`)
}
export function addDays(date: Date, count: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}
export function weekDates(date: Date) {
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}
export function moveMonth(date: Date, count: number) {
  const day = date.getDate()
  const next = new Date(date.getFullYear(), date.getMonth() + count, 1, 12)
  next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  return next
}
export function formatDate(value: string, full = false) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', ...(full ? { year: 'numeric' } : {}) })
}
export function deadline(task: PlannerTask) { return new Date(`${task.dueDate}T${task.dueTime}:00+07:00`).getTime() }
export function taskStatus(task: PlannerTask, now: number): DisplayStatus {
  return task.status !== 'done' && deadline(task) < now ? 'overdue' : task.status
}
export function isLateCompletion(task: PlannerTask) {
  return task.status === 'done' && !!task.completedAt && new Date(task.completedAt).getTime() > deadline(task)
}
export function completion(tasks: PlannerTask[]) {
  return tasks.length ? Math.round(tasks.filter((t) => t.status === 'done').length / tasks.length * 100) : 0
}
export function semesterTasks(data: PlannerData) {
  const ids = new Set(data.subjects.filter((s) => s.semesterId === data.selectedSemesterId).map((s) => s.id))
  return data.tasks.filter((task) => ids.has(task.subjectId))
}
export function priorityScore(task: PlannerTask, now: number) {
  if (task.status === 'done') return -1
  const hours = (deadline(task) - now) / 3600000
  const urgency = hours < 0 ? 1000 + Math.min(30, Math.floor(-hours / 24)) * 10 : hours <= 24 ? 500 : hours <= 72 ? 300 : Math.max(0, 100 - Math.ceil(hours / 24) * 4)
  return urgency + { low: 0, normal: 40, high: 90 }[task.importance] + { assignment: 10, exam: 30, deadline: 10, project: 20 }[task.kind] + Math.min(20, task.subtasks.filter((subtask) => !subtask.done).length * 2)
}
export function prioritizedTasks(tasks: PlannerTask[], now: number) {
  return tasks.filter((task) => task.status !== 'done').sort((a, b) => priorityScore(b, now) - priorityScore(a, now) || deadline(a) - deadline(b) || a.title.localeCompare(b.title, 'vi'))
}
export function priorityReason(task: PlannerTask, now: number) {
  const hours = (deadline(task) - now) / 3600000
  const reason = hours < 0 ? 'Đã quá hạn, cần xử lý trước' : hours <= 24 ? 'Đến hạn trong 24 giờ' : hours <= 72 ? 'Đến hạn trong 3 ngày' : `Đến hạn ${formatDate(task.dueDate)}`
  return `${reason}${task.importance === 'high' ? ' · Mức quan trọng cao' : ''}${task.kind === 'exam' ? ' · Lịch thi' : ''}`
}
export function dueAlerts(tasks: PlannerTask[], now: number) {
  return tasks.filter((task) => task.status !== 'done' && deadline(task) <= now + 72 * 3600000)
    .sort((a, b) => deadline(a) - deadline(b))
    .map((task) => ({ task, overdue: deadline(task) < now, key: `${task.id}:${task.dueDate}:${task.dueTime}:${deadline(task) < now ? 'overdue' : 'soon'}` }))
}
export function minutes(time: string) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) }
export function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot) {
  if (a.id === b.id || a.weekday !== b.weekday) return false
  if (a.date && b.date && a.date !== b.date) return false
  return a.start < b.end && b.start < a.end
}
export function slotsOnDate(data: PlannerData, date: Date) {
  const key = dateKey(date)
  const weekday = (date.getDay() + 6) % 7 + 1
  return data.schedule.filter((slot) => {
    const subject = data.subjects.find((s) => s.id === slot.subjectId)
    const semester = data.semesters.find((s) => s.id === subject?.semesterId)
    return subject?.semesterId === data.selectedSemesterId && semester && key >= semester.startDate && key <= semester.endDate &&
      (slot.date ? slot.date === key : slot.weekday === weekday)
  }).sort((a, b) => a.start.localeCompare(b.start))
}
export function plannerReducer(data: PlannerData, action: PlannerAction): PlannerData {
  function upsert<T extends { id: string }>(items: T[], value: T) { return items.some((item) => item.id === value.id) ? items.map((item) => item.id === value.id ? value : item) : [...items, value] }
  function removeSubjects(ids: Set<string>): PlannerData {
    const taskIds = new Set(data.tasks.filter((task) => ids.has(task.subjectId)).map((task) => task.id))
    return { ...data, subjects: data.subjects.filter((s) => !ids.has(s.id)), schedule: data.schedule.filter((s) => !ids.has(s.subjectId)), tasks: data.tasks.filter((t) => !ids.has(t.subjectId)), readAlerts: data.readAlerts.filter((key) => ![...taskIds].some((id) => key.startsWith(`${id}:`))) }
  }
  switch (action.type) {
    case 'profile': return { ...data, profile: action.value }
    case 'select-semester': return data.semesters.some((s) => s.id === action.id) ? { ...data, selectedSemesterId: action.id } : data
    case 'save-semester': return { ...data, semesters: upsert(data.semesters, action.value), selectedSemesterId: data.selectedSemesterId || action.value.id }
    case 'delete-semester': {
      const remaining = data.semesters.filter((s) => s.id !== action.id)
      return { ...removeSubjects(new Set(data.subjects.filter((s) => s.semesterId === action.id).map((s) => s.id))), semesters: remaining, selectedSemesterId: data.selectedSemesterId === action.id ? remaining[0]?.id ?? '' : data.selectedSemesterId }
    }
    case 'save-subject': return { ...data, subjects: upsert(data.subjects, action.value) }
    case 'delete-subject': return removeSubjects(new Set([action.id]))
    case 'save-slot': return { ...data, schedule: upsert(data.schedule, action.value) }
    case 'delete-slot': return { ...data, schedule: data.schedule.filter((s) => s.id !== action.id) }
    case 'save-task': return { ...data, tasks: upsert(data.tasks, action.value) }
    case 'delete-task': return { ...data, tasks: data.tasks.filter((t) => t.id !== action.id), readAlerts: data.readAlerts.filter((key) => !key.startsWith(`${action.id}:`)) }
    case 'task-status': return { ...data, tasks: data.tasks.map((task) => task.id === action.id ? { ...task, status: action.status, completedAt: action.status === 'done' ? task.completedAt ?? action.now : undefined, subtasks: action.status === 'done' ? task.subtasks.map((subtask) => ({ ...subtask, done: true })) : task.subtasks } : task) }
    case 'toggle-subtask': return { ...data, tasks: data.tasks.map((task) => {
      if (task.id !== action.taskId || !task.subtasks.some((subtask) => subtask.id === action.subtaskId)) return task
      const subtasks = task.subtasks.map((subtask) => subtask.id === action.subtaskId ? { ...subtask, done: !subtask.done } : subtask)
      const done = subtasks.every((subtask) => subtask.done)
      return { ...task, subtasks, status: done ? 'done' : 'doing', completedAt: done ? action.now : undefined }
    }) }
    case 'read-alerts': return { ...data, readAlerts: [...new Set([...data.readAlerts, ...action.keys])] }
  }
}
