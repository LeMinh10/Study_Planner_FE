import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { createEmptyPlannerData } from '../data/planner'
import type { PlannerAction, PlannerData, PlannerTask } from '../types/planner'
import { dueAlerts, plannerReducer, semesterTasks } from '../utils/planner'
import { DEMO_ACCOUNT, hasDemoSession, matchesDemoAccount, saveDemoSession } from '../utils/demoAuth'

interface Confirmation { title: string; message: string; confirm: () => void }
interface PlannerContextValue {
  data: PlannerData
  dispatch: Dispatch<PlannerAction>
  now: number
  tasks: PlannerTask[]
  alerts: ReturnType<typeof dueAlerts>
  taskEditor: PlannerTask | null | undefined
  openTask: (task?: PlannerTask) => void
  editTask: (task: PlannerTask) => void
  createTask: (subjectId?: string) => void
  taskSubjectId: string | undefined
  taskDetails: PlannerTask | undefined
  closeDetails: () => void
  closeTask: () => void
  confirmation: Confirmation | null
  requestDelete: (kind: 'semester' | 'subject' | 'slot' | 'task', id: string) => void
  closeConfirmation: () => void
  canMutate: boolean
  loggedIn: boolean
  loginDemo: (email: string, password: string) => boolean
  logout: () => void
}
const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(hasDemoSession)
  const [data, updateData] = useReducer(plannerReducer, undefined, () => {
    const initial = createEmptyPlannerData()
    if (loggedIn) initial.profile = { ...initial.profile, name: DEMO_ACCOUNT.name, email: DEMO_ACCOUNT.email }
    return initial
  })
  // Enable writes only after replacing local mutations with confirmed API responses.
  const canMutate = false
  const dispatch: Dispatch<PlannerAction> = (action) => {
    if (action.type === 'select-semester') updateData(action)
  }
  const [now, setNow] = useState(Date.now)
  const [taskEditor, setTaskEditor] = useState<PlannerTask | null | undefined>(undefined)
  const [taskSubjectId, setTaskSubjectId] = useState<string | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const tasks = semesterTasks(data)
  const alerts = dueAlerts(tasks, now)

  function loginDemo(email: string, password: string) {
    if (!matchesDemoAccount(email, password)) return false
    updateData({ type: 'profile', value: { ...data.profile, name: DEMO_ACCOUNT.name, email: DEMO_ACCOUNT.email } })
    saveDemoSession(true)
    setLoggedIn(true)
    return true
  }

  function logout() {
    saveDemoSession(false)
    setLoggedIn(false)
    updateData({ type: 'profile', value: createEmptyPlannerData().profile })
    setTaskEditor(undefined)
    setDetailId(undefined)
    setConfirmation(null)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    function refresh() { setNow(Date.now()) }
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  function requestDelete(kind: 'semester' | 'subject' | 'slot' | 'task', id: string) {
    if (!canMutate) return
    const name = kind === 'semester' ? data.semesters.find((s) => s.id === id)?.name : kind === 'subject' ? data.subjects.find((s) => s.id === id)?.name : kind === 'slot' ? data.schedule.find((s) => s.id === id)?.title : data.tasks.find((t) => t.id === id)?.title
    const subjectIds = kind === 'semester' ? data.subjects.filter((s) => s.semesterId === id).map((s) => s.id) : kind === 'subject' ? [id] : []
    const linkedTasks = data.tasks.filter((t) => subjectIds.includes(t.subjectId)).length
    const linkedSlots = data.schedule.filter((s) => subjectIds.includes(s.subjectId)).length
    setConfirmation({ title: `Xóa ${kind === 'semester' ? 'học kỳ' : kind === 'subject' ? 'môn học' : kind === 'slot' ? 'lịch học' : 'nhiệm vụ'}?`, message: `“${name}” sẽ được xóa.${subjectIds.length ? ` Thao tác này cũng xóa ${kind === 'semester' ? `${subjectIds.length} môn học, ` : ''}${linkedTasks} nhiệm vụ và ${linkedSlots} lịch học liên quan.` : ''} Bạn không thể hoàn tác thao tác này.`, confirm: () => {
      if (kind === 'semester') dispatch({ type: 'delete-semester', id })
      else if (kind === 'subject') dispatch({ type: 'delete-subject', id })
      else if (kind === 'slot') dispatch({ type: 'delete-slot', id })
      else dispatch({ type: 'delete-task', id })
      setConfirmation(null)
    } })
  }

  function createTask(subjectId?: string) {
    if (!canMutate) return
    setDetailId(undefined)
    setTaskSubjectId(subjectId)
    setTaskEditor(null)
  }
  function openTask(task?: PlannerTask) {
    if (!task) { createTask(); return }
    setTaskEditor(undefined)
    setDetailId(task.id)
  }
  function editTask(task: PlannerTask) {
    if (!canMutate) return
    setDetailId(undefined)
    setTaskSubjectId(undefined)
    setTaskEditor(task)
  }

  return <PlannerContext.Provider value={{ data, dispatch, now, tasks, alerts, taskEditor, openTask, editTask, createTask, taskSubjectId, taskDetails: data.tasks.find((task) => task.id === detailId), closeDetails: () => setDetailId(undefined), closeTask: () => setTaskEditor(undefined), confirmation, requestDelete, closeConfirmation: () => setConfirmation(null), canMutate, loggedIn, loginDemo, logout }}>{children}</PlannerContext.Provider>
}
export function usePlanner() {
  const context = useContext(PlannerContext)
  if (!context) throw new Error('PlannerProvider is required')
  return context
}
