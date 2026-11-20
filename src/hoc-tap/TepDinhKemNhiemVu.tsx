import { useEffect, useRef, useState } from 'react'
import { ActionMenu } from '../components/ActionMenu'
import { AnhDinhKem, docTepDinhKem, laTepAnh } from './AnhDinhKem'
import { goi } from './api'
import { xacNhan } from './xacNhan'

interface Tep { ma: number; tenTep: string; kichThuocByte: number; ngayTao: string }
export function useTepDinhKemNhiemVu({ ma, token, revision, version, disabled, onBusy, onSaved }: {
  ma: number | null; token: string; revision: number; version: number | null; disabled: boolean
  onBusy: (busy: boolean) => void; onSaved: () => void
}) {
  const [snapshot, setSnapshot] = useState<{ ma: number; files: Tep[]; version: number | null } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  useEffect(() => {
    if (ma === null) return
    const abort = new AbortController()
    setLoading(true); setError('')
    setSnapshot(current => current?.ma === ma ? { ...current, version: null } : null)
    goi<Tep[]>(token, `/tasks/${ma}/attachments`, { signal: abort.signal }).then(r => {
      if (abort.signal.aborted) return
      setSnapshot({ ma, files: r.duLieu, version: r.phienBan })
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
    if (ma === null || !canUpload || version === null) return
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Tệp phải có dữ liệu và không vượt quá 10 MB.'); return }
    await run(async () => {
      const body = new FormData(); body.append('tep', file)
      await goi<Tep>(token, `/tasks/${ma}/attachments`, { method: 'POST', body, version })
      onSaved()
    })
  }
  async function download(file: Tep) {
    if (ma === null) return
    await run(async () => {
      const url = URL.createObjectURL(await docTepDinhKem(token, ma, file.ma))
      const link = document.createElement('a'); link.href = url; link.download = file.tenTep
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }
  const current = snapshot?.ma === ma ? snapshot : null
  const files = current?.files ?? []
  const readyVersion = current?.version ?? null
  const canEdit = !disabled && !busy && !loading && version !== null && readyVersion === version
  const canUpload = canEdit && files.length < 20
  const stale = !loading && !error && readyVersion !== version
  const content = <>
    <input ref={input} className="ht-attachment-input" type="file" hidden aria-label="Chọn tệp đính kèm" disabled={!canUpload}
      onChange={event => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) void upload(file)
      }} />
    {ma !== null && version !== null && (files.length > 0 || error || busy || stale) && <section className="ht-detail-section ht-attachments" aria-label="Tệp đính kèm">
      {files.length > 0 && <ul>{files.map(file => <DongTepDinhKem key={file.ma} file={file} ma={ma} token={token}
        disabled={busy || disabled} canEdit={canEdit} onDownload={() => void download(file)} onRemove={() => void run(async () => {
          if (!await xacNhan({ tieuDe: 'Xóa tệp đính kèm', noiDung: 'Xóa “' + file.tenTep + '” khỏi nhiệm vụ?', nhanXacNhan: 'Xóa tệp' })) return
          await goi(token, '/tasks/' + ma + '/attachments/' + file.ma, { method: 'DELETE', version }); onSaved()
        })} />)}</ul>}
      {busy && <p className="ht-note" role="status">Đang xử lý tệp…</p>}
      {error && <p className="ht-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => { setRetry(n => n + 1); onSaved() }}>Tải dữ liệu mới</button></p>}
      {stale && <button type="button" className="ht-text-action" disabled={busy} onClick={onSaved}>Tải dữ liệu mới để đính kèm</button>}
    </section>}
  </>
  return { content, canUpload, chooseFile: () => input.current?.click() }
}

function DongTepDinhKem({ file, ma, token, disabled, canEdit, onDownload, onRemove }: {
  file: Tep; ma: number; token: string; disabled: boolean; canEdit: boolean; onDownload: () => void; onRemove: () => void
}) {
  const [thuNho, setThuNho] = useState(false)
  const image = laTepAnh(file.tenTep)
  const extension = /\.([a-z0-9]{1,6})$/i.exec(file.tenTep)?.[1].toUpperCase() ?? 'TỆP'
  const size = file.kichThuocByte < 1024 * 1024
    ? Math.max(1, Math.ceil(file.kichThuocByte / 1024)) + ' KB'
    : (file.kichThuocByte / 1024 / 1024).toFixed(1) + ' MB'
  return <li>
    {image && <AnhDinhKem ten={file.tenTep} ma={ma} tep={file.ma} token={token} thuNho={thuNho} disabled={disabled} />}
    <div className="ht-attachment-meta">
      <span className="ht-attachment-file-type">{extension}</span>
      <div className="ht-attachment-info">
        {image ? <span className="ht-attachment-name">{file.tenTep}</span> :
          <button type="button" className="ht-attachment-name" disabled={disabled} title={'Tải xuống ' + file.tenTep} onClick={onDownload}>{file.tenTep}</button>}
        <small>{size}</small>
      </div>
      <ActionMenu label={'Tùy chọn tệp ' + file.tenTep} className="ht-attachment-actions">
        {image && <button type="button" disabled={disabled} onClick={() => setThuNho(value => !value)}>{thuNho ? 'Mở rộng ảnh' : 'Thu nhỏ ảnh'}</button>}
        <button type="button" aria-label={'Tải xuống ' + file.tenTep} disabled={disabled} onClick={onDownload}>Tải xuống</button>
        <button type="button" aria-label={'Xóa tệp ' + file.tenTep} disabled={!canEdit} onClick={onRemove}>Xóa</button>
      </ActionMenu>
    </div>
  </li>
}
