import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { goi, LoiHocTap, thayDoi } from './api'
import { xacNhan } from './xacNhan'
import { BieuMau, ChonPhamVi, useHocTap } from './HocTapPage'
import { congNgay, gioNhap, hienGio, loaiViec, ngay, thoiDiemGui, trangThai, utc, uuTien } from './time'
import type { AnhHuong, MucChecklist, NhiemVu, Trang } from './types'
import { HoatDongNhiemVu } from './HoatDongNhiemVu'

export function ThemNhanh() {
  const c = useHocTap()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="ht-quick-add" aria-label="Thêm nhanh nhiệm vụ" onSubmit={async event => {
    event.preventDefault()
    if (busy || c.version === null || !c.zoneReady) return
    const form = event.currentTarget
    const title = String(new FormData(form).get('tieuDe') ?? '').trim()
    if (!title) { setError('Hãy nhập tên việc cần làm.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await thayDoi<NhiemVu>(c.token, '/tasks', 'POST', {
        tieuDe: title, maHocKy: c.hocKy ? Number(c.hocKy) : null,
        maMonHoc: c.monHoc ? Number(c.monHoc) : null,
        loai: c.monHoc ? 'Assignment' : 'Personal', mucDoUuTien: 'Medium',
      }, c.version)
      if (result) { form.reset(); c.hienNhiemVuMoi(result.duLieu, true); c.reload() }
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa thêm được nhiệm vụ.') }
    finally { setBusy(false) }
  }}>
    <Icon name="plus" size={17} />
    <label className="ht-quick-title"><span className="sr-only">Tên nhiệm vụ thêm nhanh</span><input name="tieuDe" placeholder="Ghi nhanh một việc cần làm…" maxLength={200} required disabled={busy || c.version === null || !c.zoneReady} /></label>
    <button disabled={busy || c.version === null || !c.zoneReady}>{busy ? 'Đang thêm…' : 'Thêm nhanh'}</button>
    {error && <p className="ht-error" role="alert">{error}</p>}
  </form>
}

async function doiHoanThanhNhiemVu(c: ReturnType<typeof useHocTap>, task: NhiemVu, version: number) {
  const action = task.tienDo === 100 ? 'reopen' : 'complete'
  function save(status: 'complete' | 'reopen', tienDo: number, baseline: number, confirm?: typeof xacNhan) {
    const body = { tienDo }
    return thayDoi(c.token, `/tasks/${task.ma}/${status}`, 'POST', body, baseline, {
      path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: status, noiDung: body },
    }, confirm)
  }
  let affectedSessions = false
  const result = await save(action, 0, version, options => {
    affectedSessions = true
    return xacNhan(options)
  })
  if (!result) return null
  if (action === 'reopen') {
    c.thongBaoThanhCong(`Đã mở lại “${task.tieuDe}”`)
  } else {
    c.thongBaoThanhCong(`Đã hoàn thành “${task.tieuDe}”`, affectedSessions ? undefined : async () => {
      const reopened = await save('reopen', task.tienDo, result.phienBan)
      if (reopened) c.thongBaoThanhCong(`Đã mở lại “${task.tieuDe}”`)
      return reopened
    })
  }
  return result
}

export type InlineChildDraft = { parent: number; after?: number }
type CayNhiemVu = { revision: number; tasks: NhiemVu[] }

export function NhiemVuView({ board = false, completed = false, openPath, inlineDraft, onInlineSaved, onAddChildInDetail, onShowCompleted }: {
  board?: boolean
  completed?: boolean
  openPath?: number[]
  inlineDraft?: InlineChildDraft
  onInlineSaved: (path: number[], draft?: InlineChildDraft) => void
  onAddChildInDetail: (path: number[]) => void
  onShowCompleted: () => void
}) {
  const c = useHocTap()
  const [params] = useSearchParams()
  const today = ngay(Date.now(), c.zone)
  const [children, setChildren] = useState(new Map<number, CayNhiemVu>())
  const [expanded, setExpanded] = useState(new Set<number>())
  const [error, setError] = useState('')
  const saving = useRef(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [quickProgress, setQuickProgress] = useState<{ task: NhiemVu; anchor: HTMLElement; path: number[]; version: number } | null>(null)
  function openProgress(task: NhiemVu, anchor: HTMLElement, path: number[]) {
    if (saving.current || c.version === null) return
    c.setTienDoXemTruoc(null)
    setQuickProgress({ task, anchor, path, version: c.version })
    if (params.get('task') !== String(task.ma)) c.chonNhiemVu(task.ma)
  }
  async function saveProgress(tienDo: number) {
    if (!quickProgress || saving.current || tienDo === quickProgress.task.tienDo) return
    const { task, path, version } = quickProgress
    saving.current = true
    setSavingProgress(true)
    try {
      await c.run(async () => {
        const saved = await capNhatTienDo(c.token, task.ma, tienDo, version)
        if (saved) onInlineSaved(path, undefined)
        return saved
      })
    } finally {
      c.setTienDoXemTruoc(null)
      setQuickProgress(null)
      saving.current = false
      setSavingProgress(false)
    }
  }
  const [editing, setEditing] = useState<number>()
  const [draft, setDraft] = useState<InlineChildDraft>()
  const inlineDraftInput = useRef<HTMLInputElement>(null)
  const [savingInline, setSavingInline] = useState(false)
  async function persistInline<T>(operation: () => Promise<T | null>, path: number[], afterSave: (saved: T) => InlineChildDraft | undefined) {
    if (saving.current) return
    saving.current = true
    setSavingInline(true)
    try {
      await c.run(async () => {
        const result = await operation()
        if (result) {
          setEditing(undefined)
          setDraft(undefined)
          onInlineSaved(path, afterSave(result))
        }
        return result
      })
    } finally {
      saving.current = false
      setSavingInline(false)
    }
  }
  const [shareLink, setShareLink] = useState('')
  useEffect(() => {
    if (c.version === null || !openPath) return
    setExpanded(current => openPath.every(id => current.has(id)) ? current : new Set([...current, ...openPath]))
    if (inlineDraft) { setEditing(undefined); setDraft(inlineDraft) }
  }, [c.version, openPath, inlineDraft])

  useEffect(() => {
    if (c.version === null) return
    const roots = c.tasks.filter(task => task.coNhiemVuCon && expanded.has(task.ma) && children.get(task.ma)?.revision !== c.revision)
    if (!roots.length) return
    const controller = new AbortController()
    setError('')
    Promise.allSettled(roots.map(async task => {
      const result = await goi<NhiemVu[]>(c.token, `/tasks/${task.ma}/tree`, { signal: controller.signal })
      return [task.ma, { revision: c.revision, tasks: result.duLieu }] as const
    })).then(results => {
      if (controller.signal.aborted) return
      const trees = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      if (trees.length) setChildren(current => new Map([...current, ...trees]))
      const failure = results.find(result => result.status === 'rejected')
      if (failure) setError(failure.reason instanceof Error ? failure.reason.message : 'Chưa tải được các bước nhỏ.')
    })
    return () => controller.abort()
  }, [c.token, c.version, c.revision, c.tasks, expanded, children])
  async function toggleCompletion(task: NhiemVu) {
    const version = c.version
    if (saving.current || version === null) return
    saving.current = true
    setSavingProgress(true)
    try {
      await c.run(() => doiHoanThanhNhiemVu(c, task, version))
    } finally {
      saving.current = false
      setSavingProgress(false)
    }
  }
  function expand(task: NhiemVu) {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(task.ma)) next.delete(task.ma)
      else next.add(task.ma)
      return next
    })
  }
  function row(task: NhiemVu, ancestors: number[] = [], source?: CayNhiemVu): ReactNode {
    const level = ancestors.length
    const path = [...ancestors, task.ma]
    const tree = source ?? children.get(task.ma)
    const flatCompleted = completed || params.get('status') === 'Completed'
    const steps = tree?.tasks.filter(n => n.maNhiemVuCha === task.ma && n.trangThai !== 'Completed') ?? []
    const rowDate = completed ? task.ngayHoanThanh : task.hanHieuLuc
    const rowReady = c.version !== null && (!source || source.revision === c.revision)
    const parent = ancestors.at(-1)
    const rowProgress = c.tienDoXemTruoc?.ma === task.ma ? c.tienDoXemTruoc.tienDo : task.tienDo
    const coChecklist = !!task.checklist?.length
    const progressLabel = 'Tiến độ ' + task.tieuDe + ' · ' + rowProgress + '%'
    function editProgress(anchor: HTMLElement) {
      if (!rowReady || saving.current) return
      if (coChecklist) c.chonNhiemVu(task.ma)
      else openProgress(task, anchor, ancestors)
    }
    function nextDraft() {
      if (parent !== undefined) return { parent, after: task.ma }
      if (task.maNhiemVuCha !== null) onAddChildInDetail([task.maNhiemVuCha])
    }
    function editTitle() {
      if (saving.current || !rowReady) return
      setDraft(undefined)
      setEditing(task.ma)
      c.chonNhiemVu(task.ma)
    }
    function addChildInList() {
      if (saving.current || !rowReady) return
      if (level >= 10) { setError('Nhiệm vụ đã ở cấp sâu nhất.'); return }
      setEditing(undefined)
      setExpanded(current => new Set([...current, ...path]))
      if (draft?.parent === task.ma) inlineDraftInput.current?.focus()
      setDraft({ parent: task.ma })
    }
    const draftRow = draft?.parent === task.ma && rowReady && (!task.coNhiemVuCon || tree?.revision === c.revision) && <form className="ht-inline-child ht-list-child-draft"
      style={{ paddingInlineStart: `min(${12 + (level + 1) * 20}px, 25%)` }} aria-label="Thêm bước nhỏ trong danh sách" onSubmit={event => {
        event.preventDefault()
        const version = c.version
        const tieuDe = String(new FormData(event.currentTarget).get('tenBuocNho') ?? '').trim()
        if (!tieuDe || version === null || saving.current || !c.zoneReady) return
        void persistInline(
          () => themBuocNho(c.token, task.ma, [{ tieuDe, hanHoanThanh: utc(hanBuocMacDinh(task, c.zone), c.zone) }], version),
          path, saved => ({ parent: task.ma, after: draft.after === undefined ? undefined : saved.duLieu.at(-1)?.ma ?? draft.after }),
        )
      }}>
      <input ref={inlineDraftInput} name="tenBuocNho" aria-label="Tên bước nhỏ trong danh sách" placeholder="Nhập tên bước nhỏ rồi nhấn Enter" required autoFocus maxLength={200}
        readOnly={savingInline} onKeyDown={event => { if (event.key === 'Escape' && !savingInline) setDraft(undefined) }} />
      <button type="submit" disabled={savingInline || !c.zoneReady}>Thêm</button>
    </form>
    const done = task.trangThai === 'Completed'
    const selected = params.get('task') === String(task.ma)
    const scopeName = c.subjects.find(s => Number(s.id) === task.maMonHoc)?.name
      ?? c.semesters.find(s => Number(s.id) === task.maHocKy)?.name ?? 'Việc cá nhân'
    const control = task.coNhiemVuCon ? <button type="button" className={'ht-parent-toggle ht-parent-' + task.mucDoUuTien}
      aria-label={flatCompleted ? 'Xem chi tiết nhiệm vụ' : expanded.has(task.ma) ? 'Thu gọn các bước nhỏ' : 'Xem các bước nhỏ'}
      aria-expanded={flatCompleted ? undefined : expanded.has(task.ma)} onClick={() => flatCompleted ? c.chonNhiemVu(task.ma) : expand(task)}
      onContextMenu={event => { event.preventDefault(); editProgress(event.currentTarget) }}>
      {!flatCompleted && <Icon name="chevron-right" size={11} className="ht-parent-chevron" />}
      <Icon name="task-group" size={17} />
    </button> : <input aria-label={(coChecklist ? 'Mở checklist ' : task.tienDo === 100 ? 'Mở lại ' : 'Hoàn thành ') + task.tieuDe} type="checkbox" checked={task.tienDo === 100} disabled={savingProgress || savingInline || !rowReady}
      onChange={() => coChecklist ? c.chonNhiemVu(task.ma) : void toggleCompletion(task)}
      onContextMenu={event => { event.preventDefault(); editProgress(event.currentTarget) }} />
    const title = editing === task.ma ? <form className="ht-row-title-editor" onSubmit={event => {
      event.preventDefault()
      const version = c.version
      const tieuDe = String(new FormData(event.currentTarget).get('tieuDe') ?? '').trim()
      if (!tieuDe || version === null || !rowReady || saving.current) return
      if (tieuDe === task.tieuDe) { setEditing(undefined); setDraft(nextDraft()); return }
      const body = { ...duLieuCapNhat(task), tieuDe }
      void persistInline(() => capNhatNhiemVu(c.token, task.ma, body, version), expanded.has(task.ma) ? path : ancestors, nextDraft)
    }}>
      <input name="tieuDe" aria-label="Đổi tên nhiệm vụ" defaultValue={task.tieuDe} required maxLength={200} autoFocus readOnly={savingInline}
        onKeyDown={event => { if (event.key === 'Escape' && !savingInline) setEditing(undefined) }} />
    </form> : <button type="button" className="ht-task-name" title="Bấm để đổi tên" onClick={editTitle}
      onKeyDown={event => {
        if (event.key !== 'F2') return
        event.preventDefault()
        editTitle()
      }}><strong>{task.tieuDe}</strong>{!board && <small>{scopeName}</small>}</button>
    const progress = <button type="button" className="ht-progress-ring ht-progress-trigger" aria-label={progressLabel}
      title={coChecklist ? progressLabel + ' · Xem checklist' : progressLabel} disabled={savingProgress || savingInline || !rowReady}
      onClick={event => editProgress(event.currentTarget)}><VongTienDo value={rowProgress} />{board && <span aria-hidden="true">{rowProgress}%</span>}</button>
    const priority = <span className={'ht-priority ht-priority-' + task.mucDoUuTien} title={'Ưu tiên ' + uuTien[task.mucDoUuTien]}>{uuTien[task.mucDoUuTien]}</span>
    const due = <span className={'ht-task-due' + (task.hanHieuLuc && Date.parse(task.hanHieuLuc) < Date.now() && task.tienDo < 100 ? ' ht-overdue' : '')}>
      {board && rowDate && <Icon name="calendar" size={13} />}
      {rowDate ? <HanNhiemVu value={rowDate} zone={c.zone} today={today} /> : completed ? '—' : 'Chưa đặt hạn'}
    </span>
    const actions = <ThaoTacNhiemVu task={task} baseline={savingInline || !rowReady ? null : c.version} onAddChild={addChildInList} onShareLink={setShareLink} />
    return <div key={task.ma} className="ht-task-branch">
      {board ? <article className={'ht-board-card' + (done ? ' ht-task-completed' : '')} data-selected={selected || undefined}
        style={level ? { marginInlineStart: `min(${level * 12}px, 12%)` } : undefined}>
        <div className="ht-board-card-top">{control}{title}{actions}</div>
        <p className="ht-board-card-scope"><Icon name={task.maMonHoc ? 'book' : 'layers'} size={13} /><span>{scopeName}</span></p>
        <div className="ht-board-card-footer">{due}{priority}{progress}</div>
      </article> : <div className={'ht-task-row' + (done ? ' ht-task-completed' : '') + (selected ? ' ht-task-selected' : '')}
        style={{ paddingInlineStart: `min(${12 + level * 20}px, 25%)` }}>
        {control}{title}{progress}{priority}{due}{actions}
      </div>}
      {(!flatCompleted || draft?.parent === task.ma) && expanded.has(task.ma) && level < 10 && <>
        {!flatCompleted && steps.map(step => <Fragment key={step.ma}>
          {row(step, path, tree)}
          {draft?.after === step.ma && draftRow}
        </Fragment>)}
        {draftRow && (flatCompleted || !steps.some(step => step.ma === draft?.after)) && draftRow}
      </>}
    </div>
  }
  const completionGroups = new Map<string, NhiemVu[]>()
  if (completed) {
    for (const task of c.tasks) {
      const day = task.ngayHoanThanh ? ngay(task.ngayHoanThanh, c.zone) : ''
      const group = completionGroups.get(day)
      if (group) group.push(task)
      else completionGroups.set(day, [task])
    }
  }
  function completionHeading(day: string, task: NhiemVu) {
    if (day === today) return 'Hôm nay'
    if (day === congNgay(today, -1)) return 'Hôm qua'
    return task.ngayHoanThanh
      ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeZone: c.zone }).format(new Date(task.ngayHoanThanh))
      : 'Chưa rõ ngày hoàn thành'
  }
  return <>
    {error && <p className="ht-error" role="alert">{error}</p>}
    {shareLink && <label className="ht-note">Sao chép liên kết nhiệm vụ <input className="ht-share-link" value={shareLink} readOnly onFocus={event => event.target.select()} /><button type="button" onClick={() => setShareLink('')}>Đóng</button></label>}
    <div className="ht-list-caption"><span>{c.total} nhiệm vụ</span></div>
    {board ? <section className="ht-board" aria-label="Nhiệm vụ theo trạng thái" tabIndex={0}>
      {['NotStarted', 'InProgress', 'Completed'].map(status => {
        const group = c.tasks.filter(task => task.trangThai === status)
        return <section className="ht-board-column" data-status={status} key={status}>
          <header className="ht-board-heading">
            <span className="ht-board-dot" aria-hidden="true" />
            <h2>{trangThai[status]}</h2>
            <span className="ht-board-count" title="Số nhiệm vụ trên trang này">{group.length}<span className="sr-only"> nhiệm vụ trên trang này</span></span>
          </header>
          <div className="ht-board-stack">
            {group.length ? group.map(task => row(task)) : <div className="ht-board-empty">
              {status === 'Completed' && params.get('status') !== 'Completed'
                ? <button type="button" onClick={onShowCompleted}>Xem danh sách đã hoàn thành <Icon name="chevron-right" size={14} /></button>
                : <p>Chưa có nhiệm vụ</p>}
            </div>}
          </div>
        </section>
      })}
    </section> : c.tasks.length ? <div className="ht-task-list">{completed
      ? Array.from(completionGroups, ([day, group]) => <section className="ht-completed-group" key={day}>
        <h2>{completionHeading(day, group[0])} <small title="Số nhiệm vụ của nhóm trên trang này">{group.length}</small></h2>
        {group.map(task => row(task))}
      </section>)
      : c.tasks.map(task => row(task))}</div> : <div className="ht-empty"><h2>Chưa có nhiệm vụ phù hợp</h2><p>Thử đổi bộ lọc hoặc thêm một nhiệm vụ mới.</p></div>}
    {quickProgress && <TienDoNhanh key={quickProgress.task.ma} task={quickProgress.task} anchor={quickProgress.anchor} busy={savingProgress}
      onSave={value => void saveProgress(value)} onClose={() => { if (!saving.current) setQuickProgress(null) }} />}
    {c.pageCount > 1 && <nav className="ht-paging ht-task-paging" aria-label="Phân trang nhiệm vụ">
      <button type="button" aria-label="Trang trước" title="Trang trước" disabled={c.version === null || c.page <= 1} onClick={() => c.setPage(c.page - 1)}>
        <Icon name="chevron-left" size={16} />
      </button>
      <span>Trang <strong>{c.page}</strong> / {c.pageCount}</span>
      <button type="button" aria-label="Trang sau" title="Trang sau" disabled={c.version === null || c.page >= c.pageCount} onClick={() => c.setPage(c.page + 1)}>
        <Icon name="chevron-right" size={16} />
      </button>
    </nav>}
  </>
}

function VongTienDo({ value }: { value: number }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle className="ht-progress-ring-track" cx="8" cy="8" r="5.8" />
    {value > 0 && <circle className="ht-progress-ring-value" cx="8" cy="8" r="5.8" pathLength="100"
      strokeDasharray={value + ' 100'} transform="rotate(-90 8 8)" />}
  </svg>
}

function TienDoNhanh({ task, anchor, busy, onSave, onClose }: {
  task: NhiemVu
  anchor: HTMLElement
  busy: boolean
  onSave: (value: number) => void
  onClose: () => void
}) {
  const { tienDoXemTruoc, setTienDoXemTruoc } = useHocTap()
  const panel = useRef<HTMLDivElement>(null)
  const range = useRef<HTMLInputElement>(null)
  const value = tienDoXemTruoc?.ma === task.ma ? tienDoXemTruoc.tienDo : task.tienDo
  useLayoutEffect(() => {
    const popup = panel.current
    if (!popup || !anchor.isConnected) return
    popup.showPopover()
    const rect = anchor.getBoundingClientRect()
    const { width, height } = popup.getBoundingClientRect()
    const { clientWidth, clientHeight } = document.documentElement
    const below = rect.bottom + 6
    const top = below + height <= clientHeight - 8 ? below : rect.top - height - 6
    popup.style.left = Math.max(8, Math.min(rect.left, clientWidth - width - 8)) + 'px'
    popup.style.top = Math.max(8, Math.min(top, clientHeight - height - 8)) + 'px'
    range.current?.focus({ preventScroll: true })
    return () => popup.hidePopover()
  }, [anchor])
  useEffect(() => () => setTienDoXemTruoc(null), [setTienDoXemTruoc])
  return <div ref={panel} className="ht-quick-progress" popover="auto" onToggle={event => {
    if (!event.currentTarget.matches(':popover-open')) onClose()
  }}>
    <label><span>Tiến độ <strong>{value}%</strong></span>
      <input ref={range} type="range" min={0} max={100} value={value} disabled={busy}
        aria-valuetext={value + '%'}
        onChange={event => setTienDoXemTruoc({ ma: task.ma, tienDo: Number(event.currentTarget.value) })}
        onPointerUp={event => onSave(Number(event.currentTarget.value))}
        onPointerCancel={() => setTienDoXemTruoc(null)}
        onKeyUp={event => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
            onSave(Number(event.currentTarget.value))
          }
        }} />
    </label>
    {busy && <small role="status">Đang lưu…</small>}
  </div>
}

function HanNhiemVu({ value, zone, today }: { value: string; zone: string; today: string }) {
  const anchor = useRef<HTMLTimeElement>(null)
  const tooltip = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [day, hour] = gioNhap(value, zone).split('T')
  const [year, month, date] = day.split('-')
  const shortDate = date + '/' + month
  const full = hour + ' · ' + shortDate + '/' + year
  let label = year === today.slice(0, 4) ? shortDate : shortDate + '/' + year
  if (day === today) label = hour === '23:59' ? 'Hôm nay' : hour
  else if (day === congNgay(today, -1)) label = 'Hôm qua'
  else if (day === congNgay(today, 1)) label = 'Ngày mai'
  useLayoutEffect(() => {
    const target = anchor.current
    const tip = tooltip.current
    if (!open || !target || !tip) return
    tip.showPopover()
    const rect = target.getBoundingClientRect()
    const { width, height } = tip.getBoundingClientRect()
    const { clientWidth, clientHeight } = document.documentElement
    const above = rect.top - height - 6
    const top = above >= 8 ? above : rect.bottom + 6
    tip.style.left = Math.max(8, Math.min(rect.left + (rect.width - width) / 2, clientWidth - width - 8)) + 'px'
    tip.style.top = Math.max(8, Math.min(top, clientHeight - height - 8)) + 'px'
    const hide = () => setOpen(false)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      tip.hidePopover()
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [open, full])
  return <>
    <time ref={anchor} className="ht-due-label" dateTime={value} tabIndex={0}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        setOpen(false)
      }}>
      <span aria-hidden="true">{label}</span><span className="sr-only">{full}</span>
    </time>
    <span ref={tooltip} className="ht-due-tooltip" popover="manual" aria-hidden="true">{full}</span>
  </>
}

function ThaoTacNhiemVu({ task, baseline, branch, onAddChild, onShareLink, onDeleted, onOpenSessions, onOpenHistory, run }: {
  task: NhiemVu
  baseline: number | null
  branch?: NhiemVu[]
  onAddChild: () => void
  onShareLink: (url: string) => void
  onDeleted?: () => void
  onOpenSessions?: () => void
  onOpenHistory?: () => void
  run?: (operation: () => Promise<unknown>) => Promise<unknown>
}) {
  const c = useHocTap()
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const [pending, setPending] = useState(false)
  async function runAction(operation: () => Promise<unknown>) {
    setPending(true)
    try { await (run ?? c.run)(operation) }
    finally { setPending(false) }
  }
  function act(action: (version: number) => void) {
    menu.current?.hidePopover()
    if (baseline !== null) action(baseline)
  }
  return <div className="ht-row-actions">
    <button type="button" className="ht-row-actions-trigger" popoverTarget={menuId} disabled={baseline === null || pending}
      aria-label={`Thao tác với ${task.tieuDe}`} onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        requestAnimationFrame(() => {
          const panel = menu.current
          if (!panel?.matches(':popover-open')) return
          const { width, height } = panel.getBoundingClientRect()
          const { clientWidth, clientHeight } = document.documentElement
          const below = rect.bottom + 5
          const above = rect.top - height - 5
          const top = below + height <= clientHeight - 8 || above < 8 ? below : above
          panel.style.left = Math.max(8, Math.min(rect.right - width, clientWidth - width - 8)) + 'px'
          panel.style.top = Math.max(8, Math.min(top, clientHeight - height - 8)) + 'px'
        })
      }}><Icon name="dots" size={18} /></button>
    <div id={menuId} ref={menu} className="ht-row-actions-panel" popover="auto" aria-label={`Thao tác với ${task.tieuDe}`}>
      <div className="ht-row-actions-heading">Thao tác nhiệm vụ</div>
      <button type="button" onClick={() => act(onAddChild)}><Icon name="plus" size={16} />Thêm bước nhỏ</button>
      <button type="button" onClick={() => act(version => c.modal(<SuaNhiemVu task={task} baseline={version} />))}><Icon name="edit" size={16} />Chỉnh sửa</button>
      {!task.checklist?.length && <button type="button" onClick={() => act(version => c.modal(<DoiTienDo task={task} baseline={version} />))}><Icon name="chart" size={16} />Cập nhật tiến độ</button>}
      <hr />
      <button type="button" onClick={() => act(version => {
        if (branch) { c.modal(<DoiCha task={task} branch={branch} baseline={version} />); return }
        void runAction(async () => {
          const read = await goi<NhiemVu[]>(c.token, `/tasks/${task.ma}/tree`)
          if (read.phienBan !== version) throw new LoiHocTap('Dữ liệu đã đổi. Hãy tải dữ liệu mới trước khi chuyển nhiệm vụ.', 409, 'DATA_VERSION_CONFLICT')
          c.modal(<DoiCha task={task} branch={read.duLieu} baseline={version} />)
          return null
        })
      })}><Icon name="layers" size={16} />{task.maNhiemVuCha ? 'Chuyển hoặc tách nhiệm vụ' : 'Chuyển vào nhiệm vụ lớn'}</button>
      {!task.maNhiemVuCha && <button type="button" onClick={() => act(version => c.modal(<DoiPhamVi task={task} baseline={version} />))}><Icon name="book" size={16} />Đổi học kỳ hoặc môn</button>}
      <button type="button" onClick={() => act(() => { c.xemPhienNhiemVu(task); onOpenSessions?.() })}><Icon name="clock" size={16} />Xem phiên tự học</button>
      <button type="button" onClick={() => act(async () => {
        const link = lienKetNhiemVu(task.ma)
        try { await navigator.clipboard.writeText(link); c.thongBaoThanhCong('Đã sao chép liên kết nhiệm vụ') }
        catch { onShareLink(link) }
      })}><Icon name="link" size={16} />Sao chép liên kết</button>
      {onOpenHistory && <button type="button" onClick={() => { menu.current?.hidePopover(); onOpenHistory() }}>
        <Icon name="list" size={16} />Hoạt động nhiệm vụ
      </button>}
      <hr />
      <button type="button" className="ht-danger" onClick={() => act(version => void runAction(async () => {
        const removed = await chuyenVaoThungRac(c.token, task, version)
        if (removed) {
          if (onDeleted) onDeleted()
          else c.chonNhiemVu(null)
          c.thongBaoThanhCong(removed)
        }
        return removed
      }))}><Icon name="trash" size={16} />Chuyển vào thùng rác</button>
    </div>
  </div>
}

function lienKetNhiemVu(ma: number) {
  const link = new URL('/tasks', window.location.origin)
  link.searchParams.set('task', String(ma))
  return link.href
}

export function SuaNhiemVu({ task, parent, baseline, onChildrenSaved }: {
  task?: NhiemVu
  parent?: NhiemVu
  baseline: number
  onChildrenSaved?: () => void
}) {
  const c = useHocTap()
  const scope = task ?? parent
  return <BieuMau title={task ? 'Chỉnh sửa nhiệm vụ' : parent ? 'Thêm bước nhỏ' : 'Thêm nhiệm vụ'} onSubmit={async form => {
    const body = {
      tieuDe: String(form.get('tieuDe')).trim(), moTa: String(form.get('moTa') ?? '').trim() || null,
      maHocKy: scope?.maHocKy ?? (form.get('maHocKy') ? Number(form.get('maHocKy')) : null),
      maMonHoc: scope?.maMonHoc ?? (form.get('maMonHoc') ? Number(form.get('maMonHoc')) : null),
      loai: String(form.get('loai')), mucDoUuTien: String(form.get('mucDoUuTien')),
      hanHoanThanh: thoiDiemGui(String(form.get('hanHoanThanh') ?? ''), task?.hanHoanThanh ?? null, c.zone),
      batDauSuKien: thoiDiemGui(String(form.get('batDauSuKien') ?? ''), task?.batDauSuKien ?? null, c.zone), ketThucSuKien: thoiDiemGui(String(form.get('ketThucSuKien') ?? ''), task?.ketThucSuKien ?? null, c.zone),
      thoiLuongDuKienPhut: task?.coNhiemVuCon ? null : form.get('thoiLuongDuKienPhut') ? Number(form.get('thoiLuongDuKienPhut')) : null,
      nhacTruocGio: task?.nhacTruocGio ?? null,
    }
    if (task) return capNhatNhiemVu(c.token, task.ma, body, baseline)
    if (parent) {
      const titles = String(form.get('nhieuTieuDe') ?? '').split(/\r?\n/).map(title => title.trim()).filter(Boolean)
      const danhSach = [body, ...titles.map(tieuDe => ({ ...body, tieuDe }))]
      const result = await themBuocNho(c.token, parent.ma, danhSach, baseline)
      if (result) onChildrenSaved?.()
      return result
    }
    const result = await thayDoi<NhiemVu>(c.token, '/tasks', 'POST', body, baseline)
    if (result) c.hienNhiemVuMoi(result.duLieu, true)
    return result
  }}>
    {parent && <p className="ht-note">Bước mới thuộc “{parent.tieuDe}”.</p>}
    <label>Tên nhiệm vụ<input name="tieuDe" defaultValue={task?.tieuDe} required maxLength={200} autoFocus /></label>
    <label>Nội dung<textarea name="moTa" rows={4} defaultValue={task?.moTa ?? ''} maxLength={20000} /></label>
    <ChonPhamVi semester={scope ? scope.maHocKy?.toString() ?? '' : c.hocKy} subject={scope ? scope.maMonHoc?.toString() ?? '' : c.monHoc} locked={!!scope} />
    <div className="ht-fields"><label>Loại công việc<select name="loai" defaultValue={task?.loai ?? ((scope ? scope.maMonHoc : c.monHoc) ? 'Assignment' : 'Personal')}>{Object.entries(loaiViec).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>Mức ưu tiên<select name="mucDoUuTien" defaultValue={task?.mucDoUuTien ?? 'Medium'}>{Object.entries(uuTien).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
    <label>Hạn hoàn thành<input name="hanHoanThanh" type="datetime-local" defaultValue={parent ? hanBuocMacDinh(parent, c.zone) : gioNhap(task?.hanHoanThanh ?? null, c.zone)} /></label>
    {(parent || task?.maNhiemVuCha) && <p className="ht-note">Để trống hạn riêng để dùng hạn của nhiệm vụ lớn.</p>}
    <label>Thời gian ước lượng (phút)<input name="thoiLuongDuKienPhut" type="number" min={1} max={100000} disabled={task?.coNhiemVuCon} defaultValue={task?.coNhiemVuCon ? '' : task?.thoiLuongDuKienPhut ?? ''} /></label>
    {task?.coNhiemVuCon && <p>Thời lượng được tổng hợp từ các bước nhỏ.</p>}
    <details><summary>Giờ diễn ra sự kiện, ví dụ ca thi</summary><div className="ht-fields"><label>Bắt đầu<input name="batDauSuKien" type="datetime-local" defaultValue={gioNhap(task?.batDauSuKien ?? null, c.zone)} /></label><label>Kết thúc<input name="ketThucSuKien" type="datetime-local" defaultValue={gioNhap(task?.ketThucSuKien ?? null, c.zone)} /></label></div></details>
    {parent && <label>Thêm các bước khác cùng lúc<textarea name="nhieuTieuDe" rows={3} placeholder="Mỗi dòng một bước nhỏ" /><small>Các bước cùng lần lưu dùng chung hạn, ưu tiên và ước lượng đã nhập. Có thể chỉnh riêng từng bước sau khi tạo.</small></label>}
  </BieuMau>
}

function hanBuocMacDinh(parent: NhiemVu, zone: string) {
  const today = ngay(Date.now(), zone) + 'T23:59'
  const parentDeadline = gioNhap(parent.hanHieuLuc, zone)
  return parentDeadline && parentDeadline <= today ? '' : today
}

function duLieuCapNhat(task: NhiemVu) {
  const { tieuDe, moTa, maHocKy, maMonHoc, loai, mucDoUuTien, hanHoanThanh, batDauSuKien, ketThucSuKien, nhacTruocGio } = task
  return { tieuDe, moTa, maHocKy, maMonHoc, loai, mucDoUuTien, hanHoanThanh, batDauSuKien, ketThucSuKien, nhacTruocGio,
    thoiLuongDuKienPhut: task.coNhiemVuCon ? null : task.thoiLuongDuKienPhut }
}

function capNhatNhiemVu(token: string, ma: number, body: object, version: number) {
  return thayDoi<NhiemVu>(token, `/tasks/${ma}`, 'PUT', body, version, {
    path: `/tasks/${ma}/change-preview`, body: { thaoTac: 'update', noiDung: body },
  })
}

function themBuocNho(token: string, parent: number, danhSach: { tieuDe: string; hanHoanThanh?: string | null }[], version: number) {
  const body = { danhSach }
  return thayDoi<NhiemVu[]>(token, `/tasks/${parent}/children`, 'POST', body, version, {
    path: `/tasks/${parent}/change-preview`, body: { thaoTac: 'children', noiDung: body },
  })
}

async function chuyenVaoThungRac(token: string, task: NhiemVu, version: number) {
  const result = await thayDoi<AnhHuong>(token, `/tasks/${task.ma}/trash`, 'POST', { huyPhienLienQuan: false }, version)
  if (!result) return null
  const steps = (result.duLieu.soNhiemVu ?? 1) - 1
  return `Đã chuyển “${task.tieuDe}”${steps > 0 ? ` và ${steps} bước nhỏ` : ''} vào thùng rác`
}

export function ChiTietNhiemVu({ ma, inline = false, draftRequest, onChildrenSaved }: {
  ma: number
  inline?: boolean
  draftRequest?: number[] | null
  onChildrenSaved?: () => void
}) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (!inline) dialog.current?.showModal() }, [inline])
  const [result, setResult] = useState<{ task: NhiemVu; branch: NhiemVu[]; version: number; revision: number } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [emptyChecklist, setEmptyChecklist] = useState(false)
  const [checklistDirty, setChecklistDirty] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftError, setDraftError] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const draftInput = useRef<HTMLInputElement>(null)
  const savingChild = useRef(false)
  const fresh = result?.task.ma === ma && result.revision === c.revision
  useEffect(() => {
    setNoteDraft(null)
    setEmptyChecklist(false)
    setChecklistDirty(false)
  }, [ma])
  function focusDraft() {
    setDraftOpen(true)
    draftInput.current?.focus()
  }
  useEffect(() => {
    if (draftRequest) focusDraft()
  }, [draftRequest])
  const closeDetail = () => { if (inline) c.chonNhiemVu(null); else c.close() }
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    goi<NhiemVu[]>(c.token, `/tasks/${ma}/tree`, { signal: controller.signal }).then(read => {
      if (controller.signal.aborted) return
      const task = read.duLieu.find(n => n.ma === ma)
      if (!task) throw new Error('Không tìm thấy nhiệm vụ.')
      setResult({ task, branch: read.duLieu, version: read.phienBan, revision: c.revision })
      setNeedsRefresh(false)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [ma, c.token, c.revision])
  async function runDetailAction<T>(operation: () => Promise<T>) {
    setBusy(true); setError('')
    try {
      const saved = await operation()
      if (saved !== null) c.reload()
      return saved
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác.') }
    finally { setBusy(false) }
  }
  async function saveContent(moTa: string | null, checklist?: MucChecklist[]) {
    if (!result || !fresh || busy) return false
    const saved = await runDetailAction(async () => {
      const update = await capNhatNhiemVu(c.token, ma, { ...duLieuCapNhat(result.task), moTa, checklist }, result.version)
      if (update) setResult(current => current ? { ...current, task: update.duLieu, version: update.phienBan } : current)
      return update
    })
    return !!saved
  }
  async function saveNote(moTa: string) {
    const saved = await saveContent(moTa || null)
    if (saved) c.thongBaoThanhCong('Đã lưu ghi chú')
    return saved
  }
  async function saveChecklist(checklist: MucChecklist[]) {
    const saved = await saveContent(result?.task.moTa ?? null, checklist)
    if (saved) setEmptyChecklist(checklist.length === 0)
    return saved
  }
  async function switchContentMode() {
    if (!result || !fresh || busy) return
    const items = result.task.checklist ?? []
    if (emptyChecklist || items.length) {
      if (checklistDirty) { setError('Hãy lưu hoặc hủy mục đang nhập trước khi chuyển.'); return }
      if (!items.length) { setError(''); setEmptyChecklist(false); return }
      const description = [result.task.moTa, ...items.map(item => item.tieuDe)].filter(Boolean).join('\n')
      if (description.length > 20000) { setError('Nội dung sau khi chuyển vượt quá 20.000 ký tự.'); return }
      if (await saveContent(description, [])) {
        setNoteDraft(null)
        setEmptyChecklist(false)
      }
      return
    }
    const lines = (noteDraft ?? result.task.moTa ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (!lines.length) { setError(''); setNoteDraft(null); setEmptyChecklist(true); return }
    if (lines.length > 100 || lines.some(line => line.length > 200)) {
      setError('Checklist tối đa 100 mục, mỗi dòng tối đa 200 ký tự. Rút gọn mô tả rồi thử lại.')
      return
    }
    if (await saveContent(null, lines.map(tieuDe => ({ tieuDe, daXong: false })))) setNoteDraft(null)
  }
  async function addChild() {
    if (!result || !fresh || busy || needsRefresh || savingChild.current || !c.zoneReady) return
    const tieuDe = draftTitle.trim()
    if (!tieuDe) { setDraftError('Hãy nhập tên bước nhỏ.'); return }
    savingChild.current = true
    setBusy(true)
    setDraftError('')
    try {
      const hanHoanThanh = utc(hanBuocMacDinh(result.task, c.zone), c.zone)
      const saved = await themBuocNho(c.token, ma, [{ tieuDe, hanHoanThanh }], result.version)
      if (saved) {
        setDraftTitle('')
        onChildrenSaved?.()
        c.reload()
      }
    } catch (e) {
      setNeedsRefresh(e instanceof LoiHocTap && e.code === 'DATA_VERSION_CONFLICT')
      setDraftError(e instanceof Error ? e.message : 'Chưa thêm được bước nhỏ.')
    } finally {
      savingChild.current = false
      setBusy(false)
      draftInput.current?.focus()
    }
  }
  const task = result?.task.ma === ma ? result.task : undefined
  const checklistMode = emptyChecklist || !!task?.checklist?.length
  const switchLabel = checklistMode ? 'Chuyển sang mô tả' : 'Chuyển sang checklist'
  const scopeName = task ? c.subjects.find(s => Number(s.id) === task.maMonHoc)?.name ?? c.semesters.find(s => Number(s.id) === task.maHocKy)?.name ?? 'Nhiệm vụ cá nhân' : 'Chi tiết nhiệm vụ'
  const progress = task && c.tienDoXemTruoc?.ma === task.ma ? c.tienDoXemTruoc.tienDo : task?.tienDo
  const deadline = task?.hanHieuLuc
  const inheritedDeadline = task?.maNhiemVuNguonHan != null && task.maNhiemVuNguonHan !== task.ma
  const deadlineTone = task?.trangThai === 'Completed' ? ' ht-detail-deadline-completed'
    : deadline && Date.parse(deadline) < Date.now() ? ' ht-detail-deadline-overdue' : ''
  const detail = <><header className="ht-detail-top">
      {!task && <span>Chi tiết nhiệm vụ</span>}
      <div className="ht-detail-header-actions">
        {task && result && <ThaoTacNhiemVu task={task} baseline={fresh && !busy ? result.version : null} branch={result.branch}
          onAddChild={focusDraft} onShareLink={setShareLink} onDeleted={closeDetail} onOpenSessions={inline ? undefined : c.close} onOpenHistory={() => setHistoryOpen(true)}
          run={runDetailAction} />}
        <button type="button" className="ht-detail-close" title="Đóng" disabled={busy} onClick={closeDetail}><Icon name="close" size={17} /><span className="sr-only">Đóng</span></button>
      </div>
      {task && result && <div className={'ht-detail-deadline' + deadlineTone}>
        <Icon name="calendar" size={16} />
        {deadline ? <span><span className="sr-only">Hạn hoàn thành </span><HanNhiemVu value={deadline} zone={c.zone} today={ngay(Date.now(), c.zone)} /></span>
          : <button type="button" disabled={busy || !fresh} onClick={() => c.modal(<SuaNhiemVu task={task} baseline={result.version} />)}>Chưa đặt hạn</button>}
        {deadline && inheritedDeadline && <small>Theo hạn nhiệm vụ lớn</small>}
      </div>}
      {progress !== undefined && <progress className="ht-detail-progress" max={100} value={progress}
        aria-label={task?.checklist?.length ? 'Tiến độ checklist' : 'Tiến độ nhiệm vụ'} title={progress + '%'} />}
    </header>
    <div className="ht-detail-body">
    {error && <p className="ht-error" role="alert">{error} <button type="button" onClick={c.reload}>Tải dữ liệu mới</button></p>}
    {task && result && <>
      <div className="ht-detail-title">
        <h2>{task.tieuDe}</h2>
        <button type="button" className="ht-content-mode" title={switchLabel} aria-label={switchLabel}
          disabled={busy || !fresh} onClick={() => void switchContentMode()}>
          <Icon name={checklistMode ? 'edit' : 'list'} size={17} />
          <span>{checklistMode ? 'Mô tả' : 'Checklist'}</span>
        </button>
      </div>
      {checklistMode ? <>
        {task.moTa && <p className="ht-preserve ht-content-note">{task.moTa}</p>}
        <ChecklistNhiemVu items={task.checklist ?? []} disabled={busy || !fresh} onSave={saveChecklist} onDraftChange={setChecklistDirty} />
      </> : <GhiChuNhiemVu key={task.ma} value={task.moTa ?? ''} draft={noteDraft} setDraft={setNoteDraft}
        readOnly={busy} canSave={fresh && !busy} onSave={saveNote} />}
      {shareLink && <label className="ht-note">Sao chép liên kết nhiệm vụ <input className="ht-share-link" aria-label="Liên kết nhiệm vụ" value={shareLink} readOnly onFocus={event => event.target.select()} /></label>}
      <section className="ht-detail-section"><h3>Các bước nhỏ</h3>
        {result.branch.filter(n => n.maNhiemVuCha === task.ma).map(n => {
          const openChild = () => { if (inline) c.chonNhiemVu(n.ma); else c.modal(<ChiTietNhiemVu key={n.ma} ma={n.ma} />) }
          return <div className={'ht-detail-child-row' + (n.tienDo === 100 ? ' ht-detail-child-done' : '')} key={n.ma}>
            {n.coNhiemVuCon || n.checklist?.length
              ? <button type="button" className="ht-detail-child-icon" aria-label={'Xem các bước của ' + n.tieuDe} onClick={openChild}><Icon name="task-group" size={15} /></button>
              : <input type="checkbox" aria-label={(n.tienDo === 100 ? 'Mở lại ' : 'Hoàn thành ') + n.tieuDe}
                checked={n.tienDo === 100} disabled={busy || !fresh}
                onChange={() => void runDetailAction(() => doiHoanThanhNhiemVu(c, n, result.version))} />}
            <button type="button" className="ht-child-link" onClick={openChild}>{n.tieuDe}</button>
            {n.tienDo > 0 && n.tienDo < 100 && <span className="ht-child-percent">{n.tienDo}%</span>}
            {n.hanHieuLuc && <HanNhiemVu value={n.hanHieuLuc} zone={c.zone} today={ngay(Date.now(), c.zone)} />}
          </div>
        })}
        {draftOpen ? <>
          <form className="ht-inline-child" aria-label="Thêm bước nhỏ" onSubmit={event => { event.preventDefault(); void addChild() }}>
            <input ref={draftInput} autoFocus name="tenBuocNho" aria-label="Tên bước nhỏ" placeholder="Nhập tên bước nhỏ rồi nhấn Enter"
              value={draftTitle} onChange={event => setDraftTitle(event.target.value)} maxLength={200} required readOnly={busy} />
            <button type="submit" disabled={busy || !fresh || needsRefresh || !c.zoneReady || !draftTitle.trim()}>{busy ? 'Đang lưu…' : 'Thêm'}</button>
          </form>
          {draftError && <p className="ht-error" role="alert">{draftError}{needsRefresh && <button type="button" onClick={() => { setDraftError(''); c.reload() }}>Tải dữ liệu mới</button>}</p>}
          <button type="button" className="ht-text-action" disabled={busy || !fresh} onClick={() => c.modal(<SuaNhiemVu parent={task} baseline={result.version} onChildrenSaved={onChildrenSaved} />)}>Thêm nhiều bước hoặc tùy chọn</button>
        </> : <button type="button" className="ht-text-action" disabled={busy || !fresh} onClick={focusDraft}>+ Thêm bước nhỏ</button>}
      </section>
      <div className="ht-detail-context"><span><Icon name="book" size={16} />{scopeName}</span><span className="ht-status-label">{trangThai[task.trangThai]}</span></div>
      <details className="ht-detail-section ht-task-metadata">
        <summary>Thông tin nhiệm vụ</summary>
        <dl className="ht-task-facts">
          <div><dt>{task.checklist?.length ? 'Tiến độ checklist' : 'Tiến độ nhiệm vụ'}</dt><dd>{progress}%</dd></div>
          <div><dt>Ưu tiên</dt><dd>{uuTien[task.mucDoUuTien]}</dd></div>
          <div><dt>Loại công việc</dt><dd>{loaiViec[task.loai]}</dd></div>
          <div><dt>Ước lượng</dt><dd>{task.coNhiemVuCon ? 'Tổng hợp từ các bước nhỏ' : task.thoiLuongDuKienPhut == null ? 'Chưa nhập' : task.thoiLuongDuKienPhut + ' phút'}</dd></div>
          <div><dt>Còn lại dự kiến</dt><dd>{task.thoiLuongConLaiPhut == null ? 'Chưa đủ dữ liệu' : task.thoiLuongConLaiPhut + ' phút'}</dd></div>
        </dl>
        {task.batDauSuKien && <p>Sự kiện {hienGio(task.batDauSuKien, c.zone)} → {hienGio(task.ketThucSuKien, c.zone)}</p>}
      </details>
    </>}
    </div>
  </>
  return <>
    {inline ? <aside className="ht-detail-panel" aria-label="Chi tiết nhiệm vụ">{detail}</aside>
      : <dialog className="ht-dialog ht-detail" ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else closeDetail() }} aria-label="Chi tiết nhiệm vụ">{detail}</dialog>}
    {historyOpen && task && <HoatDongNhiemVu key={task.ma} ma={task.ma} title={task.tieuDe} token={c.token} zone={c.zone}
      onClose={() => setHistoryOpen(false)} />}
  </>
}
const mauGhiChu = [
  { label: 'Văn bản', prefix: '' },
  { label: 'Tiêu đề', prefix: '# ' },
  { label: 'Danh sách gạch đầu dòng', prefix: '• ' },
  { label: 'Danh sách đánh số', prefix: '1. ' },
  { label: 'Ô đánh dấu', prefix: '☐ ' },
  { label: 'Trích dẫn', prefix: '› ' },
  { label: 'Đường phân cách', prefix: '────────\n' },
]

function GhiChuNhiemVu({ value, draft, setDraft, readOnly, canSave, onSave }: {
  value: string
  draft: string | null
  setDraft: (value: string | null) => void
  readOnly: boolean
  canSave: boolean
  onSave: (text: string) => Promise<boolean>
}) {
  const [slash, setSlash] = useState<number | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const text = draft ?? value
  const dirty = text.trim() !== value
  const slashAt = slash !== null && text[slash] === '/' ? slash : null
  function insert(prefix: string) {
    if (slashAt === null || readOnly) return
    const next = text.slice(0, slashAt) + prefix + text.slice(slashAt + 1)
    if (next.length > 20000) return
    setDraft(next)
    setSlash(null)
    requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.setSelectionRange(slashAt + prefix.length, slashAt + prefix.length)
    })
  }
  return <form className="ht-task-note" aria-label="Ghi chú nhiệm vụ" onSubmit={async event => {
    event.preventDefault()
    if (canSave && dirty && await onSave(text.trim())) { setDraft(null); setSlash(null) }
  }}>
    <textarea ref={field} aria-label="Nội dung ghi chú" placeholder="Viết ghi chú… Gõ / ở đầu dòng để chèn mẫu."
      rows={2} value={text} maxLength={20000} readOnly={readOnly} onChange={event => {
        const input = event.currentTarget
        const index = input.selectionStart - 1
        const before = input.value[index - 1]
        const after = input.value[index + 1]
        setDraft(input.value)
        setSlash(input.value[index] === '/' && (index === 0 || before === '\n') && (!after || after === '\n') ? index : null)
      }} onKeyDown={event => {
        if (event.key === 'Escape' && slashAt !== null) { event.preventDefault(); setSlash(null) }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          event.currentTarget.form?.requestSubmit()
        }
      }} />
    {slashAt !== null && <div className="ht-note-commands" aria-label="Mẫu ghi chú">
      {mauGhiChu.map(item => <button key={item.label} type="button" disabled={readOnly} onClick={() => insert(item.prefix)}>{item.label}</button>)}
    </div>}
    {dirty && <div className="ht-note-actions">
      <button type="submit" disabled={!canSave}>Lưu ghi chú</button>
      <button type="button" disabled={readOnly} onClick={() => { setDraft(null); setSlash(null) }}>Hủy</button>
    </div>}
  </form>
}

function ChecklistNhiemVu({ items, disabled, onSave, onDraftChange }: {
  items: MucChecklist[]; disabled: boolean; onSave: (items: MucChecklist[]) => Promise<boolean>
  onDraftChange: (dirty: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(items.length === 0)
  const [editing, setEditing] = useState<{ index: number; title: string } | null>(null)
  const dirty = !!title.trim() || (editing !== null && editing.title.trim() !== items[editing.index]?.tieuDe)
  useEffect(() => { onDraftChange(dirty) }, [dirty, onDraftChange])
  const done = items.filter(item => item.daXong).length
  function updateItem(index: number, changes: Partial<MucChecklist>) {
    return onSave(items.map((item, position) => position === index ? { ...item, ...changes } : item))
  }
  return <section className="ht-detail-section ht-task-checklist ht-content-checklist">
    <h3>Checklist{items.length > 0 && ` · ${done}/${items.length}`}</h3>
    {!!items.length && <ul>
      {items.map((item, index) => <li key={index} className={item.daXong ? 'ht-checklist-done' : undefined}>
        <input type="checkbox" aria-label={item.tieuDe} checked={item.daXong} disabled={disabled}
          onChange={event => void updateItem(index, { daXong: event.currentTarget.checked })} />
        {editing?.index === index ? <form className="ht-checklist-title" onSubmit={async event => {
          event.preventDefault()
          const tieuDe = editing.title.trim()
          if (disabled || !tieuDe) return
          if (tieuDe === item.tieuDe || await updateItem(index, { tieuDe })) setEditing(null)
        }}>
          <input autoFocus aria-label="Sửa mục checklist" value={editing.title} maxLength={200} readOnly={disabled}
            onChange={event => setEditing({ index, title: event.currentTarget.value })}
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setEditing(null) } }} />
          <button type="submit" className="ht-text-action" disabled={disabled || !editing.title.trim()} aria-label="Lưu mục checklist"><Icon name="check" size={16} /></button>
        </form> : <button type="button" className="ht-checklist-title" disabled={disabled}
          onClick={() => setEditing({ index, title: item.tieuDe })}>{item.tieuDe}</button>}
        <button type="button" className="ht-text-action" disabled={disabled} aria-label={`Xóa mục ${item.tieuDe}`}
          onClick={() => { setEditing(null); void onSave(items.filter((_, position) => position !== index)) }}><Icon name="trash" size={15} /></button>
      </li>)}
    </ul>}
    {open ? <form className="ht-inline-child" aria-label="Thêm mục checklist" onSubmit={async event => {
      event.preventDefault()
      const tieuDe = title.trim()
      if (!tieuDe || disabled || items.length >= 100) return
      if (await onSave([...items, { tieuDe, daXong: false }])) setTitle('')
    }}>
      <input autoFocus aria-label="Tên mục checklist" placeholder="Nhập mục checklist rồi nhấn Enter" value={title} maxLength={200} readOnly={disabled}
        onChange={event => setTitle(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Escape' && !disabled) setOpen(false) }} />
      <button type="submit" disabled={disabled || items.length >= 100 || !title.trim()}>Thêm</button>
    </form> : <button type="button" className="ht-text-action" disabled={disabled || items.length >= 100} onClick={() => setOpen(true)}>+ Thêm mục checklist</button>}
  </section>
}

function capNhatTienDo(token: string, ma: number, tienDo: number, version: number) {
  const body = { tienDo }
  return thayDoi<NhiemVu>(token, `/tasks/${ma}/progress`, 'PATCH', body, version, {
    path: `/tasks/${ma}/change-preview`, body: { thaoTac: 'progress', noiDung: body },
  })
}

export function DoiTienDo({ task, baseline }: { task: NhiemVu; baseline: number }) {
  const c = useHocTap()
  const [progress, setProgress] = useState(String(task.tienDo))
  return <BieuMau title="Cập nhật tiến độ" onSubmit={async form => {
    const result = await capNhatTienDo(c.token, task.ma, Number(form.get('tienDo')), baseline)
    if (result) c.thongBaoThanhCong('Đã cập nhật tiến độ nhiệm vụ')
    return result
  }}><p>{task.tieuDe}</p><label>Phần trăm đã hoàn thành<input required type="number" name="tienDo" min={0} max={100} value={progress} onChange={event => setProgress(event.target.value)} /></label>
    <label>Chỉnh tiến độ bằng thanh trượt<input type="range" min={0} max={100} value={progress || 0} onChange={event => setProgress(event.target.value)} /></label>
  </BieuMau>
}
function DoiPhamVi({ task, baseline }: { task: NhiemVu; baseline: number }) {
  const c = useHocTap()
  return <BieuMau title="Đổi học kỳ hoặc môn học" onSubmit={async form => {
    const body = { maHocKy: form.get('maHocKy') ? Number(form.get('maHocKy')) : null, maMonHoc: form.get('maMonHoc') ? Number(form.get('maMonHoc')) : null }
    const result = await thayDoi<NhiemVu>(c.token, `/tasks/${task.ma}/scope`, 'PATCH', body, baseline, { path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: 'scope', noiDung: body } })
    if (result) c.hienNhiemVuMoi(result.duLieu)
    return result
  }}><p>Lựa chọn áp dụng cho “{task.tieuDe}” và toàn bộ các bước nhỏ.</p><ChonPhamVi semester={task.maHocKy?.toString()} subject={task.maMonHoc?.toString()} /></BieuMau>
}
function DoiCha({ task, branch, baseline }: { task: NhiemVu; branch: NhiemVu[]; baseline: number }) {
  const c = useHocTap()
  const [items, setItems] = useState<NhiemVu[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [group, setGroup] = useState('')
  const [targets, setTargets] = useState<NhiemVu[]>([])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ kichThuocTrang: '100', tuKhoa: search })
      if (task.maHocKy) query.set('maHocKy', String(task.maHocKy))
      if (task.maMonHoc) query.set('maMonHoc', String(task.maMonHoc))
      Promise.all([
        goi<Trang<NhiemVu>>(c.token, '/tasks?' + query, { signal: controller.signal }),
        goi<Trang<NhiemVu>>(c.token, '/tasks?' + query + '&trangThai=Completed', { signal: controller.signal }),
      ]).then(results => {
        const unique = new Map(results.flatMap(r => r.duLieu.danhSach).map(n => [n.ma, n]))
        setItems([...unique.values()].filter(n => !branch.some(b => b.ma === n.ma) && n.maHocKy === task.maHocKy && n.maMonHoc === task.maMonHoc))
      }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, c.token, task.ma, task.maHocKy, task.maMonHoc, branch])
  useEffect(() => {
    if (!group || group === 'tach-rieng') return
    const controller = new AbortController()
    goi<NhiemVu[]>(c.token, `/tasks/${group}/tree`, { signal: controller.signal }).then(r => {
      if (!controller.signal.aborted) setTargets(r.duLieu.filter(n => !branch.some(b => b.ma === n.ma)))
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [group, c.token, branch])
  return <BieuMau title="Chuyển hoặc tách nhiệm vụ" onSubmit={form => {
    const body = { maNhiemVuCha: form.get('maNhiemVuCha') === 'tach-rieng' ? null : Number(form.get('maNhiemVuCha')) }
    return thayDoi(c.token, `/tasks/${task.ma}/parent`, 'PATCH', body, baseline, { path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: 'parent', noiDung: body } })
  }}>
    <p>Chọn nhiệm vụ lớn cùng học kỳ/môn hoặc tách thành nhiệm vụ riêng.</p>
    <label>Tìm nhiệm vụ lớn theo tên<input value={search} onChange={e => setSearch(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <label>Nhóm nhiệm vụ<select name="nhomNhiemVu" required value={group} onChange={e => { setGroup(e.target.value); setTargets([]) }}>
      <option value="" disabled>Chọn nhiệm vụ lớn hoặc tách riêng</option>
      {task.maNhiemVuCha && <option value="tach-rieng">Tách thành nhiệm vụ riêng</option>}
      {items.map(n => <option value={n.ma} key={n.ma}>{n.tieuDe}</option>)}
    </select></label>
    {group === 'tach-rieng' ? <input type="hidden" name="maNhiemVuCha" value="tach-rieng" /> : group && <label>Gắn vào nhiệm vụ hoặc bước nhỏ<select key={group + targets.length} name="maNhiemVuCha" required defaultValue={targets.length ? group : ''}>
      <option value="" disabled>{targets.length ? 'Chọn việc sẽ chứa nhiệm vụ này' : 'Đang tải các bước nhỏ…'}</option>
      {targets.map(n => <option key={n.ma} value={n.ma}>{n.maNhiemVuCha ? '↳ ' : ''}{n.tieuDe}</option>)}
    </select></label>}
    <p className="ht-note">Nhập tên để thu hẹp danh sách. Sau khi chọn một nhiệm vụ lớn, có thể chuyển vào bất kỳ bước phù hợp trong nhóm đó.</p>
  </BieuMau>
}
