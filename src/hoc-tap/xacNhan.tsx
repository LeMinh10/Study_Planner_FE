import { createRoot } from 'react-dom/client'
import { HopXacNhan } from './HopXacNhan'
import type { NoiDungXacNhan } from './HopXacNhan'

// Hộp riêng giữ được biểu mẫu đang mở khi cần xác nhận ảnh hưởng tới lịch.
export function xacNhan(noiDung: NoiDungXacNhan): Promise<boolean> {
  return new Promise(resolve => {
    const host = document.createElement('div')
    host.className = 'ht-confirm-host'
    document.body.appendChild(host)
    const root = createRoot(host)
    let closed = false
    function ketThuc(dongY: boolean) {
      if (closed) return
      closed = true
      queueMicrotask(() => { root.unmount(); host.remove(); resolve(dongY) })
    }
    root.render(<HopXacNhan noiDung={noiDung} ketThuc={ketThuc} />)
  })
}
