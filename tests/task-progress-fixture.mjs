// Giả lập HTTP để kiểm tra thao tác trình duyệt; CoreChecks kiểm chứng việc lưu dữ liệu và hoàn tác giao dịch thật.
export function createTaskProgressFixture({ tasks, makeTask, nextId, envelope, bump }) {
  function normalize(rows = tasks, previousParents = new Set()) {
    const children = new Map(rows.map(task => [task.ma, rows.filter(child => child.maNhiemVuCha === task.ma)]))
    const visited = new Set()
    function visit(task) {
      if (visited.has(task.ma)) return
      const direct = children.get(task.ma)
      direct.forEach(visit)
      task.coNhiemVuCon = direct.length > 0
      if (direct.length) { task.tienDo = Math.floor(direct.reduce((sum, child) => sum + child.tienDo, 0) / direct.length); task.thoiLuongDuKienPhut = null }
      else if (previousParents.has(task.ma)) task.tienDo = 0
      else if (task.checklist?.length) task.tienDo = Math.floor(task.checklist.filter(item => item.daXong).length * 100 / task.checklist.length)
      task.trangThai = task.tienDo === 100 ? 'Completed' : task.tienDo > 0 ? 'InProgress' : 'NotStarted'
      task.ngayHoanThanh = task.tienDo === 100 ? task.ngayHoanThanh ?? new Date().toISOString() : null
      visited.add(task.ma)
    }
    rows.forEach(visit)
  }
  function apply(rows, id, action, body, newId) {
    const target = rows.find(task => task.ma === id)
    const previousParents = new Set(rows.filter(task => task.coNhiemVuCon).map(task => task.ma))
    const before = new Map(rows.map(task => [task.ma, task.trangThai]))
    const impact = { maPhienBiHuy: [], phienBiAnhHuong: [], maNhiemVuMoLai: [], maChecklistChuyenThanhBuoc: [], maTienDoChuyenThanhBuoc: [] }
    const added = []
    function preserve(parent) {
      if (rows.some(child => child.maNhiemVuCha === parent.ma)) return
      const hasChecklist = !!parent.checklist?.length
      if (!hasChecklist && !parent.tienDo) return
      const child = makeTask(newId(), { maHocKy: parent.maHocKy, maMonHoc: parent.maMonHoc, maNhiemVuCha: parent.ma,
        tieuDe: hasChecklist ? 'Công việc chung' : 'Nhiệm vụ đã bắt đầu', tienDo: parent.tienDo, checklist: structuredClone(parent.checklist ?? []),
        thoiLuongDuKienPhut: parent.thoiLuongDuKienPhut })
      rows.push(child); added.push(child); parent.checklist = []
      impact[hasChecklist ? 'maChecklistChuyenThanhBuoc' : 'maTienDoChuyenThanhBuoc'].push(parent.ma)
    }
    if (action === 'children') {
      preserve(target)
      for (const item of body.danhSach) {
        const child = makeTask(newId(), { ...item, maHocKy: target.maHocKy, maMonHoc: target.maMonHoc, maNhiemVuCha: target.ma })
        rows.push(child); added.push(child)
      }
    } else if (action === 'parent' && target.maNhiemVuCha !== body.maNhiemVuCha) {
      if (body.maNhiemVuCha != null) preserve(rows.find(task => task.ma === body.maNhiemVuCha))
      target.maNhiemVuCha = body.maNhiemVuCha
    }
    normalize(rows, previousParents)
    impact.maNhiemVuMoLai = rows.filter(task => before.get(task.ma) === 'Completed' && task.trangThai !== 'Completed').map(task => task.ma)
    return { impact, added, target }
  }
  return { normalize, handle(route, method, body) {
    const match = route.match(/^\/tasks\/(\d+)\/(change-preview|children|parent|progress|complete|reopen)$/)
    if (!match || method === 'GET') return null
    const id = Number(match[1]), action = match[2]
    const task = tasks.find(row => row.ma === id)
    if (['progress', 'complete', 'reopen'].includes(action) && task.coNhiemVuCon)
      return { status: 409, response: { code: 'TASK_PROGRESS_IS_DERIVED', detail: 'Tiến độ được tổng hợp từ các bước con.' } }
    const operation = action === 'change-preview' ? body.thaoTac : action
    if (!['children', 'parent'].includes(operation)) return action === 'change-preview' ? { status: 200, response: envelope({ maPhienBiHuy: [], phienBiAnhHuong: [], maNhiemVuMoLai: [], maChecklistChuyenThanhBuoc: [], maTienDoChuyenThanhBuoc: [] }) } : null
    let temporary = -1
    const simulated = apply(structuredClone(tasks), id, operation, action === 'change-preview' ? body.noiDung : body, () => temporary--)
    if (action === 'change-preview') return { status: 200, response: envelope(simulated.impact) }
    if (!body.xacNhanDoiCauTruc && ['maNhiemVuMoLai', 'maChecklistChuyenThanhBuoc', 'maTienDoChuyenThanhBuoc'].some(key => simulated.impact[key].length))
      return { status: 409, response: { code: 'TASK_STRUCTURE_CONFIRMATION_REQUIRED', detail: 'Cần xác nhận thay đổi cấu trúc.', details: { anhHuong: simulated.impact } } }
    const saved = apply(tasks, id, operation, body, nextId); bump()
    return { status: action === 'children' ? 201 : 200, response: envelope(action === 'children' ? saved.added : saved.target) }
  } }
}
