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
  const Notifications = loadNotifications();
  try {
    if (!Notifications || Platform.OS === 'web' || !Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } })?.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data ?? null;
  } catch {
    return null;
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
