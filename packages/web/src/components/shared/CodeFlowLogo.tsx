interface CodeFlowLogoProps {
  size?: number;
  className?: string;
}

/**
 * Custom CodeFlow logo — a stylised directed graph / flow icon.
 * Three nodes connected by two curved arrows forming a data-flow motif.
 */
export function CodeFlowLogo({ size = 32, className }: CodeFlowLogoProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue via-accent-purple to-accent-pink ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size * 0.6, height: size * 0.6 }}
      >
        {/* Top-left node */}
        <circle cx="8" cy="8" r="3" fill="white" opacity="0.95" />
        {/* Bottom-left node */}
        <circle cx="8" cy="24" r="3" fill="white" opacity="0.95" />
        {/* Right node */}
        <circle cx="24" cy="16" r="3.5" fill="white" />

        {/* Curved arrow: top-left → right */}
        <path
          d="M11 8 C17 6, 20 10, 21 14"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Arrowhead */}
        <path
          d="M20 12 L21.5 14.5 L18.5 14"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Curved arrow: right → bottom-left */}
        <path
          d="M21 18 C18 22, 14 25, 11 24"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Arrowhead */}
        <path
          d="M13 25.5 L10.5 24 L13 22.5"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Vertical connector: top-left → bottom-left (subtle) */}
        <path
          d="M8 11.5 L8 20.5"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.4"
          strokeDasharray="2 2.5"
        />
      </svg>
    </div>
  );
}
