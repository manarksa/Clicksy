import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { Package, PackageRecord } from '../types'
import { useI18n } from './LanguageContext'

type PackagesValue = {
  /** Active packages from the database, in the current language, cheapest first. */
  packages: Package[]
  status: 'loading' | 'ready' | 'error'
  reload: () => void
}

const PackagesContext = createContext<PackagesValue | null>(null)

/** Loads the packages (and their features) once from /api/packages — the database is the source. */
export function PackagesProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n()
  const [records, setRecords] = useState<PackageRecord[]>([])
  const [status, setStatus] = useState<PackagesValue['status']>('loading')

  const load = useCallback(() => {
    api<{ packages: PackageRecord[] }>('/packages')
      .then((data) => {
        setRecords(data.packages)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load]) // status starts as 'loading'

  const reload = useCallback(() => {
    setStatus('loading')
    load()
  }, [load])

  const packages = useMemo(
    () =>
      records.map((p) => ({
        id: p.id,
        name: p.name,
        hourlyRate: p.hourlyRate,
        minHours: p.minHours,
        popular: p.popular,
        tagline: p.tagline[lang],
        features: p.features[lang],
      })),
    [records, lang],
  )

  return (
    <PackagesContext.Provider value={{ packages, status, reload }}>{children}</PackagesContext.Provider>
  )
}

export function usePackages() {
  const value = useContext(PackagesContext)
  if (!value) throw new Error('usePackages must be used inside PackagesProvider')
  return value
}
