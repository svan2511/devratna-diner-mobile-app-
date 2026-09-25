import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Brand, Fonts } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

/**
 * Splash — logo scale + fade animation, then auth/home routing.
 * Light premium intro that flows into the auth screen.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { ready, token } = useAuth();

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.08, { damping: 9, stiffness: 120 }),
      withSpring(1, { damping: 12, stiffness: 150 }),
    );
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    ring.value = withDelay(200, withTiming(1, { duration: 1200 }));
  }, [opacity, ring, scale]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      router.replace(token ? '/home' : '/auth');
    }, 1900);
    return () => clearTimeout(t);
  }, [ready, token, router]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + ring.value * 0.45 }],
    opacity: (1 - ring.value) * 0.5,
  }));

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={logoStyle}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Text style={styles.title}>Dev Ratna Diner</Text>
        <Text style={styles.subtitle}>Clement Town • Dehradun</Text>
        <Text style={styles.tagline}>Good food, good mood, good moments.</Text>
      </View>
      <Text style={styles.foot}>Fresh • Pure Veg • Garhwali Hospitality</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  center: { alignItems: 'center' },
  ring: {
    position: 'absolute',
    top: -22,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: Brand.gold,
  },
  logo: {
    width: 156,
    height: 156,
    shadowColor: Brand.espresso,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  title: { marginTop: 18, fontSize: 32, color: Brand.espresso, fontFamily: Fonts.display },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 3,
    color: Brand.terracotta,
    fontFamily: Fonts.bodyBold,
  },
  tagline: { marginTop: 10, fontSize: 15, color: Brand.stone, fontFamily: Fonts.bodyMed },
  foot: {
    position: 'absolute',
    bottom: 36,
    fontSize: 12,
    color: Brand.stone,
    fontFamily: Fonts.body,
  },
});
