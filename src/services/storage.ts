
import { Order, BatchCost } from '../types';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, SPREADSHEET_ID } from '../constants';

// Declare gapi global types for TS
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Helper to check if we are in valid production mode
const isConfigured = () => {
  return (
    GOOGLE_CLIENT_ID && 
    !GOOGLE_CLIENT_ID.includes("YOUR_CLIENT") && 
    GOOGLE_API_KEY && 
    !GOOGLE_API_KEY.includes("YOUR_API") &&
    SPREADSHEET_ID && 
    !SPREADSHEET_ID.includes("YOUR_SPREADSHEET")
  );
};

// --- INITIALIZATION ---

export const initializeGoogleApi = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If not configured, we resolve immediately to allow Demo/Offline mode
    if (!isConfigured()) {
      console.log("App running in Demo/Offline mode (Missing Credentials)");
      resolve();
      return;
    }

    // If already initialized, return immediately
    if (gapiInited && gisInited) {
      resolve();
      return;
    }

    //  poll for the global scripts
    const checkInterval = setInterval(() => {
      const gapiLoaded = typeof window !== 'undefined' && !!window.gapi && !!window.gapi.load;
      const googleLoaded = typeof window !== 'undefined' && !!window.google && !!window.google.accounts;

      if (gapiLoaded && googleLoaded) {
        clearInterval(checkInterval);
        startInit();
      }
    }, 200);

    const startInit = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;

          try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: SCOPES,
              callback: '', 
            });
            gisInited = true;
            resolve();
          } catch (gisErr) {
            reject(gisErr);
          }
        } catch (gapiErr) {
          reject(gapiErr);
        }
      });
    };
  });
};

export const signInToGoogle = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      resolve();
      return;
    }

    if (!tokenClient) {
      reject(new Error("Google Auth not initialized. Refresh the page."));
      return;
    }
    
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      resolve();
    };
    
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

// --- DATA MAPPING ---

const orderToRow = (o: Order): any[] => [
  o.id,
  o.groupId || '',
  o.createdAt,
  o.batchName,
  o.customerName,
  o.address,
  o.phoneNumber,
  o.productName,
  o.sellingPrice,
  o.quantity,
  o.advancePaid,
  o.transportMode,
  o.isFullPaymentReceived,
  o.note || ''
];

const rowToOrder = (row: any[]): Order | null => {
  if (!row || row.length === 0 || !row[0]) return null;
  
  return {
    id: String(row[0]).trim(), // STRICT STRING CONVERSION + TRIM to avoid comparison failures
    groupId: row[1] || undefined,
    createdAt: Number(row[2]) || 0,
    batchName: row[3] || '',
    customerName: row[4] || '',
    address: row[5] || '',
    phoneNumber: row[6] || '',
    productName: row[7] || '',
    sellingPrice: Number(row[8]) || 0,
    quantity: Number(row[9]) || 0,
    advancePaid: Number(row[10]) || 0,
    transportMode: (row[11] as any) || 'Keep at Shop',
    isFullPaymentReceived: row[12] === 'TRUE' || row[12] === true,
    note: row[13] && String(row[13]).trim() ? String(row[13]).trim() : undefined
  };
};

const costToRow = (c: BatchCost): any[] => [
  c.batchName,
  c.totalCostPrice,
  c.oatInputValue,
  c.deliveryFeeQuantity || ''
];

const rowToCost = (row: any[]): BatchCost => ({
  batchName: row[0],
  totalCostPrice: Number(row[1]) || 0,
  oatInputValue: Number(row[2]) || 0,
  deliveryFeeQuantity: row[3] ? Number(row[3]) : undefined
});

// --- API CALLS ---

export const loadDataFromSheets = async () => {
  if (!isConfigured()) {
    const localOrders = localStorage.getItem('demo_orders');
    const localCosts = localStorage.getItem('demo_costs');
    return {
      orders: localOrders ? JSON.parse(localOrders) : [],
      batchCosts: localCosts ? JSON.parse(localCosts) : []
    };
  }

  try {
    const ordersResponse = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A2:N', 
    });

    const rows = ordersResponse.result.values || [];
    const orders = rows.map(rowToOrder).filter((o: Order | null) => o !== null) as Order[];

    let batchCosts: BatchCost[] = [];
    try {
      const costsResponse = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'BatchCosts!A2:D',
      });
      const costRows = costsResponse.result.values || [];
      batchCosts = costRows.map(rowToCost);
    } catch (e) {
      console.warn("BatchCosts tab might not exist yet", e);
    }

    return { orders, batchCosts };

  } catch (error) {
    console.error("Error loading from sheets", error);
    throw error;
  }
};

export const syncOrdersToSheet = async (orders: Order[]) => {
  if (!isConfigured()) {
    localStorage.setItem('demo_orders', JSON.stringify(orders));
    return;
  }

  const rows = orders.map(orderToRow);
  
  await window.gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Orders!A2:N9999',
  });

  if (rows.length === 0) return;

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Orders!A2',
    valueInputOption: 'RAW',
    resource: { values: rows },
  });
};

export const syncBatchCostsToSheet = async (costs: BatchCost[]) => {
  if (!isConfigured()) {
    localStorage.setItem('demo_costs', JSON.stringify(costs));
    return;
  }

  const rows = costs.map(costToRow);

  await window.gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'BatchCosts!A2:D9999',
  });

  if (rows.length === 0) return;

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'BatchCosts!A2',
    valueInputOption: 'RAW',
    resource: { values: rows },
  });
};
