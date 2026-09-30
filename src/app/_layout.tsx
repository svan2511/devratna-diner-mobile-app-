import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { AppSplash } from '@/components/app-splash';
import { getInitialNotificationData } from '@/lib/push';
import { isOrderPush, ordersTabFromPushData, setPendingOrdersTab } from '@/lib/notify-target';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Marcellus_400Regular,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });
  // Branded launch — native splash (logo on cream) hands off to the
  // animated AppSplash, which fades into the app.
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Cold start via notification tap — app band thi. Target home pe
  // consume hoga (orders tab + sahi sub-tab khulega).
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    (async () => {
      try {
        const data = await getInitialNotificationData();
        if (data && isOrderPush(data)) {
          setPendingOrdersTab(ordersTabFromPushData(data));
          router.replace('/home');
        }
      } catch {
        // ignore — normal launch
      }
    })();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
      <CartProvider>
      <StatusBar style="dark" />
      {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FFF8EE' },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="home" />
      </Stack>
      </CartProvider>
    </AuthProvider>
  );
}
