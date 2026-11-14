import { useFonts } from 'expo-font'
import { Slot } from 'expo-router'

import { AuthProvider } from '../lib/auth-context'
import { fontAssets } from '../lib/theme'

export default function RootLayout() {
  // AuthProvider sits outside the font gate so the session check starts in
  // parallel with font loading.
  return (
    <AuthProvider>
      <FontGate />
    </AuthProvider>
  )
}

function FontGate() {
  // Render nothing until Geist loads, to avoid a flash of the system font.
  const [fontsLoaded, fontError] = useFonts(fontAssets)
  if (!fontsLoaded && !fontError) return null
  return <Slot />
}
