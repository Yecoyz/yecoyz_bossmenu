// The few icons the components need, so the library has no icon dependency.
// In scripts, use lucide-react for everything else (size 15 in buttons, 18 in tiles).
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const base = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const IconX = ({ size = 15, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const IconChevronRight = ({ size = 16, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const IconChevronLeft = ({ size = 16, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
)

export const IconArrowRight = ({ size = 14, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const IconSearch = ({ size = 15, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IconCheck = ({ size = 14, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M5 12.5 10 17 19 7" />
  </svg>
)

export const IconMinus = ({ size = 12, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M5 12h14" />
  </svg>
)

export const IconPlus = ({ size = 12, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconUser = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)
