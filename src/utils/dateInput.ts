export function displayDate(value: string) {
  return value ? value.split('-').reverse().join('/') : ''
}

export function parseDate(value: string): string | null {
  if (!value) return ''
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(0)
  date.setFullYear(Number(year), Number(month) - 1, Number(day))
  if (Number(year) < 1 || date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}
