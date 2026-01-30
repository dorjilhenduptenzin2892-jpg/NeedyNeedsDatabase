
export const APP_NAME = "NeedyNeeds"; 
export const LOGO_URL = "logo.png";
export const BUILD_VERSION = "4.2.5 (Cloud Connected)";

/**
 * GOOGLE_SHEET_WEB_APP_URL:
 * This is your specific deployment URL.
 */
// Prefer the Vite environment variable `VITE_WEB_APP_URL` when provided by Vercel.
// Set `VITE_WEB_APP_URL` in Vercel (or in `.env`) to point to your Apps Script web app.
export const WEB_APP_URL: string = (import.meta.env && (import.meta.env.VITE_WEB_APP_URL as string)) || "https://script.google.com/macros/s/AKfycbzkU61DPOJESPo34607bq_wYuz7TOkqu-i3a4rP2kKpiyNM4DsHvu_p4EcGO7GGAabvcg/exec";

export const DELIVERY_FEE_PER_ITEM = 100;
export const OAT_RATE = 28;
export const FIXED_CHARGE = 150;

export const TRANSPORT_MODES = [
  'Bus',
  'Taxi',
  'Post',
  'Keep at Shop'
] as const;

export const APP_VIEWS = {
  DASHBOARD: 'dashboard',
  NEW_ORDER: 'new_order',
  ORDER_LIST: 'order_list',
  BATCH_ANALYTICS: 'batch_analytics'
} as const;

export type AppView = typeof APP_VIEWS[keyof typeof APP_VIEWS];
