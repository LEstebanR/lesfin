import * as SecureStore from 'expo-secure-store'
import { useRouter, useSegments } from 'expo-router'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { authClient } from './auth-client'

const TOKEN_KEY = 'auth_session_token'

type User = {
  id: string
  name: string
  email: string
  image?: string
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const segments = useSegments()

  const loadSession = async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY)
      if (token) {
        const response = await authClient.getSession()
        if (
          response &&
          'data' in response &&
          response.data &&
          'user' in response.data
        ) {
          setUser(response.data.user as User)
        } else {
          await SecureStore.deleteItemAsync(TOKEN_KEY)
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err)
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)'
    const inAppGroup = segments[0] === '(app)'

    if (isLoading) return

    if (!user && inAppGroup) {
      router.replace('/login')
    } else if (user && inAuthGroup) {
      router.replace('/(app)')
    }
  }, [user, segments, isLoading])

  const signIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/(app)',
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to sign in')
      }

      if (result.data && 'user' in result.data && result.data.user) {
        setUser(result.data.user as User)
        await SecureStore.setItemAsync(TOKEN_KEY, 'authenticated')
      } else if (result.data && 'url' in result.data && result.data.url) {
        throw new Error(
          'OAuth redirect not supported in mobile. Please configure mobile OAuth.'
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      setError(message)
      console.error('Sign in error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsLoading(true)
      await authClient.signOut()
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      setUser(null)
      router.replace('/login')
    } catch (err) {
      console.error('Sign out error:', err)
      setError('Failed to sign out')
    } finally {
      setIsLoading(false)
    }
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{ user, isLoading, error, signIn, signOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
