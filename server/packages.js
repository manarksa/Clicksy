import { Router } from 'express'
import { pool } from './db.js'

/**
 * Packages come from the `packages` and `package_features` tables (one package → many features).
 * Only active packages are shown or bookable. Cheapest first, the order the site always used.
 */
export async function listPackages() {
  const [rows] = await pool.query(
    `SELECT p.package_id, p.name, p.description_en, p.description_ar, p.price, p.duration, p.is_popular,
            f.feature_name_en, f.feature_name_ar
     FROM packages p
     LEFT JOIN package_features f ON f.package_id = p.package_id
     WHERE p.is_active = 1
     ORDER BY p.price, p.package_id, f.sort_order`,
  )
  const byId = new Map()
  for (const r of rows) {
    if (!byId.has(r.package_id)) {
      byId.set(r.package_id, {
        id: r.package_id,
        name: r.name,
        hourlyRate: r.price,
        minHours: r.duration,
        popular: r.is_popular === 1,
        tagline: { en: r.description_en, ar: r.description_ar },
        features: { en: [], ar: [] },
      })
    }
    if (r.feature_name_en != null) {
      byId.get(r.package_id).features.en.push(r.feature_name_en)
      byId.get(r.package_id).features.ar.push(r.feature_name_ar)
    }
  }
  return [...byId.values()]
}

/** One bookable package with its current price, or null. */
export async function findActivePackage(id) {
  const [rows] = await pool.query(
    'SELECT package_id, name, price, duration FROM packages WHERE package_id = ? AND is_active = 1',
    [String(id ?? '')],
  )
  return rows[0] ?? null
}

export const packagesRouter = Router()

packagesRouter.get('/packages', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store') // a price changed in the database shows at once
  res.json({ packages: await listPackages() })
})
