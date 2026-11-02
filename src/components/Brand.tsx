import logo from '../assets/studyplanner-logo.png'

export function Brand({ variant = 'sidebar' }: { variant?: 'sidebar' | 'auth' }) {
  const size = variant === 'auth' ? 120 : 44
  return <span className={'study-brand study-brand-' + variant}>
    <img className="study-brand-image" src={logo} alt="" width={size} height={size} decoding="async" />
    <span>Study Planner</span>
  </span>
}
