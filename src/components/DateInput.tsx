import { useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { displayDate, parseDate } from '../utils/dateInput'
import './DateInput.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}

export function DateInput({ value, defaultValue = '', onChange, name, disabled, required, ...props }: Props) {
  const [localValue, setLocalValue] = useState(defaultValue)
  const [draft, setDraft] = useState<{ source: string; text: string } | null>(null)
  const selected = value ?? localValue
  const text = draft?.source === selected ? draft.text : displayDate(selected)
  const field = useRef<HTMLInputElement>(null)

  function update(next: string) {
    setLocalValue(next)
    onChange?.(next)
  }

  return <span className="date-input">
    <input {...props} ref={field} type="text" disabled={disabled} required={required} placeholder="dd/mm/yyyy" inputMode="numeric" maxLength={10} value={text}
      onChange={(event) => {
        const next = parseDate(event.target.value)
        event.target.setCustomValidity(next === null ? 'Nhập ngày hợp lệ theo định dạng dd/mm/yyyy.' : '')
        setDraft({ source: next ?? selected, text: event.target.value })
        if (next !== null) update(next)
      }} onBlur={() => { if (parseDate(text) !== null) setDraft(null) }} />
    <input type="hidden" name={name} value={selected} disabled={disabled} />
    <span className="date-input-picker"><Icon name="calendar" size={16} />
      <input type="date" aria-label="Chọn ngày trên lịch" disabled={disabled} value={selected} onChange={(event) => {
        field.current?.setCustomValidity('')
        setDraft(null)
        update(event.target.value)
      }} />
    </span>
  </span>
}
