import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import { FormActions, Modal } from '../components/PlannerUI'
import type { Semester } from '../types/planner'
import { dateKey, vietnamToday } from '../utils/planner'

export function SemesterEditor({ semester, onClose }: { semester: Semester | null; onClose: () => void }) {
  const { canManageSemesters, saveSemester } = usePlanner()
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageSemesters) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const startDate = String(form.get('startDate'))
    const endDate = String(form.get('endDate'))
    if (!name || endDate < startDate) { setError('Tên học kỳ không được trống; ngày kết thúc phải từ ngày bắt đầu trở đi.'); return }
    try {
      await saveSemester({ id: semester?.id ?? '', name, startDate, endDate })
      onClose()
    } catch (error) { setError(error instanceof Error ? error.message : 'Không lưu được học kỳ.') }
  }
  return <Modal title={semester ? 'Chỉnh sửa học kỳ' : 'Thêm học kỳ'} onClose={onClose}><form className="session-form" onSubmit={submit}><label>Tên học kỳ<input name="name" defaultValue={semester?.name} maxLength={200} placeholder="Học kỳ I · 2026–2027" required autoFocus /></label><div className="form-grid"><label>Ngày bắt đầu<input type="date" name="startDate" defaultValue={semester?.startDate ?? dateKey(vietnamToday())} required /></label><label>Ngày kết thúc<input type="date" name="endDate" defaultValue={semester?.endDate} required /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<FormActions onClose={onClose} disabled={!canManageSemesters} /></form></Modal>
}
