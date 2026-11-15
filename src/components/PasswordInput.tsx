import { useId, useState, type ComponentProps } from 'react'
import { Icon } from './Icon'
import './PasswordInput.css'

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'> & { passwordLabel?: string }

export function PasswordInput({ passwordLabel = 'mật khẩu', id, ...props }: PasswordInputProps) {
  const generatedId = useId()
  const [visible, setVisible] = useState(false)
  const inputId = id ?? generatedId
  return <span className="password-input">
    <input {...props} id={inputId} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle" aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${passwordLabel}`} title={`${visible ? 'Ẩn' : 'Hiện'} ${passwordLabel}`} aria-controls={inputId} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible((previous) => !previous)}><Icon name={visible ? 'eye-off' : 'eye'} size={20} /></button>
  </span>
}
