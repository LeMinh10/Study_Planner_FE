import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePlanner } from '../../contexts/PlannerContext'
import { ActionMenu } from '../../components/ActionMenu'
import { Icon } from '../../components/Icon'
import { FlowBoardCard, FlowTaskRow, QuickTaskForm } from '../../components/WorkspaceTasks'
import { WorkspaceCalendar } from '../../components/WorkspaceCalendar'
import { boardDropAction, filterWorkspaceTasks, taskColumns, TASK_DRAG_TYPE } from '../../utils/workspace'
import { kindLabels } from '../../utils/planner'
import type { TaskStatus } from '../../types/planner'

const layouts = [
  { id: 'list', label: 'Danh sách' },
  { id: 'board', label: 'Bảng' },
  { id: 'calendar', label: 'Lịch' },
]
const filters = [{ id: 'all', label: 'Tất cả' }, { id: 'today', label: 'Hôm nay' }, { id: 'upcoming', label: 'Sắp tới' }, { id: 'overdue', label: 'Quá hạn' }, { id: 'done', label: 'Đã xong' }, { id: 'priority', label: 'Ưu tiên' }]
interface QuickEntry { key: string; status: TaskStatus; subjectId?: string; date?: string }

export function TasksPage() {
  const { canMutate, data, tasks, now, createTask, dispatch } = usePlanner()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [quick, setQuick] = useState<QuickEntry | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [dropColumn, setDropColumn] = useState('')
  const [notice, setNotice] = useState('')
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId)
  const selectedSubject = subjects.find((subject) => subject.id === params.get('subject'))
  const subjectId = selectedSubject?.id ?? 'all'
  const layout = layouts.some((item) => item.id === params.get('layout')) ? params.get('layout')! : 'list'
  const view = filters.some((item) => item.id === params.get('view')) ? params.get('view')! : 'all'
  const groupBy = params.get('group') === 'subject' ? 'subject' : 'status'
  const sort = params.get('sort') ?? 'due'
  const filtered = filterWorkspaceTasks(tasks, { subject: subjectId, view, search, kind, status, sort }, now)
  const semester = data.semesters.find((item) => item.id === data.selectedSemesterId)

  useEffect(() => { setQuick(null) }, [selectedSubject?.id, data.selectedSemesterId])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all' || (key === 'layout' && value === 'list')) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }
  function addQuick(key = 'top', initialStatus: TaskStatus = 'todo', initialSubjectId = selectedSubject?.id, date?: string) {
    if (!canMutate || !subjects.length) return
    setQuick({ key, status: initialStatus, subjectId: initialSubjectId, date })
    setCollapsed((previous) => ({ ...previous, [key]: false }))
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) {
        if (!canMutate || !subjects.length) return
        event.preventDefault()
        setQuick({ key: 'top', status: 'todo', subjectId: selectedSubject?.id })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canMutate, subjects.length, selectedSubject?.id])

  const groups = groupBy === 'subject' && !selectedSubject && subjects.length > 0
    ? subjects.map((subject) => ({ id: 'subject-' + subject.id, title: subject.name, items: filtered.filter((task) => task.subjectId === subject.id), status: undefined, subjectId: subject.id }))
    : taskColumns.map((column) => ({ id: column.status, title: column.label, items: filtered.filter((task) => task.status === column.status), status: column.status, subjectId: selectedSubject?.id }))

  return <section className="task-workspace" aria-label="Không gian nhiệm vụ học tập">
    <div className="flow-space-heading"><div><h1>{selectedSubject?.name ?? 'Nhiệm vụ của tôi'}</h1><p className="flow-breadcrumb">{semester?.name ?? 'Chưa có học kỳ'}</p></div><div className="flow-space-actions">{selectedSubject && <Link to={'/subjects/' + selectedSubject.id} className="flow-text-button">Thông tin môn</Link>}<ActionMenu label="Tùy chọn danh sách"><button onClick={() => createTask(selectedSubject?.id)}><Icon name="edit" size={14} />Thêm bằng biểu mẫu</button><Link to="/subjects"><Icon name="book" size={14} />Các môn học</Link><Link to="/semesters"><Icon name="layers" size={14} />Sắp xếp học kỳ</Link></ActionMenu></div></div>
    <div className="flow-view-bar"><div className="flow-view-tabs" role="group" aria-label="Kiểu xem nhiệm vụ">{layouts.map((item) => <button key={item.id} className={layout === item.id ? 'active' : ''} aria-pressed={layout === item.id} onClick={() => { setFilter('layout', item.id); setQuick(null) }}>{item.label}</button>)}</div><span className="flow-task-total">{filtered.length} nhiệm vụ</span><button className="flow-button" onClick={() => addQuick()}>Thêm nhiệm vụ</button></div>
    <div className="flow-filter-bar"><label className="flow-find-task"><Icon name="search" size={15} /><input type="search" aria-label="Tìm trong danh sách" placeholder="Tìm nhiệm vụ…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="flow-filter-chips" role="group" aria-label="Lọc thời hạn">{filters.map((item) => <button className={view === item.id ? 'active' : ''} aria-pressed={view === item.id} key={item.id} onClick={() => setFilter('view', item.id)}>{item.id === 'priority' && <Icon name="flag" size={11} />}{item.label}</button>)}</div><details className="flow-filter-popover"><summary><Icon name="list" size={13} />Lọc{(kind !== 'all' || status !== 'all') && <i />}</summary><div><label>Loại nhiệm vụ<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Tất cả loại</option>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option>{taskColumns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}</select></label><button className="flow-text-button" onClick={() => { setKind('all'); setStatus('all') }}>Bỏ bộ lọc</button></div></details><label className="flow-group-picker"><span className="sr-only">Sắp xếp</span><select value={sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="due">Theo hạn nộp</option><option value="priority">Theo ưu tiên</option><option value="name">Theo tên</option></select></label>{layout === 'list' && <label className="flow-group-picker"><span className="sr-only">Nhóm nhiệm vụ</span><select value={groupBy} onChange={(event) => setFilter('group', event.target.value)}><option value="status">Nhóm: Trạng thái</option><option value="subject">Nhóm: Môn học</option></select></label>}</div>
    <div className={'flow-work-content layout-' + layout}>
      {!subjects.length && <div className="flow-setup-notice"><div><strong>Chưa có dữ liệu môn học hoặc nhiệm vụ.</strong></div><Link to="/subjects" className="flow-button">Xem môn học</Link></div>}
      {quick?.key === 'top' && <div className="flow-top-quick"><QuickTaskForm key={quick.date ?? 'top'} subjects={subjects} subjectId={quick.subjectId} status={quick.status} date={quick.date} onClose={() => setQuick(null)} onCreated={(task) => setNotice('Đã thêm “' + task.title + '”.')} /></div>}
      {view === 'priority' && layout !== 'calendar' && <p className="flow-priority-note"><Icon name="flag" size={13} />{layout === 'board' ? 'Nhiệm vụ cần ưu tiên được đặt trước trong mỗi cột.' : 'Nhiệm vụ quá hạn, hạn gần và mức quan trọng cao được đặt trước trong mỗi nhóm.'}</p>}
      {layout === 'list' && <div className="flow-list-view">{groups.map((group) => {
        const closed = quick?.key !== group.id && (collapsed[group.id] ?? (group.status === 'done' && view !== 'done'))
        return <section key={group.id} className={'flow-list-group flow-group-' + (group.status ?? 'subject')}><div className="flow-group-heading"><button className="flow-group-toggle" aria-expanded={!closed} onClick={() => setCollapsed((previous) => ({ ...previous, [group.id]: !closed }))}><Icon name="chevron-right" size={13} /><span className={'flow-group-label flow-label-' + (group.status ?? 'subject')}>{group.title}</span><span className="flow-group-count">{group.items.length}</span></button><button className="icon-button" aria-label={'Thêm nhiệm vụ vào ' + group.title} onClick={() => addQuick(group.id, group.status ?? 'todo', group.subjectId)}><Icon name="plus" size={14} /></button></div>{!closed && <><div className={'flow-column-labels' + (selectedSubject ? ' no-subject' : '')}><span>Tên nhiệm vụ</span>{!selectedSubject && <span>Môn học</span>}<span>Trạng thái</span><span>Hạn nộp</span><span>Ưu tiên</span><span /></div>{group.items.map((task) => <FlowTaskRow key={task.id} task={task} showSubject={!selectedSubject} showReason={view === 'priority'} />)}{quick?.key === group.id ? <QuickTaskForm subjects={subjects} subjectId={quick.subjectId} status={quick.status} onClose={() => setQuick(null)} /> : <button className="flow-inline-add" onClick={() => addQuick(group.id, group.status ?? 'todo', group.subjectId)}><Icon name="plus" size={13} />Thêm nhiệm vụ</button>}</>}</section>
      })}</div>}
      {layout === 'board' && <div className="flow-board" aria-label="Bảng trạng thái nhiệm vụ">{taskColumns.map((column) => {
        const items = filtered.filter((task) => task.status === column.status)
        return <section key={column.status} className={'flow-board-column' + (dropColumn === column.status ? ' is-drop-target' : '')} onDragOver={(event) => { if (canMutate && event.dataTransfer.types.includes(TASK_DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropColumn(column.status) } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropColumn('') }} onDrop={(event) => { event.preventDefault(); if (!canMutate) return; const action = boardDropAction(filtered, event.dataTransfer.getData(TASK_DRAG_TYPE), column.status, Date.now()); if (action) { dispatch(action); setNotice('Đã chuyển nhiệm vụ sang ' + column.label + '.') } setDropColumn('') }}><div className="flow-board-heading"><span className={'flow-status-dot flow-' + column.status} /><h2>{column.label}</h2><span>{items.length}</span><button className="icon-button" aria-label={'Thêm thẻ vào ' + column.label} onClick={() => addQuick('board-' + column.status, column.status)}><Icon name="plus" size={15} /></button></div><div className="flow-board-cards">{items.map((task) => <FlowBoardCard task={task} key={task.id} onDragEnd={() => setDropColumn('')} />)}{!items.length && <div className="flow-board-empty">Chưa có nhiệm vụ</div>}</div>{quick?.key === 'board-' + column.status ? <QuickTaskForm subjects={subjects} subjectId={quick.subjectId} status={quick.status} onClose={() => setQuick(null)} /> : <button className="flow-inline-add" onClick={() => addQuick('board-' + column.status, column.status)}><Icon name="plus" size={14} />Thêm nhiệm vụ</button>}</section>
      })}</div>}
      {layout === 'calendar' && <WorkspaceCalendar tasks={filtered} subjectId={selectedSubject?.id} onCreate={(date) => addQuick('top', 'todo', selectedSubject?.id, date)} />}
      <span className="sr-only" role="status">{notice}</span>
    </div>
    <div className="flow-workspace-footer"><span><Icon name="check" size={12} />{tasks.filter((task) => (subjectId === 'all' || task.subjectId === subjectId) && task.status === 'done').length} nhiệm vụ đã xong</span><span>{!canMutate ? 'Chưa có dữ liệu nhiệm vụ.' : layout === 'board' ? 'Kéo thẻ qua cột để đổi trạng thái · Có thể dùng ô trạng thái trên thẻ' : layout === 'calendar' ? 'Nhiệm vụ và giờ học trong cùng một lịch' : 'Enter để thêm nhanh · N để tạo nhiệm vụ mới'}</span></div>
  </section>
}
