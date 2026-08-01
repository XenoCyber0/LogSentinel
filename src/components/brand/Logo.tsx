// LogSentinel mark rendered inline so it inherits the surrounding size/color.
// Pass `animated` to enable the radar sweep + sonar pings. Animation uses SMIL
// <animateTransform>/<animate> because CSS transform-origin on inline SVG is
// browser-dependent (fill-box vs view-box vs conforming spec) and was rotating
// the wedge around its own local box instead of the shield center. SMIL bakes
// cx/cy directly into the transform, so it works cross-browser with no CSS.
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
  animated?: boolean;
}

export function LogoMark({ className, animated = false }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-ls-animated={animated ? 'true' : undefined}
      className={cn(animated && 'ls-logo-animated', 'h-6 w-6', className)}
    >
      <defs>
        <linearGradient id="ls-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      {/* Shield */}
      <path
        d="M32 6 L54 14 V30 C54 46 44 56 32 60 C20 56 10 46 10 30 V14 Z"
        fill="none"
        stroke="url(#ls-mark-g)"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Sonar ping rings (animated variant only) */}
      {animated && (
        <>
          <circle cx="32" cy="32" r="11" fill="none" stroke="url(#ls-mark-g)" strokeWidth="1.5">
            <animate
              attributeName="r"
              values="7;28"
              dur="2.8s"
              begin="0s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.55;0"
              dur="2.8s"
              begin="0s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="32" cy="32" r="11" fill="none" stroke="url(#ls-mark-g)" strokeWidth="1.5">
            <animate
              attributeName="r"
              values="7;28"
              dur="2.8s"
              begin="1.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.55;0"
              dur="2.8s"
              begin="1.4s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}

      {/* Radar wedge — spins around the shield center via SMIL rotate. */}
      <g>
        <path
          d="M32 32 L45 19 A17 17 0 0 1 49 33 Z"
          fill="url(#ls-mark-g)"
          opacity="0.9"
        >
          {animated && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 32 32"
              to="360 32 32"
              dur="2.8s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </g>

      {/* Center dot */}
      <circle cx="32" cy="32" r="3.5" fill="url(#ls-mark-g)" />

      {!animated && (
        <circle
          cx="32"
          cy="32"
          r="11"
          fill="none"
          stroke="url(#ls-mark-g)"
          strokeWidth="2"
          opacity="0.4"
        />
      )}
    </svg>
  );
}

interface LogoLockupProps {
  className?: string;
  animated?: boolean;
}

export function LogoLockup({ className, animated = false }: LogoLockupProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark animated={animated} />
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">LogSentinel</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
          AI Threat Analysis
        </div>
      </div>
    </div>
  );
}
