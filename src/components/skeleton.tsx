import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BASE = '#EADFD3';
const SHINE = 'rgba(255, 255, 255, 0.8)';

const SW = Dimensions.get('window').width;
const CONTENT_W = SW - 32;
const BANNER_W = SW - 32 - 44;

/** Single shimmering block — gradient sweep loops left → right. */
export function ShimmerBlock({
  width,
  height,
  borderRadius = 12,
  style,
}: {
  width: number;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });

  return (
    <View style={[{ width, height, borderRadius, backgroundColor: BASE, overflow: 'hidden' }, style]}>
      <Animated.View style={{ width: width * 0.55, height: '100%', transform: [{ translateX }] }}>
        <LinearGradient
          colors={['transparent', SHINE, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function Row({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', gap }}>{children}</View>;
}

/** Home tab skeleton — mirrors banner, categories, deal, bestsellers. */
function HomeSkeleton() {
  return (
    <View style={s.wrap}>
      <ShimmerBlock width={CONTENT_W} height={50} borderRadius={14} />
      <ShimmerBlock width={BANNER_W} height={128} borderRadius={18} style={{ marginTop: 14 }} />
      <View style={s.dots}>
        <ShimmerBlock width={18} height={6} borderRadius={3} />
        <ShimmerBlock width={6} height={6} borderRadius={3} />
        <ShimmerBlock width={6} height={6} borderRadius={3} />
      </View>
      <ShimmerBlock width={190} height={20} borderRadius={6} style={{ marginTop: 22 }} />
      <View style={{ marginTop: 12 }}>
        <Row>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <ShimmerBlock width={64} height={64} borderRadius={32} />
              <ShimmerBlock width={56} height={10} borderRadius={5} />
            </View>
          ))}
        </Row>
      </View>
      <ShimmerBlock width={CONTENT_W} height={196} borderRadius={18} style={{ marginTop: 18 }} />
      <ShimmerBlock width={200} height={20} borderRadius={6} style={{ marginTop: 22 }} />
      <View style={{ marginTop: 12 }}>
        <Row>
          {[0, 1].map((i) => (
            <View key={i} style={s.card}>
              <ShimmerBlock width={206} height={150} borderRadius={0} />
              <View style={{ padding: 12, gap: 6 }}>
                <ShimmerBlock width={150} height={14} borderRadius={6} />
                <ShimmerBlock width={100} height={12} borderRadius={5} />
                <ShimmerBlock width={90} height={32} borderRadius={10} />
              </View>
            </View>
          ))}
        </Row>
      </View>
    </View>
  );
}

/** Menu tab skeleton — mirrors chips + dish rows. */
function MenuSkeleton() {
  return (
    <View style={s.wrap}>
      <ShimmerBlock width={120} height={20} borderRadius={6} style={{ marginTop: 22 }} />
      <View style={{ marginTop: 12 }}>
        <Row gap={8}>
          {[100, 80, 90, 70].map((w, i) => (
            <ShimmerBlock key={i} width={w} height={36} borderRadius={20} />
          ))}
        </Row>
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={s.menuRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <ShimmerBlock width={150} height={14} borderRadius={6} />
            <ShimmerBlock width={80} height={12} borderRadius={5} />
            <ShimmerBlock width={190} height={10} borderRadius={5} />
          </View>
          <ShimmerBlock width={132} height={128} borderRadius={16} />
        </View>
      ))}
    </View>
  );
}

/**
 * Dish-rows-only shimmer — used when switching menu categories.
 * Chips stay visible on top, only the list shimmers (Zomato-style feedback).
 */
export function MenuListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={s.menuRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <ShimmerBlock width={150} height={14} borderRadius={6} />
            <ShimmerBlock width={80} height={12} borderRadius={5} />
            <ShimmerBlock width={190} height={10} borderRadius={5} />
          </View>
          <ShimmerBlock width={132} height={128} borderRadius={16} />
        </View>
      ))}
    </View>
  );
}

/** Orders / Profile skeleton — generic card + lines. */
function SimpleSkeleton() {
  return (
    <View style={[s.wrap, { alignItems: 'center', paddingTop: 40 }]}>
      <ShimmerBlock width={76} height={76} borderRadius={38} />
      <ShimmerBlock width={180} height={20} borderRadius={6} style={{ marginTop: 14 }} />
      <ShimmerBlock width={140} height={13} borderRadius={6} style={{ marginTop: 8 }} />
      <ShimmerBlock width={CONTENT_W} height={64} borderRadius={14} style={{ marginTop: 18 }} />
      <ShimmerBlock width={CONTENT_W} height={64} borderRadius={14} style={{ marginTop: 12 }} />
      <ShimmerBlock width={CONTENT_W} height={48} borderRadius={14} style={{ marginTop: 16 }} />
    </View>
  );
}

export function ScreenSkeleton({ tab }: { tab: 'home' | 'menu' | 'orders' | 'profile' }) {
  if (tab === 'menu') return <MenuSkeleton />;
  if (tab === 'orders' || tab === 'profile') return <SimpleSkeleton />;
  return <HomeSkeleton />;
}

const s = StyleSheet.create({
  wrap: { paddingBottom: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  card: {
    width: 208,
    marginRight: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BASE,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BASE,
  },
});
