import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Brand, Fonts } from '@/constants/brand';
import { api, SessionExpiredError, type ApiOrderTracking } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const POLL_MS = 5000;

const FULFILL_LABEL: Record<string, string> = {
  new: 'Order received',
  preparing: 'Preparing',
  ready: 'Waiting for rider',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const FULFILL_TONE: Record<string, string> = {
  new: '#4F3CC9',
  preparing: '#8A5A00',
  ready: '#1A56DB',
  out_for_delivery: '#00695C',
  delivered: '#1E7A34',
  cancelled: '#B3261E',
};

function distanceLabel(m: number | null): string {
  if (m == null) return 'Location pending';
  if (m < 1000) return `${m}m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = Number(params.id);
  const insets = useSafeAreaInsets();
  const { token, forceLogout } = useAuth();
  const [tracking, setTracking] = useState<ApiOrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const didFit = useRef(false);

  const handleAuthError = useCallback(async () => {
    await forceLogout();
    router.replace('/auth');
  }, [forceLogout, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!token || !Number.isFinite(orderId)) return;
      if (!silent) setLoading(true);
      try {
        const next = await api.trackOrder(token, orderId);
        setTracking(next);
        setError(null);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await handleAuthError();
          return;
        }
        if (!silent) setError(e instanceof Error ? e.message : 'Could not load tracking.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, orderId, handleAuthError],
  );

  useEffect(() => {
    if (!token) {
      router.replace('/auth');
      return;
    }
    const kick = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(true), POLL_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, [token, load, router]);

  useEffect(() => {
    if (!tracking || didFit.current) return;
    const coordinates: { latitude: number; longitude: number }[] = [
      { latitude: tracking.shop.lat, longitude: tracking.shop.lng },
    ];
    if (tracking.destination) {
      coordinates.push({
        latitude: tracking.destination.lat,
        longitude: tracking.destination.lng,
      });
    }
    if (tracking.rider_location) {
      coordinates.push({
        latitude: tracking.rider_location.lat,
        longitude: tracking.rider_location.lng,
      });
    }

    didFit.current = true;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [tracking]);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  const callRider = () => {
    if (tracking?.rider?.phone) void Linking.openURL(`tel:+91${tracking.rider.phone}`);
  };

  const recenter = () => {
    if (!tracking) return;
    const points = [{ latitude: tracking.shop.lat, longitude: tracking.shop.lng }];
    if (tracking.destination) {
      points.push({ latitude: tracking.destination.lat, longitude: tracking.destination.lng });
    }
    if (tracking.rider_location) {
      points.push({
        latitude: tracking.rider_location.lat,
        longitude: tracking.rider_location.lng,
      });
    }
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 120, right: 50, bottom: 300, left: 50 },
      animated: true,
    });
  };

  if (loading && !tracking) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Brand.terracotta} />
        <Text style={styles.loadingText}>Rider track ho raha hai.</Text>
      </SafeAreaView>
    );
  }

  if (error && !tracking) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <Text style={styles.errorTitle}>Tracking unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={back}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!tracking) return null;

  const { order, rider, rider_location: riderLocation, destination } = tracking;
  const status = order.fulfillment_status ?? 'new';
  const delivered = status === 'delivered' || order.delivered_at != null;
  const tone = FULFILL_TONE[status] ?? Brand.stone;
  const riderPoint = riderLocation
    ? { latitude: riderLocation.lat, longitude: riderLocation.lng }
    : null;
  const destinationPoint = destination
    ? { latitude: destination.lat, longitude: destination.lng }
    : null;

  const etaText = delivered
    ? 'Delivered'
    : !rider
      ? 'Rider assign hone ka wait'
      : tracking.is_stale
        ? 'Last known rider location'
        : tracking.eta_minutes == null
          ? 'Live location pending'
          : tracking.eta_minutes === 0
            ? 'Reaching now'
            : `${tracking.eta_minutes} min away`;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: tracking.shop.lat,
          longitude: tracking.shop.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        showsCompass={false}
        toolbarEnabled={false}>
        <Marker
          coordinate={{ latitude: tracking.shop.lat, longitude: tracking.shop.lng }}
          title="Dev Ratna Diner"
          description="Order picked up from here"
          pinColor={Brand.gold}
        />
        {destinationPoint ? (
          <Marker
            coordinate={destinationPoint}
            title="Delivery address"
            description={order.delivery_address ?? 'Your location'}
            pinColor="#1E7A34"
          />
        ) : null}
        {riderPoint ? (
          <>
            <Marker
              coordinate={riderPoint}
              title={rider?.name ?? 'Rider'}
              description={rider?.vehicle_type ?? 'Delivery partner'}
              pinColor={Brand.terracotta}
              anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.riderMarker}>
                <Text style={styles.riderMarkerText}>
                  {(rider?.name ?? 'R').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            </Marker>
            {destinationPoint ? (
              <Polyline
                coordinates={[riderPoint, destinationPoint]}
                strokeColor={Brand.terracotta}
                strokeWidth={3}
                lineDashPattern={[8, 8]}
              />
            ) : null}
          </>
        ) : null}
      </MapView>

      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          <Pressable style={styles.backBtn} onPress={back}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>Order #{order.id}</Text>
            <Text style={[styles.topStatus, { color: tone }]}>{FULFILL_LABEL[status] ?? status}</Text>
          </View>
          <Pressable style={styles.recenterBtn} onPress={recenter}>
            <Text style={styles.recenterText}>Recenter</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.etaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eta}>{etaText}</Text>
            <Text style={styles.distance}>
              {delivered
                ? 'Dev Ratna se khane ke liye shukriya!'
                : distanceLabel(tracking.distance_to_customer_m)}
            </Text>
          </View>
          {!delivered && tracking.eta_minutes != null ? (
            <View style={styles.etaBadge}>
              <Text style={styles.etaNumber}>{tracking.eta_minutes}</Text>
              <Text style={styles.etaUnit}>MIN</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {rider ? (
          <View style={styles.riderRow}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderAvatarText}>
                {(rider.name ?? 'R').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{rider.name ?? 'Delivery partner'}</Text>
              <Text style={styles.riderMeta}>
                {rider.vehicle_type}
                {rider.vehicle_number ? ` - ${rider.vehicle_number}` : ''}
                {rider.is_online ? ' - online' : ''}
              </Text>
            </View>
            <Pressable style={styles.callBtn} onPress={callRider}>
              <Text style={styles.callText}>Call</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.riderRow}>
            <View style={[styles.riderAvatar, { backgroundColor: Brand.clay }]}>
              <Text style={[styles.riderAvatarText, { color: Brand.stone }]}>
                {delivered ? '✓' : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>
                {delivered ? 'Delivered by shop team' : 'Rider assignment pending'}
              </Text>
              <Text style={styles.riderMeta}>
                {delivered
                  ? 'Order successfully deliver ho gaya.'
                  : 'Shop rider assign karega, phir yahi live location dikhegi.'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.destinationRow}>
          <View style={styles.destDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.destLabel}>Deliver to</Text>
            <Text style={styles.destAddress} numberOfLines={2}>
              {order.delivery_address ?? 'Your saved location'}
            </Text>
          </View>
          <Text style={styles.total}>₹{order.total}</Text>
        </View>

        {tracking.is_stale && !delivered ? (
          <Text style={styles.staleNote}>
            Rider ka GPS 90 seconds se purana hai - last known location dikh rahi hai.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  loadingRoot: {
    flex: 1,
    backgroundColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
  },
  loadingText: { color: Brand.stone, fontFamily: Fonts.body },
  errorTitle: { fontSize: 24, color: Brand.espresso, fontFamily: Fonts.display },
  errorText: {
    fontSize: 14,
    color: Brand.stone,
    textAlign: 'center',
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Brand.terracotta,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: Brand.white, fontFamily: Fonts.bodyExtra, fontSize: 14 },
  backLink: { padding: 10 },
  backLinkText: { color: Brand.terracotta, fontFamily: Fonts.bodyBold, fontSize: 13 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 14,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,248,238,0.96)',
    shadowColor: Brand.espresso,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.creamRich,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 28,
    lineHeight: 30,
    color: Brand.espresso,
    fontFamily: Fonts.body,
    marginTop: -2,
  },
  topTitle: { fontSize: 16, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  topStatus: { marginTop: 1, fontSize: 12, fontFamily: Fonts.bodySemi },
  recenterBtn: {
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  recenterText: { fontSize: 11, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  riderMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.terracotta,
    borderWidth: 3,
    borderColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  riderMarkerText: { color: Brand.white, fontSize: 16, fontFamily: Fonts.bodyExtra },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.bone,
    marginBottom: 14,
  },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eta: { fontSize: 24, color: Brand.espresso, fontFamily: Fonts.display },
  distance: { marginTop: 3, fontSize: 13, color: Brand.stone, fontFamily: Fonts.body },
  etaBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Brand.creamRich,
    borderWidth: 1.5,
    borderColor: Brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaNumber: { fontSize: 22, color: Brand.terracotta, fontFamily: Fonts.bodyExtra, lineHeight: 24 },
  etaUnit: { fontSize: 8, letterSpacing: 1.2, color: Brand.stone, fontFamily: Fonts.bodyExtra },
  divider: { height: 1, backgroundColor: Brand.bone, marginVertical: 14 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatarText: { color: Brand.cream, fontSize: 18, fontFamily: Fonts.bodyExtra },
  riderName: { fontSize: 15, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  riderMeta: {
    marginTop: 2,
    fontSize: 12,
    color: Brand.stone,
    textTransform: 'capitalize',
    fontFamily: Fonts.body,
  },
  callBtn: {
    backgroundColor: Brand.espresso,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  callText: { color: Brand.cream, fontSize: 12, fontFamily: Fonts.bodyExtra },
  destinationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  destDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1E7A34',
    marginTop: 5,
  },
  destLabel: { fontSize: 10, letterSpacing: 1, color: Brand.stone, fontFamily: Fonts.bodyExtra },
  destAddress: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: Brand.charcoal,
    fontFamily: Fonts.bodyMed,
  },
  total: { fontSize: 18, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  staleNote: {
    marginTop: 12,
    backgroundColor: '#FFF4DE',
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    lineHeight: 16,
    color: '#8A5A00',
    fontFamily: Fonts.bodyMed,
  },
});
