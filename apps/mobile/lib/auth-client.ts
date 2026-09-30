import { createAuthClient } from 'better-auth/react'

const baseURL =
  process.env.EXPO_PUBLIC_AUTH_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://lesfin.app'
    : 'http://localhost:3000')

export const authClient = createAuthClient({
  baseURL: `${baseURL}/api/auth`,
})
