// Typed client for the web app's mobile API (`/api/v1/*`, see
// docs/mobile-api.md). Type-only import: the contract file has no runtime
// code, so nothing from the web app ends up in the bundle.
import type {
  ApiErrorBody,
  ApiErrorCode,
  OverviewDto,
} from '../../../lib/api/contracts'
import { authBaseURL, authClient } from './auth-client'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: Record<string, string[]>
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  // The expo client keeps the better-auth session cookie in SecureStore;
  // the API authenticates with the very same session as the web.
  const headers: Record<string, string> = { Cookie: authClient.getCookie() }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${authBaseURL}/api/v1${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // The cookie is attached by hand above; don't mix in the native jar.
      credentials: 'omit',
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor.'
    )
  }

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = (body as ApiErrorBody | null)?.error
    // An expired/revoked session: let the auth context re-check, which
    // sends the user back to login with its "session expired" message.
    if (res.status === 401) authClient.$store.notify('$sessionSignal')
    throw new ApiError(
      res.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? 'Error inesperado del servidor.',
      error?.details
    )
  }
  return body as T
}

export const api = {
  overview: () => request<OverviewDto>('/overview'),
}
