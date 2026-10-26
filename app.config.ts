import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Static app.json + build-time native config.
 * GOOGLE_MAPS_API_KEY is read by EAS/prebuild, not shipped to JS.
 * Demo Key restrictions: enable "Maps SDK for Android" in Google Cloud.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [...(config.plugins ?? [])];
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (googleMapsApiKey) {
    plugins.push([
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ]);
  }

  return {
    ...config,
    plugins,
  } as ExpoConfig;
};
