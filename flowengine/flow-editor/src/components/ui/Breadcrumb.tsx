/**
 * Breadcrumb Component
 * Navigation breadcrumb with Material Design 3 styling
 */

import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

const ChevronIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
)

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && (
            <span style={{ color: 'var(--outline)', opacity: 0.5 }}>
              {ChevronIcon}
            </span>
          )}
          {item.href ? (
            <Link
              to={item.href}
              className="px-2 py-1 rounded-lg transition-all hover:bg-[var(--surface-container-high)]"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="px-2 py-1"
              style={{ color: 'var(--on-surface)' }}
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
