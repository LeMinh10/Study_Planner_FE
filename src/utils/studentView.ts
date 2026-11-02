import type { PlannerData, PlannerTask } from '../types/planner'
import { addDays, dateKey, deadline, taskStatus, vietnamToday } from './planner'

export type TaskGroup = 'today' | 'upcoming' | 'overdue' | 'done'

export function taskGroup(task: PlannerTask, now: number): TaskGroup {
  if (task.status === 'done') return 'done'
  if (taskStatus(task, now) === 'overdue') return 'overdue'
  return task.dueDate === dateKey(vietnamToday(new Date(now))) ? 'today' : 'upcoming'
}

export function taskDueLabel(task: PlannerTask, now: number) {
  const today = vietnamToday(new Date(now))
  const label = task.dueDate === dateKey(today) ? 'Hôm nay' : task.dueDate === dateKey(addDays(today, 1)) ? 'Ngày mai' : new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })
  return `${taskStatus(task, now) === 'overdue' ? 'Quá hạn · ' : ''}${label}, ${task.dueTime}`
}

export function upcomingClasses(data: PlannerData, now: number, subjectId?: string, limit = 3) {
  const today = vietnamToday(new Date(now))
  const occurrences = []
  for (const slot of data.schedule) {
    const subject = data.subjects.find((item) => item.id === slot.subjectId)
    if (!subject || (subjectId ? subject.id !== subjectId : subject.semesterId !== data.selectedSemesterId)) continue
    const semester = data.semesters.find((item) => item.id === subject.semesterId)
    if (!semester) continue
    const start = dateKey(today) < semester.startDate ? new Date(`${semester.startDate}T12:00:00`) : today
    const candidates = slot.date ? [new Date(`${slot.date}T12:00:00`)] : Array.from({ length: 14 }, (_, index) => addDays(start, index))
    for (const date of candidates) {
      const key = dateKey(date)
      if (key < semester.startDate || key > semester.endDate || (!slot.date && (date.getDay() + 6) % 7 + 1 !== slot.weekday)) continue
      const startsAt = new Date(`${key}T${slot.start}:00+07:00`).getTime()
      const endsAt = new Date(`${key}T${slot.end}:00+07:00`).getTime()
      if (endsAt <= now) continue
      occurrences.push({ slot, subject, date, startsAt, endsAt })
    }
  }
  return occurrences.sort((a, b) => a.startsAt - b.startsAt || a.subject.name.localeCompare(b.subject.name, 'vi')).slice(0, limit)
}

export function closestTask(tasks: PlannerTask[], now: number) {
  return tasks.filter((task) => task.status !== 'done' && deadline(task) >= now).sort((a, b) => deadline(a) - deadline(b))[0]
}
