
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, PlusCircle, List, Menu, X, PieChart, Loader2, RefreshCw, AlertTriangle, ExternalLink, CheckCircle2, CloudOff, Info, Copy, Check, BookOpen, ShieldAlert, UserCircle, LogOut, Cloud } from 'lucide-react';
import { Order, OrderFormData, BatchCost } from './types';
import { APP_VIEWS, AppView, APP_NAME, WEB_APP_URL, LOGO_URL, BUILD_VERSION } from './constants';
import { 
  loadDataFromSheets, 
  syncOrdersToSheet, 
  syncBatchCostsToSheet 
} from './services/storage';
import { Dashboard } from './components/Dashboard';
import { OrderForm } from './components/OrderForm';
import { OrderList } from './components/OrderList';
import { BatchAnalytics } from './components/BatchAnalytics';

const generateId = () => {
  try {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(APP_VIEWS.DASHBOARD);
  const [orders, setOrders] = useState<Order[]>([]);
  const [batchCosts, setBatchCosts] = useState<BatchCost[]>([]);

  const ordersRef = useRef<Order[]>([]);
  const costsRef = useRef<BatchCost[]>([]);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [customerContext, setCustomerContext] = useState<Partial<Order> | null>(null);
  const [targetBatchToEdit, setTargetBatchToEdit] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isConfigured = WEB_APP_URL && WEB_APP_URL.startsWith("https://script.google.com") && !WEB_APP_URL.includes("YOUR_PASTED");

  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { costsRef.current = batchCosts; }, [batchCosts]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setSyncError(null);
      try {
        const data = await loadDataFromSheets();
        if (data.orders) setOrders(data.orders);
        if (data.batchCosts) setBatchCosts(data.batchCosts);
      } catch (err: any) {
        console.error("Initial load failed:", err);
        setSyncError(err.message || 'Connection Blocked');
        const localOrders = localStorage.getItem('demo_orders');
        const localCosts = localStorage.getItem('demo_costs');
        if (localOrders) setOrders(JSON.parse(localOrders));
        if (localCosts) setBatchCosts(JSON.parse(localCosts));
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [isConfigured]);

  const triggerCloudSync = useCallback(async (currentOrders: Order[], currentCosts: BatchCost[]) => {
    if (!isConfigured) {
      localStorage.setItem('demo_orders', JSON.stringify(currentOrders));
      localStorage.setItem('demo_costs', JSON.stringify(currentCosts));
      return;
    }

    setIsSyncing(true);
    try {
      await syncOrdersToSheet(currentOrders);
      await syncBatchCostsToSheet(currentCosts);
      setSyncError(null);
      localStorage.setItem('demo_orders', JSON.stringify(currentOrders));
      localStorage.setItem('demo_costs', JSON.stringify(currentCosts));
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncError("Sync Failed. Cloud not updated.");
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured]);

  // Debounced cloud sync on any data change
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      triggerCloudSync(orders, batchCosts);
    }, 1500);
    return () => clearTimeout(timer);
  }, [orders, batchCosts, isLoading, triggerCloudSync]);

  const refreshData = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await loadDataFromSheets();
      if (data.orders) setOrders(data.orders);
      if (data.batchCosts) setBatchCosts(data.batchCosts);
    } catch (err: any) {
      setSyncError(err.message || 'Failed to fetch');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateOrUpdateOrder = (data: OrderFormData | OrderFormData[]) => {
    setOrders(prev => {
      let next = [...prev];
      if (editingOrder) {
        const eid = String(editingOrder.id).trim();
        if (Array.isArray(data)) {
          const gid = editingOrder.groupId || generateId();
          const firstItem = data[0];
          const rest = data.slice(1);
          next = next.map(o => String(o.id).trim() === eid ? { ...firstItem, id: editingOrder.id, createdAt: editingOrder.createdAt, groupId: gid } : o);
          const newOnes: Order[] = rest.map(d => ({ ...d, id: generateId(), groupId: gid, createdAt: Date.now() }));
          next = [...newOnes, ...next];
        } else {
          next = next.map(o => String(o.id).trim() === eid ? { ...data, id: editingOrder.id, createdAt: editingOrder.createdAt, groupId: editingOrder.groupId } : o);
        }
      } else {
        if (Array.isArray(data)) {
          const gid = generateId();
          const newOnes: Order[] = data.map(d => ({ ...d, id: generateId(), groupId: gid, createdAt: Date.now() }));
          next = [...newOnes, ...next];
        } else {
          next = [{ ...data, id: generateId(), createdAt: Date.now() }, ...next];
        }
      }
      return next;
    });
    setEditingOrder(null);
    setCustomerContext(null);
    setCurrentView(APP_VIEWS.ORDER_LIST);
  };

  const handleDeleteOrder = (idOrIds: string | string[]) => {
    const idsToKill = Array.isArray(idOrIds) 
      ? idOrIds.map(id => String(id).trim()) 
      : [String(idOrIds).trim()];
    
    const killSet = new Set(idsToKill);
    
    setOrders(prev => {
      const filtered = prev.filter(order => !killSet.has(String(order.id).trim()));
      return filtered;
    });
  };

  const handleBulkUpdateOrders = (updatedList: Order[]) => {
    setOrders(prev => {
      const updates = new Map(updatedList.map(o => [String(o.id).trim(), o]));
      return prev.map(o => updates.has(String(o.id).trim()) ? updates.get(String(o.id).trim())! : o);
    });
  };

  const handleUpdateBatchCost = (cost: BatchCost) => {
    setBatchCosts(prev => {
      const next = [...prev];
      const idx = next.findIndex(c => c.batchName === cost.batchName);
      if (idx >= 0) next[idx] = cost; else next.push(cost);
      return next;
    });
  };

  const NavItem = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setEditingOrder(null);
        setCustomerContext(null);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium ${currentView === view ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin h-12 w-12 text-rose-600 mb-4" />
        <p className="text-slate-500 font-medium tracking-wide">Connecting to Cloud Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row print:bg-white relative">
      <aside className={`fixed inset-0 z-10 bg-white md:static md:w-72 md:h-screen border-r border-slate-100 p-6 flex flex-col transition-transform duration-300 ease-in-out print:hidden text-slate-900 ${isMobileMenuOpen ? 'translate-x-0 pt-24' : '-translate-x-full md:translate-x-0'}`}>
        <div className="hidden md:flex items-center gap-3 font-bold text-2xl mb-10 px-2">
           <img src={LOGO_URL} alt="Logo" className="w-14 h-14 rounded-full object-cover shadow-lg shadow-rose-200" />
           <span className="font-serif tracking-tight">{APP_NAME}</span>
        </div>
        
        <nav className="space-y-2 flex-1">
          <NavItem view={APP_VIEWS.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={APP_VIEWS.NEW_ORDER} icon={PlusCircle} label="New Order" />
          <NavItem view={APP_VIEWS.ORDER_LIST} icon={List} label="Order History" />
          <NavItem view={APP_VIEWS.BATCH_ANALYTICS} icon={PieChart} label="Analytics" />
        </nav>
        
        <div className="mt-auto space-y-4">
           {isSyncing ? (
             <div className="bg-indigo-50 text-indigo-700 px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-100 animate-pulse">
               <Loader2 className="animate-spin" size={14} /> Saving to Cloud...
             </div>
           ) : (
             <div className={`px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 border ${syncError ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
               {syncError ? <CloudOff size={14} /> : <CheckCircle2 size={14} />}
               {syncError ? 'Offline Mode' : 'Cloud Connected'}
             </div>
           )}
           <button onClick={refreshData} className="w-full flex items-center justify-center gap-2 text-slate-500 text-sm hover:text-slate-900 py-2 border-t border-slate-50 pt-4 transition-colors">
             <RefreshCw size={14} /> Refresh Data
           </button>
           <div className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold opacity-50">
             V {BUILD_VERSION}
           </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen print:h-auto print:overflow-visible text-slate-900">
        <header className="mb-8 flex justify-between items-center print:hidden">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 font-serif">
            {currentView === APP_VIEWS.DASHBOARD && 'Dashboard'}
            {currentView === APP_VIEWS.NEW_ORDER && (editingOrder ? 'Edit Record' : 'New Entry')}
            {currentView === APP_VIEWS.ORDER_LIST && 'Database'}
            {currentView === APP_VIEWS.BATCH_ANALYTICS && 'Analytics'}
          </h1>
          <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>
        <div className="print:w-full">
          {currentView === APP_VIEWS.DASHBOARD && <Dashboard orders={orders} batchCosts={batchCosts} />}
          {currentView === APP_VIEWS.NEW_ORDER && <OrderForm initialData={editingOrder || undefined} customerContext={customerContext || undefined} existingBatches={Array.from(new Set(orders.map(o => o.batchName)))} onSubmit={handleCreateOrUpdateOrder} onCancel={() => { setEditingOrder(null); setCustomerContext(null); setCurrentView(APP_VIEWS.DASHBOARD); }} />}
          {currentView === APP_VIEWS.ORDER_LIST && <OrderList orders={orders} batchCosts={batchCosts} onDelete={handleDeleteOrder} onEdit={(o) => { setEditingOrder(o); setCurrentView(APP_VIEWS.NEW_ORDER); }} onAddMore={(o) => { setCustomerContext(o); setCurrentView(APP_VIEWS.NEW_ORDER); }} onEditBatchCost={(b) => { setTargetBatchToEdit(b); setCurrentView(APP_VIEWS.BATCH_ANALYTICS); }} onUpdateOrders={handleBulkUpdateOrders} />}
          {currentView === APP_VIEWS.BATCH_ANALYTICS && <BatchAnalytics orders={orders} batchCosts={batchCosts} onUpdateBatchCost={handleUpdateBatchCost} initialEditBatch={targetBatchToEdit} />}
        </div>
      </main>
    </div>
  );
}
