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
}

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
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      })
      if (result.error) {
        setError(
          result.error.message || 'No se pudo iniciar sesión con Google.'
        )
      }
    } catch {
      // A network failure or the client timeout rejects instead of returning
      // `result.error`; without this the button silently did nothing.
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    }
  }, [])

  const signOut = useCallback(async () => {
    signingOut.current = true
    try {
      const result = await authClient.signOut()
      if (!result.error) return
    } catch {
      // Network failure or timeout; handled below like a server error.
    }
    // The expo client clears the stored cookie before the request is sent, so
    // the device is already signed out even if the server call failed. Refresh
    // the session so the UI follows; the server session simply expires.
    authClient.$store.notify('$sessionSignal')
  }, [])

  const value = useMemo(
    () => ({
      user,
      // The expo client restores the cached session from SecureStore right
      // away, so only block on the network check when there is nothing cached.
      isLoading: isPending && !session,
      error,
      signIn,
      signOut,
    }),
    [user, session, isPending, error, signIn, signOut]
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
