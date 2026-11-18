import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useI18n } from '../context/LanguageContext'
import { isIntroDisabled } from '../introPreference'

/**
 * One homepage sequence per document load.
 * It starts only when this load opens on `/`. Refreshing the homepage
 * starts it again. Other first pages, and later route changes, do not.
 * React Strict Mode only resubscribes; it does not cancel the animation.
 * The Guide switch and reduced motion skip the sequence entirely.
 */
const SEQUENCE_MS = 15_000
const FLASH_MS = 1240
// One bloom at a time, wandering across the page. Repeated spots are far apart.
const BLOOM_ORDER = [0, 3, 6, 8, 2, 1, 4, 0, 3, 9, 8, 6, 1, 2, 7, 5, 4, 3, 6, 8]
// Short, uneven gaps. Every gap is shorter than a bloom, so the next rise starts during the previous fade.
const GAPS = [680, 760, 640, 820, 700, 750, 610, 790, 670, 740, 660, 800, 720, 630, 770, 690, 810, 650, 600]

const FLASHES = BLOOM_ORDER.map((bloom, index) => ({
  bloom,
  at: 140 + GAPS.slice(0, index).reduce((sum, gap) => sum + gap, 0),
}))

const BLOOMS = [
  { x: '16%', y: '24%', size: '34vmin', blur: '12px' },
  { x: '78%', y: '18%', size: '40vmin', blur: '14px' },
  { x: '30%', y: '72%', size: '42vmin', blur: '14px' },
  { x: '86%', y: '66%', size: '30vmin', blur: '10px' },
  { x: '48%', y: '44%', size: '36vmin', blur: '12px' },
  { x: '66%', y: '80%', size: '28vmin', blur: '10px' },
  { x: '12%', y: '52%', size: '38vmin', blur: '12px' },
  { x: '58%', y: '30%', size: '32vmin', blur: '10px' },
  { x: '90%', y: '38%', size: '28vmin', blur: '10px' },
  { x: '36%', y: '14%', size: '34vmin', blur: '12px' },
]

type Status = 'pending' | 'running' | 'done'

const intro = {
  status: 'pending' as Status,
  startedAt: 0,
  frame: 0,
  listeners: new Set<() => void>(),
}

function emit() {
  intro.listeners.forEach((listener) => listener())
}

function smooth(value: number) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function flashOpacity(progress: number) {
  if (progress <= 0 || progress >= 1) return 0
  if (progress < 0.34) return smooth(progress / 0.34)
  if (progress < 0.5) return 1
  return 1 - smooth((progress - 0.5) / 0.5)
}

function paintFrame(elapsed: number) {
  const amounts = BLOOMS.map(() => 0)
  FLASHES.forEach((flash) => {
    const progress = (elapsed - flash.at) / FLASH_MS
    if (progress <= 0 || progress >= 1) return
    amounts[flash.bloom] = Math.max(amounts[flash.bloom], flashOpacity(progress))
  })
  document.querySelectorAll<HTMLElement>('.flash-bloom').forEach((node, index) => {
    const amount = amounts[index] ?? 0
    node.style.opacity = amount < 0.01 ? '0' : amount.toFixed(3)
  })
}

function stopFrame() {
  if (intro.frame) cancelAnimationFrame(intro.frame)
  intro.frame = 0
}

function finish() {
  stopFrame()
  intro.status = 'done'
  paintFrame(SEQUENCE_MS + FLASH_MS)
  emit()
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function arm() {
  if (intro.status !== 'pending') return
  if (reducedMotion() || isIntroDisabled()) {
    intro.status = 'done'
    return
  }
  intro.status = 'running'
  intro.startedAt = performance.now()
  document.documentElement.dataset.introStart = String(Math.round(intro.startedAt))
  const tick = (now: number) => {
    if (intro.status !== 'running') return
    const elapsed = now - intro.startedAt
    if (elapsed >= SEQUENCE_MS) {
      finish()
      return
    }
    paintFrame(elapsed)
    intro.frame = requestAnimationFrame(tick)
  }
  intro.frame = requestAnimationFrame(tick)
}

function skipIntro() {
  if (intro.status !== 'running') return
  finish()
}

export function StudioIntro({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const [, setVersion] = useState(0)
  const onHome = pathname === '/'

  useEffect(() => {
    const listener = () => setVersion((value) => value + 1)
    intro.listeners.add(listener)
    if (onHome) arm()
    else intro.status = 'done'
    listener()
    return () => {
      intro.listeners.delete(listener)
    }
    // The first path decides the sequence. Later route changes must not arm it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const running = intro.status === 'running'

  return (
    <>
      {children}
      {running && onHome && (
        <div className="intro-layer" data-intro="running">
          <div className="flash-field" aria-hidden="true">
            {BLOOMS.map((bloom) => (
              <span
                key={`${bloom.x}-${bloom.y}`}
                className="flash-bloom"
                style={{
                  ['--x' as string]: bloom.x,
                  ['--y' as string]: bloom.y,
                  ['--size' as string]: bloom.size,
                  ['--blur' as string]: bloom.blur,
                }}
              />
            ))}
          </div>
          <div className="intro-skip-wrap">
            <p>{t.intro.note}</p>
            <button type="button" className="intro-skip" onClick={skipIntro}>
              {t.intro.skip}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
