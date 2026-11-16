interface AlexynLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AlexynLogo({ size = 'md' }: AlexynLogoProps) {
  const dimensions =
    size === 'lg'
      ? 'h-16 w-16 rounded-2xl'
      : size === 'sm'
      ? 'h-8 w-8 rounded-xl'
      : 'h-12 w-12 rounded-2xl';

  const svgSize = size === 'lg' ? 36 : size === 'sm' ? 19 : 28;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center border border-[#38BDF8]/35 bg-gradient-to-br from-[#0F2457] via-[#0B1738] to-[#1A1A4B] shadow-[0_8px_24px_rgba(46,139,255,0.25)] ${dimensions}`}
      aria-hidden="true"
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="alexynLogoGrad" x1="4" y1="32" x2="32" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="55%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <path
          d="M8.5 29L17.2 7.5L25.5 29"
          stroke="url(#alexynLogoGrad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.8 22.2H22.2"
          stroke="#5EEAD4"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M28 5L29.1 8.1L32.2 9.2L29.1 10.3L28 13.4L26.9 10.3L23.8 9.2L26.9 8.1L28 5Z"
          fill="#5EEAD4"
        />
      </svg>
    </div>
  );
}
