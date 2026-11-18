import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

export interface SidebarItem {
  to: string
  label: string
  end?: boolean
  /** Shown as a highlighted call to action (e.g. «احجز جلسة»). */
  cta?: boolean
}

interface SidebarProps {
  title: string
  /** Text badge so the desk is recognisable without relying on colour. */
  badge: string
  variant: 'owner' | 'client'
  items: SidebarItem[]
  footer?: ReactNode
}

export function Sidebar({ title, badge, variant, items, footer }: SidebarProps) {
  return (
    <aside className={`sidebar sidebar-${variant}`}>
      <div className="sidebar-top">
        <Logo size="sm" light={variant === 'owner'} />
        <p className="sidebar-title">{title}</p>
        <span className={`role-badge role-badge-${variant}`}>
          <span aria-hidden>{variant === 'owner' ? '◆' : '●'}</span> {badge}
        </span>
      </div>
      <nav className="sidebar-nav" aria-label={title}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-link${item.cta ? ' sidebar-cta' : ''}${isActive ? ' active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {footer && <div className="sidebar-footer">{footer}</div>}
    </aside>
  )
}
