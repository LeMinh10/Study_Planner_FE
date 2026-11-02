import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import type { Importance, PlannerTask, TaskKind, TaskStatus } from '../types/planner'
import { addDays, dateKey, importanceLabels, kindLabels, vietnamToday } from '../utils/planner'
import { taskColumns } from '../utils/workspace'
import { ActionMenu } from './ActionMenu'
import { Icon } from './Icon'

export function TaskActionMenu({ task }: { task: PlannerTask }) {
  const { canMutate, data, now, dispatch, openTask, editTask, closeDetails, requestDelete } = usePlanner()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [notice, setNotice] = useState('')
  const semesterId = data.subjects.find((subject) => subject.id === task.subjectId)?.semesterId
  const subjects = data.subjects.filter((subject) => subject.semesterId === semesterId)
  const today = vietnamToday(new Date(now))
  const dateOptions = [
    { days: 0, label: 'Hôm nay', icon: 'sun' },
    { days: 1, label: 'Ngày mai', icon: 'calendar' },
    { days: 7, label: 'Sau 1 tuần', icon: 'calendar' },
  ] as const

  function save(value: Partial<PlannerTask>) {
    if (!canMutate) return
    dispatch({ type: 'save-task', value: { ...task, ...value } })
    setNotice('Đã lưu thay đổi.')
  }
  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canMutate) return
    const title = subtaskTitle.trim()
    if (!title) return
    save({
      subtasks: [...task.subtasks, { id: crypto.randomUUID(), title, done: false }],
      status: task.status === 'done' ? 'doing' : task.status,
      completedAt: task.status === 'done' ? undefined : task.completedAt,
    })
    setSubtaskTitle('')
    setNotice('Đã thêm nhiệm vụ nhỏ.')
  }
  function duplicate() {
    if (!canMutate) return
    dispatch({ type: 'save-task', value: {
      ...task, id: crypto.randomUUID(), title: `${task.title.slice(0, 140)} (bản sao)`,
      status: 'todo', completedAt: undefined,
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: crypto.randomUUID(), done: false })),
    } })
  }

  return <ActionMenu label={'Tùy chọn cho ' + task.title} className="task-action-menu">
    <div className="task-menu-section" data-menu-keep-open>
      <span className="task-menu-caption">Hạn hoàn thành</span>
      <div className="task-menu-shortcuts">{dateOptions.map((option) => {
        const date = dateKey(addDays(today, option.days))
        return <button type="button" key={option.days} aria-pressed={task.dueDate === date} onClick={() => save({ dueDate: date })}><Icon name={option.icon} size={17} /><span>{option.label}</span></button>
      })}</div>
      <div className="task-menu-date-fields"><label><span className="sr-only">Ngày đến hạn</span><input type="date" value={task.dueDate} required onChange={(event) => { if (event.target.validity.valid && event.target.value) save({ dueDate: event.target.value }) }} /></label><label><span className="sr-only">Giờ đến hạn</span><input type="time" value={task.dueTime} required onChange={(event) => { if (event.target.validity.valid && event.target.value) save({ dueTime: event.target.value }) }} /></label></div>
    </div>
    <div className="task-menu-section" data-menu-keep-open>
      <span className="task-menu-caption">Mức ưu tiên</span>
      <div className="task-menu-priorities" role="group" aria-label="Mức ưu tiên">{(['high', 'normal', 'low'] as Importance[]).map((importance) => <button type="button" key={importance} className={'task-menu-priority priority-' + importance} aria-pressed={task.importance === importance} onClick={() => save({ importance })}><Icon name="flag" size={17} /><span>{importanceLabels[importance]}</span></button>)}</div>
    </div>
    <div className="task-menu-section task-menu-fields" data-menu-keep-open>
      <label><Icon name="check" size={15} /><span>Trạng thái</span><select value={task.status} onChange={(event) => { if (!canMutate) return; dispatch({ type: 'task-status', id: task.id, status: event.target.value as TaskStatus, now: new Date().toISOString() }); setNotice('Đã đổi trạng thái.') }}>{taskColumns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}</select></label>
      <label><Icon name="book" size={15} /><span>Chuyển môn</span><select value={task.subjectId} onChange={(event) => save({ subjectId: event.target.value })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <label><Icon name="layers" size={15} /><span>Loại nhiệm vụ</span><select value={task.kind} onChange={(event) => save({ kind: event.target.value as TaskKind })}>{Object.entries(kindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
    </div>
    <form className="task-menu-section task-menu-subtask" data-menu-keep-open onSubmit={addSubtask}>
      <label><Icon name="list" size={15} /><span>Thêm nhiệm vụ nhỏ</span><input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} maxLength={180} placeholder="Nhập tên nhiệm vụ nhỏ…" /></label>
      <button type="submit" aria-label="Thêm nhiệm vụ nhỏ"><Icon name="plus" size={16} /></button>
    </form>
    <div className="task-menu-actions">
      <button type="button" onClick={() => openTask(task)}><Icon name="list" size={15} />Mở chi tiết</button>
      <button type="button" onClick={() => editTask(task)}><Icon name="edit" size={15} />Sửa tên, mô tả…</button>
      <button type="button" onClick={duplicate}><Icon name="layers" size={15} />Nhân bản nhiệm vụ</button>
      <button type="button" className="danger-text" onClick={() => { closeDetails(); requestDelete('task', task.id) }}><Icon name="trash" size={15} />Xóa nhiệm vụ</button>
    </div>
    <p className="task-menu-notice" role="status">{notice}</p>
  </ActionMenu>
}
