import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { TaskActionMenu } from './TaskActionMenu'
import { Modal, StatusBadge, SubjectBadge } from './PlannerUI'
import { usePlanner } from '../contexts/PlannerContext'
import type { Importance, PlannerTask, TaskKind } from '../types/planner'
import { importanceLabels, kindLabels, priorityReason, taskStatus } from '../utils/planner'
import { taskDueLabel } from '../utils/studentView'
import { TaskStatusControl } from './WorkspaceTasks'

export function StudentTaskList({ tasks, showSubject = true, showReason = false }: { tasks: PlannerTask[]; showSubject?: boolean; showReason?: boolean }) {
  const { canMutate, now, dispatch, openTask } = usePlanner()
  return <div className="student-task-list">{tasks.map((task) => {
    const done = task.status === 'done'
    const overdue = taskStatus(task, now) === 'overdue'
    return <article className={`student-task${done ? ' student-task-done' : ''}`} key={task.id}>
      <label className="student-task-check"><input type="checkbox" checked={done} aria-label={`${done ? 'Mở lại' : 'Đánh dấu đã xong'}: ${task.title}`} onChange={() => dispatch({ type: 'task-status', id: task.id, status: done ? 'doing' : 'done', now: new Date().toISOString() })} /><span><Icon name="check" size={14} /></span></label>
      <div className="student-task-body"><div className="student-task-title-line"><button className="student-task-title" onClick={() => openTask(task)}>{task.title}</button>{task.status === 'doing' && !overdue && <span className="working-label">Đang làm</span>}</div><div className="student-task-meta">{showSubject && <SubjectBadge id={task.subjectId} />}<span className={overdue ? 'task-due-overdue' : ''}><Icon name="clock" size={12} />{taskDueLabel(task, now)}</span>{task.subtasks.length > 0 && <span><Icon name="list" size={12} />{task.subtasks.filter((item) => item.done).length}/{task.subtasks.length} nhiệm vụ nhỏ</span>}<span className="task-kind-label">{kindLabels[task.kind]}</span></div>{showReason && !done && <p className="student-priority-reason"><Icon name="flag" size={12} />{priorityReason(task, now)}</p>}</div>
      {!done && <button className={`task-start-button${task.status === 'doing' ? ' continue-task' : ''}`} onClick={() => {
        if (!canMutate) return
        if (task.status === 'todo') dispatch({ type: 'task-status', id: task.id, status: 'doing', now: new Date().toISOString() })
        openTask(task)
      }}>{task.status === 'doing' ? 'Tiếp tục' : 'Bắt đầu'}<Icon name="arrow-right" size={14} /></button>}
      <TaskActionMenu task={task} />
    </article>
  })}</div>
}

export function TaskDetails() {
  const { canMutate, data, taskDetails: task, now, dispatch, closeDetails } = usePlanner()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  useEffect(() => { setSubtaskTitle('') }, [task?.id])
  if (!task) return null
  const done = task.status === 'done'
  const progress = task.subtasks.length ? Math.round(task.subtasks.filter((subtask) => subtask.done).length / task.subtasks.length * 100) : done ? 100 : 0
  return <Modal title={task.title} onClose={closeDetails} side>
    <div className="task-detail-top"><Link to={`/subjects/${task.subjectId}`} onClick={closeDetails}><SubjectBadge id={task.subjectId} /></Link><TaskStatusControl task={task} />{taskStatus(task, now) === 'overdue' && <StatusBadge task={task} />}<TaskActionMenu task={task} /></div>
    <div className="task-detail-facts flow-detail-facts"><div><span>Hạn hoàn thành</span><div><input type="date" aria-label="Ngày đến hạn" value={task.dueDate} onChange={(event) => { if (event.target.value) dispatch({ type: 'save-task', value: { ...task, dueDate: event.target.value } }) }} /><input type="time" aria-label="Giờ đến hạn" value={task.dueTime} onChange={(event) => { if (event.target.value) dispatch({ type: 'save-task', value: { ...task, dueTime: event.target.value } }) }} /></div></div><div><span>Loại nhiệm vụ</span><select aria-label="Loại nhiệm vụ" value={task.kind} onChange={(event) => dispatch({ type: 'save-task', value: { ...task, kind: event.target.value as TaskKind } })}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><div><span>Mức quan trọng</span><select aria-label="Mức quan trọng" value={task.importance} onChange={(event) => dispatch({ type: 'save-task', value: { ...task, importance: event.target.value as Importance } })}>{Object.entries(importanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><div><span>Môn học</span><select aria-label="Chuyển nhiệm vụ sang môn học" value={task.subjectId} onChange={(event) => dispatch({ type: 'save-task', value: { ...task, subjectId: event.target.value } })}>{data.subjects.filter((subject) => subject.semesterId === data.subjects.find((item) => item.id === task.subjectId)?.semesterId).map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></div></div>
    <section className="task-description"><h3>Mô tả</h3><textarea className="flow-detail-description" value={task.description} aria-label="Mô tả nhiệm vụ" placeholder="Nội dung hoặc yêu cầu nhiệm vụ" rows={4} maxLength={2000} onChange={(event) => dispatch({ type: 'save-task', value: { ...task, description: event.target.value } })} /></section>
    <section className="task-detail-subtasks"><div><h3>Nhiệm vụ nhỏ</h3><span>{task.subtasks.filter((subtask) => subtask.done).length}/{task.subtasks.length}</span></div>{task.subtasks.length > 0 && <progress max="100" value={progress} aria-label="Tiến độ nhiệm vụ nhỏ" />}{task.subtasks.map((subtask) => <label key={subtask.id}><input type="checkbox" checked={subtask.done} onChange={() => dispatch({ type: 'toggle-subtask', taskId: task.id, subtaskId: subtask.id, now: new Date().toISOString() })} /><span className={subtask.done ? 'crossed-out' : ''}>{subtask.title}</span></label>)}<form className="flow-detail-add-subtask" onSubmit={(event) => { event.preventDefault(); if (!canMutate || !subtaskTitle.trim()) return; dispatch({ type: 'save-task', value: { ...task, status: task.status === 'done' ? 'doing' : task.status, completedAt: task.status === 'done' ? undefined : task.completedAt, subtasks: [...task.subtasks, { id: crypto.randomUUID(), title: subtaskTitle.trim(), done: false }] } }); setSubtaskTitle('') }}><Icon name="plus" size={14} /><input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} aria-label="Thêm nhiệm vụ nhỏ" placeholder="Thêm nhiệm vụ nhỏ…" maxLength={180} /><button type="submit">Thêm</button></form></section>
    <div className="task-detail-actions">{task.status === 'todo' && <button className="button button-secondary" onClick={() => dispatch({ type: 'task-status', id: task.id, status: 'doing', now: new Date().toISOString() })}><Icon name="play" size={15} />Bắt đầu làm</button>}<button className="button button-primary" onClick={() => dispatch({ type: 'task-status', id: task.id, status: done ? 'doing' : 'done', now: new Date().toISOString() })}><Icon name={done ? 'reset' : 'check'} size={16} />{done ? 'Mở lại nhiệm vụ này' : 'Đánh dấu đã xong'}</button></div>
    {done && <p className="task-detail-finished" role="status">Đã hoàn thành nhiệm vụ.</p>}
  </Modal>
}
