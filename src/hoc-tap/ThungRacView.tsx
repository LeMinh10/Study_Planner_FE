import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { goi } from './api'
import { useHocTap } from './HocTapPage'
import { hienGio } from './time'
import type { KetQua, Trang } from './types'
import { xacNhan } from './xacNhan'

interface NhiemVuDaXoa {
  ma: number
  tieuDe: string
  moTa: string | null
  ngayXoa: string
  hanHoanThanh: string | null
  soNhiemVu: number
}

export function ThungRacView() {
  const c = useHocTap()
  const [page, setPage] = useState(1)
  const [selection, setSelection] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<{ revision: number; result: KetQua<Trang<NhiemVuDaXoa>> } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    goi<Trang<NhiemVuDaXoa>>(c.token, '/tasks/trash?trang=' + page, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      if (!result.duLieu.danhSach.length && page > 1) { setPage(page - 1); return }
      setSnapshot({ revision: c.revision, result })
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa tải được thùng rác.') })
    return () => controller.abort()
  }, [c.token, c.revision, page])
  const data = snapshot?.result.duLieu
  const rows = data?.danhSach ?? []
  const selected = rows.find(task => task.ma === selection)
  const fresh = snapshot?.revision === c.revision && data?.trang === page && !error

  async function act(task: NhiemVuDaXoa, permanent: boolean) {
    if (!fresh || !snapshot || saving.current) return
    saving.current = true
    setBusy(true)
    const version = snapshot.result.phienBan
    try {
      await c.run(async () => {
        const path = '/tasks/trash/' + task.ma
        if (permanent) {
          const confirmed = await xacNhan({
            tieuDe: 'Xóa vĩnh viễn nhiệm vụ?',
            noiDung: <>Xóa vĩnh viễn <strong>“{task.tieuDe}”</strong>{task.soNhiemVu > 1 ? ' và các bước trong nhánh này' : ''}?</>,
            chiTiet: [{ nhan: 'Nhiệm vụ và bước nhỏ', giaTri: task.soNhiemVu }],
            luuY: 'Nhiệm vụ và dữ liệu liên kết sẽ không thể khôi phục.',
            nhanXacNhan: 'Xóa vĩnh viễn', nhanDangXuLy: 'Đang xóa…', nguyHiem: true,
            khiXacNhan: () => goi(c.token, path, { method: 'DELETE', version }),
          })
          if (!confirmed) return null
        } else {
          await goi(c.token, path + '/restore', { method: 'POST', version })
        }
        setSelection(null)
        c.thongBaoThanhCong(permanent ? 'Đã xóa vĩnh viễn nhiệm vụ' : 'Đã khôi phục nhiệm vụ')
        return true
      })
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <>
    {error && <p className="ht-error" role="alert">{error} <button type="button" onClick={c.reload}>Thử tải lại</button></p>}
    {!snapshot && !error && <p role="status">Đang tải thùng rác…</p>}
    {snapshot && <div className="ht-trash-layout">
      <section aria-label="Nhiệm vụ trong thùng rác">
        {!rows.length && <div className="ht-empty"><Icon name="trash" size={23} /><h2>Thùng rác trống</h2></div>}
        {rows.map(task => <button type="button" className="ht-trash-row" aria-pressed={selected?.ma === task.ma}
          key={task.ma} onClick={() => setSelection(task.ma)}>
          <Icon name={task.soNhiemVu > 1 ? 'task-group' : 'trash'} size={16} />
          <span><strong>{task.tieuDe}</strong><small>{hienGio(task.ngayXoa, c.zone)}</small></span>
        </button>)}
        {data && data.tongSo > data.kichThuocTrang && <div className="ht-paging">
          <button type="button" disabled={busy || !fresh || page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span>Trang {page}</span>
          <button type="button" disabled={busy || !fresh || page * data.kichThuocTrang >= data.tongSo} onClick={() => setPage(page + 1)}>Trang sau</button>
        </div>}
      </section>
      {selected && <aside className="ht-trash-detail" aria-label="Chi tiết nhiệm vụ trong thùng rác">
        <h2>{selected.tieuDe}</h2>
        <p>Đã chuyển vào thùng rác {hienGio(selected.ngayXoa, c.zone)}</p>
        {selected.hanHoanThanh && <p>Hạn riêng {hienGio(selected.hanHoanThanh, c.zone)}</p>}
        {selected.soNhiemVu > 1 && <p>{selected.soNhiemVu - 1} bước nhỏ đi cùng</p>}
        {selected.moTa && <p className="ht-preserve">{selected.moTa}</p>}
        <div className="ht-trash-actions">
          <button type="button" disabled={!fresh || busy} onClick={() => void act(selected, false)}><Icon name="reset" size={15} />Khôi phục</button>
          <button type="button" className="ht-danger" disabled={!fresh || busy} onClick={() => void act(selected, true)}><Icon name="trash" size={15} />Xóa vĩnh viễn</button>
        </div>
      </aside>}
    </div>}
  </>
}
