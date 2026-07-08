import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shroomfinder.wilddex',
  appName: 'ShroomFinder',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: { cleartext: true },
  plugins: { Camera: {}, Geolocation: {}, Filesystem: {}, Preferences: {} }
};

export default config;