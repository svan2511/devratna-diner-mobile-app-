import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { Brand, Fonts } from '@/constants/brand';

/**
 * Branded launch splash — Dev Ratna logo scales + fades in with the
 * tagline, holds briefly, then fades out into the app.
 * Native splash (same cream + logo) hands off seamlessly to this.
 */
export function AppSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(tagOpacity, {
        toValue: 1,
        duration: 700,
        delay: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    intro.start();

    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => doneRef.current());
    }, 1550);
    return () => clearTimeout(t);
  }, [opacity, logoScale, logoOpacity, tagOpacity]);

  return (
    <Animated.View style={[s.root, { opacity }]}>
      <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
        <Image source={require('@/assets/images/logo.png')} style={s.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={{ opacity: tagOpacity }}>
        <Text style={s.tag}>GOOD FOOD • HAPPY MOOD</Text>
      </Animated.View>
      <View style={s.vegRow}>
        <View style={s.vegBox}>
          <View style={s.vegDot} />
        </View>
        <Text style={s.vegText}>PURE VEG</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logo: { width: 208, height: 208 },
  tag: {
    fontSize: 12,
    letterSpacing: 3,
    color: Brand.stone,
    fontFamily: Fonts.bodyBold,
  },
  vegRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  vegBox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#1E7A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E7A34' },
  vegText: { fontSize: 10, letterSpacing: 1.5, color: '#1E7A34', fontFamily: Fonts.bodyExtra },
});
