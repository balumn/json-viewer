import { registerSW } from "virtual:pwa-register";

// Offline-after-load (PWA). No data is ever sent anywhere; all processing is local.
registerSW({ immediate: true });


