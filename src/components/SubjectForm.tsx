import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import { FormActions } from './PlannerUI'
import { Icon } from './Icon'
import { subjectColors } from '../api/academic'
import type { Subject, SubjectColor } from '../types/planner'

const colors: { value: SubjectColor; label: string }[] = [
  { value: 'sage', label: 'Xanh lá' }, { value: 'clay', label: 'Cam đất' },
  { value: 'lavender', label: 'Tím nhạt' }, { value: 'blue', label: 'Xanh dương' },
]

export function SubjectForm({ subject, defaultSemesterId, onCancel, onSaved }: { subject?: Subject; defaultSemesterId?: string; onCancel: () => void; onSaved: (semesterId: string) => void }) {
  const { canManageSubjects, data, saveSubject, academicBusy } = usePlanner()
  const [error, setError] = useState('')
  const [name, setName] = useState(subject?.name ?? '')
  const [color, setColor] = useState<SubjectColor>(subject?.color ?? 'sage')
  const [colorChanged, setColorChanged] = useState(false)
  const [pending, setPending] = useState(false)
  const hex = !colorChanged && subject?.colorHex ? subject.colorHex : subjectColors[color]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageSubjects || pending) return
    const form = new FormData(event.currentTarget)
    const semesterId = subject?.semesterId ?? String(form.get('semesterId'))
    if (!name.trim() || !data.semesters.some((semester) => semester.id === semesterId)) { setError('Nhập tên môn và chọn học kỳ.'); return }
    setPending(true); setError('')
    try {
      await saveSubject({ id: subject?.id ?? '', semesterId, name: name.trim(), code: String(form.get('code')).trim().toLocaleUpperCase('vi'), credits: Number(form.get('credits')), teacher: String(form.get('teacher')).trim(), color, colorHex: hex })
      onSaved(semesterId)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được môn học.') }
    finally { setPending(false) }
  }

  return (
    <form className="session-form course-editor" aria-busy={pending} onSubmit={submit}>
      <div className={`course-editor-preview ${color}`} style={{ '--course-color': hex } as CSSProperties}><span className="course-card-icon"><Icon name="book" size={25} /></span><div><small>MÔN HỌC CỦA BẠN</small><strong>{name.trim() || 'Tên môn học'}</strong></div></div>
      <fieldset disabled={pending || academicBusy || !canManageSubjects} className="course-editor-fields">
        <label>Tên môn học <span className="sr-only">(bắt buộc)</span><input name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="Ví dụ: Lập trình web" required autoFocus /></label>
        <div className="form-grid"><label>Mã môn<input name="code" defaultValue={subject?.code} maxLength={50} placeholder="Ví dụ: IT301" /></label><label>Số tín chỉ<input name="credits" type="number" min="1" max="2147483647" step="1" defaultValue={subject ? subject.credits || '' : 3} placeholder="Chưa xác định" /></label></div>
        <label>Học kỳ<select disabled={!!subject} name="semesterId" defaultValue={subject?.semesterId ?? defaultSemesterId ?? data.selectedSemesterId} required>{data.semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.name}</option>)}</select></label>
        <label>Giảng viên<input name="teacher" defaultValue={subject?.teacher} maxLength={200} placeholder="Tên giảng viên (không bắt buộc)" /></label>
        <fieldset className="course-color-picker"><legend>Màu nhận diện</legend><div>{colors.map((item) => <label key={item.value} className={item.value}><input type="radio" name="color" value={item.value} checked={color === item.value} onChange={() => { setColor(item.value); setColorChanged(true) }} /><span className="course-color-swatch" style={{ backgroundColor: subjectColors[item.value] }}><Icon name="check" size={17} /></span><span>{item.label}</span></label>)}</div></fieldset>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={onCancel} disabled={pending || !canManageSubjects} label={pending ? 'Đang lưu…' : subject ? 'Lưu thay đổi' : 'Tạo môn học'} />
    </form>
  )
}
