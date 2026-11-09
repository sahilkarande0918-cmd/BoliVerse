const P: Record<string, string> = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3',
  stop: 'M7 7h10v10H7z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  open: 'M3 7h6l2 2h10v10H3z',
  film: 'M4 5h16v14H4zM4 9h16M4 15h16M8 5v4M16 5v4M8 15v4M16 15v4',
  play: 'm8 5 11 7-11 7z',
  rec: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  cube: 'm12 3 8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  layers: 'm12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  send: 'M4 12 20 4l-6 16-3-7z',
  down: 'M12 4v12m-5-5 5 5 5-5M5 20h14',
  x: 'M6 6l12 12M18 6 6 18',
  github: 'M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6 0C6.8 2.6 5.8 2.9 5.8 2.9a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.3c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chev: 'm9 6 6 6-6 6',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m11.4 0 1.4 1.4M4.9 4.9l1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
}
export function Icon({ name, size = 16, className = '' }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  )
}

export function Mark({ size = 22, color = '#34302D' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M16 54V30a16 16 0 0 1 32 0v24" fill="none" stroke={color} strokeWidth="3.5" />
      <circle cx="32" cy="40" r="3.5" fill={color} />
    </svg>
  )
}

/** lowercase editorial wordmark */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`text-[19px] font-medium tracking-[-0.01em] ${className}`}>boliverse</span>
}
