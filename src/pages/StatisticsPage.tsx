import { useState } from 'react'
import { EmptyState, PageHeading } from '../components/PlannerUI'
import { usePlanner } from '../contexts/PlannerContext'
import type { TaskKind } from '../types/planner'
import { completion, isLateCompletion, kindLabels, statusLabels, taskStatus } from '../utils/planner'

export function StatisticsPage() {
  const { data, tasks, now } = usePlanner()
  const [subjectId, setSubjectId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId)
  const invalidRange = !!from && !!to && from > to
  const filtered = invalidRange ? [] : tasks.filter((task) => (subjectId === 'all' || task.subjectId === subjectId) && (!from || task.dueDate >= from) && (!to || task.dueDate <= to))
  const done = filtered.filter((task) => task.status === 'done').length
  const overdue = filtered.filter((task) => taskStatus(task, now) === 'overdue').length
  const late = filtered.filter(isLateCompletion).length

  if (!tasks.length) return <>
    <PageHeading title="Tiến độ" />
    <section className="paper-panel"><EmptyState title="Chưa có dữ liệu thống kê" description="Tiến độ sẽ hiển thị khi có dữ liệu nhiệm vụ." /></section>
  </>

  return <>
    <PageHeading title="Tiến độ" />
    <div className="analytics-filters"><label>Môn học<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="all">Tất cả môn học</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label>Hạn nộp từ<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Đến<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="text-button" onClick={() => { setFrom(''); setTo(''); setSubjectId('all') }}>Xóa bộ lọc</button></div>
    {invalidRange && <p className="form-error analytics-error" role="alert">Ngày bắt đầu cần trước hoặc bằng ngày kết thúc.</p>}
    <div className="metric-grid"><article><span>Tổng nhiệm vụ</span><strong>{filtered.length}</strong><p>Trong phạm vi đang xem</p></article><article><span>Tỷ lệ hoàn thành</span><strong>{completion(filtered)}<small>%</small></strong><p>{done}/{filtered.length} nhiệm vụ đã xong</p></article><article className="metric-warning"><span>Đang quá hạn</span><strong>{overdue}</strong><p>Chưa hoàn thành và đã trễ hạn</p></article><article><span>Hoàn thành muộn</span><strong>{late}</strong><p>Đã xong sau thời điểm đến hạn</p></article></div>
    <div className="analytics-grid"><section className="paper-panel analytics-panel"><div className="panel-heading"><div><h2>Theo trạng thái</h2></div><span className="muted">{filtered.length} nhiệm vụ</span></div><div className="status-chart">{Object.entries(statusLabels).map(([value, label]) => {
      const count = filtered.filter((task) => taskStatus(task, now) === value).length
      return <div className="status-chart-row" key={value}><span><i className={`status-color status-color-${value}`} />{label}</span><div className="status-chart-track"><div className={`status-chart-fill status-color-${value}`} style={{ width: `${filtered.length ? count / filtered.length * 100 : 0}%` }} /></div><strong>{count}</strong></div>
    })}</div></section><section className="paper-panel analytics-panel"><div className="panel-heading"><div><h2>Theo loại nhiệm vụ</h2></div></div><div className="kind-stats">{Object.entries(kindLabels).map(([value, label]) => {
      const related = filtered.filter((task) => task.kind === value as TaskKind)
      return <div key={value}><span>{label}</span><strong>{related.filter((task) => task.status === 'done').length}/{related.length}</strong><progress max="100" value={completion(related)} aria-label={`Hoàn thành ${label}`} /></div>
    })}</div></section></div>
    <section className="paper-panel data-panel subject-statistics"><div className="panel-heading"><div><h2>Theo môn học</h2></div></div><table className="data-table"><thead><tr><th>Môn học</th><th>Tổng nhiệm vụ</th><th>Hoàn thành</th><th>Quá hạn</th><th>Tỷ lệ hoàn thành</th></tr></thead><tbody>{subjects.filter((subject) => subjectId === 'all' || subject.id === subjectId).map((subject) => {
      const related = filtered.filter((task) => task.subjectId === subject.id)
      return <tr key={subject.id}><td><span className={`subject-tag ${subject.color}`}>{subject.name}</span></td><td>{related.length}</td><td>{related.filter((task) => task.status === 'done').length}</td><td>{related.filter((task) => taskStatus(task, now) === 'overdue').length}</td><td><div className="table-progress"><span><strong>{completion(related)}%</strong></span><progress max="100" value={completion(related)} aria-label={`Tiến độ ${subject.name}`} /></div></td></tr>
    })}</tbody></table>{!subjects.length && <p className="chart-note">Học kỳ này chưa có môn học để thống kê.</p>}</section>

  </>
}
