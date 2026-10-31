import type { PlannerAction, PlannerTask, Subject, TaskKind, TaskStatus } from '../types/planner'
import { dateKey, deadline, priorityScore } from './planner'
import { taskGroup } from './studentView'

export const taskColumns: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Cần làm' },
  { status: 'doing', label: 'Đang làm' },
  { status: 'done', label: 'Đã xong' },
]
export const TASK_DRAG_TYPE = 'application/x-study-task'

export function filterWorkspaceTasks(tasks: PlannerTask[], options: {
  subject: string; view: string; search: string; kind: string; status: string; sort: string
}, now: number) {
  const search = options.search.trim().toLocaleLowerCase('vi')
  return tasks.filter((task) => (options.subject === 'all' || task.subjectId === options.subject) &&
    (options.view === 'all' || (options.view === 'priority' ? task.status !== 'done' : taskGroup(task, now) === options.view)) &&
    (!search || `${task.title} ${task.description} ${task.subtasks.map((subtask) => subtask.title).join(' ')}`.toLocaleLowerCase('vi').includes(search)) &&
    (options.kind === 'all' || task.kind === options.kind) && (options.status === 'all' || task.status === options.status))
    .sort((a, b) => options.sort === 'name' ? a.title.localeCompare(b.title, 'vi') : options.view === 'priority' || options.sort === 'priority' ? priorityScore(b, now) - priorityScore(a, now) || deadline(a) - deadline(b) : deadline(a) - deadline(b))
}

export function validDateKey(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value
}

export function makeQuickTask(input: { title: string; subjectId: string; date: string; status: TaskStatus; kind?: TaskKind }, subjects: Subject[], now: number, id: string): PlannerTask {
  const title = input.title.trim()
  if (!title || title.length > 150) throw new Error('Nhập tên nhiệm vụ từ 1 đến 150 ký tự.')
  if (!subjects.some((subject) => subject.id === input.subjectId)) throw new Error('Chọn một môn học trong học kỳ này.')
  if (!validDateKey(input.date)) throw new Error('Chọn ngày đến hạn hợp lệ.')
  return { id, title, subjectId: input.subjectId, description: '', kind: input.kind ?? 'assignment', dueDate: input.date, dueTime: '23:59', status: input.status, importance: 'normal', subtasks: [], ...(input.status === 'done' ? { completedAt: new Date(now).toISOString() } : {}) }
}

export function boardDropAction(tasks: PlannerTask[], id: string, status: TaskStatus, now: number): PlannerAction | null {
  const task = tasks.find((item) => item.id === id)
  return task && task.status !== status ? { type: 'task-status', id, status, now: new Date(now).toISOString() } : null
}

export function rescheduleTask(tasks: PlannerTask[], id: string, date: string): PlannerTask | null {
  const task = tasks.find((item) => item.id === id)
  return task && validDateKey(date) && task.dueDate !== date ? { ...task, dueDate: date } : null
}
