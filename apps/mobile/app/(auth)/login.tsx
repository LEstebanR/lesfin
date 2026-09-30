import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useAuth } from '../../lib/auth-context'

const C = {
  bg: '#F8F9F5',
  card: '#FFFFFF',
  text: '#1D2530',
  muted: '#7A818A',
  border: '#E8EBE5',
  green: '#B5E44A',
  greenDark: '#8DBA24',
  navy: '#1D2530',
  red: '#D95C5C',
}

export default function LoginScreen() {
  const { signIn, error, clearError } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      clearError()
      await signIn()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      Alert.alert('Error', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>lesfin</Text>
          <Text style={styles.subtitle}>Tu compañero financiero personal</Text>
        </View>

        <View style={styles.illustration}>
          <View style={styles.illustrationCircle}>
            <Ionicons color={C.green} name="wallet-outline" size={64} />
          </View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.title}>Bienvenido</Text>
          <Text style={styles.description}>
            Inicia sesión para comenzar a gestionar tus finanzas de manera
            inteligente
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons color={C.red} name="alert-circle-outline" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          disabled={loading}
          onPress={handleGoogleSignIn}
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color={C.navy} />
          ) : (
            <>
              <Ionicons color={C.navy} name="logo-google" size={20} />
              <Text style={styles.googleButtonText}>Continuar con Google</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          Al continuar, aceptas nuestros términos de servicio y política de
          privacidad
        </Text>
      </View>

      <Text style={styles.footer}>LESFIN · VERSIÓN 0.1.0</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.bg,
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    color: C.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  illustration: {
    alignItems: 'center',
    marginBottom: 48,
  },
  illustrationCircle: {
    alignItems: 'center',
    backgroundColor: `${C.green}22`,
    borderRadius: 80,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  welcome: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  description: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: `${C.red}11`,
    borderColor: `${C.red}44`,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    padding: 14,
  },
  errorText: {
    color: C.red,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: C.green,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 16,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '800',
  },
  disclaimer: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  footer: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingBottom: 32,
    textAlign: 'center',
  },
})
