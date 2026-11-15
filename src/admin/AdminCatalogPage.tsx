import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { deleteTemplate, listTemplateCourses, listTemplateSemesters, saveTemplateCourse, saveTemplateSemester } from '../api/catalog'
import type { CatalogPage, TemplateCourse, TemplateSemester } from '../api/catalog'
import { Modal, FormActions } from '../components/PlannerUI'
import { Icon } from '../components/Icon'
import './catalog.css'

type Editor = { kind: 'semesters'; row?: TemplateSemester } | { kind: 'courses'; row?: TemplateCourse }
type Removal = { kind: 'semesters' | 'courses'; row: TemplateSemester | TemplateCourse }

export function AdminCatalogPage() {
  const auth = useAuth(), session = auth.getAccessToken
  const enabled = auth.status === 'authenticated' && auth.user?.role === 'admin' && !auth.isDemo && !useMockApi
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'semesters' ? 'semesters' : 'courses'
  const semester = params.get('semester') || '', keyword = params.get('q') || ''
  const rawPage = Number(params.get('page') || 1), page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const [searchInput, setSearchInput] = useState({ scope: keyword, value: keyword })
  const search = searchInput.scope === keyword ? searchInput.value : keyword
  const setSearch = (value: string) => setSearchInput({ scope: keyword, value })
  const [semesters, setSemesters] = useState<TemplateSemester[]>([])
  const [courses, setCourses] = useState<CatalogPage>()
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState<Editor>(), [removal, setRemoval] = useState<Removal>()
  const [name, setName] = useState(''), [order, setOrder] = useState('1'), [code, setCode] = useState(''), [credits, setCredits] = useState('3'), [selectedSemester, setSelectedSemester] = useState('')
  const lock = useRef(false), lifetime = useRef(0)
  const ready = enabled && !loading && !busy && !loadError
  const query = useCallback((values: Record<string, string>) => {
    setParams(current => { const next = new URLSearchParams(current); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key) } return next })
  }, [setParams])
  useEffect(() => {
    if (search === keyword || busy) return
    const timer = setTimeout(() => query({ q: search.trim(), page: '' }), 300)
    return () => clearTimeout(timer)
  }, [search, keyword, busy, query])
  useEffect(() => {
    const current = ++lifetime.current, controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      if (!enabled) { setLoading(false); return }
      setLoading(true); setLoadError('')
      return Promise.all([listTemplateSemesters(session(), controller.signal), listTemplateCourses(session(), semester, keyword, page, controller.signal)])
    }).then(result => {
      if (!result) return
      const [terms, rows] = result
      if (controller.signal.aborted || current !== lifetime.current) return
      setSemesters(terms); setCourses(rows)
      if (semester && !terms.some(term => String(term.ma) === semester)) { query({ semester: '', page: '' }); return }
      if (page > 1 && !rows.danhSach.length) query({ page: '' })
    }).catch(error => { if (!controller.signal.aborted && current === lifetime.current) setLoadError(error instanceof Error ? error.message : 'Chưa tải được danh mục.') })
      .finally(() => { if (!controller.signal.aborted && current === lifetime.current) setLoading(false) })
    return () => { controller.abort(); lifetime.current = current + 1 }
  }, [enabled, session, semester, keyword, page, revision, query])
  function open(next: Editor) {
    setName(next.row?.ten || ''); setActionError(''); setNotice('')
    if (next.kind === 'semesters') setOrder(String(next.row?.thuTu ?? Math.min(100, Math.max(0, ...semesters.map(row => row.thuTu)) + 1)))
    else { setCode(next.row?.kyHieu || ''); setCredits(String(next.row?.soTinChi ?? 3)); setSelectedSemester(String(next.row?.maHocKyMau ?? (semester || semesters[0]?.ma || ''))) }
    setEditor(next)
  }
  const close = () => { if (!lock.current) { setEditor(undefined); setRemoval(undefined); setActionError('') } }
  async function mutate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!ready || lock.current || (event && !event.currentTarget.reportValidity())) return
    const current = lifetime.current
    lock.current = true; setBusy(true); setActionError(''); setNotice('')
    try {
      if (removal) await deleteTemplate(session(), removal.kind, removal.row.ma, removal.row.phienBan)
      else if (editor?.kind === 'semesters') await saveTemplateSemester(session(), { ten: name, thuTu: Number(order), phienBan: editor.row?.phienBan }, editor.row?.ma)
      else if (editor?.kind === 'courses') await saveTemplateCourse(session(), { ten: name, kyHieu: code, soTinChi: Number(credits), maHocKyMau: Number(selectedSemester), phienBan: editor.row?.phienBan }, editor.row?.ma)
      if (current !== lifetime.current) return
      setNotice(removal ? 'Đã xóa mẫu.' : 'Đã lưu mẫu.'); closeAfterSave(); setRevision(value => value + 1)
    } catch (error) { if (current === lifetime.current) setActionError(error instanceof Error ? error.message : 'Chưa lưu được thay đổi.') }
    finally { lock.current = false; setBusy(false) }
  }
  function closeAfterSave() { setEditor(undefined); setRemoval(undefined) }

  return <section className="catalog-page" aria-labelledby="catalog-title">
    <header className="catalog-heading"><div><span className="admin-label">DANH MỤC DÙNG CHUNG</span><h1 id="catalog-title">Danh mục môn học & học kỳ</h1></div></header>
    {!enabled ? <p className="catalog-message">Đăng nhập tài khoản quản trị thật để quản lý danh mục.</p> : <>
      <nav className="catalog-tabs" aria-label="Danh mục mẫu"><button aria-current={tab === 'courses' ? 'page' : undefined} disabled={busy} onClick={() => query({ tab: '', page: '' })}><Icon name="book" size={17} />Môn học mẫu</button><button aria-current={tab === 'semesters' ? 'page' : undefined} disabled={busy} onClick={() => query({ tab: 'semesters', page: '' })}><Icon name="calendar" size={17} />Học kỳ mẫu</button></nav>
      {notice && <p className="admin-feedback" role="status">{notice}</p>}
      {loadError && <div className="catalog-error" role="alert">{loadError}<button disabled={loading} onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>}
      <section className="catalog-card" aria-label={tab === 'courses' ? 'Danh sách môn học mẫu' : 'Danh sách học kỳ mẫu'}>
        <header className="catalog-card-heading"><div><h2>{tab === 'courses' ? 'Môn học mẫu' : 'Học kỳ mẫu'}</h2><p>{tab === 'courses' ? 'Quản lý tên môn, mã môn và số tín chỉ.' : 'Sắp xếp các học kỳ và nhóm môn học tương ứng.'}</p></div><button className="button button-primary catalog-add" disabled={!ready || (tab === 'courses' && !semesters.length)} onClick={() => open({ kind: tab })}><Icon name="plus" size={16} />{tab === 'courses' ? 'Thêm môn mẫu' : 'Thêm học kỳ mẫu'}</button></header>
        {tab === 'courses' && <div className="catalog-filters"><label><span>Tìm môn học</span><input type="search" name="catalogSearch" placeholder="Nhập tên hoặc mã môn…" maxLength={200} disabled={busy} value={search} onChange={event => setSearch(event.target.value)} /></label><label><span>Học kỳ mẫu</span><select name="catalogSemesterFilter" value={semester} disabled={busy || loading} onChange={event => query({ semester: event.target.value, page: '' })}><option value="">Tất cả học kỳ</option>{semesters.map(row => <option key={row.ma} value={row.ma}>{row.ten}</option>)}</select></label>{(keyword || semester) && <button className="catalog-text-button" disabled={busy} onClick={() => { setSearch(''); query({ q: '', semester: '', page: '' }) }}>Xóa bộ lọc</button>}</div>}
        {loading ? <p className="catalog-message" role="status">Đang tải danh mục…</p> : !loadError && <>
          {tab === 'courses' ? <><div className="admin-table-container"><table className="catalog-table"><thead><tr><th>Mã môn</th><th>Tên môn học</th><th>Học kỳ mẫu</th><th>Tín chỉ</th><th>Thao tác</th></tr></thead><tbody>{courses?.danhSach.map(row => <tr key={row.ma} data-catalog-id={row.ma}><td><span className="catalog-code">{row.kyHieu}</span></td><td><strong>{row.ten}</strong></td><td>{row.tenHocKy}</td><td>{row.soTinChi}</td><td><div className="catalog-actions"><button disabled={!ready} aria-label={'Sửa môn ' + row.ten} onClick={() => open({ kind: 'courses', row })}><Icon name="edit" size={15} />Sửa</button><button disabled={!ready} aria-label={'Xóa môn ' + row.ten} onClick={() => { setActionError(''); setRemoval({ kind: 'courses', row }) }}><Icon name="trash" size={15} />Xóa</button></div></td></tr>)}</tbody></table></div>{!courses?.tongSo && <p className="catalog-message">{!semesters.length ? 'Chưa có học kỳ mẫu. Thêm học kỳ trước khi tạo môn học.' : 'Không có môn học phù hợp. Thử đổi bộ lọc hoặc thêm môn mới.'}</p>}<footer className="catalog-pagination"><span>{courses?.tongSo ?? 0} môn học</span><nav aria-label="Trang môn học mẫu"><button disabled={!ready || page === 1} onClick={() => query({ page: String(page - 1) })}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil((courses?.tongSo ?? 0) / 20))}</span><button disabled={!ready || page * 20 >= (courses?.tongSo ?? 0)} onClick={() => query({ page: String(page + 1) })}>Sau</button></nav></footer></> : <><div className="admin-table-container"><table className="catalog-table"><thead><tr><th>Thứ tự</th><th>Tên học kỳ mẫu</th><th>Số môn</th><th>Tổng tín chỉ</th><th>Thao tác</th></tr></thead><tbody>{semesters.map(row => <tr key={row.ma} data-catalog-id={row.ma}><td>{row.thuTu}</td><td><strong>{row.ten}</strong></td><td><button className="catalog-text-button" disabled={!ready} onClick={() => query({ tab: '', semester: String(row.ma), q: '', page: '' })}>{row.soMonHoc} môn học</button></td><td>{row.tongTinChi}</td><td><div className="catalog-actions"><button disabled={!ready} aria-label={'Sửa học kỳ ' + row.ten} onClick={() => open({ kind: 'semesters', row })}><Icon name="edit" size={15} />Sửa</button><button disabled={!ready} aria-label={'Xóa học kỳ ' + row.ten} onClick={() => { setActionError(''); setRemoval({ kind: 'semesters', row }) }}><Icon name="trash" size={15} />Xóa</button></div></td></tr>)}</tbody></table></div>{!semesters.length && <p className="catalog-message">Chưa có học kỳ mẫu. Tạo học kỳ đầu tiên để bắt đầu.</p>}</>}
        </>}
      </section>
    </>}
    {editor && <Modal title={(editor.row ? 'Chỉnh sửa ' : 'Thêm ') + (editor.kind === 'semesters' ? 'học kỳ mẫu' : 'môn học mẫu')} onClose={close}><form className="catalog-form" onSubmit={event => { void mutate(event) }}>
      {actionError && <p className="catalog-error" role="alert">{actionError}</p>}<fieldset disabled={busy}>
        <label>Tên {editor.kind === 'semesters' ? 'học kỳ' : 'môn học'}<input name="catalogName" value={name} required maxLength={200} autoFocus onChange={event => setName(event.target.value)} /></label>
        {editor.kind === 'semesters' ? <label>Thứ tự hiển thị<input type="number" name="catalogOrder" value={order} required min={1} max={100} step={1} onChange={event => setOrder(event.target.value)} /></label> : <><label>Học kỳ mẫu<select name="catalogCourseSemester" value={selectedSemester} required onChange={event => setSelectedSemester(event.target.value)}>{semesters.map(row => <option key={row.ma} value={row.ma}>{row.ten}</option>)}</select></label><div className="catalog-form-grid"><label>Mã môn<input name="catalogCode" value={code} required maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._\-]*" title="Dùng chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới" onChange={event => setCode(event.target.value)} /></label><label>Số tín chỉ<input type="number" name="catalogCredits" value={credits} required min={1} max={30} step={1} onChange={event => setCredits(event.target.value)} /></label></div></>}
      </fieldset><FormActions onClose={close} disabled={busy} label={busy ? 'Đang lưu…' : 'Lưu mẫu'} /></form></Modal>}
    {removal && <Modal title="Xóa mẫu?" onClose={close}><div className="catalog-form"><p>Bạn muốn xóa “{removal.row.ten}” khỏi danh mục mẫu?</p><p className="catalog-help">{removal.kind === 'semesters' ? 'Chỉ xóa được học kỳ khi không còn môn học mẫu bên trong.' : 'Dữ liệu học tập riêng của sinh viên được giữ nguyên.'}</p>{actionError && <p className="catalog-error" role="alert">{actionError}</p>}<div className="dialog-actions"><button className="button button-secondary" disabled={busy} onClick={close}>Hủy</button><button className="button button-primary catalog-confirm-delete" disabled={!ready} onClick={() => { void mutate() }}>{busy ? 'Đang xóa…' : 'Xóa mẫu'}</button></div></div></Modal>}
  </section>
}
