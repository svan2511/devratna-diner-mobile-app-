/**
 * Dev Ratna Diner — brand tokens (ui/DESIGN.md se).
 * Warm Editorial Hospitality: Deep Espresso + Terracotta + Warm Gold + Warm Cream.
 */
export const Brand = {
  espresso: '#241A17',
  terracotta: '#C65D3A',
  terracottaDark: '#B34E2D',
  gold: '#C89B5B',
  cream: '#FFF8EE',
  creamRich: '#F9F3EA',
  clay: '#F2E8DA',
  charcoal: '#252525',
  stone: '#746E68',
  bone: '#E8DFD3',
  white: '#FFFFFF',
} as const;

/** Loaded via expo-font in src/app/_layout.tsx. Falls back to system fonts. */
export const Fonts = {
  display: 'Marcellus_400Regular',
  body: 'Outfit_400Regular',
  bodyMed: 'Outfit_500Medium',
  bodySemi: 'Outfit_600SemiBold',
  bodyBold: 'Outfit_700Bold',
  bodyExtra: 'Outfit_800ExtraBold',
} as const;
