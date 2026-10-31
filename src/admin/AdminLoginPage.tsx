import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'

export function AdminLoginPage({ onLogin }: { onLogin: (email: string, password: string) => boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!event.currentTarget.reportValidity()) return
    if (!onLogin(email, password)) setError('Email hoặc mật khẩu quản trị không đúng. Vui lòng thử lại.')
  }

  return <div className="auth-page admin-login-page">
    <main className="auth-main">
      <div className="auth-form-container">
        <div className="brand"><span className="brand-mark"><Icon name="book" size={30} /></span><span className="brand-wordmark">study<span>planner</span><i>.</i></span></div>
        <span className="admin-label">KHU VỰC QUẢN TRỊ</span>
        <h1>Đăng nhập admin</h1>
        <p>Quản lý tài khoản sinh viên trên Study Planner.</p>
        <form className="session-form" onSubmit={submit} noValidate>
          <fieldset className="form-fields">
            <label>Email quản trị<input name="email" type="email" autoComplete="username" placeholder="Nhập email quản trị" maxLength={150} required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} /></label>
            <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" minLength={6} maxLength={128} required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary auth-submit">Đăng nhập<Icon name="arrow-right" size={17} /></button>
          </fieldset>
        </form>
      </div>
    </main>
  </div>
}
