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
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    })
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
