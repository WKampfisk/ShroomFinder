import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shroomfinder.wilddex',
  appName: 'ShroomFinder',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    cleartext: true, // dev only; set false or remove for release APK
  },
  plugins: {
    Camera: {},
    Geolocation: {},
    Filesystem: {},
    Preferences: {}
  }
};

export default config;