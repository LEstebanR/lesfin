import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const C = {
  bg: '#F8F9F5',
  text: '#1D2530',
  greenDark: '#8DBA24',
}

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>lesfin</Text>
      <ActivityIndicator color={C.greenDark} size="large" />
      <Text style={styles.text}>Cargando...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: C.bg,
    flex: 1,
    gap: 20,
    justifyContent: 'center',
  },
  logo: {
    color: C.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  text: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
})
