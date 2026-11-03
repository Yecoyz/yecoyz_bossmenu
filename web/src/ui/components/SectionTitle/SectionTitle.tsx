import type { ReactNode } from 'react'
import './section-title.css'

// Divides a long scrolling panel into sections: small uppercase title with a hairline running to the edge.
export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title title">{children}</div>
}

// Quieter sub-heading inside a section (dim label, no line).
export function SectionSubtitle({ children }: { children: ReactNode }) {
  return <div className="section-subtitle label">{children}</div>
}
