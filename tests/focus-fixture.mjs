export function createFocusFixture({ tasks, sessions, revision, bump, zone }) {
  const records = []
  const timeEdits = new Map()
  const controls = { failStatistics: false }
  let sequence = 1, offset = 0
  const now = () => Date.now() + offset
  const iso = n => new Date(n).toISOString()
  const active = () => records.find(r => ['Running', 'Paused'].includes(r.trangThai)) ?? null
  const elapsed = r => Math.min(r.cheDo === 'Pomodoro' ? r.mucTieuGiay * 1000 : Infinity,
    r.soMiliGiayDaHoc + (r.batDauDoan ? Math.max(0, now() - Date.parse(r.batDauDoan)) : 0))
  const envelope = duLieu => ({ status: 200, response: { phienBan: revision(), duLieu } })
  const failed = detail => ({ status: 409, response: { detail, code: 'FOCUS_STATE_CONFLICT' } })
  const day = date => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(date))
  function close(r, end = now()) {
    r.soMiliGiayDaHoc = elapsed(r); r.batDauDoan = null; r.ketThuc = iso(end); r.trangThai = 'Completed'
    const planned = sessions().find(s => s.ma === r.maPhienTuHoc)
    if (planned) { planned.trangThai = 'Completed'; planned.batDauBamGio = null; planned.soGiayDaHoc = Math.floor(r.soMiliGiayDaHoc / 1000) }
    bump()
  }
  return { records, active, controls, advance(ms) { offset += ms }, handle(url, method, body) {
    const route = url.pathname.replace('/api/v1', '')
    if (!route.startsWith('/focus/')) return null
    const current = active()
    if (current?.cheDo === 'Pomodoro' && current.trangThai === 'Running' && elapsed(current) >= current.mucTieuGiay * 1000) close(current)
    if (route === '/focus/statistics' || /^\/focus\/tasks\/\d+\/summary$/.test(route)) {
      if (controls.failStatistics && route === '/focus/statistics') return { status: 503, response: { detail: 'Thống kê tạm gián đoạn.' } }
      const history = records.filter(r => r.trangThai === 'Completed')
      const totals = rows => ({ soPhien: rows.length, soPomodoro: rows.reduce((n, r) => n + (r.cheDo === 'Pomodoro' ? Math.floor(r.soMiliGiayDaHoc / (r.mucTieuGiay * 1000)) : 0), 0), tongMiliGiay: rows.reduce((n, r) => n + r.soMiliGiayDaHoc, 0) })
      if (route !== '/focus/statistics') {
        const id = Number(route.split('/')[3])
        if (!tasks.some(task => task.ma === id)) return { status: 404, response: { detail: 'Không tìm thấy nhiệm vụ.' } }
        return envelope(totals(history.filter(row => row.maNhiemVu === id)))
      }
      const count = Number(url.searchParams.get('soNgay') ?? 7), end = url.searchParams.get('ngay') ?? day(now())
      const addDay = (value, delta) => new Date(Date.parse(value + 'T12:00Z') + delta * 86400000).toISOString().slice(0, 10)
      const from = addDay(end, 1 - count)
      const chosen = history.filter(row => day(row.ketThuc) >= from && day(row.ketThuc) <= end)
      const byTask = new Map()
      for (const row of chosen) {
        const key = row.maNhiemVu == null ? 'free:' + row.tieuDe : String(row.maNhiemVu)
        byTask.set(key, [...(byTask.get(key) ?? []), row])
      }
      return envelope({ tuNgay: from, denNgay: end, muiGio: zone, tongHop: totals(chosen),
        theoNgay: Array.from({ length: count }, (_, i) => { const date = addDay(from, i); return { ngay: date, ...totals(chosen.filter(row => day(row.ketThuc) === date)) } }),
        theoNhiemVu: [...byTask.values()].map(rows => ({ maNhiemVu: rows[0].maNhiemVu, tieuDe: rows[0].tieuDe, ...totals(rows) })).sort((a, b) => b.tongMiliGiay - a.tongMiliGiay) })
    }
    if (route === '/focus/state') {
      const history = records.filter(r => r.trangThai === 'Completed').sort((a, b) => Date.parse(b.batDau) - Date.parse(a.batDau))
      const today = history.filter(r => day(r.ketThuc) === day(now()))
      const count = rows => rows.reduce((n, r) => n + (r.cheDo === 'Pomodoro' ? Math.floor(r.soMiliGiayDaHoc / (r.mucTieuGiay * 1000)) : 0), 0)
      const page = Number(url.searchParams.get('trang') ?? 1)
      return envelope({ hienTai: active(), lichSu: history.slice((page - 1) * 20, page * 20), tongQuan: { pomoHomNay: count(today), miliGiayHomNay: today.reduce((s, r) => s + r.soMiliGiayDaHoc, 0), tongPomo: count(history), tongMiliGiay: history.reduce((s, r) => s + r.soMiliGiayDaHoc, 0) }, trang: page, tongSo: history.length, thoiDiemMayChu: iso(now()), muiGio: zone })
    }
    if (route === '/focus/start') {
      if (active()) return envelope(active())
      const planned = sessions().find(s => s.ma === body.maPhienTuHoc)
      const task = tasks.find(t => t.ma === (planned?.maNhiemVu ?? body.maNhiemVu))
      const row = { ma: sequence++, maNhiemVu: task?.ma ?? null, maPhienTuHoc: planned?.ma ?? null, tieuDe: task?.tieuDe ?? 'Tập trung tự do', cheDo: body.cheDo, mucTieuGiay: body.mucTieuGiay, trangThai: 'Running', soMiliGiayDaHoc: 0, batDau: iso(now()), batDauDoan: iso(now()), ketThuc: null, ghiChu: null, nhapThuCong: false }
      if (planned) { planned.trangThai = 'InProgress'; planned.batDauBamGio = row.batDauDoan; planned.soGiayDaHoc = 0 }
      records.push(row); bump(); return envelope(row)
    }
    if (route === '/focus/records') {
      const start = Date.parse(body.batDau), end = Date.parse(body.ketThuc)
      if (end <= start || end > now()) return failed('Khoảng thời gian không hợp lệ.')
      if (records.some(r => r.trangThai !== 'Discarded' && Date.parse(r.batDau) < end && (!r.ketThuc || Date.parse(r.ketThuc) > start))) return failed('Khoảng nhập trùng với thời gian đã ghi.')
      const task = tasks.find(t => t.ma === body.maNhiemVu)
      const row = { ma: sequence++, maNhiemVu: task?.ma ?? null, maPhienTuHoc: null, tieuDe: task?.tieuDe ?? 'Tập trung tự do', cheDo: body.cheDo, mucTieuGiay: body.mucTieuGiay, trangThai: 'Completed', soMiliGiayDaHoc: end - start, batDau: body.batDau, batDauDoan: null, ketThuc: body.ketThuc, ghiChu: body.ghiChu, nhapThuCong: true }
      records.push(row); bump(); return envelope(row)
    }
    const timeRecord = route.match(/^\/focus\/(\d+)\/time$/)
    if (timeRecord) {
      const row = records.find(r => r.ma === Number(timeRecord[1]) && r.trangThai === 'Completed')
      if (!row) return failed('Không tìm thấy bản ghi đã lưu.')
      const history = timeEdits.get(row.ma) ?? []
      const snapshot = () => ({ batDau: row.batDau, ketThuc: row.ketThuc, soMiliGiayDaHoc: row.soMiliGiayDaHoc })
      if (method === 'PUT') {
        const start = Date.parse(body.batDau), end = Date.parse(body.ketThuc)
        if (end <= start || end > now()) return { status: 400, response: { detail: 'Khoảng thời gian không hợp lệ.' } }
        const before = snapshot()
        Object.assign(row, { batDau: body.batDau, ketThuc: body.ketThuc, soMiliGiayDaHoc: end - start })
        history.push({ suaLuc: iso(now()), truoc: before, sau: snapshot() })
        timeEdits.set(row.ma, history)
        const planned = sessions().find(s => s.ma === row.maPhienTuHoc)
        if (planned) planned.soGiayDaHoc = Math.floor(row.soMiliGiayDaHoc / 1000)
        bump()
      }
      return envelope({ banGhi: row, canNhapThoiLuong: false, lichSu: history })
    }
    const match = route.match(/^\/focus\/(\d+)\/(pause|resume|finish|note|discard)$/)
    const row = match && records.find(r => r.ma === Number(match[1]))
    if (!row) return failed('Không tìm thấy phiên.')
    row.ghiChu = body.ghiChu || null
    switch (match[2]) {
      case 'pause': if (row.trangThai === 'Running') { row.soMiliGiayDaHoc = elapsed(row); row.batDauDoan = null; row.trangThai = 'Paused' }; break
      case 'resume': if (row.trangThai === 'Paused') { row.batDauDoan = iso(now()); row.trangThai = 'Running' }; break
      case 'finish': if (row.trangThai !== 'Completed') close(row); break
      case 'discard': row.trangThai = 'Discarded'; row.batDauDoan = null; row.ketThuc = iso(now()); row.soMiliGiayDaHoc = 0; break
    }
    bump(); return envelope(row)
  } }
}
