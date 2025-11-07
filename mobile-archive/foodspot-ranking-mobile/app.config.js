export default {
  expo: {
    name: "foodspot-ranking-mobile",
    slug: "foodspot-ranking-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "foodspot-ranking",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.foodspotranking.app",
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSExceptionDomains: {
            "cvkyvhkwsylmzlrdlbxz.supabase.co": {
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSIncludesSubdomains: true,
              NSExceptionRequiresForwardSecrecy: false
            }
          }
        }
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: "com.foodspotranking.app",
      usesCleartextTraffic: true,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Diese App benötigt Zugriff auf deinen Standort, um Foodspots zu finden."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Diese App benötigt Zugriff auf deine Fotos, um Bilder für Foodspots hochzuladen."
        }
      ],
      [
        "expo-local-authentication",
        {
          faceIDPermission: "Diese App verwendet Face ID für die sichere Anmeldung."
        }
      ]
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      mapsApiKey: process.env.EXPO_PUBLIC_MAPS_API_KEY
    }
  }
};

