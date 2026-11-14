import { useFonts } from 'expo-font'
import { Slot } from 'expo-router'

import { AuthProvider } from '../lib/auth-context'
import { fontAssets } from '../lib/theme'

export default function RootLayout() {
  // Geist ships with the bundle, so this resolves almost immediately; render
  // nothing until then to avoid a flash of the system font.
  const [fontsLoaded, fontError] = useFonts(fontAssets)
  if (!fontsLoaded && !fontError) return null

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  )
}
