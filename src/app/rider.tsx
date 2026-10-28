import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { AppAlert, type AppAlertData } from '@/components/app-alert';
import { Brand, Fonts } from '@/constants/brand';
import {
  api,
  SessionExpiredError,
  type ApiRiderAssignments,
  type ApiRiderOrder,
} from '@/lib/api';
import { addPushReceivedListener, registerPushTokenDetailed } from '@/lib/push';
import {
  startRiderLocationTracking,
  stopRiderLocationTracking,
  type RiderTrackingMode,
} from '@/lib/rider-location';
import { useAuth } from '@/context/AuthContext';

const POLL_MS = 10000;

function shortDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function stageLabel(order: ApiRiderOrder): string {
  if (order.delivered_at || order.fulfillment_status === 'delivered') return 'Delivered';
  if (order.picked_up_at) return 'On the way to customer';
  if (order.rider_accepted_at) return 'Accepted - pick up the food';
  return 'New assignment';
}

export default function RiderScreen() {
  const router = useRouter();
  const { ready, token, user, logout, forceLogout } = useAuth();
  const [data, setData] = useState<ApiRiderAssignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AppAlertData | null>(null);
  const [trackingMode, setTrackingMode] = useState<RiderTrackingMode | null>(null);
  const [appStateTick, setAppStateTick] = useState(0);
  const deniedRef = useRef(false);
  const pushTokenRef = useRef<string | null>(null);

  const activeOrder = data?.active_order ?? null;
  const activeOrderId = activeOrder?.id ?? null;
  const activeStatus = activeOrder?.fulfillment_status ?? null;
  const liveTrackingMode =
    activeOrderId == null || activeStatus === 'delivered' || activeStatus === 'cancelled'
      ? null
      : trackingMode;

  const showAlert = useCallback((title: string, message: string, type: AppAlertData['type'] = 'info') => {
    setAlert({ title, message, type });
  }, []);

  const handleAuthError = useCallback(async () => {
    await forceLogout();
    router.replace('/auth');
  }, [forceLogout, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const next = await api.riderAssignments(token);
        setData(next);
        setError(null);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await handleAuthError();
          return;
        }
        if (!silent) setError(e instanceof Error ? e.message : 'Could not load assignments.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, handleAuthError],
  );

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace('/auth');
      return;
    }
    if (user && !user.is_rider) {
      router.replace('/home');
    }
  }, [ready, token, user, router]);

  useEffect(() => {
    const kick = setTimeout(() => void load(), 0);
    return () => clearTimeout(kick);
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(t);
  }, [token, load]);

  // Rider home nahi kholta — assignment push ke liye token yahin register karo.
  useEffect(() => {
    if (!token) {
      pushTokenRef.current = null;
      return;
    }
    if (pushTokenRef.current === token) return;
    pushTokenRef.current = token;

    void (async () => {
      const result = await registerPushTokenDetailed();
      if (!result.ok) return;
      try {
        await api.pushToken(token, {
          token: result.token,
          platform: Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : undefined,
        });
      } catch {
        pushTokenRef.current = null;
      }
    })();
  }, [token]);

  // Naya assignment push aate hi dashboard turant refresh — 10s poll ka wait nahi.
  useEffect(() => {
    const recv = addPushReceivedListener(() => {
      void load(true);
    });
    return () => recv?.remove();
  }, [load]);

  // Settings se wapas aane par permission dobara check karo — "Allow all the
  // time" karte hi background task start ho jaye, app restart na karna pade.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setAppStateTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // Live location background task me chalti hai, taaki Maps kholne par bhi
  // customer ko rider dikhta rahe. Background permission na mile to foreground
  // watcher fallback chalta hai (app khula rehne tak).
  useEffect(() => {
    if (!token || activeOrderId == null || activeStatus === 'delivered' || activeStatus === 'cancelled') {
      void stopRiderLocationTracking();
      deniedRef.current = false;
      return;
    }

    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    let lastSent = 0;

    void (async () => {
      const mode = await startRiderLocationTracking(token, activeOrderId);
      if (cancelled) return;
      setTrackingMode(mode);

      if (mode === 'denied') {
        if (!deniedRef.current) {
          deniedRef.current = true;
          showAlert(
            'Location permission needed',
            'Allow location so customers can see your live rider location.',
            'warning',
          );
        }
        return;
      }

      deniedRef.current = false;
      if (mode === 'background') return;

      const nextSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (pos) => {
          const now = Date.now();
          if (now - lastSent < 8000) return;
          lastSent = now;
          void api
            .sendRiderLocation(token, activeOrderId, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy_m:
                typeof pos.coords.accuracy === 'number'
                  ? Math.min(10000, Math.round(pos.coords.accuracy))
                  : null,
            })
            .catch(() => {});
        },
      );

      if (cancelled) {
        nextSub.remove();
        return;
      }
      sub = nextSub;
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [token, activeOrderId, activeStatus, showAlert, appStateTick]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const doAction = useCallback(
    async (action: 'accept' | 'pickup' | 'deliver') => {
      if (!token || !activeOrder || busy) return;
      setBusy(true);
      try {
        let mapsUrl: string | null = null;
        let pickupMode: RiderTrackingMode | null = null;
        if (action === 'accept') await api.acceptRide(token, activeOrder.id);
        if (action === 'pickup') {
          const res = await api.pickupRide(token, activeOrder.id);
          // Maps kholne se pehle background tracking on karo — warna app
          // background hote hi customer ki live location ruk jaati hai.
          pickupMode = await startRiderLocationTracking(token, activeOrder.id);
          setTrackingMode(pickupMode);
          mapsUrl = pickupMode === 'background' ? res.order.maps_url : null;
        }
        if (action === 'deliver') {
          await api.deliverRide(token, activeOrder.id);
          await stopRiderLocationTracking();
          setTrackingMode(null);
        }
        await load(true);
        if (mapsUrl) void Linking.openURL(mapsUrl);
        showAlert(
          action === 'deliver'
            ? 'Delivery complete'
            : action === 'pickup' && pickupMode !== 'background'
              ? 'Order picked up'
              : 'Updated',
          action === 'deliver'
            ? 'Order marked as delivered. Thank you!'
            : action === 'pickup'
              ? pickupMode === 'background'
                ? 'Order picked up — maps opened and the customer can see your live location.'
                : 'Order picked up. Background location is off — set Location to "Allow all the time", then tap Open maps. Otherwise live tracking stops when the app goes to the background.'
              : 'Order accepted.',
          action === 'pickup' && pickupMode !== 'background' ? 'warning' : 'success',
        );
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await handleAuthError();
          return;
        }
        showAlert('Action failed', e instanceof Error ? e.message : 'Please try again.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [token, activeOrder, busy, load, showAlert, handleAuthError],
  );

  const toggleOnline = useCallback(async () => {
    if (!token || !data || busy) return;
    const next = !data.rider.is_online;
    setBusy(true);
    try {
      await api.setRiderAvailability(token, next);
      setData((prev) =>
        prev ? { ...prev, rider: { ...prev.rider, is_online: next } } : prev,
      );
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await handleAuthError();
        return;
      }
      showAlert('Could not update status', e instanceof Error ? e.message : 'Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }, [token, data, busy, showAlert, handleAuthError]);

  const doLogout = useCallback(async () => {
    await logout();
    router.replace('/auth');
  }, [logout, router]);

  const callCustomer = () => {
    const phone = activeOrder?.customer?.phone;
    if (phone) void Linking.openURL(`tel:+91${phone}`);
  };

  const openMaps = () => {
    const url = activeOrder?.maps_url;
    if (!url) return;

    if (liveTrackingMode === 'background') {
      void Linking.openURL(url);
      return;
    }

    Alert.alert(
      'Live tracking will stop',
      'Opening Maps sends the app to the background. Set Location to "Allow all the time" in Settings, otherwise the customer will not see your live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: () => void Linking.openSettings() },
        { text: 'Open anyway', onPress: () => void Linking.openURL(url) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Brand.terracotta} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>DEV RATNA DINER</Text>
            <Text style={styles.title}>Rider dashboard</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={doLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        {error ? (
          <Pressable style={styles.errorCard} onPress={() => void load()}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </Pressable>
        ) : null}

        {loading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Brand.terracotta} />
            <Text style={styles.loadingText}>Loading your runs.</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(data.rider.name || user?.name || 'R').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.riderName}>{data.rider.name || user?.name || 'Rider'}</Text>
                  <Text style={styles.riderMeta}>
                    {data.rider.vehicle_type}
                    {data.rider.vehicle_number ? ` - ${data.rider.vehicle_number}` : ''}
                  </Text>
                </View>
                <Pressable
                  style={[styles.onlinePill, data.rider.is_online ? styles.onlineOn : styles.onlineOff]}
                  onPress={() => void toggleOnline()}
                  disabled={busy}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: data.rider.is_online ? '#8FE3A4' : '#C9BCB2' },
                    ]}
                  />
                  <Text style={styles.onlineText}>{data.rider.is_online ? 'ONLINE' : 'OFFLINE'}</Text>
                </Pressable>
              </View>
              <Text style={styles.profileHint}>
                {data.rider.is_online
                  ? 'You are online — you will get a notification when a new delivery is assigned.'
                  : 'You are offline — the admin can assign you only when you are online.'}
              </Text>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Current delivery</Text>
              <Text style={styles.sectionCount}>{activeOrder ? '1 active' : 'free'}</Text>
            </View>

            {activeOrder ? (
              <View style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <View>
                    <Text style={styles.orderId}>Order #{activeOrder.id}</Text>
                    <Text style={styles.orderStage}>{stageLabel(activeOrder)}</Text>
                  </View>
                  <Text style={styles.orderTotal}>₹{activeOrder.total}</Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.customerName}>
                  {activeOrder.customer?.name || 'Customer'}
                </Text>
                {activeOrder.delivery_address ? (
                  <Text style={styles.address}>{activeOrder.delivery_address}</Text>
                ) : null}
                {activeOrder.distance_m != null ? (
                  <Text style={styles.distance}>{activeOrder.distance_m}m from the shop</Text>
                ) : null}

                <View style={styles.itemsBox}>
                  {activeOrder.items.map((line, i) => (
                    <View key={`${line.id}-${i}`} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{line.qty}x</Text>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {line.name}
                        {line.portion !== 'single' ? ` (${line.portion})` : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.contactRow}>
                  <Pressable style={styles.contactBtn} onPress={callCustomer}>
                    <Text style={styles.contactText}>Call customer</Text>
                  </Pressable>
                  <Pressable style={styles.contactBtn} onPress={openMaps}>
                    <Text style={styles.contactText}>Open maps</Text>
                  </Pressable>
                </View>

                {activeOrder.fulfillment_status !== 'delivered' &&
                liveTrackingMode !== null &&
                liveTrackingMode !== 'background' ? (
                  <View style={styles.locationWarn}>
                    <Text style={styles.locationWarnText}>
                      {liveTrackingMode === 'denied'
                        ? 'Location is off — the customer cannot see your live location.'
                        : 'Background location is off — live tracking will stop when Maps opens.'}
                    </Text>
                    <Pressable style={styles.locationWarnBtn} onPress={() => void Linking.openSettings()}>
                      <Text style={styles.locationWarnAction}>Fix location</Text>
                    </Pressable>
                  </View>
                ) : null}

                {activeOrder.fulfillment_status !== 'delivered' ? (
                  <View style={styles.actionCol}>
                    {!activeOrder.picked_up_at ? (
                      <Pressable
                        style={[styles.primaryBtn, busy && styles.btnDisabled]}
                        disabled={busy}
                        onPress={() =>
                          void doAction(activeOrder.rider_accepted_at ? 'pickup' : 'accept')
                        }>
                        <Text style={styles.primaryText}>
                          {busy
                            ? 'Please wait.'
                            : activeOrder.rider_accepted_at
                              ? 'Order picked up'
                              : 'Accept order'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.primaryBtn, busy && styles.btnDisabled]}
                        disabled={busy}
                        onPress={() => void doAction('deliver')}>
                        <Text style={styles.primaryText}>
                          {busy ? 'Please wait.' : 'Mark delivered'}
                        </Text>
                      </Pressable>
                    )}
                    {activeOrder.rider_accepted_at && !activeOrder.picked_up_at ? (
                      <Text style={styles.stepHint}>
                        Customer phone and address are shown above. Tap Order picked up after
                        collecting the food.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyGlyph}>--</Text>
                <Text style={styles.emptyTitle}>No active delivery</Text>
              </View>
            )}

            {data.history.length > 0 ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Recent</Text>
                  <Text style={styles.sectionCount}>{data.history.length} runs</Text>
                </View>
                <View style={styles.historyCard}>
                  {data.history.map((order) => (
                    <View key={order.id} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyId}>Order #{order.id}</Text>
                        <Text style={styles.historyMeta}>
                          {shortDate(order.delivered_at || order.created_at)}
                        </Text>
                      </View>
                      <Text style={styles.historyTotal}>₹{order.total}</Text>
                      <Text style={styles.historyStatus}>
                        {order.fulfillment_status === 'delivered' ? 'Delivered' : 'Closed'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <AppAlert data={alert} onClose={() => setAlert(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  content: { padding: 18, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: Brand.terracotta,
    fontFamily: Fonts.bodyBold,
  },
  title: {
    marginTop: 2,
    fontSize: 28,
    color: Brand.espresso,
    fontFamily: Fonts.display,
  },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: { fontSize: 12, color: Brand.stone, fontFamily: Fonts.bodyBold },
  errorCard: {
    backgroundColor: '#FDECEA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  errorText: { color: '#B3261E', fontSize: 13, fontFamily: Fonts.bodyMed },
  errorRetry: {
    marginTop: 6,
    color: Brand.terracotta,
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
  },
  loading: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Brand.stone, fontFamily: Fonts.body },
  profileCard: {
    backgroundColor: Brand.espresso,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Brand.cream, fontSize: 20, fontFamily: Fonts.bodyExtra },
  riderName: { color: Brand.cream, fontSize: 18, fontFamily: Fonts.bodyBold },
  riderMeta: {
    color: '#D5C3BD',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
    fontFamily: Fonts.body,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  onlineOn: { backgroundColor: 'rgba(30,122,52,0.28)' },
  onlineOff: { backgroundColor: 'rgba(255,255,255,0.10)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { color: Brand.cream, fontSize: 10, letterSpacing: 0.8, fontFamily: Fonts.bodyExtra },
  profileHint: {
    marginTop: 12,
    color: '#D5C3BD',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.body,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 20, color: Brand.espresso, fontFamily: Fonts.display },
  sectionCount: { fontSize: 11, color: Brand.stone, fontFamily: Fonts.bodyBold, letterSpacing: 0.5 },
  orderCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.bone,
    shadowColor: Brand.espresso,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderId: { fontSize: 20, color: Brand.espresso, fontFamily: Fonts.display },
  orderStage: {
    marginTop: 4,
    fontSize: 12,
    color: Brand.terracotta,
    fontFamily: Fonts.bodyBold,
  },
  orderTotal: { fontSize: 20, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  divider: { height: 1, backgroundColor: Brand.bone, marginVertical: 14 },
  customerName: { fontSize: 16, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  address: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: Brand.stone,
    fontFamily: Fonts.body,
  },
  distance: {
    marginTop: 5,
    fontSize: 12,
    color: Brand.terracotta,
    fontFamily: Fonts.bodySemi,
  },
  itemsBox: {
    marginTop: 12,
    backgroundColor: Brand.creamRich,
    borderRadius: 12,
    padding: 10,
    gap: 7,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemQty: { fontSize: 12, color: Brand.terracotta, fontFamily: Fonts.bodyExtra, minWidth: 24 },
  itemName: { flex: 1, fontSize: 13, color: Brand.charcoal, fontFamily: Fonts.bodyMed },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  contactBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  contactText: { fontSize: 12, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  locationWarn: {
    marginTop: 12,
    backgroundColor: '#FFF3D6',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  locationWarnText: {
    color: '#7A4B00',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.bodyMed,
  },
  locationWarnBtn: { alignSelf: 'flex-start' },
  locationWarnAction: { color: Brand.terracotta, fontSize: 12, fontFamily: Fonts.bodyBold },
  actionCol: { marginTop: 14 },
  primaryBtn: {
    backgroundColor: Brand.terracotta,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: Brand.white, fontSize: 15, fontFamily: Fonts.bodyExtra },
  btnDisabled: { opacity: 0.55 },
  stepHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: Brand.stone,
    fontFamily: Fonts.body,
  },
  emptyCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Brand.bone,
  },
  emptyGlyph: { fontSize: 22, color: Brand.gold, fontFamily: Fonts.display },
  emptyTitle: {
    marginTop: 8,
    fontSize: 18,
    color: Brand.espresso,
    fontFamily: Fonts.display,
  },
  historyCard: {
    marginTop: 2,
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.bone,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.bone,
  },
  historyId: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  historyMeta: { marginTop: 2, fontSize: 11, color: Brand.stone, fontFamily: Fonts.body },
  historyTotal: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  historyStatus: { fontSize: 10, color: '#1E7A34', fontFamily: Fonts.bodyExtra, letterSpacing: 0.4 },
});
