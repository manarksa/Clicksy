import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

export interface SidebarItem {
  to: string
  label: string
  end?: boolean
}

interface SidebarProps {
  title: string
  items: SidebarItem[]
  footer?: ReactNode
}

export function Sidebar({ title, items, footer }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Logo size="sm" />
        <p className="sidebar-title">{title}</p>
      </div>
      <nav className="sidebar-nav" aria-label={title}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
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
