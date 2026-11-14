interface AlexynLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AlexynLogo({ size = 'md' }: AlexynLogoProps) {
  const dim = size === 'lg' ? 88 : size === 'md' ? 38 : 28;
  return (
    <svg
      width={dim}
      height={Math.round(dim * 0.85)}
      viewBox="0 0 120 102"
      fill="none"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_0_14px_rgba(46,139,255,0.55)]"
    >
      <defs>
        <linearGradient id="alexynLogoGrad" x1="12" y1="88" x2="108" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="52%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <path
        d="M16 84L52 14L86 76"
        stroke="url(#alexynLogoGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 65C42 54 74 44 106 32"
        stroke="url(#alexynLogoGrad)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <path
        d="M93 8L96.5 18.5L107 22L96.5 25.5L93 36L89.5 25.5L79 22L89.5 18.5L93 8Z"
        fill="#BAE6FD"
      />
    </svg>
  );
}
