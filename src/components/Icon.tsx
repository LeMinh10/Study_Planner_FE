import type { ReactNode } from 'react'

export type IconName = 'overview' | 'calendar' | 'book' | 'chart' | 'search' | 'chevron-left' | 'chevron-right' | 'arrow-right' | 'plus' | 'check' | 'clock' | 'menu' | 'close' | 'sun' | 'headphones' | 'play' | 'pause' | 'reset' | 'code' | 'language' | 'math' | 'panel-left' | 'leaf' | 'edit' | 'trash' | 'bell' | 'user' | 'logout' | 'flag' | 'list' | 'layers'

const paths: Record<IconName, ReactNode> = {
  edit: <><path d="m15 4 5 5M4 20l5-1 12-12a2 2 0 0 0-5-5L4 14Z" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  bell: <><path d="M5 9a7 7 0 0 1 14 0c0 7 2 7 2 8H3c0-1 2-1 2-8M9 21h6" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  logout: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>,
  flag: <><path d="M5 21V3c5-3 9 3 14 0v10c-5 3-9-3-14 0" /></>,
  list: <><path d="m3 6 1 1 2-3M9 6h12M3 12h3M9 12h12M3 18h3M9 18h12" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></>,
  overview: <><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" /><rect x="14" y="14" width="6.5" height="6.5" rx="1.2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17M7.5 14h2M14 14h2M7.5 17h2" /></>,
  book: <><path d="M12 5.5C9.5 3.5 6 3.5 3 4.5v15c3-1 6.5-1 9 1 2.5-2 6-2 9-1v-15c-3-1-6.5-1-9 1Zm0 0v15" /><path d="M6 8h3M6 11h3M15 8h3M15 11h3" /></>,
  chart: <path d="M4 3.5v17h17M8.5 15v-4M13 15V6M17.5 15V9" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'arrow-right': <path d="M4 12h15m-6-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  reset: <path d="M4 10a8 8 0 1 1 .7 6M4 4v6h6" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  language: <path d="M3 5h12M9 3v2M5 5c.5 5 4 8 8 10M13 5c-.5 5-4 8-8 10M13 21l4-10 4 10M14.5 17h5" />,
  math: <path d="M7 5h10L9 12l8 7H7" />,
  'panel-left': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m6-11-3 3 3 3" /></>,
  leaf: <><path d="M19.5 4C8 2 3 9 6 15c6 4 14-1 13.5-11Z" /><path d="M4 21 15 10" /></>,
}

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}
