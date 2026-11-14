import { Redirect, Stack } from 'expo-router'

import { LoadingScreen } from '../../components/loading-screen'
import { useAuth } from '../../lib/auth-context'

export default function AppLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Redirect href="/login" />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  )
}
