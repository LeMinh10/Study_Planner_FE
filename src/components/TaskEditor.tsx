import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import { FormActions, Modal } from './PlannerUI'
import { Icon } from './Icon'
import type { Importance, PlannerTask, Subtask, TaskKind, TaskStatus } from '../types/planner'
import { addDays, dateKey, importanceLabels, kindLabels, statusLabels, vietnamToday } from '../utils/planner'

export function TaskEditor({ task, initialSubjectId, onClose }: { task: PlannerTask | null; initialSubjectId?: string; onClose: () => void }) {
  const { canMutate, data, dispatch } = usePlanner()
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? [])
  const [newSubtask, setNewSubtask] = useState('')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [error, setError] = useState('')
  const semesterId = data.subjects.find((subject) => subject.id === (task?.subjectId ?? initialSubjectId))?.semesterId ?? data.selectedSemesterId
  const subjects = data.subjects.filter((subject) => subject.semesterId === semesterId)

  function changeSubtasks(next: Subtask[]) {
    setSubtasks(next)
    if (next.length && next.every((subtask) => subtask.done)) setStatus('done')
    else if (status === 'done' && next.some((subtask) => !subtask.done)) setStatus('doing')
  }
  function addSubtask() {
    if (!newSubtask.trim()) return
    changeSubtasks([...subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canMutate) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    const subjectId = String(form.get('subjectId'))
    if (!title || !data.subjects.some((subject) => subject.id === subjectId)) { setError('Nhập tên nhiệm vụ và chọn một môn học.'); return }
    if (subtasks.some((subtask) => !subtask.title.trim())) { setError('Tên nhiệm vụ nhỏ không được để trống.'); return }
    const nextSubtasks = (newSubtask.trim() ? [...subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }] : subtasks).map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
    dispatch({ type: 'save-task', value: {
      id: task?.id ?? crypto.randomUUID(), subjectId, title,
      description: String(form.get('description')).trim(), kind: String(form.get('kind')) as TaskKind,
      dueDate: String(form.get('dueDate')), dueTime: String(form.get('dueTime')),
      status, importance: String(form.get('importance')) as Importance,
      subtasks: status === 'done' ? nextSubtasks.map((subtask) => ({ ...subtask, done: true })) : nextSubtasks,
      completedAt: status === 'done' ? task?.completedAt ?? new Date().toISOString() : undefined,
    } })
    onClose()
  }

  return <Modal title={task ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ'} onClose={onClose} wide>
    <form className="session-form" onSubmit={submit}>
      <label>Tên nhiệm vụ<input name="title" defaultValue={task?.title} maxLength={150} placeholder="Ví dụ: Hoàn thành bài tập chương 3" required autoFocus /></label>
      <div className="form-grid"><label>Môn học<select name="subjectId" defaultValue={task?.subjectId ?? initialSubjectId ?? subjects[0]?.id} required><option value="" disabled>Chọn môn học</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Loại nhiệm vụ<select name="kind" defaultValue={task?.kind ?? 'assignment'}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="form-grid"><label>Ngày đến hạn<input name="dueDate" type="date" defaultValue={task?.dueDate ?? dateKey(addDays(vietnamToday(), 1))} required /></label><label>Giờ đến hạn<input name="dueTime" type="time" defaultValue={task?.dueTime ?? '23:59'} required /></label></div>
      <div className="form-grid"><label>Trạng thái<select name="status" value={status} onChange={(event) => { const next = event.target.value as TaskStatus; setStatus(next); if (next === 'done') setSubtasks(subtasks.map((subtask) => ({ ...subtask, done: true }))) }}>{(['todo', 'doing', 'done'] as const).map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label><label>Mức quan trọng<select name="importance" defaultValue={task?.importance ?? 'normal'}>{Object.entries(importanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      <label>Mô tả<textarea name="description" defaultValue={task?.description} rows={3} maxLength={2000} placeholder="Nội dung cần làm, yêu cầu nộp bài, tài liệu…" /></label>
      <fieldset className="subtask-editor"><legend>Chia thành nhiệm vụ nhỏ <span>{subtasks.filter((subtask) => subtask.done).length}/{subtasks.length}</span></legend>
        {subtasks.map((subtask) => <div className="subtask-edit-row" key={subtask.id}><input type="checkbox" checked={subtask.done} aria-label={`Hoàn thành ${subtask.title}`} onChange={() => changeSubtasks(subtasks.map((item) => item.id === subtask.id ? { ...item, done: !item.done } : item))} /><input value={subtask.title} aria-label="Tên nhiệm vụ nhỏ" maxLength={180} required onChange={(event) => setSubtasks(subtasks.map((item) => item.id === subtask.id ? { ...item, title: event.target.value } : item))} /><button type="button" className="icon-button" aria-label={`Xóa ${subtask.title}`} onClick={() => changeSubtasks(subtasks.filter((item) => item.id !== subtask.id))}><Icon name="close" size={16} /></button></div>)}
        <div className="add-subtask-row"><input value={newSubtask} placeholder="Thêm một nhiệm vụ nhỏ…" maxLength={180} aria-label="Nhiệm vụ nhỏ mới" onChange={(event) => { setNewSubtask(event.target.value); if (status === 'done' && event.target.value.trim()) setStatus('doing') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubtask() } }} /><button type="button" className="button button-secondary" onClick={addSubtask} disabled={!newSubtask.trim()}><Icon name="plus" size={15} />Thêm</button></div>
      </fieldset>
      <p className="field-hint">Trạng thái quá hạn được tính tự động theo hạn nộp. Chọn hoàn thành sẽ hoàn tất các nhiệm vụ nhỏ.</p>
      {error && <p className="form-error" role="alert">{error}</p>}<FormActions onClose={onClose} label={task ? 'Lưu nhiệm vụ' : 'Tạo nhiệm vụ'} />
    </form>
  </Modal>
}
