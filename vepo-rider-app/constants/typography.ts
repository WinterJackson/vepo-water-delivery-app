/**
 * Typography System — Inter Font Family
 * Used for all body text, buttons, and captions in Auth/Splash screens.
 */
import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  heading1: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  heading2: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  heading3: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
};
