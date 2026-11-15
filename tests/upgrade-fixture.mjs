export function createPlanningUpgradeFixture({ envelope, bump, tasks, windows, addWindows, sessions, addSessions }) {
  let settings = { phienHocPhut: 25, nghiGiuaPhienPhut: 5, gioiHanHocMoiNgayPhut: 180 }
  let reminders = false, counter = 1, reminderHours = 24
  const controls = { failSettings: false }
  const reminderRows = []
  const exceptions = new Map(), previews = new Map(), applied = new Map()
  const ok = (data, status = 200) => ({ status, response: envelope(data) })
  return { controls, handle(url, method, body, headers) {
    const route = url.pathname.replace('/api/v1', '')
    if (route === '/notifications/settings') {
      if (method === 'PUT') {
        if (controls.failSettings) { controls.failSettings = false; return { status: 503, response: { detail: 'Chưa lưu được thiết lập. Hãy thử lại.' } } }
        reminderHours = body.nhacTruocGio; reminders = body.nhacKeHoach; bump()
      }
      return ok({ nhacTruocGio: reminderHours, nhacKeHoach: reminders })
    }
    if (route === '/study-settings') {
      if (method === 'PUT') {
        if (body.phienHocPhut < 15 || body.phienHocPhut > 50 || body.nghiGiuaPhienPhut < 1 || body.nghiGiuaPhienPhut > 30)
          return { status: 400, response: { code: 'VALIDATION_ERROR', detail: 'Cấu hình học không hợp lệ.' } }
        settings = { ...body }; bump()
      }
      return ok(settings)
    }
    if (route === '/planning-reminders/settings') { if (method === 'PUT') { reminders = body.dangBat; bump() }; return ok({ dangBat: reminders }) }
    if (route === '/planning-reminders') {
      if (reminders && !reminderRows.length) {
        const now = new Date().toISOString()
        reminderRows.push({ ma: 1, loai: 'WeeklyReview', tieuDe: 'Rà soát kế hoạch tuần này', noiDung: 'Kiểm tra nhiệm vụ và giờ rảnh tuần này.', duongDan: '/tasks?tab=planning', ngayPhat: now, ngayDoc: null },
          { ma: 2, loai: 'AvailabilityExpiring', tieuDe: 'Giờ rảnh sắp hết hiệu lực', noiDung: 'Có 5 mẫu giờ rảnh sắp hết hạn.', duongDan: '/tasks?tab=free', ngayPhat: now, ngayDoc: null })
      }
      const rows = url.searchParams.get('chuaDoc') === 'true' ? reminderRows.filter(row => !row.ngayDoc) : reminderRows
      return ok({ danhSach: rows, tongSo: rows.length, tongChuaDoc: reminderRows.filter(row => !row.ngayDoc).length, trang: 1, kichThuocTrang: 10, muiGio: 'Asia/Ho_Chi_Minh', docDenLuc: new Date().toISOString() })
    }
    if (route === '/planning-reminders/read-all' || /^\/planning-reminders\/\d+\/read$/.test(route)) {
      for (const row of reminderRows) if (route.endsWith('read-all') || row.ma === Number(route.split('/')[2])) row.ngayDoc ??= new Date().toISOString()
      return { status: 204 }
    }
    if (route === '/availability-windows/batch') {
      let next = Math.max(7, ...windows().map(row => row.ma)) + 1
      const rows = body.thuTrongTuan.map(day => ({ ...body, thuTrongTuan: day, ma: next++ }))
      addWindows(rows); bump(); return ok(rows, 201)
    }
    const exception = route.match(/^\/availability-windows\/(\d+)\/exceptions(?:\/(.*))?$/)
    if (exception) {
      const id = Number(exception[1]), suffix = exception[2]
      if (suffix === 'change-preview') return ok({ phienBiAnhHuong: [], lichHocTrung: [], canKetThucPhienDangHoc: false })
      if (method === 'GET') return ok([...exceptions.values()].filter(row => row.maKhungGioRanh === id))
      const key = id + ':' + suffix
      if (method === 'DELETE') { exceptions.delete(key); bump(); return { status: 204 } }
      exceptions.set(key, { ...body, ngay: suffix, maKhungGioRanh: id }); bump(); return ok({ phienBiAnhHuong: [], lichHocTrung: [], canKetThucPhienDangHoc: false })
    }
    if (!process.env.CORE_PLANNING_ONLY) return null
    if (route === '/planning/preview') {
      const ids = body.danhSachMaNhiemVu?.length ? body.danhSachMaNhiemVu : [4]
      const task = tasks.find(task => ids.includes(task.ma) && !task.coNhiemVuCon) ?? tasks.find(task => task.ma === 4)
      const from = body.ngayBatDau || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      const start = from + 'T12:00:00Z'
      const end = new Date(Date.parse(start) + settings.phienHocPhut * 60000).toISOString()
      const replacements = body.capNhatKeHoach ? sessions().filter(row => row.trangThai === 'Planned' && row.maNhiemVu === task.ma).map(row => row.ma) : []
      const row = { tokenPreview: 'upgrade-' + counter++, muiGio: 'Asia/Ho_Chi_Minh', hetHanLuc: new Date(Date.now() + 600000).toISOString(),
        tongPhutCanXep: settings.phienHocPhut, tongPhutDaDat: 0, tongPhutDeXuat: settings.phienHocPhut, tongPhutChuaXep: 0, canhBao: [],
        cauHinhHoc: settings, maPhienThayThe: replacements, phien: [{ maNhiemVu: task.ma, tieuDe: task.tieuDe, batDauDuKien: start, ketThucDuKien: end, lyDo: 'Theo cấu hình học' }] }
      previews.set(row.tokenPreview, row); return ok(row)
    }
    if (route === '/planning/apply') {
      const key = Object.entries(headers).find(([key]) => key.toLowerCase() === 'idempotency-key')?.[1]
      if (applied.has(key)) return ok(applied.get(key))
      const preview = previews.get(body.tokenPreview)
      for (const row of sessions()) if (preview.maPhienThayThe.includes(row.ma)) row.trangThai = 'Cancelled'
      const base = Math.max(19, ...sessions().map(row => row.ma)) + 1
      const rows = body.phien.map((row, index) => ({ ...row, ma: base + index, maLanApDung: base, trangThai: 'Planned', ghiChu: null }))
      addSessions(rows); bump(); const result = { maLanApDung: base, phien: rows }; applied.set(key, result); return ok(result)
    }
    return null
  } }
}
