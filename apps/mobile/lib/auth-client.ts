import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

const baseURL =
  process.env.EXPO_PUBLIC_AUTH_URL ||
  (__DEV__ ? 'http://localhost:3000' : 'https://www.lesfin.app')

const scheme = (Constants.expoConfig?.scheme as string | undefined) ?? 'lesfin'

// The expo plugin opens the OAuth flow in the system browser, receives the
// deep link back into the app, and persists the session cookie in SecureStore
// (encrypted), attaching it to every request. That is what keeps the user
// signed in across app restarts.
export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme,
      storagePrefix: 'lesfin',
      storage: SecureStore,
    }),
  ],
})

export type AuthUser = typeof authClient.$Infer.Session.user
