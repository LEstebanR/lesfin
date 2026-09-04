import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>lesfin</Text>
      <Text style={styles.title}>Tus finanzas, en movimiento.</Text>
      <Text style={styles.subtitle}>
        La app móvil está lista para empezar a compartir la experiencia de la
        web.
      </Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    color: '#18181b',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 40,
  },
  title: {
    color: '#18181b',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: '#71717a',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
    textAlign: 'center',
  },
})
