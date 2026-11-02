import { useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import type { PlannerTask, Subject, TaskStatus } from '../types/planner'
import { addDays, dateKey, importanceLabels, priorityReason, vietnamToday } from '../utils/planner'
import { taskDueLabel } from '../utils/studentView'
import { makeQuickTask, taskColumns, TASK_DRAG_TYPE } from '../utils/workspace'
import { Icon } from './Icon'
import { TaskActionMenu } from './TaskActionMenu'
import { SubjectBadge } from './PlannerUI'

export function QuickTaskForm({ subjects, subjectId, status = 'todo', date, onClose, onCreated }: {
  subjects: Subject[]; subjectId?: string; status?: TaskStatus; date?: string; onClose: () => void; onCreated?: (task: PlannerTask) => void
}) {
  const { canMutate, dispatch } = usePlanner()
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canMutate) return
    const form = new FormData(event.currentTarget)
    try {
      const task = makeQuickTask({ title: String(form.get('title')), subjectId: String(form.get('subjectId')), date: String(form.get('date')), status }, subjects, Date.now(), crypto.randomUUID())
      dispatch({ type: 'save-task', value: task })
      onCreated?.(task)
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa thêm được nhiệm vụ.') }
  }
  return <form className="quick-task-form" onSubmit={submit} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="quick-task-title"><span className={'flow-status-dot flow-' + status} /><input name="title" placeholder="Tên nhiệm vụ · Enter để thêm" maxLength={150} required autoFocus aria-label="Tên nhiệm vụ mới" /><button type="button" className="icon-button" aria-label="Hủy thêm nhanh" onClick={onClose}><Icon name="close" size={15} /></button></div>
    <div className="quick-task-options"><label><span className="sr-only">Môn học cho nhiệm vụ mới</span><select name="subjectId" defaultValue={subjectId ?? subjects[0]?.id ?? ''} required><option value="" disabled>Chọn môn học</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label className="quick-task-date"><Icon name="calendar" size={13} /><span>Hạn</span><input type="date" name="date" defaultValue={date ?? dateKey(addDays(vietnamToday(), 1))} required aria-label="Hạn của nhiệm vụ mới" /></label><button className="flow-button" type="submit">Thêm nhiệm vụ<Icon name="arrow-right" size={13} /></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>
}

export function TaskStatusControl({ task, compact = false }: { task: PlannerTask; compact?: boolean }) {
  const { dispatch } = usePlanner()
  return <label className={'flow-status-control' + (compact ? ' compact-status' : '')}><span className={'flow-status-dot flow-' + task.status} /><select value={task.status} aria-label={'Trạng thái của ' + task.title} onChange={(event) => dispatch({ type: 'task-status', id: task.id, status: event.target.value as TaskStatus, now: new Date().toISOString() })}>{taskColumns.map((column) => <option value={column.status} key={column.status}>{column.label}</option>)}</select></label>
}

export function FlowTaskRow({ task, showSubject = true, showReason = false }: { task: PlannerTask; showSubject?: boolean; showReason?: boolean }) {
  const { now, dispatch, openTask } = usePlanner()
  const [expanded, setExpanded] = useState(false)
  const overdue = task.status !== 'done' && new Date(`${task.dueDate}T${task.dueTime}:00+07:00`).getTime() < now
  return <div className={'flow-list-task' + (task.status === 'done' ? ' is-complete' : '')}>
    <article className={'flow-task-row' + (showSubject ? '' : ' no-subject')}>
      <label className="flow-complete-check"><input type="checkbox" checked={task.status === 'done'} aria-label={(task.status === 'done' ? 'Mở lại' : 'Đánh dấu đã xong') + ': ' + task.title} onChange={() => dispatch({ type: 'task-status', id: task.id, status: task.status === 'done' ? 'doing' : 'done', now: new Date().toISOString() })} /><span><Icon name="check" size={12} /></span></label>
      <div className="flow-task-name"><button onClick={() => openTask(task)}>{task.title}</button>{task.subtasks.length > 0 && <button className={'flow-subtask-toggle' + (expanded ? ' expanded' : '')} aria-label={'Nhiệm vụ nhỏ của ' + task.title} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Icon name="list" size={12} />{task.subtasks.filter((subtask) => subtask.done).length}/{task.subtasks.length}</button>}</div>
      {showSubject && <div className="flow-task-subject"><SubjectBadge id={task.subjectId} /></div>}
      <div className="flow-task-status-cell"><TaskStatusControl task={task} compact /></div>
      <label className={'flow-inline-date' + (overdue ? ' date-overdue' : '')} title={taskDueLabel(task, now)}><Icon name="calendar" size={13} /><input type="date" value={task.dueDate} aria-label={'Đổi hạn nộp của ' + task.title} onChange={(event) => { if (event.target.value) dispatch({ type: 'save-task', value: { ...task, dueDate: event.target.value } }) }} /></label>
      <label className={'flow-importance importance-' + task.importance} title={importanceLabels[task.importance]}><Icon name="flag" size={13} /><select value={task.importance} aria-label={'Mức quan trọng của ' + task.title} onChange={(event) => dispatch({ type: 'save-task', value: { ...task, importance: event.target.value as PlannerTask['importance'] } })}>{Object.entries(importanceLabels).map(([value, label]) => <option key={value} value={value}>{value === 'normal' ? 'Vừa' : label}</option>)}</select></label>
      <TaskActionMenu task={task} />
    </article>
    {showReason && <p className="flow-priority-reason"><Icon name="flag" size={12} />{priorityReason(task, now)}</p>}
    {expanded && <div className="flow-inline-subtasks">{task.subtasks.map((subtask) => <label key={subtask.id}><input type="checkbox" checked={subtask.done} onChange={() => dispatch({ type: 'toggle-subtask', taskId: task.id, subtaskId: subtask.id, now: new Date().toISOString() })} /><span className={subtask.done ? 'crossed-out' : ''}>{subtask.title}</span></label>)}</div>}
  </div>
}

export function startTaskDrag(event: DragEvent, task: PlannerTask) {
  event.dataTransfer.setData(TASK_DRAG_TYPE, task.id)
  event.dataTransfer.setData('text/plain', task.title)
  event.dataTransfer.effectAllowed = 'move'
}

export function FlowBoardCard({ task, onDragEnd }: { task: PlannerTask; onDragEnd?: () => void }) {
  const { canMutate, now, openTask } = usePlanner()
  return <article className={'flow-board-card' + (task.status === 'done' ? ' is-complete' : '')} draggable={canMutate} onDragStart={(event) => startTaskDrag(event, task)} onDragEnd={onDragEnd}>
    <div className="flow-board-card-top"><SubjectBadge id={task.subjectId} /><TaskActionMenu task={task} /></div>
    <button className="flow-board-title" onClick={() => openTask(task)}>{task.title}</button>
    {task.subtasks.length > 0 && <div className="flow-board-checklist"><Icon name="list" size={12} /><span>{task.subtasks.filter((subtask) => subtask.done).length}/{task.subtasks.length}</span><progress max={task.subtasks.length} value={task.subtasks.filter((subtask) => subtask.done).length} aria-label={'Tiến độ ' + task.title} /></div>}
    <div className="flow-board-card-meta"><span className={taskGroupClass(task, now)}><Icon name="calendar" size={12} />{taskDueLabel(task, now)}</span>{task.importance === 'high' && <span className="flow-high-priority" title="Quan trọng cao"><Icon name="flag" size={12} /></span>}</div>
    <TaskStatusControl task={task} />
  </article>
}

function taskGroupClass(task: PlannerTask, now: number) {
  return task.status !== 'done' && new Date(`${task.dueDate}T${task.dueTime}:00+07:00`).getTime() < now ? 'date-overdue' : ''
}
