import { useEffect, useState } from 'react'
import { goi } from '../hoc-tap/api'
import { durationText } from './focus'
import { focusColors, focusDistribution, focusGradient } from './focus-statistics'
import type { FocusStatistics as Statistics } from './focus-statistics'
import { FocusDialog } from './FocusDialog'

export function FocusStatistics({ token, today, close, openTask }: { token: string; today: string; close: () => void; openTask: (id: number) => void }) {
  const [days, setDays] = useState(7)
  const [end, setEnd] = useState(today)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const refresh = () => setRetry(value => value + 1)
    window.addEventListener('studyplanner:focus-changed', refresh)
    return () => window.removeEventListener('studyplanner:focus-changed', refresh)
  }, [])
  const key = JSON.stringify([days, end, retry])
  const [response, setResponse] = useState<{ key: string; data?: Statistics; error?: string } | null>(null)
  const result = response?.key === key ? response : null
  const data = result?.data
  useEffect(() => {
    const controller = new AbortController()
    if (!end) { setResponse({ key, error: 'Chọn ngày kết thúc để xem thống kê.' }); return }
    goi<Statistics>(token, '/focus/statistics?' + new URLSearchParams({ ngay: end, soNgay: String(days) }), { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setResponse({ key, data: r.duLieu }) })
      .catch(e => { if (!controller.signal.aborted) setResponse({ key, error: e.message }) })
    return () => controller.abort()
  }, [token, days, end, key])
  const groups = focusDistribution(data?.theoNhiemVu ?? [])
  const total = data?.tongHop.tongMiliGiay ?? 0
  const maximum = Math.max(1, ...(data?.theoNgay.map(row => row.tongMiliGiay) ?? []))
  const date = (day: string) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00Z'))
  return <FocusDialog title="Thống kê tập trung" className="focus-statistics" close={close}>
    <div className="focus-stat-filters"><div role="group" aria-label="Khoảng thống kê">{[[1, 'Ngày'], [7, '7 ngày'], [30, '30 ngày']].map(([value, label]) => <button type="button" key={value} aria-pressed={days === value} onClick={() => setDays(Number(value))}>{label}</button>)}</div><label>Đến ngày<input type="date" max={today} value={end} aria-label="Ngày kết thúc thống kê" onChange={e => setEnd(e.target.value)} /></label></div>
    {!result && <p className="focus-empty" role="status">Đang tải thống kê…</p>}
    {result?.error && <p className="focus-error" role="alert">{result.error}<button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>}
    {data && <>
      <p className="focus-stat-period">{date(data.tuNgay)} – {date(data.denNgay)}</p>
      <div className="focus-stat-kpis">{[['Thời gian tập trung', durationText(total)], ['Pomodoro hoàn tất', String(data.tongHop.soPomodoro)], ['Phiên đã lưu', String(data.tongHop.soPhien)], ['Trung bình / ngày', durationText(total / data.theoNgay.length)]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="focus-stat-grid">
        <section className="focus-stat-chart-card"><h3>Thời gian theo ngày</h3><div className="focus-trend" role="img" aria-label="Biểu đồ thời gian tập trung theo ngày">{data.theoNgay.map((day, index) => <div key={day.ngay} title={`${date(day.ngay)} · ${durationText(day.tongMiliGiay)} · ${day.soPhien} phiên`}><div className="focus-trend-track"><span style={{ height: day.tongMiliGiay / maximum * 100 + '%' }} /></div><small>{index === 0 || index === data.theoNgay.length - 1 || index % Math.ceil(data.theoNgay.length / 7) === 0 ? date(day.ngay) : '\u00a0'}</small></div>)}</div></section>
        <section className="focus-stat-chart-card"><h3>Thời gian theo nhiệm vụ</h3><div className="focus-distribution"><div className="focus-donut" role="img" aria-label={'Tổng thời gian ' + durationText(total)} style={{ background: focusGradient(groups) }}><div><strong>{durationText(total)}</strong><span>Tập trung</span></div></div><div className="focus-distribution-legend">{groups.map((row, index) => <div key={index}><i style={{ background: focusColors[index] }} /><button type="button" disabled={row.maNhiemVu == null} title={row.tieuDe} onClick={() => { if (row.maNhiemVu != null) openTask(row.maNhiemVu) }}>{row.tieuDe}</button><span>{total > 0 ? Math.round(row.tongMiliGiay / total * 1000) / 10 : 0}%</span></div>)}</div></div></section>
      </div>
      {data.tongHop.soPhien === 0 && <p className="focus-stat-empty">Chưa có phiên trong khoảng này.</p>}
    </>}
    <footer><button type="button" className="focus-primary" onClick={close}>Xong</button></footer>
  </FocusDialog>
}
