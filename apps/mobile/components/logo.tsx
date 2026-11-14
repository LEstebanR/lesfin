import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { colors, fonts, radius } from '../lib/theme'

// Same mark as the web's components/ui/logo.tsx: wallet badge + "LESFin".
export function Logo() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons
          color={colors.primaryForeground}
          name="wallet-outline"
          size={16}
        />
      </View>
      <Text style={styles.wordmark}>
        <Text style={styles.les}>LES</Text>
        <Text style={styles.fin}>Fin</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  wordmark: {
    color: colors.foreground,
    fontSize: 24,
    letterSpacing: -1.2,
  },
  les: {
    color: colors.primary,
    fontFamily: fonts.black,
  },
  fin: {
    fontFamily: fonts.blackItalic,
  },
})
