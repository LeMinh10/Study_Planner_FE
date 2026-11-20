import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { loadNotificationSettings, saveNotificationSettings } from '../api/notificationSettings'
import type { NotificationSettingsData } from '../api/notificationSettings'

export function NotificationSettings({ back }: { back: () => void }) {
  const { getAccessToken } = useAuth()
  const [snapshot, setSnapshot] = useState<{ data: NotificationSettingsData; version: number } | null>(null)
  const [hours, setHours] = useState('24')
  const [planning, setPlanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const active = useRef(false)
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    active.current = true
    const controller = new AbortController()
    setLoading(true); setError('')
    void Promise.resolve().then(() => loadNotificationSettings(getAccessToken(), controller.signal)).then(result => {
      if (controller.signal.aborted) return
      setSnapshot(result); setHours(String(result.data.nhacTruocGio)); setPlanning(result.data.nhacKeHoach)
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa tải được thiết lập thông báo.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { active.current = false; controller.abort() }
  }, [getAccessToken, revision])
  return <section className="notification-settings" aria-label="Thiết lập nhắc hạn">
    <h3>Thiết lập nhắc hạn</h3>
    {loading && <p role="status">Đang tải thiết lập…</p>}
    {error && <div className="notification-settings-error" role="alert"><p>{error}</p><button type="button" disabled={saving || loading} onClick={reload}>Tải cấu hình mới</button></div>}
    {snapshot && <form onSubmit={async event => {
      event.preventDefault()
      if (saving || loading) return
      setSaving(true); setError('')
      try {
        // Gửi cùng phiên bản đã xem; khi có xung đột cần tải lại, không tự ghi đè lựa chọn của tab khác.
        await saveNotificationSettings(getAccessToken(), { nhacTruocGio: Number(hours), nhacKeHoach: planning }, snapshot.version)
        if (active.current) back()
      } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Chưa lưu được thiết lập.') }
      finally { if (active.current) setSaving(false) }
    }}>
      <fieldset disabled={saving || loading}>
        <label className="notification-hours">Nhắc nhiệm vụ trước hạn (giờ)<input name="nhacTruocGio" type="number" min={0} max={8760} step={1} required value={hours} onChange={event => setHours(event.target.value)} /></label>
        <p>Dùng cho nhiệm vụ chưa có nhắc hạn riêng. Nhập 0 để nhắc đúng hạn. Mặc định là 24 giờ.</p>
        <label className="planning-reminder-toggle"><input name="nhacKeHoach" type="checkbox" checked={planning} onChange={event => setPlanning(event.target.checked)} />Nhắc rà soát tuần và giờ rảnh sắp hết hạn</label>
        <p>Nhắc kế hoạch khi bạn mở hoặc quay lại ứng dụng. Giờ rảnh vẫn lặp khi tắt nhắc.</p>
      </fieldset>
      <footer><button type="button" disabled={saving} onClick={back}>Quay lại thông báo</button><button type="submit" disabled={saving || loading}>{saving ? 'Đang lưu…' : 'Lưu thiết lập'}</button></footer>
    </form>}
    {!snapshot && <button type="button" onClick={back}>Quay lại thông báo</button>}
  </section>
}
