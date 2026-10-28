import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_BASE_URL } from './api';

type TaskManagerApi = typeof import('expo-task-manager');

/**
 * Purane dev build/APK me expo-task-manager native module nahi hota. Static
 * import wahan poori app crash kar deta hai, isliye lazy + guarded load:
 * module na mile to sirf foreground tracking fallback chalta hai.
 */
function loadTaskManager(): TaskManagerApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-task-manager') as TaskManagerApi;
  } catch {
    return null;
  }
}

const TaskManager = Platform.OS === 'web' ? null : loadTaskManager();

/**
 * Rider live location.
 *
 * Background me Maps/other app kholne par bhi rider location bhejni hai,
 * isliye active delivery ke waqt expo-location background task (Android
 * foreground service ke saath) chalta hai. Permission na mile to rider screen
 * foreground watcher par fallback karti hai.
 */

export const RIDER_LOCATION_TASK = 'devratna-rider-location';
export type RiderTrackingMode = 'background' | 'foreground' | 'denied';

type RiderLocationSession = { token: string; orderId: number };

const SESSION_KEY = 'devratna.rider.location.session';

let memorySession: RiderLocationSession | null = null;

async function readSession(): Promise<RiderLocationSession | null> {
  if (memorySession) return memorySession;
  if (Platform.OS === 'web') return null;

  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RiderLocationSession>;
    if (typeof parsed.token !== 'string' || typeof parsed.orderId !== 'number') {
      return null;
    }
    memorySession = { token: parsed.token, orderId: parsed.orderId };
    return memorySession;
  } catch {
    return null;
  }
}

async function writeSession(next: RiderLocationSession | null): Promise<void> {
  memorySession = next;
  if (Platform.OS === 'web') return;

  try {
    if (next) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // Memory session hi kaafi hai; task agla update retry karega.
  }
}

async function postRiderLocation(
  token: string,
  orderId: number,
  coords: { latitude: number; longitude: number; accuracy: number | null },
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/rider/orders/${orderId}/location`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_m:
        coords.accuracy == null ? null : Math.min(10_000, Math.round(coords.accuracy)),
    }),
  });

  // Token/order stale ho gaya - task band karo, warna error loop chalta rahega.
  if ([401, 403, 404, 422].includes(response.status)) {
    await stopRiderLocationTracking();
  }
}

async function stopTaskOnly(): Promise<void> {
  if (Platform.OS === 'web' || TaskManager === null) return;

  try {
    if (await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK);
    }
  } catch {
    // Task pehle se band hai.
  }
}

if (TaskManager !== null && !TaskManager.isTaskDefined(RIDER_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
    RIDER_LOCATION_TASK,
    async ({ data, error }) => {
      if (error) return;

      const locations = data?.locations;
      if (!locations?.length) return;

      const current = await readSession();
      if (!current) return;

      const last = locations[locations.length - 1];
      try {
        await postRiderLocation(current.token, current.orderId, last.coords);
      } catch {
        // Network miss - agla location update retry karega.
      }
    },
  );
}

/**
 * Active order par call karo (pickup par Maps kholne se pehle bhi). Background
 * permission mili to task start hota hai; warna foreground mode return hota
 * hai aur app khula rehne tak hi location jaati hai.
 */
export async function startRiderLocationTracking(
  token: string,
  orderId: number,
): Promise<RiderTrackingMode> {
  if (Platform.OS === 'web') return 'foreground';

  let foreground: Location.LocationPermissionResponse;
  try {
    foreground = await Location.requestForegroundPermissionsAsync();
  } catch {
    await writeSession(null);
    await stopTaskOnly();
    return 'denied';
  }

  if (!foreground.granted) {
    await writeSession(null);
    await stopTaskOnly();
    return 'denied';
  }

  // Native module missing (purana build) - foreground watcher hi chalega.
  if (TaskManager === null) return 'foreground';

  let background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (!background?.granted && background?.canAskAgain) {
    background = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  }

  await writeSession({ token, orderId });

  if (!background?.granted) {
    await stopTaskOnly();
    return 'foreground';
  }

  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10_000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        foregroundService: {
          notificationTitle: 'Dev Ratna delivery',
          notificationBody: 'Sharing your live location with the customer',
          notificationColor: '#C65D3A',
          killServiceOnDestroy: true,
        },
      });
    }
    return 'background';
  } catch {
    await stopTaskOnly();
    return 'foreground';
  }
}

export async function stopRiderLocationTracking(): Promise<void> {
  await writeSession(null);
  await stopTaskOnly();
}
