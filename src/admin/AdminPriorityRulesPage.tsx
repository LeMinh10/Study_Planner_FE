import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { activatePriorityRule, createPriorityRule, deletePriorityRule, listPriorityRules, loadActivePriorityRule } from '../api/priorityRules'
import type { PriorityRulePage } from '../api/priorityRules'
import { criteria, criterionLabels, defaultPriorityConfig } from '../priority/rules'
import type { PriorityConfig, PriorityCriterion, PriorityRule } from '../priority/rules'
import { Modal } from '../components/PlannerUI'
import { Icon } from '../components/Icon'
import { PriorityCriteriaEditor } from './PriorityCriteriaEditor'
import './priorityRules.css'

type Confirmation = { kind: 'activate' | 'delete'; rule: PriorityRule; activeVersion: number }
export function AdminPriorityRulesPage() {
  const auth = useAuth()
  const session = auth.getAccessToken
  const enabled = auth.status === 'authenticated' && (!auth.isDemo || useMockApi)
  const [active, setActive] = useState<PriorityRule>()
  const [list, setList] = useState<PriorityRulePage>()
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('Ưu tiên theo hạn')
  const [order, setOrder] = useState<PriorityCriterion[]>([...criteria])
  const [selected, setSelected] = useState<readonly PriorityCriterion[]>(defaultPriorityConfig.tieuChi)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const busyRef = useRef(false)
  const generation = useRef(0)
  const config: PriorityConfig = { phienBanSchema: 1, tieuChi: order.filter(item => selected.includes(item)) }
  const ready = enabled && !!active && !!list && !loading && !loadError && !busy
  const sequence = (rule: PriorityRule) => rule.cauHinh.tieuChi.map(item => criterionLabels[item]).join(' → ')
  const refresh = () => setRevision(value => value + 1)

  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted || !enabled) return
      setLoading(true); setLoadError('')
      const token = session()
      const [nextList, nextActive] = await Promise.all([listPriorityRules(token, page, controller.signal), loadActivePriorityRule(token, controller.signal)])
      if (controller.signal.aborted || current !== generation.current) return
      if (page > 1 && !nextList.danhSach.length) { setPage(1); return }
      setList(nextList); setActive(nextActive)
    }).catch(error => { if (!controller.signal.aborted && current === generation.current) setLoadError(error instanceof Error ? error.message : 'Chưa tải được quy tắc.') })
      .finally(() => { if (current === generation.current) setLoading(false) })
    return () => { generation.current = current + 1; controller.abort() }
  }, [enabled, session, page, revision])

  function edit(rule?: PriorityRule) {
    const source = rule?.cauHinh ?? defaultPriorityConfig
    setName(rule?.ten ?? 'Ưu tiên theo hạn')
    setOrder([...source.tieuChi, ...criteria.filter(item => !source.tieuChi.includes(item))])
    setSelected([...source.tieuChi]); setActionError(''); setNotice('')
  }
  async function mutate(kind: 'save' | 'activate' | 'delete') {
    if (!ready || busyRef.current) return
    busyRef.current = true; setBusy(true); setActionError(''); setNotice('')
    const current = generation.current
    try {
      const token = session()
      if (kind === 'save') {
        await createPriorityRule(token, name, config)
        if (current !== generation.current) return
        setNotice('Đã lưu quy tắc.'); setPage(1)
      } else if (confirmation) {
        if (kind === 'activate') {
          const applied = await activatePriorityRule(token, confirmation.rule.ma, confirmation.activeVersion)
          if (current !== generation.current) return
          setActive(applied); setNotice(`Đã áp dụng “${applied.ten}”.`)
        } else {
          await deletePriorityRule(token, confirmation.rule.ma)
          if (current !== generation.current) return
          setNotice('Đã xóa quy tắc.')
        }
        setConfirmation(null)
      }
      refresh()
    } catch (error) {
      if (current === generation.current) { setActionError(error instanceof Error ? error.message : 'Chưa lưu được thay đổi.'); setConfirmation(null) }
    } finally { busyRef.current = false; if (current === generation.current) setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (event.currentTarget.reportValidity()) void mutate('save') }

  return <section className="admin-priority-page" aria-labelledby="priority-rules-title">
    <header className="priority-page-heading"><div className="admin-page-heading"><h1 id="priority-rules-title">Quy tắc ưu tiên</h1></div><button type="button" className="button button-secondary" disabled={!enabled || loading || busy} onClick={refresh}><Icon name="reset" size={15} />Tải lại</button></header>
    {!enabled ? <p className="priority-message">Vui lòng đăng nhập tài khoản quản trị.</p> : <>
      {loadError && <div className="priority-error" role="alert">{loadError} <button type="button" disabled={loading || busy} onClick={refresh}>Thử lại</button></div>}
      {actionError && <p className="priority-error" role="alert">{actionError}</p>}
      {notice && <p className="admin-feedback" role="status">{notice}</p>}
      {loading && <p className="priority-message" role="status">Đang tải quy tắc…</p>}
      {active && <section className="priority-active" aria-label="Quy tắc đang áp dụng"><div><span>Đang áp dụng</span><h2>{active.ten}</h2><p>{sequence(active)}</p></div></section>}
      <div className="priority-editor-grid">
        <form className="priority-editor priority-card" onSubmit={submit}>
          <header><h2>Tạo quy tắc</h2><button type="button" className="priority-text-button" disabled={!ready} onClick={() => edit()}>Dùng mặc định</button></header>
          <fieldset disabled={!ready}>
            <label className="priority-name">Tên quy tắc<input name="ruleName" value={name} required maxLength={200} onChange={event => setName(event.target.value)} /></label>
            <PriorityCriteriaEditor order={order} selected={selected} disabled={!ready} onReorder={setOrder} onSelect={setSelected} />
            <button type="submit" className="button button-primary">{busy ? 'Đang lưu…' : 'Lưu quy tắc'}</button>
          </fieldset>
        </form>
      </div>
      {list && <section className="priority-card priority-history">
        <header><h2>Quy tắc đã lưu</h2><span>{list.tongSo} quy tắc</span></header>
        <div className="admin-table-container"><table><thead><tr><th>Quy tắc</th><th>Thứ tự tiêu chí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{list.danhSach.map(rule => <tr key={rule.ma} data-rule-id={rule.ma}><td><strong>{rule.ten}</strong><small>{new Date(rule.ngayTao!).toLocaleDateString('vi-VN')}</small></td><td>{sequence(rule)}</td><td><span className={'admin-status ' + (rule.ma === active?.ma ? 'active' : '')}>{rule.ma === active?.ma ? 'Đang dùng' : 'Chưa áp dụng'}</span></td><td><div className="priority-row-actions"><button type="button" className="rule-edit" disabled={!ready} onClick={() => edit(rule)}>Chỉnh sửa</button><button type="button" className="rule-activate" disabled={!ready || rule.ma === active?.ma} onClick={() => setConfirmation({ kind: 'activate', rule, activeVersion: active!.phienBan })}>Áp dụng</button><button type="button" className="rule-delete" disabled={!ready || rule.ma === active?.ma} onClick={() => setConfirmation({ kind: 'delete', rule, activeVersion: active!.phienBan })}>Xóa</button></div></td></tr>)}</tbody></table></div>
        {!list.tongSo && <p className="priority-message">Chưa có quy tắc đã lưu.</p>}
        {list.tongSo > list.kichThuocTrang && <footer><nav aria-label="Trang quy tắc"><button disabled={!ready || page === 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page}/{Math.ceil(list.tongSo / list.kichThuocTrang)}</span><button disabled={!ready || page * list.kichThuocTrang >= list.tongSo} onClick={() => setPage(page + 1)}>Sau</button></nav></footer>}
      </section>}
    </>}
    {confirmation && <Modal title={confirmation.kind === 'activate' ? 'Áp dụng quy tắc?' : 'Xóa quy tắc?'} onClose={() => { if (!busy) setConfirmation(null) }}><p className="priority-confirm">{confirmation.kind === 'activate' ? `Áp dụng “${confirmation.rule.ten}” cho gợi ý Hôm nay của tất cả sinh viên?` : `Xóa quy tắc “${confirmation.rule.ten}”?`}</p><div className="dialog-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Hủy</button><button type="button" className="button button-primary priority-confirm-submit" disabled={busy} onClick={() => { void mutate(confirmation.kind) }}>{busy ? 'Đang xử lý…' : confirmation.kind === 'activate' ? 'Áp dụng' : 'Xóa'}</button></div></Modal>}
  </section>
}
