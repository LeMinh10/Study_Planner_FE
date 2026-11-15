import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { loadAdminOverview, overviewStudentLink } from '../api/adminOverview'
import { loadActivePriorityRule } from '../api/priorityRules'
import { criterionLabels } from '../priority/rules'
import { useAdminResource } from './useAdminResource'
import './overview.css'

export function AdminOverviewPage() {
  const loadSummary = useCallback((token: string, signal: AbortSignal) => loadAdminOverview(token, signal), [])
  const loadRule = useCallback((token: string, signal: AbortSignal) => loadActivePriorityRule(token, signal), [])
  const summary = useAdminResource(loadSummary)
  const rule = useAdminResource(loadRule)
  const data = summary.data
  const metrics = [
    { key: 'total', label: 'Tổng sinh viên', value: data?.total, icon: 'user' },
    { key: 'open', label: 'Tài khoản đang mở', value: data?.open, icon: 'check' },
    { key: 'locked', label: 'Tài khoản đã khóa', value: data?.locked, icon: 'logout' },
    { key: 'recent', label: 'Tài khoản mới trong 7 ngày', value: data?.recentCount, icon: 'plus' },
  ] as const
  const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))

  return <section className="admin-overview" aria-labelledby="admin-overview-title">
    <header className="overview-heading"><div className="admin-page-heading"><h1 id="admin-overview-title">Tổng quan</h1></div></header>
    {summary.error && <div className="overview-error" role="alert">{summary.error.message}<button type="button" className="overview-stats-retry" onClick={summary.reload}>Thử lại</button></div>}
    <div className="overview-metrics" aria-label="Thống kê tài khoản sinh viên" aria-busy={summary.loading}>{metrics.map(metric => <div key={metric.key} data-overview-metric={metric.key} className={'overview-metric metric-' + metric.key}><span className="overview-metric-icon"><Icon name={metric.icon} size={19} /></span><span className="overview-metric-content"><span>{metric.label}</span><strong>{metric.value === undefined ? '—' : metric.value.toLocaleString('vi-VN')}</strong></span></div>)}</div>
    <div className="overview-grid">
      <section className="overview-panel overview-recent" aria-labelledby="overview-recent-title"><header><h2 id="overview-recent-title">Sinh viên mới đăng ký</h2><Link to={overviewStudentLink('total')}>Xem tất cả<Icon name="chevron-right" size={14} /></Link></header>
        {summary.loading ? <p className="overview-message" role="status">Đang tải sinh viên…</p> : summary.error ? <p className="overview-message">Chưa tải được danh sách.</p> : data?.students.length ? <div className="admin-table-container"><table><thead><tr><th>Họ và tên</th><th>Ngày đăng ký</th><th>Trạng thái</th><th><span className="sr-only">Chi tiết</span></th></tr></thead><tbody>{data.students.map(student => <tr key={student.id} data-student-id={student.id}><td><strong>{student.name}</strong><small>{student.email}</small></td><td>{date(student.createdAt)}</td><td><span className={'admin-status ' + (student.active ? 'active' : 'locked')}>{student.active ? 'Đang mở' : 'Đã khóa'}</span></td><td><Link className="overview-student-detail" to={`/admin/students/${student.id}?VaiTro=Student`} aria-label={`Xem chi tiết ${student.name}`}><Icon name="arrow-right" size={16} /></Link></td></tr>)}</tbody></table></div> : <p className="overview-message">Chưa có sinh viên.</p>}
      </section>
      <section className="overview-panel overview-rule" aria-labelledby="overview-rule-title"><header><h2 id="overview-rule-title">Quy tắc đang áp dụng</h2><Icon name="flag" size={17} /></header>
        {rule.loading ? <p className="overview-message" role="status">Đang tải quy tắc…</p> : rule.error ? <div className="overview-error" role="alert">{rule.error.message}<button type="button" className="overview-rule-retry" onClick={rule.reload}>Thử lại</button></div> : rule.data && <div className="overview-rule-body"><h3>{rule.data.ten}</h3><ol>{rule.data.cauHinh.tieuChi.map((criterion, index) => <li key={criterion}><span>{String(index + 1).padStart(2, '0')}</span>{criterionLabels[criterion]}</li>)}</ol></div>}
        <Link className="overview-rule-link" to="/admin/priority-rules">Quản lý quy tắc<Icon name="arrow-right" size={15} /></Link>
      </section>
    </div>
  </section>
}
