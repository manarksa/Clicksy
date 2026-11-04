import { Link } from 'react-router-dom'

interface LogoProps {
  to?: string
  light?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ to = '/', light = false, size = 'md' }: LogoProps) {
  return (
    <Link to={to} className={`logo logo-${size}${light ? ' logo-light' : ''}`}>
      <span className="logo-mark" aria-hidden>
        <span className="logo-aperture" />
      </span>
      <span className="logo-word">
        Click<span>sy</span>
      </span>
    </Link>
  )
}
