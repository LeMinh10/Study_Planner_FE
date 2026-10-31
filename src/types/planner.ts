export type TaskStatus = 'todo' | 'doing' | 'done'
export type DisplayStatus = TaskStatus | 'overdue'
export type TaskKind = 'assignment' | 'exam' | 'deadline' | 'project'
export type Importance = 'low' | 'normal' | 'high'
export type SubjectColor = 'sage' | 'clay' | 'lavender' | 'blue'

export interface Profile {
  name: string
  email: string
  studentId: string
  school: string
  major: string
  year: string
  goal: string
}

export interface Semester { id: string; name: string; startDate: string; endDate: string }
export interface Subject { id: string; semesterId: string; code: string; name: string; credits: number; teacher: string; color: SubjectColor }
export interface ScheduleSlot {
  id: string
  subjectId: string
  title: string
  weekday: number
  date?: string
  start: string
  end: string
  room: string
  note: string
}
export interface Subtask { id: string; title: string; done: boolean }
export interface PlannerTask {
  id: string
  subjectId: string
  title: string
  description: string
  kind: TaskKind
  dueDate: string
  dueTime: string
  status: TaskStatus
  importance: Importance
  subtasks: Subtask[]
  completedAt?: string
}
export interface PlannerData {
  version: 1
  profile: Profile
  semesters: Semester[]
  selectedSemesterId: string
  subjects: Subject[]
  schedule: ScheduleSlot[]
  tasks: PlannerTask[]
  readAlerts: string[]
}

export type PlannerAction =
  | { type: 'profile'; value: Profile }
  | { type: 'select-semester'; id: string }
  | { type: 'save-semester'; value: Semester }
  | { type: 'delete-semester'; id: string }
  | { type: 'save-subject'; value: Subject }
  | { type: 'delete-subject'; id: string }
  | { type: 'save-slot'; value: ScheduleSlot }
  | { type: 'delete-slot'; id: string }
  | { type: 'save-task'; value: PlannerTask }
  | { type: 'delete-task'; id: string }
  | { type: 'task-status'; id: string; status: TaskStatus; now: string }
  | { type: 'toggle-subtask'; taskId: string; subtaskId: string; now: string }
  | { type: 'read-alerts'; keys: string[] }
