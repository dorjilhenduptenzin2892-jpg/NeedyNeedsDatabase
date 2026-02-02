
export const APP_NAME = "NeedyNeeds Inventory"; 
export const BUILD_VERSION = "4.6.0 (Cloud)";

/**
 * GOOGLE_SHEET_WEB_APP_URL:
 * Deployment URL for the Apps Script Bridge.
 */
export const WEB_APP_URL: string = "https://script.google.com/macros/s/AKfycby2f6wXVE4xfsIP19dmzLR-K5v-XUwQOyH9J25Tm1HFZBb0tUa4IPW5xQ0p4FSStbm-/exec";
export const DEPLOYMENT_ID: string = "AKfycby2f6wXVE4xfsIP19dmzLR-K5v-XUwQOyH9J25Tm1HFZBb0tUa4IPW5xQ0p4FSStbm-";

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
