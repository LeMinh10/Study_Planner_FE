import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeading } from '../components/PlannerUI'
import { usePlanner } from '../contexts/PlannerContext'
import { useAuth } from '../contexts/AuthContext'
import { useStatistics } from '../statistics/useStatistics'
import { filterStatistics, summarizeStatistics } from '../statistics/statisticsModel'
import '../statistics/statistics.css'

export function StatisticsPage() {
  const { data } = usePlanner()
  const auth = useAuth()
  return <StatisticsContent key={`${auth.user?.email}:${data.selectedSemesterId}`} semesterId={data.selectedSemesterId} />
}

function StatisticsContent({ semesterId }: { semesterId: string }) {
  const planner = usePlanner()
  const resource = useStatistics(semesterId)
  const [subjectId, setSubjectId] = useState('all')
  const subjects = planner.data.subjects.filter(subject => subject.semesterId === semesterId)
  const selectedSubject = subjectId === 'all' || subjectId === 'unassigned' || subjects.some(subject => subject.id === subjectId) ? subjectId : 'all'
  const snapshot = resource.snapshot
  const filtered = snapshot ? filterStatistics(snapshot.tasks, { semesterId, subjectId: selectedSubject }) : []
  const summary = summarizeStatistics(filtered, planner.now)
  const hasUnassigned = snapshot?.tasks.some(task => task.maMonHoc === null)
  const rows = subjects.filter(subject => selectedSubject === 'all' || subject.id === selectedSubject).map(subject => ({ id: subject.id, name: subject.name, color: subject.colorHex }))
  if (hasUnassigned && (selectedSubject === 'all' || selectedSubject === 'unassigned')) rows.push({ id: 'unassigned', name: 'Không gắn môn học', color: undefined })
  const ready = resource.enabled && !!snapshot && !planner.academicLoading
  const semesterName = planner.data.semesters.find(semester => semester.id === semesterId)?.name
  const taskQuery = new URLSearchParams({ semester: semesterId })
  if (selectedSubject !== 'all' && selectedSubject !== 'unassigned') taskQuery.set('subject', selectedSubject)
  const completedQuery = new URLSearchParams(taskQuery)
  completedQuery.set('view', 'all')
  completedQuery.set('status', 'Completed')

  return <div className="statistics-page">
    <PageHeading title="Tiến độ học tập" />
    <div className="statistics-filters">
      <label>Môn học<select name="statistics-subject" value={selectedSubject} onChange={event => setSubjectId(event.target.value)} disabled={planner.academicLoading}>
        <option value="all">Tất cả môn học</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        {hasUnassigned && <option value="unassigned">Không gắn môn học</option>}
      </select></label>
      <button type="button" className="statistics-clear" onClick={() => setSubjectId('all')} disabled={selectedSubject === 'all'}>Xóa bộ lọc</button>
    </div>
    {semesterName && <p className="statistics-scope">{semesterName}<span>·</span>Nhiệm vụ chính, gồm cả đã hoàn thành</p>}
    {planner.academicError && <div className="statistics-feedback" role="alert"><p>{planner.academicError}</p><button type="button" onClick={planner.retryAcademic}>Thử lại môn học</button></div>}
    {resource.error && <div className="statistics-feedback" role="alert"><p>{snapshot ? 'Chưa cập nhật được tiến độ. Đang hiển thị dữ liệu lần tải trước. ' : ''}{resource.error}</p><button type="button" onClick={resource.reload} disabled={resource.loading}>Thử lại</button></div>}
    {planner.academicLoading || (!snapshot && resource.loading) ? <div className="statistics-loading" role="status">Đang tải tiến độ học tập…</div> : !semesterId ? <section className="statistics-panel"><EmptyState title="Chưa có học kỳ" description="Chọn hoặc tạo học kỳ để xem tiến độ học tập." /></section> : !resource.enabled ? <section className="statistics-panel"><EmptyState title="Chưa có dữ liệu thống kê" description="Đăng nhập tài khoản thật để xem tiến độ học tập." /></section> : null}
    {ready && <>
      {resource.loading && <p className="statistics-updating" role="status">Đang cập nhật…</p>}
      <div className="statistics-metrics">
        <article><span>Tổng nhiệm vụ</span><strong data-stat="total">{summary.total}</strong><small><span data-stat="pending">{summary.total - summary.completed}</span> chưa xong · {summary.completed} đã xong</small></article>
        <article className="statistics-completed"><span>Đã hoàn thành</span><strong data-stat="completed">{summary.completed}</strong><small>{summary.completionRate}% tổng nhiệm vụ</small></article>
        <article><span>Đang thực hiện</span><strong data-stat="inProgress">{summary.inProgress}</strong><small>{summary.notStarted} chưa bắt đầu</small></article>
        <article className="statistics-overdue"><span>Đang quá hạn</span><strong data-stat="overdue">{summary.overdue}</strong><small>Chưa hoàn thành và đã trễ hạn</small></article>
      </div>
      {selectedSubject !== 'unassigned' && <div className="statistics-task-links">
        <Link className="statistics-task-link" to={'/tasks?' + taskQuery}>Xem nhiệm vụ chưa xong →</Link>
        <Link className="statistics-task-link statistics-completed-link" to={'/tasks?' + completedQuery}>Xem nhiệm vụ đã hoàn thành →</Link>
      </div>}
      {summary.total === 0 && <section className="statistics-panel statistics-empty"><EmptyState title="Không có nhiệm vụ trong phạm vi đang chọn" /></section>}
      <section className="statistics-panel statistics-timeliness" aria-labelledby="statistics-timeliness-title">
        <div className="statistics-panel-heading"><h2 id="statistics-timeliness-title">Mức độ đúng hạn</h2><div className="statistics-rate"><strong data-stat="onTimeRate">{summary.onTimeRate === null ? '—' : `${summary.onTimeRate}%`}</strong><span>hoàn thành đúng hạn</span></div></div>
        <div className="statistics-timeliness-grid">
          <div><span className="statistics-dot statistics-dot-success" />Hoàn thành đúng hạn<strong data-stat="onTime">{summary.onTime}</strong></div>
          <div><span className="statistics-dot statistics-dot-warning" />Hoàn thành trễ hạn<strong data-stat="late">{summary.late}</strong></div>
          <div><span className="statistics-dot statistics-dot-danger" />Đang quá hạn<strong data-stat="timelinessOverdue">{summary.overdue}</strong></div>
        </div>
        <p className="statistics-note">Tỷ lệ tính trên nhiệm vụ đã hoàn thành có hạn và ngày hoàn thành.</p>
        {(summary.completedUndated > 0 || summary.completedUnknown > 0) && <p className="statistics-note">Không tính vào tỷ lệ: {[
          summary.completedUndated > 0 ? `${summary.completedUndated} nhiệm vụ không có hạn` : '',
          summary.completedUnknown > 0 ? `${summary.completedUnknown} nhiệm vụ thiếu ngày hoàn thành` : '',
        ].filter(Boolean).join(', ')}.</p>}
      </section>
      <section className="statistics-panel statistics-subjects" aria-labelledby="statistics-subjects-title">
        <div className="statistics-panel-heading"><h2 id="statistics-subjects-title">Tiến độ theo môn học</h2></div>
        {!planner.academicError && <div className="statistics-table-scroll"><table>
          <thead><tr><th>Môn học</th><th>Tổng nhiệm vụ</th><th>Hoàn thành</th><th>Quá hạn</th><th>Tiến độ</th></tr></thead>
          <tbody>{rows.map(row => {
            const stats = summarizeStatistics(filtered.filter(task => row.id === 'unassigned' ? task.maMonHoc === null : String(task.maMonHoc) === row.id), planner.now)
            return <tr key={row.id} data-subject={row.id}><th scope="row"><span className="statistics-subject-dot" style={{ backgroundColor: row.color || 'var(--accent)' }} />{row.name}</th><td>{stats.total}</td><td>{stats.completed}/{stats.total}</td><td className={stats.overdue ? 'statistics-late-count' : ''}>{stats.overdue}</td><td><div className="statistics-progress"><progress value={stats.completionRate} max={100} aria-label={`Tiến độ ${row.name}`} /><span>{stats.completionRate}%</span></div></td></tr>
          })}</tbody>
        </table>{!rows.length && <p className="statistics-note">Chưa có môn học trong học kỳ này.</p>}</div>}
      </section>
    </>}
  </div>
}
