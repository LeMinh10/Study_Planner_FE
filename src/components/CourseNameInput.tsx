import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { loadCourseSuggestions } from '../api/courseSuggestions'
import type { CourseSuggestion, CourseSuggestions } from '../api/courseSuggestions'
import './courseSuggestions.css'

export function CourseNameInput({ value, onChange, onSelect, validationError, errorId }: { value: string; onChange: (name: string) => void; onSelect: (course: CourseSuggestion) => void; validationError?: string; errorId?: string }) {
  const auth = useAuth(), session = auth.getAccessToken
  const enabled = auth.status === 'authenticated' && !auth.isDemo && !useMockApi
  const id = useId(), listId = id + '-options'
  const [open, setOpen] = useState(false), [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [result, setResult] = useState<(CourseSuggestions & { keyword: string })>()
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null), generation = useRef(0)
  const keyword = value.trim(), expanded = enabled && open
  const matching = result?.keyword === keyword ? result : undefined
  const rows = matching?.rows ?? []
  const waiting = loading || (!matching && !error)
  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController(), current = ++generation.current
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      void loadCourseSuggestions(session(), keyword, page, controller.signal).then(next => {
        if (controller.signal.aborted || current !== generation.current) return
        setResult(previous => {
          const combined = page > 1 && previous?.keyword === keyword && previous.page === page - 1 ? [...previous.rows, ...next.rows] : next.rows
          return { ...next, keyword, rows: [...new Map(combined.map(row => [row.ma, row])).values()] }
        })
      }).catch(reason => { if (!controller.signal.aborted && current === generation.current) setError(reason instanceof Error ? reason.message : 'Chưa tải được gợi ý.') })
        .finally(() => { if (!controller.signal.aborted && current === generation.current) setLoading(false) })
    }, keyword ? 200 : 0)
    return () => { clearTimeout(timer); controller.abort(); generation.current = current + 1 }
  }, [expanded, session, keyword, page, revision])
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(listId + '-' + active)?.scrollIntoView({ block: 'nearest' })
  }, [active, expanded, listId])
  function show() { if (enabled) { setOpen(true); setError(''); setPage(1); setActive(-1) } }
  function choose(row: CourseSuggestion) { onSelect(row); setOpen(false); setActive(-1) }
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!expanded) show()
      if (rows.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % rows.length : (index <= 0 ? rows.length - 1 : index - 1))
    } else if (event.key === 'Enter' && expanded && active >= 0 && rows[active]) { event.preventDefault(); choose(rows[active]) }
  }
  return <div className="course-name-field" ref={root} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1) } }}>
    <label htmlFor={id}>Tên môn học <span className="course-required-mark" aria-hidden="true">*</span><span className="sr-only">(bắt buộc)</span></label>
    <input id={id} name="name" value={value} onChange={event => { onChange(event.target.value); setPage(1); setActive(-1); setError(''); setOpen(enabled) }} onClick={() => { if (!open) show() }} onKeyDown={keys} maxLength={200} placeholder="Nhập tên hoặc chọn môn gợi ý" required autoFocus autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && active >= 0 && rows[active] ? listId + '-' + active : undefined} aria-invalid={!!validationError} aria-describedby={[id + '-hint', validationError ? errorId : undefined].filter(Boolean).join(' ')} />
    <p className="course-suggestion-hint" id={id + '-hint'}>Chọn môn gợi ý để điền mã môn và tín chỉ, hoặc tự nhập môn của bạn.</p>
    {expanded && <div className="course-suggestions-popup">
      <div className="course-suggestions-heading">Môn học gợi ý<span></span></div>
      {error && <div className="course-suggestions-error" role="status"><p>Chưa tải được gợi ý. Bạn vẫn có thể tự nhập môn.</p><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setRevision(count => count + 1)}>Thử lại</button></div>}
      {waiting && <p className="course-suggestions-message" role="status">Đang tìm môn học…</p>}
      <div className="course-suggestions-list" id={listId} role="listbox" aria-label="Môn học mẫu" aria-busy={waiting}>
        {rows.map((row, index) => <button type="button" role="option" id={listId + '-' + index} key={row.ma} aria-selected={active === index} tabIndex={-1} onMouseDown={event => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(row)}><span><strong>{row.ten}</strong><small>{row.kyHieu} · {row.tenHocKy}</small></span><span className="course-suggestion-credits">{row.soTinChi} tín chỉ</span></button>)}
      </div>
      {!waiting && !error && !rows.length && <p className="course-suggestions-message">Chưa có môn phù hợp. Bạn có thể tiếp tục tự nhập.</p>}
      {matching && rows.length < matching.total && <button type="button" className="course-suggestions-more" disabled={waiting} onMouseDown={event => event.preventDefault()} onClick={() => { setLoading(true); setPage(matching.page + 1) }}>Xem thêm môn học</button>}
    </div>}
  </div>
}
