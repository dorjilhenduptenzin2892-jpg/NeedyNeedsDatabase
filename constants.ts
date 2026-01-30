
export const APP_NAME = "NeedyNeeds"; 
export const LOGO_URL = "logo.png";
export const BUILD_VERSION = "4.2.5 (Cloud Connected)";

/**
 * GOOGLE_SHEET_WEB_APP_URL:
 * This is your specific deployment URL.
 */
export const WEB_APP_URL: string = "https://script.google.com/macros/s/AKfycbyaLvIsyIrKtuet1zcf2lkTUkr0egt7SIPyESrWBxFgA1B_qW1ZyOWr1Rf9YKM_J4cyQw/exec";

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
