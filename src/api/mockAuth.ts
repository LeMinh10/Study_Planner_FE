// Local account simulation for frontend development. These tokens are accepted
// only by this adapter; they do not authenticate against a real backend.
import { demoStudents } from '../admin/studentAccounts'

interface MockUser {
  ma: number
  email: string
  hoTen: string
  maSinhVien: string
  tenTruong: string
  tenLop: string
  nganhHoc: string
  vaiTro: 'Student' | 'Admin'
  dangHoatDong: boolean
  muiGio: string
  nhacTruocGio: number
  ngayTao: string
  ngayCapNhat: string
}
interface MockAccount { user: MockUser; salt: string; passwordHash: string }
interface MockSession { token: string; accountId: number; expiresAt: number }
interface MockDatabase { version: 1; nextId: number; accounts: MockAccount[]; sessions: MockSession[]; adminSeedVersion?: number }
interface MockRequest { method?: string; body?: unknown; token?: string; signal?: AbortSignal }

const STORAGE_KEY = 'studyplanner.mock-auth.v1'
const encoder = new TextEncoder()
let memoryDatabase: MockDatabase | null = null
let requestQueue: Promise<void> = Promise.resolve()

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function randomHex() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('') }
async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256)
  return Array.from(new Uint8Array(bits), (value) => value.toString(16).padStart(2, '0')).join('')
}
function json(status: number, payload?: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
function failure(status: number, thongBao: string, code = '', errors?: Record<string, string[]>) { return json(status, { thongBao, code, ...(errors ? { errors } : {}) }) }
function publicUser(account: MockAccount) { return { ...account.user } }
function saveDatabase(database: MockDatabase) {
  memoryDatabase = database
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(database)) } catch { /* The current tab can still use the in-memory data. */ }
}
function storedDatabase(): MockDatabase | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const value = object(JSON.parse(stored))
    if (value.version !== 1 || !Number.isInteger(value.nextId) || !Array.isArray(value.accounts) || !Array.isArray(value.sessions)) return null
    if (!value.accounts.every((item) => {
      const account = object(item), user = object(account.user)
      return typeof account.salt === 'string' && typeof account.passwordHash === 'string' && typeof user.ma === 'number' &&
        ['email', 'hoTen', 'maSinhVien', 'tenTruong', 'tenLop', 'nganhHoc', 'ngayTao', 'ngayCapNhat'].every((key) => typeof user[key] === 'string') &&
        ['Student', 'Admin'].includes(String(user.vaiTro)) && typeof user.dangHoatDong === 'boolean'
    })) return null
    if (!value.sessions.every((item) => { const session = object(item); return typeof session.token === 'string' && typeof session.accountId === 'number' && typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt) })) return null
    return value as unknown as MockDatabase
  } catch { return memoryDatabase }
}
async function database() {
  const saved = storedDatabase()
  if (saved) return addAdminSeeds(saved)
  const now = new Date().toISOString()
  const users: MockUser[] = [
    { ma: 1, email: 'demo@studyplanner.vn', hoTen: 'Sinh viên mẫu', maSinhVien: 'SVDEMO001', tenTruong: 'Cao đẳng Kỹ Thuật Cao Thắng', tenLop: 'CDTH23WEBC', nganhHoc: 'Công nghệ thông tin', vaiTro: 'Student', dangHoatDong: true, muiGio: 'Asia/Ho_Chi_Minh', nhacTruocGio: 24, ngayTao: now, ngayCapNhat: now },
    { ma: 2, email: 'admin@studyplanner.vn', hoTen: 'Quản trị viên', maSinhVien: '', tenTruong: '', tenLop: '', nganhHoc: '', vaiTro: 'Admin', dangHoatDong: true, muiGio: 'Asia/Ho_Chi_Minh', nhacTruocGio: 24, ngayTao: now, ngayCapNhat: now },
  ]
  const accounts = await Promise.all(users.map(async (user) => { const salt = randomHex(); return { user, salt, passwordHash: await hashPassword('123456', salt) } }))
  const initial: MockDatabase = { version: 1, nextId: 3, accounts, sessions: [] }
  return addAdminSeeds(initial)
}
async function addAdminSeeds(data: MockDatabase) {
  if (data.adminSeedVersion === 1) return data
  const now = new Date().toISOString()
  const candidates = [
    ...demoStudents.map((student) => ({
      email: student.email, hoTen: student.name, maSinhVien: student.studentId, tenTruong: student.schoolName, tenLop: student.className,
      nganhHoc: 'Công nghệ thông tin', vaiTro: 'Student' as const, dangHoatDong: student.status === 'active', ngayTao: student.createdAt, password: '123456',
    })),
    { email: 'admin@caothang.edu.vn', hoTen: 'Quản trị viên', maSinhVien: '', tenTruong: '', tenLop: '', nganhHoc: '', vaiTro: 'Admin' as const, dangHoatDong: true, ngayTao: now, password: '0306231303' },
  ]
  data.nextId = Math.max(data.nextId, ...data.accounts.map((account) => account.user.ma + 1))
  for (const candidate of candidates) {
    const exists = data.accounts.some(({ user }) => user.email.toLowerCase() === candidate.email.toLowerCase() || (candidate.maSinhVien && user.maSinhVien.toLowerCase() === candidate.maSinhVien.toLowerCase()))
    if (exists) continue
    const salt = randomHex()
    const { password, ...profile } = candidate
    data.accounts.push({ user: { ...profile, ma: data.nextId++, muiGio: 'Asia/Ho_Chi_Minh', nhacTruocGio: 24, ngayCapNhat: profile.ngayTao }, salt, passwordHash: await hashPassword(password, salt) })
  }
  data.adminSeedVersion = 1
  saveDatabase(data)
  return data
}
function abortIfNeeded(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Yêu cầu đã bị hủy.', 'AbortError') }
function requiredFields(body: Record<string, unknown>, fields: [string, string, number][]) {
  const errors: Record<string, string[]> = {}
  for (const [key, label, maxLength] of fields) {
    const value = body[key]
    if (typeof value !== 'string' || !value.trim()) errors[key] = [`Vui lòng nhập ${label}.`]
    else if (value.length > maxLength) errors[key] = [`${label} không được dài quá ${maxLength} ký tự.`]
  }
  return errors
}
const registrationFields: [string, string, number][] = [
  ['hoTen', 'họ và tên', 100], ['email', 'email', 150], ['maSinhVien', 'MSSV', 40],
  ['tenTruong', 'tên trường', 150], ['tenLop', 'tên lớp', 100], ['nganhHoc', 'ngành học', 120],
]
function passwordError(value: unknown) {
  return typeof value !== 'string' || !value.trim() || value.length < 6 || value.length > 128 ? 'Mật khẩu cần từ 6 đến 128 ký tự.' : ''
}
function base64Json(value: unknown) {
  const binary = Array.from(encoder.encode(JSON.stringify(value)), (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function makeSession(account: MockAccount): MockSession {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = (now + 3600) * 1000
  const token = [base64Json({ alg: 'MOCK', typ: 'JWT' }), base64Json({ iss: 'studyplanner-local-mock', sub: String(account.user.ma), role: account.user.vaiTro, iat: now, exp: now + 3600, jti: randomHex() }), randomHex()].join('.')
  return { token, accountId: account.user.ma, expiresAt }
}

async function handle(path: string, request: MockRequest): Promise<Response> {
  const url = new URL(path, 'http://studyplanner.local')
  path = url.pathname
  abortIfNeeded(request.signal)
  const data = await database()
  abortIfNeeded(request.signal)
  const method = (request.method || 'GET').toUpperCase()
  const body = object(request.body)

  if (path === '/auth/register' && method === 'POST') {
    const errors = requiredFields(body, registrationFields)
    if (typeof body.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) errors.email = ['Email chưa đúng định dạng.']
    const invalidPassword = passwordError(body.matKhau)
    if (invalidPassword) errors.matKhau = [invalidPassword]
    if (Object.keys(errors).length) return failure(400, Object.values(errors)[0][0], 'VALIDATION_ERROR', errors)
    const email = (body.email as string).trim().toLowerCase()
    const maSinhVien = (body.maSinhVien as string).trim()
    if (data.accounts.some((account) => account.user.email.toLowerCase() === email)) return failure(409, 'Email đã được sử dụng.', 'EMAIL_EXISTS')
    if (data.accounts.some((account) => account.user.maSinhVien.toLowerCase() === maSinhVien.toLowerCase())) return failure(409, 'MSSV đã được sử dụng.', 'STUDENT_CODE_EXISTS')
    const now = new Date().toISOString(), salt = randomHex()
    const account: MockAccount = {
      user: { ma: data.nextId, email, hoTen: (body.hoTen as string).trim(), maSinhVien, tenTruong: (body.tenTruong as string).trim(), tenLop: (body.tenLop as string).trim(), nganhHoc: (body.nganhHoc as string).trim(), vaiTro: 'Student', dangHoatDong: true, muiGio: 'Asia/Ho_Chi_Minh', nhacTruocGio: 24, ngayTao: now, ngayCapNhat: now },
      salt, passwordHash: await hashPassword(body.matKhau as string, salt),
    }
    abortIfNeeded(request.signal)
    data.accounts.push(account); data.nextId++
    saveDatabase(data)
    return json(201, publicUser(account))
  }
  if (path === '/auth/login' && method === 'POST') {
    const taiKhoan = typeof body.taiKhoan === 'string' ? body.taiKhoan.trim().toLowerCase() : ''
    const account = data.accounts.find((item) => item.user.email.toLowerCase() === taiKhoan || (item.user.maSinhVien && item.user.maSinhVien.toLowerCase() === taiKhoan))
    if (!taiKhoan || !account || typeof body.matKhau !== 'string' || await hashPassword(body.matKhau, account.salt) !== account.passwordHash) return failure(401, 'Tài khoản hoặc mật khẩu không đúng.', 'INVALID_CREDENTIALS')
    if (!account.user.dangHoatDong) return failure(403, 'Tài khoản đã bị vô hiệu hóa.', 'ACCOUNT_DISABLED')
    abortIfNeeded(request.signal)
    const session = makeSession(account)
    data.sessions = data.sessions.filter((item) => item.expiresAt > Date.now())
    data.sessions.push(session); saveDatabase(data)
    return json(200, { tokenTruyCap: session.token, loaiToken: 'Bearer', hetHanLuc: new Date(session.expiresAt).toISOString(), nguoiDung: publicUser(account) })
  }
  const adminRequest = path === '/admin/users' || path.startsWith('/admin/users/')
  if (!['/users/me', '/users/me/change-password'].includes(path) && !adminRequest) return failure(404, 'Không tìm thấy chức năng yêu cầu.')
  const session = data.sessions.find((item) => item.token === request.token && item.expiresAt > Date.now())
  const account = session ? data.accounts.find((item) => item.user.ma === session.accountId) : undefined
  if (!session || !account) return failure(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.', 'INVALID_TOKEN')
  if (!account.user.dangHoatDong) return failure(403, 'Tài khoản đã bị vô hiệu hóa.', 'ACCOUNT_DISABLED')
  if (adminRequest) {
    if (account.user.vaiTro !== 'Admin') return failure(403, 'Bạn không có quyền quản lý người dùng.', 'FORBIDDEN')
    if (path === '/admin/users' && method === 'GET') {
      const numberParameter = (name: string, fallback: number, maximum: number) => {
        const raw = url.searchParams.get(name)
        if (raw === null || raw === '') return fallback
        return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) <= maximum ? Number(raw) : null
      }
      const trang = numberParameter('Trang', 1, 2147483647)
      const kichThuocTrang = numberParameter('KichThuocTrang', 20, 100)
      const activeFilter = url.searchParams.get('DangHoatDong')
      if (trang === null || kichThuocTrang === null || (activeFilter !== null && activeFilter !== '' && !['true', 'false'].includes(activeFilter))) return failure(400, 'Thông tin phân trang hoặc bộ lọc trạng thái chưa hợp lệ.', 'VALIDATION_ERROR')
      const search = (url.searchParams.get('TuKhoa') || '').trim().toLocaleLowerCase('vi')
      const filtered = data.accounts.filter(({ user }) =>
        (!activeFilter || user.dangHoatDong === (activeFilter === 'true')) &&
        (!search || `${user.hoTen} ${user.email} ${user.maSinhVien}`.toLocaleLowerCase('vi').includes(search)),
      ).sort((left, right) => left.user.ma - right.user.ma)
      return json(200, { danhSach: filtered.slice((trang - 1) * kichThuocTrang, trang * kichThuocTrang).map(publicUser), trang, kichThuocTrang, tongSo: filtered.length })
    }
    const targetPath = path.match(/^\/admin\/users\/([1-9]\d*)(?:\/(activate|deactivate))?$/)
    if (!targetPath || Number(targetPath[1]) > 2147483647) return failure(404, 'Không tìm thấy người dùng.', 'USER_NOT_FOUND')
    const target = data.accounts.find((item) => item.user.ma === Number(targetPath[1]))
    if (!target) return failure(404, 'Không tìm thấy người dùng.', 'USER_NOT_FOUND')
    if (!targetPath[2] && method === 'GET') return json(200, publicUser(target))
    if (targetPath[2] && method === 'PATCH') {
      const dangHoatDong = targetPath[2] === 'activate'
      target.user.dangHoatDong = dangHoatDong
      target.user.ngayCapNhat = new Date().toISOString()
      if (!dangHoatDong) data.sessions = data.sessions.filter((item) => item.accountId !== target.user.ma)
      saveDatabase(data)
      return json(200, { thongBao: dangHoatDong ? 'Kích hoạt tài khoản thành công.' : 'Vô hiệu hóa tài khoản thành công.', dangHoatDong })
    }
    return failure(405, 'Phương thức yêu cầu chưa được hỗ trợ.')
  }
  if (path === '/users/me' && method === 'GET') return json(200, publicUser(account))
  if (path === '/users/me' && method === 'PATCH') {
    const fields = registrationFields.filter(([key]) => ['hoTen', 'tenTruong', 'tenLop', 'nganhHoc'].includes(key) && key in body)
    if (!fields.length) return failure(400, 'Vui lòng nhập thông tin hồ sơ cần cập nhật.')
    const errors = requiredFields(body, fields)
    if (Object.keys(errors).length) return failure(400, Object.values(errors)[0][0], 'VALIDATION_ERROR', errors)
    for (const [key] of fields) {
      const editable = key as 'hoTen' | 'tenTruong' | 'tenLop' | 'nganhHoc'
      account.user[editable] = (body[key] as string).trim()
    }
    account.user.ngayCapNhat = new Date().toISOString(); saveDatabase(data)
    return json(200, publicUser(account))
  }
  if (path === '/users/me/change-password' && method === 'POST') {
    if (typeof body.matKhauHienTai !== 'string' || await hashPassword(body.matKhauHienTai, account.salt) !== account.passwordHash) return failure(400, 'Mật khẩu hiện tại không đúng.', 'INCORRECT_PASSWORD')
    const invalidPassword = passwordError(body.matKhauMoi)
    if (invalidPassword) return failure(400, invalidPassword, 'VALIDATION_ERROR', { matKhauMoi: [invalidPassword] })
    const salt = randomHex(), passwordHash = await hashPassword(body.matKhauMoi as string, salt)
    abortIfNeeded(request.signal)
    account.salt = salt; account.passwordHash = passwordHash
    account.user.ngayCapNhat = new Date().toISOString()
    data.sessions = data.sessions.filter((item) => item.accountId !== account.user.ma)
    saveDatabase(data)
    return json(204)
  }
  return failure(405, 'Phương thức yêu cầu chưa được hỗ trợ.')
}

export function mockAuthRequest(path: string, request: MockRequest = {}): Promise<Response> {
  const pending = requestQueue.then(() => handle(path, request))
  requestQueue = pending.then(() => undefined, () => undefined)
  return pending
}
