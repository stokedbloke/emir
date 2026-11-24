// The VocalMirror mark: a voice (the bars) above still water, with its
// reflection fading below the surface.
export function VocalMirrorLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} role="img" aria-label="VocalMirror">
      <defs>
        <linearGradient id="vocalmirror-tile" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#vocalmirror-tile)" />
      <g stroke="#fff" strokeWidth="7" strokeLinecap="round">
        <line x1="26" y1="44" x2="26" y2="37" />
        <line x1="38" y1="44" x2="38" y2="27" />
        <line x1="50" y1="44" x2="50" y2="18" />
        <line x1="62" y1="44" x2="62" y2="30" />
        <line x1="74" y1="44" x2="74" y2="39" />
      </g>
      <line x1="16" y1="53" x2="84" y2="53" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <g stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity="0.35">
        <line x1="26" y1="62" x2="26" y2="67" />
        <line x1="38" y1="62" x2="38" y2="75" />
        <line x1="50" y1="62" x2="50" y2="82" />
        <line x1="62" y1="62" x2="62" y2="73" />
        <line x1="74" y1="62" x2="74" y2="66" />
      </g>
    </svg>
  )
}
