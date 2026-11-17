import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import { FormActions } from './PlannerUI'
import { Icon } from './Icon'
import { CourseNameInput } from './CourseNameInput'
import { subjectColors } from '../api/academic'
import type { Subject } from '../types/planner'
import { normalizeSubjectText, validateSubject } from '../utils/subjectValidation'
import type { SubjectErrors, SubjectFields } from '../utils/subjectValidation'

export function SubjectForm({ subject, defaultSemesterId, onCancel, onSaved }: { subject?: Subject; defaultSemesterId?: string; onCancel: () => void; onSaved: (semesterId: string) => void }) {
  const { canManageSubjects, data, saveSubject, academicBusy } = usePlanner()
  const [error, setError] = useState('')
  const [name, setName] = useState(subject?.name ?? '')
  const [code, setCode] = useState(subject?.code ?? '')
  const [credits, setCredits] = useState(String(subject ? subject.credits || '' : 3))
  const [teacher, setTeacher] = useState(subject?.teacher ?? '')
  const [semesterId, setSemesterId] = useState(subject?.semesterId ?? defaultSemesterId ?? data.selectedSemesterId)
  const [submitted, setSubmitted] = useState(false)
  const fields = { name, code, credits, teacher, semesterId }
  const validation = validateSubject(fields, data.semesters, data.subjects, subject?.id)
  const errors: SubjectErrors = submitted ? validation : {}
  const fieldError = (field: keyof SubjectFields) => errors[field] ? <p id={`subject-${field}-error`} className="form-error" role="alert">{errors[field]}</p> : null
  const attributes = (field: keyof SubjectFields) => ({ 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `subject-${field}-error` : undefined })
  const color = subject?.color ?? 'sage'
  const [pending, setPending] = useState(false)
  const hex = subject?.colorHex ?? subjectColors[color]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageSubjects || pending || academicBusy) return
    setSubmitted(true); setError('')
    if (Object.keys(validation).length) {
      const first = Object.keys(validation)[0]
      event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    setPending(true); setError('')
    try {
      await saveSubject({ id: subject?.id ?? '', semesterId, name: normalizeSubjectText(name), code: code.trim().toUpperCase(), credits: Number(credits), teacher: normalizeSubjectText(teacher), color, colorHex: hex })
      onSaved(semesterId)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được môn học.') }
    finally { setPending(false) }
  }

  return (
    <form className="session-form course-editor" aria-busy={pending} onSubmit={submit} noValidate>
      <div className="course-editor-preview"><span className="course-card-icon"><Icon name="book" size={25} /></span><div><small>MÔN HỌC CỦA BẠN</small><strong>{name.trim() || 'Tên môn học'}</strong></div></div>
      <fieldset disabled={pending || academicBusy || !canManageSubjects} className="course-editor-fields">
        <div>{subject ? <label>Tên môn học <span className="course-required-mark" aria-hidden="true">*</span><input name="name" value={name} onChange={event => setName(event.target.value)} {...attributes('name')} maxLength={200} placeholder="Ví dụ: Lập trình web" required autoFocus /></label> : <CourseNameInput value={name} onChange={setName} validationError={errors.name} errorId="subject-name-error" onSelect={course => { setName(course.ten); setCode(course.kyHieu); setCredits(String(course.soTinChi)) }} />}{fieldError('name')}</div>
        <div className="form-grid"><div><label>Mã môn<input name="code" value={code} onChange={event => setCode(event.target.value)} {...attributes('code')} maxLength={50} placeholder="Ví dụ: IT301" /></label>{fieldError('code')}</div><div><label>Số tín chỉ <span className="course-required-mark" aria-hidden="true">*</span><input name="credits" type="number" min="1" max="30" step="1" required value={credits} onChange={event => setCredits(event.target.value)} {...attributes('credits')} placeholder="1–30" /></label>{fieldError('credits')}</div></div>
        <div><label>Học kỳ <span className="course-required-mark" aria-hidden="true">*</span><select disabled={!!subject} name="semesterId" value={semesterId} onChange={event => setSemesterId(event.target.value)} {...attributes('semesterId')} required><option value="" disabled>Chọn học kỳ</option>{data.semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.name}</option>)}</select></label>{fieldError('semesterId')}</div>
        <div><label>Giảng viên<input name="teacher" value={teacher} onChange={event => setTeacher(event.target.value)} {...attributes('teacher')} maxLength={200} placeholder="Ví dụ: Nguyễn Văn An" /></label>{fieldError('teacher')}</div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={onCancel} disabled={pending || academicBusy || !canManageSubjects} label={pending ? 'Đang lưu…' : subject ? 'Lưu thay đổi' : 'Tạo môn học'} />
    </form>
  )
}
