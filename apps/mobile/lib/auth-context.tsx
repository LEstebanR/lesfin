import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { type AuthUser, authClient } from './auth-client'

type AuthContextType = {
  user: AuthUser | null
  /** True while the stored session is being restored/validated. */
  isLoading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const SIGN_IN_TIMEOUT_MS = 15_000

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const [error, setError] = useState<string | null>(null)
  const user = session?.user ?? null

  // Detect a session that disappears without an explicit sign-out (expired or
  // revoked on the server) so the login screen can explain why.
  const hadUser = useRef(false)
  const signingOut = useRef(false)
  useEffect(() => {
    if (isPending) return
    if (user) {
      hadUser.current = true
    } else if (hadUser.current) {
      hadUser.current = false
      if (!signingOut.current) {
        setError('Tu sesión expiró. Inicia sesión de nuevo.')
      }
      signingOut.current = false
    }
  }, [user, isPending])

  const signIn = useCallback(async () => {
    setError(null)
    let result: Awaited<ReturnType<typeof authClient.signIn.social>>
    try {
      result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
        // Only bounds the request to the server; the timer is cleared before
        // the system browser opens, so a slow Google login is not cut off.
        fetchOptions: { timeout: SIGN_IN_TIMEOUT_MS },
      })
    } catch (cause) {
      // A network failure or the timeout rejects instead of returning
      // `result.error`, so without this the button silently did nothing.
      const message = 'No se pudo conectar con el servidor. Intenta de nuevo.'
      setError(message)
      throw new Error(message, { cause })
    }
    if (result.error) {
      const message =
        result.error.message || 'No se pudo iniciar sesión con Google.'
      setError(message)
      throw new Error(message)
    }
  }, [])

  const signOut = useCallback(async () => {
    signingOut.current = true
    const result = await authClient.signOut()
    if (result.error) {
      signingOut.current = false
      setError('No se pudo cerrar sesión. Intenta de nuevo.')
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo(
    () => ({
      user,
      isLoading: isPending,
      error,
      signIn,
      signOut,
      clearError,
    }),
    [user, isPending, error, signIn, signOut, clearError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
