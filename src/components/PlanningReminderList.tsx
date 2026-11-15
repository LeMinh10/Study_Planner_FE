import type { usePlanningReminders } from '../hooks/usePlanningReminders'
import type { PlanningReminder } from '../api/planningReminders'

export function PlanningReminderList({ state, open }: { state: ReturnType<typeof usePlanningReminders>; open: (item: PlanningReminder) => void }) {
  if (!state.enabled || (!state.error && !state.loading && !state.inbox?.danhSach.length)) return null
  const rows = state.inbox?.danhSach ?? []
  const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: state.inbox?.muiGio ?? 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  return <section className="planning-reminders" aria-label="Nhắc kế hoạch học">
    <div className="planning-reminders-heading"><h3>Kế hoạch học</h3>{!!state.inbox?.tongChuaDoc && <button type="button" disabled={state.loading || state.saving} onClick={() => void state.mark()}>Đọc hết mục này</button>}</div>
    {state.error && <div className="notification-error" role="alert"><p>{state.error}</p><button type="button" disabled={state.loading || state.saving} onClick={state.refresh}>Thử lại nhắc kế hoạch</button></div>}
    {state.loading && !state.inbox && <p className="notification-loading" role="status">Đang tải nhắc kế hoạch…</p>}
    {!!rows.length && <ul className="planning-reminder-list">{rows.map(item => <li key={item.ma}><button type="button" disabled={state.saving} className={'student-notification-item' + (!item.ngayDoc ? ' notification-unread' : '')} onClick={() => open(item)}>
      <span className="student-notification-kind">{item.tieuDe}{!item.ngayDoc && <span className="notification-unread-dot" aria-label="Chưa đọc" />}</span>
      <span className="planning-reminder-content">{item.noiDung}</span><small>{date(item.ngayPhat)}</small>
    </button></li>)}</ul>}
    {state.inbox && state.inbox.tongSo > state.inbox.kichThuocTrang && <nav className="notification-pagination" aria-label="Trang nhắc kế hoạch"><button type="button" disabled={state.page <= 1 || state.loading || state.saving} onClick={() => state.setPage(state.page - 1)}>Trước</button><span>{state.page}/{Math.ceil(state.inbox.tongSo / state.inbox.kichThuocTrang)}</span><button type="button" disabled={state.page * state.inbox.kichThuocTrang >= state.inbox.tongSo || state.loading || state.saving} onClick={() => state.setPage(state.page + 1)}>Sau</button></nav>}
  </section>
}
