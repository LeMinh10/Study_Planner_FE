import { useCallback, useEffect, useRef, useState } from 'react'
import { goi } from './api'
import type { CauHinhHoc } from './types'
import './planning-upgrade.css'

export function useStudySettings(token: string) {
  const [snapshot, setSnapshot] = useState<{ token: string; version: number; data: CauHinhHoc } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sequence = useRef(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    window.addEventListener('studyplanner:saved', refresh)
    window.addEventListener('studyplanner:refresh', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('studyplanner:saved', refresh); window.removeEventListener('studyplanner:refresh', refresh); window.removeEventListener('focus', refresh) }
  }, [refresh])
  useEffect(() => {
    const controller = new AbortController(), request = ++sequence.current
    if (!token) { setLoading(false); return }
    setLoading(true); setError('')
    goi<CauHinhHoc>(token, '/study-settings', { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted && request === sequence.current) setSnapshot({ token, version: result.phienBan, data: result.duLieu })
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, revision])
  // Chỉ dùng cấu hình của phiên đăng nhập hiện tại, tránh khởi tạo đồng hồ bằng dữ liệu tài khoản trước.
  const current = snapshot?.token === token ? snapshot : null
  async function save(data: CauHinhHoc) {
    if (!current || loading || saving) return false
    setSaving(true); setError('')
    try {
      const result = await goi<CauHinhHoc>(token, '/study-settings', { method: 'PUT', body: data, version: current.version })
      setSnapshot({ token, version: result.phienBan, data: result.duLieu })
      window.dispatchEvent(new Event('studyplanner:refresh'))
      return true
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được cấu hình học.'); return false }
    finally { setSaving(false) }
  }
  return { data: current?.data ?? null, version: current?.version ?? null, loading, saving, error, refresh, save }
}

export function StudySettingsForm({ token, sound, saveSound, onSaved, close }: {
  token: string; sound?: boolean; saveSound?: (value: boolean) => void; onSaved?: () => void; close?: () => void
}) {
  const settings = useStudySettings(token)
  const data = settings.data
  const [saved, setSaved] = useState(false)
  return <div className="ht-shared-settings">
    {settings.loading && !data && <p role="status">Đang tải cài đặt…</p>}
    {settings.error && <p className="ht-error" role="alert">{settings.error} <button type="button" onClick={settings.refresh}>Tải lại cấu hình</button></p>}
    {data && <form onSubmit={async event => {
      event.preventDefault(); setSaved(false)
      const form = new FormData(event.currentTarget)
      const updated = await settings.save({ phienHocPhut: Number(form.get('minutes')), nghiGiuaPhienPhut: Number(form.get('rest')), gioiHanHocMoiNgayPhut: Number(form.get('daily')) })
      if (updated) { saveSound?.(form.has('sound')); setSaved(true); onSaved?.() }
    }}>
      <fieldset disabled={settings.loading || settings.saving} key={JSON.stringify(data)}>
        <div className="ht-settings-fields"><label>Thời gian mỗi phiên (phút)<input name="minutes" type="number" min={15} max={50} required defaultValue={data.phienHocPhut} /></label>
          <label>Nghỉ giữa các phiên (phút)<input name="rest" type="number" min={1} max={30} required defaultValue={data.nghiGiuaPhienPhut} /></label>
          <label>Giới hạn học mỗi ngày (phút)<input name="daily" type="number" min={15} max={720} required defaultValue={data.gioiHanHocMoiNgayPhut} /></label></div>
        {saveSound && <label className="focus-checkbox"><input type="checkbox" name="sound" defaultChecked={sound} />Âm báo khi hết giờ trên trình duyệt này</label>}
      </fieldset>
      <p className="ht-study-caption">Thời gian học và nghỉ áp dụng cho phiên Pomodoro mới và gợi ý lịch mới. Giới hạn mỗi ngày dùng khi xếp lịch.</p>
      {saved && <p role="status" className="ht-settings-saved">Đã lưu cài đặt.</p>}
      <footer>{close && <button type="button" disabled={settings.saving} onClick={close}>Đóng</button>}<button className="ht-primary" type="submit" disabled={settings.loading || settings.saving}>{settings.saving ? 'Đang lưu…' : 'Lưu cài đặt'}</button></footer>
    </form>}
  </div>
}

export function StudySettingsPanel({ token, onSaved }: { token: string; onSaved?: () => void }) {
  return <details className="ht-study-settings"><summary>Cấu hình học và nghỉ</summary><StudySettingsForm token={token} onSaved={onSaved} /></details>
}
