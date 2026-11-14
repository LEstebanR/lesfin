import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Logo } from '../../components/logo'
import { useAuth } from '../../lib/auth-context'
import { colors, fonts, radius, shadowSoft } from '../../lib/theme'

// Same layout and copy as the web's app/login/page.tsx: logo on top, then a
// card with the title, subtitle and the Google button.
export default function LoginScreen() {
  const { signIn, error, clearError } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      clearError()
      await signIn()
    } catch {
      // The error is already exposed through `error` and rendered below.
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Logo />

      <View style={styles.card}>
        <Text style={styles.title}>¡Bienvenido de nuevo!</Text>
        <Text style={styles.subtitle}>
          Iniciar sesión para acceder a tu cuenta
        </Text>

        {error && (
          <View style={styles.error}>
            <Ionicons
              color={colors.destructive}
              name="alert-circle-outline"
              size={18}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={handleGoogleSignIn}
          style={({ pressed }) => [
            styles.button,
            (pressed || loading) && styles.buttonDimmed,
          ]}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Redirigiendo a Google...' : 'Continuar con Google'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 96,
  },
  card: {
    ...shadowSoft,
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    gap: 6,
    padding: 24,
  },
  title: {
    color: colors.foreground,
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  error: {
    alignItems: 'center',
    backgroundColor: `${colors.destructive}0D`,
    borderColor: `${colors.destructive}33`,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: 12,
  },
  errorText: {
    color: colors.destructive,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonDimmed: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
})
