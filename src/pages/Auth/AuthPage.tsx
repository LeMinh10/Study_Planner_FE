import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { usePlanner } from '../../contexts/PlannerContext'

export function AuthPage({ register = false }: { register?: boolean }) {
  const { loginDemo } = usePlanner()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (register) return
    setError('')
    if (!event.currentTarget.reportValidity()) return
    if (!loginDemo(email, password)) {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
      return
    }
    navigate('/tasks', { replace: true })
  }
  return <div className="auth-page">
    <main className="auth-main">
      <div className="auth-form-container">
        <Link to="/" className="brand">Study Planner</Link>
        <h1>{register ? 'Đăng ký' : 'Đăng nhập'}</h1>
        <form className="session-form" onSubmit={submit} noValidate>
          <fieldset className="form-fields">
            {register && <label>Họ và tên<input name="name" autoComplete="name" maxLength={100} required /></label>}
            <label>Email<input name="email" type="email" autoComplete="email" placeholder="ban@example.com" maxLength={150} required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} /></label>
            <label>Mật khẩu<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={6} maxLength={128} placeholder="Tối thiểu 6 ký tự" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} /></label>
            {register && <label>Nhập lại mật khẩu<input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary auth-submit">{register ? 'Đăng ký' : 'Đăng nhập'}<Icon name="arrow-right" size={17} /></button>
          </fieldset>
        </form>
        <p className="auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <Link to={register ? '/login' : '/register'}>{register ? 'Đăng nhập' : 'Đăng ký'}</Link></p>
      </div>
    </main>
  </div>
}
