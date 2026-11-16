import { useEffect, useRef, useState } from 'react'
import { apiBaseUrl } from '../api/config'
import { readApiResponse } from '../api/client'
import { goi } from './api'
import { xacNhan } from './xacNhan'

interface Tep { ma: number; tenTep: string; kichThuocByte: number; ngayTao: string }
export function TepDinhKemNhiemVu({ ma, token, revision, version, disabled, onBusy, onSaved }: {
  ma: number; token: string; revision: number; version: number; disabled: boolean
  onBusy: (busy: boolean) => void; onSaved: () => void
}) {
  const [files, setFiles] = useState<Tep[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [readyVersion, setReadyVersion] = useState<number | null>(null)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  useEffect(() => {
    const abort = new AbortController()
    setLoading(true); setError(''); setReadyVersion(null)
    goi<Tep[]>(token, `/tasks/${ma}/attachments`, { signal: abort.signal }).then(r => {
      if (abort.signal.aborted) return
      setFiles(r.duLieu); setReadyVersion(r.phienBan)
    }).catch(e => { if (!abort.signal.aborted) setError(e.message) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [ma, token, revision, retry])

  async function run(action: () => Promise<void>) {
    if (running.current) return
    running.current = true; setBusy(true); onBusy(true); setError('')
    try { await action() }
    catch (e) { setError(e instanceof Error ? e.message : 'Chưa xử lý được tệp. Hãy thử lại.') }
    finally { running.current = false; setBusy(false); onBusy(false) }
  }
  async function upload(file: File) {
    if (disabled || readyVersion !== version) return
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Tệp phải có dữ liệu và không vượt quá 10 MB.'); return }
    await run(async () => {
      const body = new FormData(); body.append('tep', file)
      await goi<Tep>(token, `/tasks/${ma}/attachments`, { method: 'POST', body, version })
      onSaved()
    })
    if (input.current) input.current.value = ''
  }
  async function download(file: Tep) {
    await run(async () => {
      const response = await fetch(apiBaseUrl + `/tasks/${ma}/attachments/${file.ma}/download`, {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
      })
      if (!response.ok) { await readApiResponse(response, token); return }
      // Không mở nội dung do người dùng tải lên trong nguồn ứng dụng; chỉ lưu xuống máy.
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = file.tenTep
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }
  const canEdit = !disabled && !busy && !loading && readyVersion === version
  return <section className="ht-detail-section ht-attachments" aria-label="Tệp đính kèm">
    <h3>Tệp đính kèm{files.length > 0 && ` · ${files.length}/20`}</h3>
    {loading && <p className="ht-note" role="status">Đang tải danh sách tệp…</p>}
    {!loading && !error && !files.length && <p className="ht-note">Chưa có tệp đính kèm.</p>}
    <ul>{files.map(file => <li key={file.ma}>
      <button type="button" className="ht-attachment-name" disabled={busy || disabled} title={'Tải xuống ' + file.tenTep} onClick={() => void download(file)}>{file.tenTep}</button>
      <small>{file.kichThuocByte < 1024 * 1024 ? Math.max(1, Math.ceil(file.kichThuocByte / 1024)) + ' KB' : (file.kichThuocByte / 1024 / 1024).toFixed(1) + ' MB'}</small>
      <button type="button" className="ht-text-action" aria-label={'Xóa tệp ' + file.tenTep} disabled={!canEdit} onClick={() => void run(async () => {
        if (!await xacNhan({ tieuDe: 'Xóa tệp đính kèm', noiDung: `Xóa “${file.tenTep}” khỏi nhiệm vụ?`, nhanXacNhan: 'Xóa tệp' })) return
        await goi(token, `/tasks/${ma}/attachments/${file.ma}`, { method: 'DELETE', version }); onSaved()
      })}>Xóa</button>
    </li>)}</ul>
    <input ref={input} type="file" hidden aria-label="Chọn tệp đính kèm" disabled={!canEdit || files.length >= 20}
      onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
    <button type="button" className="ht-text-action" disabled={!canEdit || files.length >= 20} onClick={() => input.current?.click()}>{busy ? 'Đang xử lý…' : '+ Đính kèm tệp'}</button>
    <small className="ht-note">Tối đa 10 MB/tệp, 20 tệp/nhiệm vụ.</small>
    {error && <p className="ht-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => { setRetry(n => n + 1); onSaved() }}>Tải dữ liệu mới</button></p>}
    {!loading && !error && readyVersion !== version && <button type="button" className="ht-text-action" disabled={busy} onClick={onSaved}>Tải dữ liệu mới để đính kèm</button>}
  </section>
}
