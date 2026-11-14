import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'

const baseURL =
  process.env.EXPO_PUBLIC_AUTH_URL ||
  (__DEV__ ? 'http://localhost:3000' : 'https://www.lesfin.app')

// The expo plugin opens the OAuth flow in the system browser, receives the
// deep link back into the app, and persists the session cookie in SecureStore
// (encrypted), attaching it to every request. That is what keeps the user
// signed in across app restarts.
export const authClient = createAuthClient({
  baseURL,
  // Bounds each request to the server. better-fetch clears the timer once the
  // response arrives, before the expo plugin opens the system browser, so a
  // slow Google login is not cut off.
  fetchOptions: { timeout: 15_000 },
  plugins: [
    expoClient({
      scheme: 'lesfin', // app.json "scheme"
      storagePrefix: 'lesfin',
      storage: SecureStore,
    }),
  ],
})

export type AuthUser = typeof authClient.$Infer.Session.user
