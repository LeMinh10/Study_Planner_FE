import { DateInput } from '../components/DateInput'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import { FormActions, Modal } from '../components/PlannerUI'
import type { Semester } from '../types/planner'
import { displayDate, parseDate } from '../utils/dateInput'
import { normalizeSemesterName, validateSemester } from '../utils/semesterValidation'
import type { SemesterFields } from '../utils/semesterValidation'
import './semesterEditor.css'

export function SemesterEditor({ semester, onClose }: { semester: Semester | null; onClose: () => void }) {
  const { canManageSemesters, saveSemester, data, academicBusy } = usePlanner()
  const [error, setError] = useState('')
  const [fields, setFields] = useState<SemesterFields>({ name: semester?.name ?? '', startDate: displayDate(semester?.startDate ?? ''), endDate: displayDate(semester?.endDate ?? '') })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const validation = validateSemester(fields, data.semesters, semester?.id)
  const errors = submitted ? validation : {}
  const update = (field: keyof SemesterFields, value: string) => setFields(previous => ({ ...previous, [field]: value }))
  const attributes = (field: keyof SemesterFields) => ({ id: `semester-${field}`, 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `semester-${field}-error` : undefined })
  const fieldError = (field: keyof SemesterFields) => errors[field] ? <p className="form-error" id={`semester-${field}-error`} role="alert">{errors[field]}</p> : null
  const close = () => { if (!pending) onClose() }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageSemesters || pending || academicBusy) return
    setSubmitted(true); setError('')
    if (Object.keys(validation).length) {
      event.currentTarget.querySelector<HTMLElement>(`#semester-${Object.keys(validation)[0]}`)?.focus()
      return
    }
    setPending(true)
    try {
      await saveSemester({ id: semester?.id ?? '', name: normalizeSemesterName(fields.name), startDate: parseDate(fields.startDate)!, endDate: parseDate(fields.endDate)! })
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được học kỳ.') }
    finally { setPending(false) }
  }

  return <Modal title={semester ? 'Chỉnh sửa học kỳ' : 'Thêm học kỳ'} onClose={close}>
    <form className="session-form semester-editor" onSubmit={submit} noValidate aria-busy={pending}>
      <fieldset disabled={pending || academicBusy || !canManageSemesters}>
        <div><label htmlFor="semester-name">Tên học kỳ <span className="semester-required-mark" aria-hidden="true">*</span></label><input name="name" value={fields.name} onChange={event => update('name', event.target.value)} {...attributes('name')} maxLength={200} placeholder="Học kỳ I · 2026–2027" required autoFocus />{fieldError('name')}</div>
        <div className="form-grid">
          <div><label htmlFor="semester-startDate">Ngày bắt đầu <span className="semester-required-mark" aria-hidden="true">*</span></label><DateInput name="startDate" defaultValue={semester?.startDate} onTextChange={text => update('startDate', text)} {...attributes('startDate')} required />{fieldError('startDate')}</div>
          <div><label htmlFor="semester-endDate">Ngày kết thúc <span className="semester-required-mark" aria-hidden="true">*</span></label><DateInput name="endDate" defaultValue={semester?.endDate} onTextChange={text => update('endDate', text)} {...attributes('endDate')} required />{fieldError('endDate')}</div>
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={close} label={pending ? 'Đang lưu…' : 'Xác nhận'} showIcon={false} disabled={pending || academicBusy || !canManageSemesters} />
    </form>
  </Modal>
}
