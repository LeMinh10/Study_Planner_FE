import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type { AuthCredentials, AuthUser, ChangePasswordInput } from '../types/auth'
import type { Profile } from '../types/planner'
import { clearAuthCredentials, readAuthCredentials, saveAuthCredentials } from '../auth/session'
import { changeCurrentPassword, getCurrentUser, loginAccount, registerStudent, updateCurrentUser } from '../api/auth'
import { ApiError, SESSION_INVALID_EVENT } from '../api/client'
import { clearDemoSession, readDemoSession, saveDemoSession, tryDemoLogin } from '../auth/demo'
import { useMockApi } from '../api/config'

interface AuthState {
  credentials: AuthCredentials | null
  user: AuthUser | null
  isDemo: boolean
  status: AuthContextValue['status']
  notice: string
  error: string
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const credentials = readAuthCredentials()
    const demoUser = !useMockApi && !credentials ? readDemoSession() : null
    return { credentials, user: demoUser, isDemo: !!demoUser, status: credentials ? 'loading' : demoUser ? 'authenticated' : 'anonymous', notice: '', error: '' }
  })
  const version = useRef(0)

  const endSession = useCallback((notice = '') => {
    version.current++
    clearAuthCredentials()
    clearDemoSession()
    setState({ credentials: null, user: null, isDemo: false, status: 'anonymous', notice, error: '' })
  }, [])

  useEffect(() => {
    if (state.status !== 'loading' || !state.credentials) return
    const controller = new AbortController()
    const credentials = state.credentials
    const currentVersion = version.current
    getCurrentUser(credentials.token, controller.signal).then((user) => {
      if (!controller.signal.aborted && version.current === currentVersion) setState({ credentials, user, isDemo: useMockApi, status: 'authenticated', notice: '', error: '' })
    }).catch((error: unknown) => {
      if (controller.signal.aborted || version.current !== currentVersion) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) endSession(error.message)
      else setState({ credentials, user: null, isDemo: false, status: 'error', notice: '', error: error instanceof Error ? error.message : 'Không tải được thông tin tài khoản.' })
    })
    return () => controller.abort()
  }, [state.status, state.credentials, endSession])

  useEffect(() => {
    const credentials = state.credentials
    if (!credentials) return
    let timer: ReturnType<typeof setTimeout>
    function checkExpiry() {
      const remaining = credentials!.expiresAt - Date.now()
      if (remaining <= 0) endSession('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      else timer = setTimeout(checkExpiry, Math.min(remaining, 2147483647))
    }
    function onInvalid(event: Event) {
      if ((event as CustomEvent<{ token: string }>).detail.token === credentials!.token) endSession('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.')
    }
    checkExpiry()
    window.addEventListener(SESSION_INVALID_EVENT, onInvalid)
    return () => { clearTimeout(timer); window.removeEventListener(SESSION_INVALID_EVENT, onInvalid) }
  }, [state.credentials, endSession])

  async function login(taiKhoan: string, password: string, role: 'sinhvien' | 'admin') {
    const currentVersion = ++version.current
    const demoUser = useMockApi ? null : tryDemoLogin(taiKhoan, password, role)
    if (demoUser) {
      clearAuthCredentials()
      saveDemoSession(demoUser.role)
      setState({ credentials: null, user: demoUser, isDemo: true, status: 'authenticated', notice: '', error: '' })
      return
    }
    const session = await loginAccount(taiKhoan, password, role)
    if (currentVersion !== version.current) throw new ApiError('Yêu cầu đăng nhập đã bị hủy. Vui lòng thử lại.')
    const credentials = { token: session.token, expiresAt: session.expiresAt }
    clearDemoSession()
    saveAuthCredentials(credentials)
    setState({ credentials, user: session.user, isDemo: useMockApi, status: 'authenticated', notice: '', error: '' })
  }
  function requireSession() {
    const current = state
    if (current.isDemo && !current.credentials) throw new ApiError('Tài khoản mẫu chỉ dùng để xem giao diện. Vui lòng đăng nhập tài khoản đã đăng ký để lưu hồ sơ hoặc đổi mật khẩu.')
    if (current.status !== 'authenticated' || !current.credentials || current.credentials.expiresAt <= Date.now()) {
      endSession('Vui lòng đăng nhập lại để tiếp tục.')
      throw new ApiError('Vui lòng đăng nhập lại để tiếp tục.', 401)
    }
    return current.credentials.token
  }
  async function saveProfile(profile: Profile) {
    const token = requireSession()
    const currentVersion = version.current
    const user = await updateCurrentUser(token, profile)
    if (currentVersion === version.current) setState((previous) => ({ ...previous, user }))
  }
  async function changePassword(input: ChangePasswordInput) {
    const token = requireSession()
    const currentVersion = version.current
    await changeCurrentPassword(token, input)
    if (currentVersion === version.current) endSession('Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.')
  }

  return <AuthContext.Provider value={{ user: state.user, isDemo: state.isDemo, status: state.status, notice: state.notice, error: state.error, login, register: registerStudent, saveProfile, changePassword, getAccessToken: requireSession, logout: () => endSession(), retry: () => setState((previous) => ({ ...previous, status: previous.credentials ? 'loading' : 'anonymous', error: '' })) }}>{children}</AuthContext.Provider>
}
