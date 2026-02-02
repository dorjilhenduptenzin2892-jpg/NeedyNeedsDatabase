
export const APP_NAME = "NeedyNeeds"; 
export const LOGO_URL = "logo.png";
export const BUILD_VERSION = "3.3.2 (Demo)";

// --- GOOGLE SHEETS CONFIGURATION ---
// Production URL: https://needyneeds-manager-777450546992.us-west1.run.app
// (Ensure this URL is added to "Authorized JavaScript origins" in Google Cloud Console)

export const GOOGLE_CLIENT_ID: string = "";
export const GOOGLE_API_KEY: string = "";
export const SPREADSHEET_ID: string = "";
// -----------------------------------

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