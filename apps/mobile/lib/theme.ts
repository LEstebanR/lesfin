// Per-weight subpaths: the package index requires all 18 .ttf files, which
// would ship every weight in the bundle.
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular'
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium'
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold'
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold'
import { Geist_900Black } from '@expo-google-fonts/geist/900Black'
import { Geist_900Black_Italic } from '@expo-google-fonts/geist/900Black_Italic'

// Mirrors the light theme tokens in the web's app/globals.css (converted from
// OKLCH to sRGB hex) so mobile and web share the same look. Keep them in sync
// when the web palette changes.
export const colors = {
  background: '#FFFFFF',
  foreground: '#0C141F',
  card: '#FFFFFF',
  primary: '#5BB661',
  primaryForeground: '#F8F8F8',
  mutedForeground: '#545F6C',
  destructive: '#E7000B',
  border: '#DADEE5',
  chart3: '#1F68BC',
  chart4: '#EA6747',
  chart5: '#AD51A7',
} as const

// --radius is 0.65rem on the web; md/lg/2xl follow its Tailwind scale.
export const radius = {
  md: 8,
  lg: 10,
  '2xl': 16,
} as const

// Geist is the web's sans font. Custom fonts ignore `fontWeight` on Android,
// so each weight is its own family.
export const fontAssets = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_900Black,
  Geist_900Black_Italic,
}

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  black: 'Geist_900Black',
  blackItalic: 'Geist_900Black_Italic',
} as const

// Equivalent of the web's --shadow-soft (used by cards).
export const shadowSoft = {
  boxShadow: [
    { offsetX: 0, offsetY: 1, blurRadius: 0, color: 'rgba(17, 24, 39, 0.04)' },
    {
      offsetX: 0,
      offsetY: 10,
      blurRadius: 30,
      spreadDistance: -18,
      color: 'rgba(17, 24, 39, 0.28)',
    },
  ],
} as const
