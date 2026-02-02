
import { Order, BatchCost } from '../types';
import { WEB_APP_URL } from '../constants';

const isConfigured = () => {
  return WEB_APP_URL && WEB_APP_URL.startsWith("https://script.google.com");
};

const orderToRow = (o: Order): any[] => [
  String(o.id || '').trim(),
  String(o.groupId || '').trim(),
  o.createdAt || Date.now(),
  String(o.batchName || '').trim(),
  String(o.customerName || '').trim(),
  String(o.address || '').trim(),
  String(o.phoneNumber || '').trim(),
  String(o.productName || '').trim(),
  Number(o.sellingPrice || 0),
  Number(o.quantity || 0),
  Number(o.advancePaid || 0),
  String(o.transportMode || 'Keep at Shop'),
  Boolean(o.isFullPaymentReceived),
  String(o.note || '').trim()
];

const rowToOrder = (row: any[]): Order | null => {
  if (!row || row.length < 1 || !row[0]) return null;
  
  const parseBool = (val: any) => {
    if (typeof val === 'boolean') return val;
    const s = String(val).toUpperCase();
    return s === 'TRUE' || s === 'YES' || val === 1 || val === '1';
  };

  return {
    id: String(row[0]).trim(),
    groupId: String(row[1] || '').trim(),
    createdAt: !isNaN(Number(row[2])) ? Number(row[2]) : Date.now(),
    batchName: String(row[3] || '').trim(),
    customerName: String(row[4] || '').trim(),
    address: String(row[5] || '').trim(),
    phoneNumber: String(row[6] || '').trim(),
    productName: String(row[7] || '').trim(),
    sellingPrice: Number(row[8] || 0),
    quantity: Number(row[9] || 0),
    advancePaid: Number(row[10] || 0),
    transportMode: (row[11] as any) || 'Keep at Shop',
    isFullPaymentReceived: parseBool(row[12]),
    note: String(row[13] || '').trim()
  };
};

export const loadDataFromSheets = async () => {
  if (!isConfigured()) {
    const localOrders = localStorage.getItem('nn_orders');
    const localCosts = localStorage.getItem('nn_costs');
    return {
      orders: localOrders ? JSON.parse(localOrders) : [],
      batchCosts: localCosts ? JSON.parse(localCosts) : []
    };
  }

  try {
    const url = `${WEB_APP_URL}?t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow'
    });
    
    if (!response.ok) {
        throw new Error("CLOUD_ACCESS_FAILED");
    }
    
    const result = await response.json();
    const orders = (result.orders || []).map(rowToOrder).filter((o: any) => o !== null);
    const batchCosts = (result.costs || []).map((row: any[]) => ({
      batchName: String(row[0] || '').trim(),
      totalCostPrice: Number(row[1] || 0),
      oatInputValue: Number(row[2] || 0),
      deliveryFeeQuantity: row[3] !== undefined && row[3] !== "" ? Number(row[3]) : undefined
    }));

    return { orders, batchCosts };
  } catch (error: any) {
    console.error("Cloud Access Error:", error);
    throw error;
  }
};

export const syncOrdersToSheet = async (orders: Order[]) => {
  if (!isConfigured()) return;
  try {
    await fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'syncOrders',
        data: orders.map(orderToRow)
      })
    });
  } catch (err) {
    console.error("Orders sync interrupted:", err);
  }
};

export const syncBatchCostsToSheet = async (costs: BatchCost[]) => {
  if (!isConfigured()) return;
  try {
    await fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'syncCosts',
        data: costs.map(c => [
          String(c.batchName || '').trim(),
          Number(c.totalCostPrice || 0),
          Number(c.oatInputValue || 0),
          c.deliveryFeeQuantity !== undefined ? Number(c.deliveryFeeQuantity) : ''
        ])
      })
    });
  } catch (err) {
    console.error("Costs sync interrupted:", err);
  }
};
