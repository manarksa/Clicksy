/**
 * Catches misspelled email domains (gamil.com, gmail.con, hotmial.com …) before a sign-in code is
 * sent to an address that does not exist — or worse, to a stranger's look-alike domain.
 * Shared by the sign-up form and the server.
 */
const PROVIDERS: Record<string, string> = {
  gmail: 'gmail.com',
  googlemail: 'googlemail.com',
  hotmail: 'hotmail.com',
  outlook: 'outlook.com',
  live: 'live.com',
  yahoo: 'yahoo.com',
  icloud: 'icloud.com',
  me: 'me.com',
  msn: 'msn.com',
  aol: 'aol.com',
  protonmail: 'protonmail.com',
  proton: 'proton.me',
}

/** Real domains that look close to a provider name but are fine as typed. */
const KNOWN_OK = new Set([
  ...Object.values(PROVIDERS),
  'hotmail.co.uk', 'hotmail.fr', 'yahoo.co.uk', 'yahoo.fr', 'live.co.uk', 'outlook.sa', 'outlook.fr',
  'mail.com', 'email.com', 'gmx.com', 'ymail.com',
])

/** Top-level domains people mean as ".com" when they type them after a big provider. */
const COM_TYPOS = new Set(['con', 'cm', 'om', 'co', 'comm', 'cpm', 'vom', 'xom', 'coom', 'cim', 'clm', 'ocm', 'c', 'cmo'])

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      // adjacent swap (gmial → gmail) counts as one edit
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], prev)
      prev = tmp
    }
  }
  return row[b.length]
}

/** Returns the corrected address when the domain is a likely typo, otherwise null. */
export function suggestEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!domain || KNOWN_OK.has(domain)) return null

  const dot = domain.indexOf('.')
  const name = dot === -1 ? domain : domain.slice(0, dot)
  const tld = dot === -1 ? '' : domain.slice(dot + 1)

  // Exact provider with a broken ending: gmail.con, gmail.cm, gmail (no ending)
  if (PROVIDERS[name] && (tld === '' || COM_TYPOS.has(tld))) {
    return name === 'me' && tld === '' ? null : `${local}@${PROVIDERS[name]}`
  }

  // Misspelled provider: gamil.com, gmial.com, hotmial.com, outlok.com, yaho.com …
  if (tld === 'com' || tld === '' || COM_TYPOS.has(tld)) {
    for (const [provider, fixed] of Object.entries(PROVIDERS)) {
      if (provider.length < 5) continue // too short to guess safely (me, msn, aol, live)
      const d = distance(name, provider)
      if (d > 0 && d <= (provider.length >= 7 ? 2 : 1)) return `${local}@${fixed}`
    }
  }
  return null
}
