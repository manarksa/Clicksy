/** Error with a short code the UI can translate (see `errors` in i18n/messages.ts). */
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

/** Calls the Express server. The session cookie is sent automatically. */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('network', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // A proxy with no server behind it answers 5xx with no JSON body.
    const code = data.error ?? (res.status >= 500 ? 'network' : 'server')
    throw new ApiError(code, res.status)
  }
  return data as T
}

export function errorCode(err: unknown) {
  return err instanceof ApiError ? err.code : 'server'
}
