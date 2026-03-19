import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.what2play.app",
  appName: "What2Play",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#F8F6F1",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#F8F6F1",
    },
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#2D7A4F",
    },
  },
};

export default config;
