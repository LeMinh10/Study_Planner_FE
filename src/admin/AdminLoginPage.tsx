import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { useAuth } from '../contexts/AuthContext'

export function AdminLoginPage({ onLogin }: { onLogin: (taiKhoan: string, password: string) => Promise<void> }) {
  const { notice, status } = useAuth()
  const [taiKhoan, setTaiKhoan] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    if (!taiKhoan.trim()) { setError('Vui lòng nhập tài khoản quản trị.'); return }
    if (!event.currentTarget.reportValidity()) return
    setPending(true)
    try { await onLogin(taiKhoan, password) }
    catch (error) { setError(error instanceof Error ? error.message : 'Không đăng nhập được. Vui lòng thử lại.') }
    finally { setPending(false) }
  }

  return <div className="auth-page admin-login-page">
    <main className="auth-main">
      <div className="auth-form-container">
        <div className="brand"><span className="brand-mark"><Icon name="book" size={30} /></span><span className="brand-wordmark">study<span>planner</span><i>.</i></span></div>
        <span className="admin-label">KHU VỰC QUẢN TRỊ</span>
        <h1>Đăng nhập admin</h1>
        <p>Quản lý tài khoản sinh viên trên Study Planner.</p>
        {status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <form className="session-form" onSubmit={submit} noValidate aria-busy={pending}>
          <fieldset className="form-fields" disabled={pending || status === 'loading'}>
            <label>Tài khoản quản trị<input name="taiKhoan" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Nhập email hoặc MSSV" maxLength={320} required value={taiKhoan} onChange={(event) => { setTaiKhoan(event.target.value); setError('') }} /></label>
            <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" maxLength={128} required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary auth-submit">{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          </fieldset>
        </form>
      </div>
    </main>
  </div>
}
