import { useEffect, useRef, useState } from 'react'
import { apiBaseUrl } from '../api/config'
import { readApiResponse } from '../api/client'
import { Icon } from '../components/Icon'

export function laTepAnh(ten: string) {
  return /\.(?:png|jpe?g|webp|gif)$/i.test(ten)
}

export async function docTepDinhKem(token: string, ma: number, tep: number, signal?: AbortSignal) {
  const response = await fetch(apiBaseUrl + '/tasks/' + ma + '/attachments/' + tep + '/download', {
    headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal,
  })
  if (!response.ok) await readApiResponse(response, token)
  return response.blob()
}

async function kieuAnh(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const starts = (...prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte)
  const textAt = (offset: number, value: string) => [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0))
  // Kiểm tra byte thực. Tên tệp và Content-Type do máy chủ dùng để tải xuống không xác định nội dung ảnh.
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png'
  if (starts(255, 216, 255)) return 'image/jpeg'
  if (textAt(0, 'GIF87a') || textAt(0, 'GIF89a')) return 'image/gif'
  if (textAt(0, 'RIFF') && textAt(8, 'WEBP') && textAt(12, 'VP8') && [32, 76, 88].includes(bytes[15])) return 'image/webp'
  return null
}

function XemAnhLon({ src, ten, onClose }: { src: string; ten: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="ht-attachment-lightbox" aria-label={'Xem ảnh ' + ten} onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
    <button type="button" className="ht-attachment-lightbox-close" aria-label="Đóng xem ảnh" autoFocus
      onClick={() => dialog.current?.close()}><Icon name="close" size={23} /></button>
    <img src={src} alt={ten} />
  </dialog>
}

export function AnhDinhKem({ ten, ma, tep, token, thuNho, disabled }: {
  ten: string; ma: number; tep: number; token: string; thuNho: boolean; disabled: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    let url: string | undefined
    let observer: IntersectionObserver | undefined
    setSrc(undefined); setOpen(false)
    async function load() {
      try {
        const blob = await docTepDinhKem(token, ma, tep, abort.signal)
        const type = await kieuAnh(blob)
        if (abort.signal.aborted) return
        if (!type) { setSrc(null); return }
        url = URL.createObjectURL(new Blob([blob], { type }))
        setSrc(url)
      } catch {
        if (!abort.signal.aborted) setSrc(null)
      }
    }
    if (container.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (abort.signal.aborted || !entries.some(entry => entry.isIntersecting)) return
        observer?.disconnect()
        void load()
      }, { rootMargin: '120px' })
      observer.observe(container.current)
    } else void load()
    return () => {
      observer?.disconnect(); abort.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [token, ma, tep])
  return <div ref={container} className={'ht-attachment-image' + (thuNho ? ' ht-attachment-image-small' : '')}>
    {src ? <>
      <button type="button" className="ht-attachment-preview" aria-label={'Xem ảnh ' + ten} disabled={disabled} onClick={() => setOpen(true)}>
        <img src={src} alt="" onError={() => { setOpen(false); setSrc(null) }} />
      </button>
      {open && <XemAnhLon src={src} ten={ten} onClose={() => setOpen(false)} />}
    </> : <small className="ht-attachment-preview-note">{src === null ? 'Không xem trước được ảnh. Bạn vẫn có thể tải xuống.' : 'Đang tải ảnh…'}</small>}
  </div>
}
