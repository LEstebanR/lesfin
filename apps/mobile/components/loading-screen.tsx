import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { colors } from '../lib/theme'
import { Logo } from './logo'

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Logo />
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 24,
    justifyContent: 'center',
  },
})
