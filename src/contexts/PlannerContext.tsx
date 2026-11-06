import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { createEmptyPlannerData } from '../data/planner'
import type { PlannerAction, PlannerData, PlannerTask, Semester, Subject } from '../types/planner'
import * as academic from '../api/academic'
import { useMockApi } from '../api/config'
import { dueAlerts, plannerReducer, semesterTasks } from '../utils/planner'
import { useAuth } from './AuthContext'

interface Confirmation { title: string; message: string; confirm: () => Promise<void> }
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
  canManageSemesters: boolean
  canManageSubjects: boolean
  academicError: string
  academicLoading: boolean
  academicBusy: boolean
  retryAcademic: () => void
  saveSemester: (value: Semester) => Promise<void>
  saveSubject: (value: Subject) => Promise<void>
  loadSubject: (id: string, signal: AbortSignal) => Promise<void>
  loggedIn: boolean
  logout: () => void
}
const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { getAccessToken, isDemo } = auth
  const loggedIn = auth.status === 'authenticated'
  const [plannerData, updateData] = useReducer(plannerReducer, undefined, createEmptyPlannerData)
  const data = { ...plannerData, profile: auth.user ? {
    name: auth.user.name, email: auth.user.email, studentId: auth.user.studentId,
    school: auth.user.school, className: auth.user.className, major: auth.user.major,
  } : plannerData.profile }
  // Tasks and schedules remain read-only until their APIs are integrated.
  const canMutate = false
  const [semesterReady, setSemesterReady] = useState(false)
  const [subjectReady, setSubjectReady] = useState(false)
  const [academicError, setAcademicError] = useState('')
  const [academicLoading, setAcademicLoading] = useState(false)
  const [academicBusy, setAcademicBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const writeVersion = useRef(0)
  const busy = useRef(false)
  const canManageSemesters = loggedIn && semesterReady && !academicLoading && !academicBusy
  const canManageSubjects = loggedIn && subjectReady && !academicLoading && !academicBusy
  const dispatch: Dispatch<PlannerAction> = useCallback((action) => {
    if (action.type === 'select-semester') updateData(action)
  }, [])
  const [now, setNow] = useState(Date.now)
  const [taskEditor, setTaskEditor] = useState<PlannerTask | null | undefined>(undefined)
  const [taskSubjectId, setTaskSubjectId] = useState<string | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const tasks = semesterTasks(data)
  const alerts = dueAlerts(tasks, now)

  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    updateData({ type: 'reset' })
    setSemesterReady(false); setSubjectReady(false); setConfirmation(null)
    setAcademicError(''); setAcademicLoading(false)
    busy.current = false; setAcademicBusy(false)
    if (!loggedIn || isDemo || useMockApi) return
    setAcademicLoading(true)
    async function load() {
      try {
        const token = getAccessToken()
        const semesters = await academic.listSemesters(token, controller.signal)
        if (current !== generation.current) return
        updateData({ type: 'load-academic', semesters, subjects: [] })
        setSemesterReady(true)
        const subjects = (await Promise.all(semesters.map((semester) => academic.listSubjects(token, semester.id, controller.signal)))).flat()
        if (current !== generation.current) return
        updateData({ type: 'load-academic', semesters, subjects })
        setSubjectReady(true)
      } catch (error) {
        if (current === generation.current && !controller.signal.aborted) setAcademicError(error instanceof Error ? error.message : 'Không tải được học kỳ/môn học.')
      } finally { if (current === generation.current) setAcademicLoading(false) }
    }
    void load()
    return () => { generation.current = current + 1; controller.abort() }
  }, [loggedIn, isDemo, getAccessToken, revision])

  async function saveSemester(value: Semester) {
    if (!canManageSemesters || busy.current) throw new Error('Học kỳ chưa sẵn sàng để ghi dữ liệu.')
    const current = generation.current
    writeVersion.current++
    busy.current = true; setAcademicBusy(true)
    try {
      const saved = await academic.saveSemester(getAccessToken(), value)
      if (current === generation.current) updateData({ type: 'save-semester', value: saved })
    } finally { if (current === generation.current) { busy.current = false; setAcademicBusy(false) } }
  }
  async function saveSubject(value: Subject) {
    if (!canManageSubjects || busy.current) throw new Error('Môn học chưa sẵn sàng để ghi dữ liệu.')
    const original = data.subjects.find((item) => item.id === value.id)
    if (value.id && (!original || original.semesterId !== value.semesterId)) throw new Error('Không thể chuyển học kỳ của môn học.')
    const current = generation.current
    writeVersion.current++
    busy.current = true; setAcademicBusy(true)
    try {
      const saved = await academic.saveSubject(getAccessToken(), value)
      if (current === generation.current) updateData({ type: 'save-subject', value: saved })
    } finally { if (current === generation.current) { busy.current = false; setAcademicBusy(false) } }
  }

  const loadSubject = useCallback(async (id: string, signal: AbortSignal) => {
    if (!subjectReady) return
    const current = generation.current
    const version = writeVersion.current
    const value = await academic.getSubject(getAccessToken(), id, signal)
    if (current === generation.current && version === writeVersion.current && !signal.aborted) updateData({ type: 'save-subject', value })
  }, [subjectReady, getAccessToken])

  function logout() {
    auth.logout()
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
    if (kind !== 'semester' && kind !== 'subject') return
    if (!(kind === 'semester' ? canManageSemesters : canManageSubjects) || busy.current) return
    const current = generation.current
    const token = getAccessToken()
    busy.current = true; setAcademicBusy(true); setAcademicError('')
    void academic.deletionPreview(token, kind, id).then((preview) => {
      if (current !== generation.current) return
      const name = kind === 'semester' ? data.semesters.find((item) => item.id === id)?.name : data.subjects.find((item) => item.id === id)?.name
      setConfirmation({ title: 'Xóa ' + (kind === 'semester' ? 'học kỳ' : 'môn học') + '?', message: '“' + name + '” sẽ được xóa. ' + (kind === 'semester' ? preview.courses + ' môn học và ' : '') + preview.sessions + ' buổi học liên quan bị xóa. ' + preview.tasks + ' nhiệm vụ được giữ lại và bỏ liên kết ' + (kind === 'semester' ? 'học kỳ/môn học' : 'môn học') + '. Bạn không thể hoàn tác thao tác này.', confirm: async () => {
        if (current !== generation.current || busy.current) return
        writeVersion.current++
        busy.current = true; setAcademicBusy(true)
        try {
          await academic.deleteAcademic(token, kind, id)
          if (current !== generation.current) return
          updateData({ type: kind === 'semester' ? 'delete-semester' : 'delete-subject', id })
          setConfirmation(null)
        } finally { if (current === generation.current) { busy.current = false; setAcademicBusy(false) } }
      } })
    }).catch((error) => { if (current === generation.current) setAcademicError(error instanceof Error ? error.message : 'Không tải được ảnh hưởng khi xóa.') })
      .finally(() => { if (current === generation.current) { busy.current = false; setAcademicBusy(false) } })
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

  return <PlannerContext.Provider value={{ data, dispatch, now, tasks, alerts, taskEditor, openTask, editTask, createTask, taskSubjectId, taskDetails: data.tasks.find((task) => task.id === detailId), closeDetails: () => setDetailId(undefined), closeTask: () => setTaskEditor(undefined), confirmation, requestDelete, closeConfirmation: () => { if (!busy.current) setConfirmation(null) }, canManageSemesters, canManageSubjects, academicError, academicLoading, academicBusy, retryAcademic: () => setRevision((value) => value + 1), saveSemester, saveSubject, loadSubject, canMutate, loggedIn, logout }}>{children}</PlannerContext.Provider>
}
export function usePlanner() {
  const context = useContext(PlannerContext)
  if (!context) throw new Error('PlannerProvider is required')
  return context
}
