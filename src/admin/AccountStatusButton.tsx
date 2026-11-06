import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUserActive } from '../api/admin'
import { useAuth } from '../contexts/AuthContext'
import type { ManagedUser } from '../types/admin'

export function AccountStatusButton({ account, onUpdated }: { account: ManagedUser; onUpdated: (message: string) => void }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const mounted = useRef(true)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const activating = account.status !== 'active'
  const label = activating ? 'Kích hoạt' : 'Vô hiệu hóa'
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function updateStatus() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const result = await setUserActive(auth.getAccessToken(), account.id, activating)
      if (!mounted.current) return
      if (!result.isActive && account.email.toLowerCase() === auth.user?.email.toLowerCase()) {
        auth.logout()
        navigate('/admin', { replace: true })
      } else onUpdated(result.message)
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Không cập nhật được trạng thái tài khoản.')
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }

  return <div className="admin-status-action">
    <button type="button" className={'admin-status-button ' + (activating ? 'activate' : 'deactivate')} disabled={pending} onClick={() => void updateStatus()} aria-label={`${label} tài khoản ${account.name}`}>{pending ? 'Đang cập nhật…' : label}</button>
    {error && <p className="admin-action-error" role="alert">{error}</p>}
  </div>
}
