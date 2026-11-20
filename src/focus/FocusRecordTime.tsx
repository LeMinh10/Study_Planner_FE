import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { goi, LoiHocTap } from '../hoc-tap/api'
import { gioNhap, utc } from '../hoc-tap/time'
import { FocusDialog } from './FocusDialog'
import { clockText } from './focus'
import type { FocusRecord } from './focus'

interface TimeSnapshot {
  batDau: string
  ketThuc: string
  soMiliGiayDaHoc: number
}

interface RecordTime {
  banGhi: FocusRecord
  canNhapThoiLuong: boolean
  lichSu: { suaLuc: string; truoc: TimeSnapshot; sau: TimeSnapshot }[]
}

function localTime(value: string, zone: string) {
  return gioNhap(value, zone) + new Date(value).toISOString().slice(16, -1)
}

function inputTime(value: string, original: string, zone: string) {
  // Keep the original offset and precision if this field was untouched.
  if (value && Date.parse(value + 'Z') === Date.parse(localTime(original, zone) + 'Z')) return original
  const minute = utc(value.slice(0, 16), zone)
  return minute && new Date(Date.parse(minute) + Date.parse(value + 'Z') - Date.parse(value.slice(0, 16) + 'Z')).toISOString()
}

export function FocusRecordTime({ id, token, zone, close, onSaved }: {
  id: number
  token: string
  zone: string
  close: () => void
  onSaved: (record: FocusRecord) => void
}) {
  const path = '/focus/' + id + '/time'
  const [data, setData] = useState<{ duLieu: RecordTime; phienBan: number }>()
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    goi<RecordTime>(token, path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message)
    })
    return () => controller.abort()
  }, [token, path, retry])

  function reload() {
    setData(undefined)
    setError('')
    setStale(false)
    setRetry(value => value + 1)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data || busy || stale) return
    const form = new FormData(event.currentTarget)
    const { banGhi, canNhapThoiLuong } = data.duLieu
    setBusy(true)
    setError('')
    try {
      const batDau = inputTime(String(form.get('start')), banGhi.batDau, zone)
      const ketThuc = inputTime(String(form.get('end')), banGhi.ketThuc!, zone)
      if (!batDau || !ketThuc || Date.parse(batDau) >= Date.parse(ketThuc))
        throw new Error('Giờ bắt đầu phải trước giờ kết thúc.')
      const soMiliGiayDaHoc = canNhapThoiLuong ? Math.round(Number(form.get('duration')) * 1000) : null
      const result = await goi<RecordTime>(token, path, { method: 'PUT', version: data.phienBan,
        body: { batDau, ketThuc, soMiliGiayDaHoc } })
      onSaved(result.duLieu.banGhi)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được thời gian thực học.')
      if (cause instanceof LoiHocTap && cause.code === 'DATA_VERSION_CONFLICT') setStale(true)
    } finally { setBusy(false) }
  }

  const detail = data?.duLieu
  const dateTime = new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'medium' })
  const summary = (value: TimeSnapshot) =>
    dateTime.format(new Date(value.batDau)) + ' → ' + dateTime.format(new Date(value.ketThuc)) + ' · ' + clockText(value.soMiliGiayDaHoc / 1000)
  return <FocusDialog title="Sửa thời gian thực học" close={close} busy={busy}>
    {error && <p role="alert" className="focus-error">{error}</p>}
    {((!detail && error) || stale) && <button type="button" onClick={reload}>Tải lại bản ghi</button>}
    {!detail && !error && <p role="status">Đang tải bản ghi…</p>}
    {detail && <form onSubmit={save}>
      <fieldset disabled={busy || stale}>
        <label>Bắt đầu<input name="start" type="datetime-local" step={0.001} required defaultValue={localTime(detail.banGhi.batDau, zone)} /></label>
        <label>Kết thúc<input name="end" type="datetime-local" step={0.001} required defaultValue={localTime(detail.banGhi.ketThuc!, zone)} /></label>
        {detail.canNhapThoiLuong && <label>Thời gian thực học (giây)
          <input name="duration" type="number" required min={0.001} step={0.001} defaultValue={detail.banGhi.soMiliGiayDaHoc / 1000} />
          <small>Bản ghi này chỉ có tổng thời gian. Nhập số giây thực học sau khi trừ các khoảng dừng.</small>
        </label>}
      </fieldset>
      {!!detail.lichSu.length && <details>
        <summary>Lịch sử chỉnh sửa</summary>
        <ul>{detail.lichSu.map((edit, index) => <li key={edit.suaLuc + index}>
          <strong>{dateTime.format(new Date(edit.suaLuc))}</strong>
          <p>Trước {summary(edit.truoc)}</p>
          <p>Sau {summary(edit.sau)}</p>
        </li>)}</ul>
      </details>}
      <footer><button type="button" disabled={busy} onClick={close}>Hủy</button>
        <button type="submit" className="focus-primary" disabled={busy || stale}>{busy ? 'Đang lưu…' : 'Lưu thời gian'}</button></footer>
    </form>}
  </FocusDialog>
}
