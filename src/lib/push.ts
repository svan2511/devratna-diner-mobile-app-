import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Order-status push via Expo Push Service.
 *
 * IMPORTANT: Expo Go (SDK 53+) me remote push REMOVED hai — waha ye file
 * silently no-op hai aur app polling (10s Orders refresh) se chalegi.
 * Push automatically development/production build me kaam karegi.
 */

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  try {
    // Expo Go me remote push removed hai — module ko require karte hi wo
    // throw karta hai (catch ke bawajood LogBox me error aata hai),
    // isliye pehle se pehchano aur chhuo hi mat.
    if (Constants.appOwnership === 'expo') return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export function isPushAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return loadNotifications() !== null;
}

/** Foreground banner + sound — module load pe ek baar, guarded. */
export function setupNotificationHandler(): void {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // ignore
  }
}

export async function registerPushToken(): Promise<string | null> {
  const r = await registerPushTokenDetailed();
  return r.ok ? (r.token ?? null) : null;
}

export type PushStatus =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/** Detailed version — Profile screen me status dikhane ke liye. */
export async function registerPushTokenDetailed(): Promise<PushStatus> {
  const Notifications = loadNotifications();
  try {
    if (!Notifications) {
      if (Constants.appOwnership === 'expo') return { ok: false, reason: 'Expo Go me push nahi — dev build chahiye' };
      return { ok: false, reason: 'Push module missing — nayi dev build banao' };
    }
    if (Platform.OS === 'web') return { ok: false, reason: 'Web pe push nahi' };
    if (!Device.isDevice) return { ok: false, reason: 'Emulator me push nahi — real phone chahiye' };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { ok: false, reason: 'Permission denied — Settings me Allow karo' };

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } })?.easConfig?.projectId;
    if (!projectId) return { ok: false, reason: 'EAS project ID nahi — EAS build chahiye' };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!data) return { ok: false, reason: 'Token nahi bana — FCM setup check karo' };
    return { ok: true, token: data };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 140) : 'Token failed' };
  }
}

export function addPushReceivedListener(cb: () => void): { remove: () => void } | null {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    return Notifications.addNotificationReceivedListener(cb);
  } catch {
    return null;
  }
}

export function addPushResponseListener(cb: () => void): { remove: () => void } | null {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    return Notifications.addNotificationResponseReceivedListener(cb);
  } catch {
    return null;
  }
}
