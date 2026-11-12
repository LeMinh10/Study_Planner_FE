import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Modal, PageHeading } from '../../components/PlannerUI'
import { hienGio, loaiViec, ngay, trangThai, uuTien } from '../../hoc-tap/time'
import type { NhiemVu } from '../../hoc-tap/types'
import { agenda, dailyTasks, eventInScope, isDone, nextClass, recommend, taskHref, taskInScope } from './todayModel'
import { useToday } from './useToday'
import './today.css'

function Loading({ label }: { label: string }) {
  return <div className="today-skeleton" role="status" aria-label={label}><span>{label}</span><i /><i /><i /></div>
}
function Empty({ title }: { title: string }) {
  return <div className="today-empty"><Icon name="check" size={23} /><strong>{title}</strong></div>
}
function ReadError({ message, retry, loading }: { message: string; retry: () => void; loading: boolean }) {
  return <div role="alert" className="today-error"><p>{message}</p><button type="button" disabled={loading} onClick={retry}>Thử lại</button></div>
}

export function Dashboard() {
  const c = useToday()
  const [allRecommendations, setAllRecommendations] = useState(false)
  const [tab, setTab] = useState<'today' | 'overdue' | 'completed'>('today')
  const [allDaily, setAllDaily] = useState(false)
  const [selected, setSelected] = useState<NhiemVu | null>(null)
  const semester = c.academic.selectedSemesterId
  useEffect(() => { setSelected(null); setAllRecommendations(false); setAllDaily(false) }, [semester])
  const scoped = (c.tasks ?? []).filter((task) => taskInScope(task, semester))
  const events = (c.calendar?.suKien ?? []).filter((event) => eventInScope(event, semester))
  const ranked = recommend(scoped, c.now)
  const dueToday = dailyTasks(scoped, c.now, c.zone)
  const pendingToday = dueToday.filter((task) => !isDone(task))
  const completedToday = dueToday.filter(isDone)
  const overdue = ranked.filter((item) => item.group === 0).map((item) => item.task)
  const sessions = agenda(events, c.now, c.zone)
  const next = nextClass(events, c.now, c.zone)
  const today = ngay(c.now, c.zone)
  const busy = c.taskLoading || c.calendarLoading
  const metadataPending = c.academicLoading
  const taskReady = c.tasks !== undefined && !metadataPending
  const calendarReady = c.calendar !== undefined && !metadataPending
  const progress = dueToday.length ? Math.round(completedToday.length / dueToday.length * 100) : 0
  const selectedTask = selected ? scoped.find((task) => task.ma === selected.ma) ?? selected : null
  const dailyList = tab === 'today' ? pendingToday : tab === 'overdue' ? overdue : completedToday
  const time = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: c.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  const subjectName = (task: NhiemVu) => task.maMonHoc ? c.academic.subjects.find((subject) => subject.id === String(task.maMonHoc))?.name ?? 'Môn học chưa tải' : task.maHocKy ? 'Việc chung của học kỳ' : 'Việc cá nhân'
  const subjectColor = (task: NhiemVu) => c.academic.subjects.find((subject) => subject.id === String(task.maMonHoc))?.color ?? 'blue'

  function TaskMeta({ task }: { task: NhiemVu }) {
    return <div className="today-task-meta"><span className={`subject-tag ${subjectColor(task)}`}>{subjectName(task)}</span><span><Icon name="clock" size={12} />{hienGio(task.hanHieuLuc, c.zone)}</span></div>
  }

  return <section className="today-page" aria-label="Tổng hợp Hôm nay">
    <PageHeading eyebrow={new Intl.DateTimeFormat('vi-VN', { timeZone: c.zone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(c.now))} title="Hôm nay">
      <button type="button" className="button button-secondary today-reload" disabled={!c.enabled || busy} onClick={c.reload}><Icon name="reset" size={15} />{busy ? 'Đang cập nhật…' : 'Cập nhật'}</button><Link to="/tasks" className="button button-primary">Quản lý nhiệm vụ<Icon name="arrow-right" size={15} /></Link>
    </PageHeading>
    {!c.enabled ? <div className="today-login-notice">Đăng nhập để xem nhiệm vụ và lịch học.</div> : <>
      <div className="today-metrics" aria-label="Tổng quan trong ngày">
        <div><span>Đến hạn hôm nay</span><strong>{taskReady ? pendingToday.length : '—'}</strong></div>
        <div className={overdue.length ? 'today-metric-warning' : ''}><span>Đã quá hạn</span><strong>{taskReady ? overdue.length : '—'}</strong></div>
        <div><span>Lịch hôm nay</span><strong>{calendarReady ? sessions.length : '—'}</strong></div>
      </div>
      <div className="today-grid">
        <div className="today-main">
          <section className="today-panel today-priorities" aria-labelledby="today-priority-title">
            <header className="today-panel-heading"><h2 id="today-priority-title">Gợi ý nên làm trước</h2>{c.taskLoading && c.tasks !== undefined && <span className="today-updating" role="status">Đang cập nhật…</span>}</header>
            {c.taskError && <ReadError message={(c.tasks ? 'Đang hiển thị lần tải trước. ' : '') + c.taskError} retry={c.reload} loading={c.taskLoading} />}
            {!taskReady && !c.taskError ? <Loading label="Đang tải gợi ý ưu tiên…" /> : taskReady && ranked.length ? <ol className="today-priority-list">{(allRecommendations ? ranked : ranked.slice(0, 5)).map(({ task }, index) => <li key={task.ma} className={index === 0 ? 'today-first-choice' : ''}>
              <span className="today-rank" aria-label={`Ưu tiên ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
              <div className="today-recommendation"><button className="today-task-title" onClick={() => setSelected(task)}>{task.tieuDe}</button><TaskMeta task={task} /></div><button type="button" className="today-open" aria-label={'Xem nhiệm vụ: ' + task.tieuDe} onClick={() => setSelected(task)}><Icon name="arrow-right" size={16} /></button>
            </li>)}</ol> : taskReady && !c.taskError ? <Empty title="Chưa có việc cần gợi ý" /> : null}
            {taskReady && ranked.length > 5 && <button className="today-show-more" aria-expanded={allRecommendations} onClick={() => setAllRecommendations((value) => !value)}>{allRecommendations ? 'Thu gọn còn 5 gợi ý' : `Xem tất cả ${ranked.length} gợi ý`}<Icon name={allRecommendations ? 'chevron-left' : 'chevron-right'} size={14} /></button>}
          </section>

          <section className="today-panel today-daily" aria-labelledby="today-daily-title"><header className="today-panel-heading"><h2 id="today-daily-title">Việc cần theo dõi</h2><Link to="/tasks?view=today" className="today-text-link">Mở danh sách<Icon name="arrow-right" size={14} /></Link></header>
            {!taskReady && !c.taskError ? <Loading label="Đang tải nhiệm vụ trong ngày…" /> : taskReady ? <>
              <div className="today-progress"><span>Đã xong <strong>{completedToday.length}/{dueToday.length}</strong> nhiệm vụ đến hạn hôm nay</span><progress max={100} value={progress} aria-label="Tiến độ nhiệm vụ đến hạn hôm nay" /></div>
              <div className="today-task-tabs" role="group" aria-label="Nhóm nhiệm vụ Hôm nay">{([['today', 'Đến hạn hôm nay', pendingToday.length], ['overdue', 'Quá hạn', overdue.length], ['completed', 'Đã xong', completedToday.length]] as const).map(([value, label, count]) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setAllDaily(false) }}>{label}<span>{count}</span></button>)}</div>
              {dailyList.length ? <div className="today-daily-list">{(allDaily ? dailyList : dailyList.slice(0, 8)).map((task) => <article key={task.ma}><span className={'today-task-state' + (isDone(task) ? ' today-done' : '')}><Icon name={isDone(task) ? 'check' : task.trangThai === 'InProgress' ? 'play' : 'clock'} size={15} /></span><div><button className="today-task-title" onClick={() => setSelected(task)}>{task.tieuDe}</button><TaskMeta task={task} /></div><button className="today-text-link" onClick={() => setSelected(task)}>Chi tiết<Icon name="chevron-right" size={13} /></button></article>)}</div> : <Empty title={tab === 'today' ? 'Không còn nhiệm vụ đến hạn hôm nay' : tab === 'overdue' ? 'Không có nhiệm vụ quá hạn' : 'Chưa có nhiệm vụ đến hạn hôm nay được hoàn thành'} />}
              {dailyList.length > 8 && <button className="today-show-more" onClick={() => setAllDaily((value) => !value)}>{allDaily ? 'Thu gọn' : `Xem đủ ${dailyList.length} nhiệm vụ`}</button>}
            </> : c.taskError ? <p className="today-unavailable">Chưa tải được nhiệm vụ.</p> : null}
          </section>
        </div>

        <aside className="today-aside">
          <section className="today-next-class" aria-labelledby="today-next-title"><span className="today-kicker"><Icon name="book" size={14} />{next && Date.parse(next.batDau) <= c.now ? 'ĐANG TRONG GIỜ HỌC' : 'BUỔI HỌC TIẾP THEO'}</span>
            {c.calendarError && <ReadError message={(c.calendar ? 'Đang hiển thị lần tải trước. ' : '') + c.calendarError} retry={c.reload} loading={c.calendarLoading} />}
            {!calendarReady && !c.calendarError ? <Loading label="Đang tải lịch học…" /> : calendarReady && next ? <><h2 id="today-next-title">{next.tieuDe}</h2><p>{ngay(next.batDau, c.zone) === today ? 'Hôm nay' : new Intl.DateTimeFormat('vi-VN', { timeZone: c.zone, weekday: 'long', day: 'numeric', month: 'numeric' }).format(new Date(next.batDau))}</p><div className="today-class-hours"><strong>{time(next.batDau)}</strong><span>đến {time(next.ketThuc!)}</span></div><Link className="today-text-link" to="/calendar">Xem lịch học<Icon name="arrow-right" size={14} /></Link></> : calendarReady && !c.calendarError ? <><h2 id="today-next-title">Chưa có buổi học trong 7 ngày tới</h2><Link to="/schedule?tab=classes" className="today-text-link">Xem lịch theo môn<Icon name="arrow-right" size={14} /></Link></> : null}
          </section>
          <section className="today-panel today-agenda" aria-labelledby="today-agenda-title"><header className="today-panel-heading"><h2 id="today-agenda-title">Lịch hôm nay</h2><Icon name="calendar" size={18} /></header>
            {c.calendarLoading && c.calendar && <p className="today-updating" role="status">Đang cập nhật…</p>}
            {!calendarReady && !c.calendarError ? <Loading label="Đang tải lịch trong ngày…" /> : calendarReady && sessions.length ? <ol className="today-agenda-list">{sessions.map((event) => {
              const ended = event.ketThuc ? Date.parse(event.ketThuc) <= c.now : Date.parse(event.batDau) < c.now
              const current = !ended && Date.parse(event.batDau) <= c.now
              return <li key={event.ma} className={(ended ? 'today-event-ended' : '') + (current ? ' today-event-current' : '')}><div className="today-agenda-time"><strong>{time(event.batDau)}</strong>{event.ketThuc && <span>{time(event.ketThuc)}</span>}</div><div><span className="today-event-kind">{event.loai === 'LichHoc' ? 'Lớp học' : event.loai === 'PhienTuHoc' ? 'Tự học' : 'Sự kiện'}{current ? ' · Đang diễn ra' : ended ? ' · Đã qua giờ' : ''}</span><strong>{event.tieuDe}</strong>{event.trangThai && <small>{trangThai[event.trangThai] ?? event.trangThai}</small>}</div></li>
            })}</ol> : calendarReady && !c.calendarError ? <Empty title="Hôm nay chưa có lịch" /> : <p className="today-unavailable">Chưa tải được lịch.</p>}
            <Link to="/calendar" className="today-aside-link">Mở thời khóa biểu<Icon name="arrow-right" size={14} /></Link>
          </section>
        </aside>
      </div>
    </>}
    {selectedTask && <Modal title={selectedTask.tieuDe} onClose={() => setSelected(null)} side><div className="today-detail">
      <div className="today-detail-meta"><span className={`subject-tag ${subjectColor(selectedTask)}`}>{subjectName(selectedTask)}</span><span>{trangThai[selectedTask.trangThai]}</span></div>
      <dl><div><dt>Hạn hoàn thành</dt><dd>{hienGio(selectedTask.hanHieuLuc, c.zone)}</dd></div><div><dt>Mức quan trọng</dt><dd>{uuTien[selectedTask.mucDoUuTien]}</dd></div><div><dt>Loại nhiệm vụ</dt><dd>{loaiViec[selectedTask.loai]}</dd></div><div><dt>Tiến độ</dt><dd>{selectedTask.tienDo}%</dd></div></dl>
      {selectedTask.moTa && <section><h3>Mô tả</h3><p className="today-description">{selectedTask.moTa}</p></section>}
      <Link to={taskHref(selectedTask)} className="button button-primary" onClick={() => setSelected(null)}>Mở trong Nhiệm vụ<Icon name="arrow-right" size={15} /></Link>
    </div></Modal>}
  </section>
}
