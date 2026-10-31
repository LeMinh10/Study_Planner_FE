import type { PlannerData } from '../types/planner'

// No browser storage or seeded records: only API responses may populate the app.
export function createEmptyPlannerData(): PlannerData {
  return {
    version: 1,
    profile: { name: '', email: '', studentId: '', school: '', major: '', year: '', goal: '' },
    semesters: [],
    selectedSemesterId: '',
    subjects: [],
    schedule: [],
    tasks: [],
    readAlerts: [],
  }
}

function isDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) }
function isTime(value: unknown): value is string { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) }
export function isPlannerData(value: unknown): value is PlannerData {
  if (!value || typeof value !== 'object') return false
  const data = value as PlannerData
  if (data.version !== 1 || !data.profile || !['name', 'email', 'studentId', 'school', 'major', 'year', 'goal'].every((key) => typeof data.profile[key as keyof typeof data.profile] === 'string')) return false
  if (!Array.isArray(data.semesters) || !data.semesters.every((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && isDate(s.startDate) && isDate(s.endDate) && s.endDate >= s.startDate)) return false
  if (!Array.isArray(data.subjects) || !data.subjects.every((s) => s && typeof s.id === 'string' && data.semesters.some((semester) => semester.id === s.semesterId) && ['name', 'code', 'teacher'].every((key) => typeof s[key as keyof typeof s] === 'string') && Number.isInteger(s.credits) && s.credits > 0 && ['sage', 'clay', 'lavender', 'blue'].includes(s.color))) return false
  const subjectExists = (id: string) => data.subjects.some((s) => s.id === id)
  return typeof data.selectedSemesterId === 'string' && (data.semesters.length ? data.semesters.some((s) => s.id === data.selectedSemesterId) : data.selectedSemesterId === '') &&
    Array.isArray(data.schedule) && data.schedule.every((s) => s && typeof s.id === 'string' && subjectExists(s.subjectId) && typeof s.title === 'string' && typeof s.room === 'string' && typeof s.note === 'string' && Number.isInteger(s.weekday) && s.weekday >= 1 && s.weekday <= 7 && (!s.date || isDate(s.date)) && isTime(s.start) && isTime(s.end) && s.start < s.end) &&
    Array.isArray(data.tasks) && data.tasks.every((t) => t && typeof t.id === 'string' && subjectExists(t.subjectId) && typeof t.title === 'string' && typeof t.description === 'string' && ['assignment', 'exam', 'deadline', 'project'].includes(t.kind) && ['todo', 'doing', 'done'].includes(t.status) && ['low', 'normal', 'high'].includes(t.importance) && isDate(t.dueDate) && isTime(t.dueTime) && (!t.completedAt || !Number.isNaN(Date.parse(t.completedAt))) && Array.isArray(t.subtasks) && t.subtasks.every((s) => s && typeof s.id === 'string' && typeof s.title === 'string' && typeof s.done === 'boolean')) &&
    Array.isArray(data.readAlerts) && data.readAlerts.every((key) => typeof key === 'string')
}
