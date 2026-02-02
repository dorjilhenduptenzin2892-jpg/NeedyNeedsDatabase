
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, PlusCircle, List, Menu, X, PieChart, Loader2, RefreshCw, AlertTriangle, CloudOff, Cloud, ShieldCheck, Lock } from 'lucide-react';
import { Order, OrderFormData, BatchCost } from './types';
import { APP_VIEWS, AppView, APP_NAME, WEB_APP_URL, BUILD_VERSION } from './constants';
import { 
  loadDataFromSheets, 
  syncOrdersToSheet, 
  syncBatchCostsToSheet 
} from './services/storage';
import { Dashboard } from './components/Dashboard';
import { OrderForm } from './components/OrderForm';
import { OrderList } from './components/OrderList';
import { BatchAnalytics } from './components/BatchAnalytics';
import { Admin } from './components/Admin';

const ADMIN_PASSWORD = "Ghost006*";

const generateId = () => {
  try {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView | 'admin'>(APP_VIEWS.DASHBOARD);
  const [orders, setOrders] = useState<Order[]>([]);
  const [batchCosts, setBatchCosts] = useState<BatchCost[]>([]);

  const ordersRef = useRef<Order[]>([]);
  const costsRef = useRef<BatchCost[]>([]);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [customerContext, setCustomerContext] = useState<Partial<Order> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [batchToEditInAnalytics, setBatchToEditInAnalytics] = useState<string | null>(null);
  
  // Admin Protection
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const isConfigured = WEB_APP_URL && WEB_APP_URL.startsWith("https://script.google.com");

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
        const localOrders = localStorage.getItem('nn_orders');
        const localCosts = localStorage.getItem('nn_costs');
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
      localStorage.setItem('nn_orders', JSON.stringify(currentOrders));
      localStorage.setItem('nn_costs', JSON.stringify(currentCosts));
      return;
    }

    setIsSyncing(true);
    try {
      await syncOrdersToSheet(currentOrders);
      await syncBatchCostsToSheet(currentCosts);
      setSyncError(null);
      localStorage.setItem('nn_orders', JSON.stringify(currentOrders));
      localStorage.setItem('nn_costs', JSON.stringify(currentCosts));
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncError("Cloud Sync Pending");
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      triggerCloudSync(orders, batchCosts);
    }, 2000);
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
      setSyncError(err.message || 'Refresh failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const verifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setCurrentView('admin');
      setShowPasswordPrompt(false);
      setPasswordInput("");
      setPasswordError(false);
      setIsMobileMenuOpen(false);
    } else {
      setPasswordError(true);
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
    setOrders(prev => prev.filter(order => !killSet.has(String(order.id).trim())));
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
    setBatchToEditInAnalytics(null);
  };

  const NavItem = ({ view, icon: Icon, label, isAdmin = false }: { view: any, icon: any, label: string, isAdmin?: boolean }) => (
    <button
      onClick={() => {
        if (isAdmin) {
          setShowPasswordPrompt(true);
        } else {
          setCurrentView(view);
          setEditingOrder(null);
          setCustomerContext(null);
          setBatchToEditInAnalytics(null);
          setIsMobileMenuOpen(false);
        }
      }}
      className={`flex items-center gap-3 w-full px-5 py-3.5 rounded-xl transition-all duration-200 font-semibold text-sm ${currentView === view ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-1' : 'text-slate-500 hover:bg-white hover:text-slate-900'}`}
    >
      <Icon size={18} className={currentView === view ? 'text-rose-500' : ''} />
      <span>{label}</span>
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin h-10 w-10 text-slate-900 mb-6" />
        <div className="text-center">
            <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">{APP_NAME}</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Connecting to Secure Cloud</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col md:flex-row print:bg-white relative">
      <aside className={`fixed inset-0 z-40 bg-slate-50 md:static md:w-80 md:h-screen border-r border-slate-100 p-8 flex flex-col transition-transform duration-300 ease-in-out print:hidden ${isMobileMenuOpen ? 'translate-x-0 pt-24' : '-translate-x-full md:translate-x-0'}`}>
        
        <div className="hidden md:flex flex-col gap-0.5 mb-14 px-1">
           <span className="font-serif text-3xl font-bold text-slate-900 tracking-tight leading-none">NeedyNeeds</span>
           <span className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-slate-400 mt-1">Inventory Management</span>
        </div>
        
        <nav className="space-y-1.5 flex-1">
          <NavItem view={APP_VIEWS.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={APP_VIEWS.NEW_ORDER} icon={PlusCircle} label="New Order" />
          <NavItem view={APP_VIEWS.ORDER_LIST} icon={List} label="All Orders" />
          <NavItem view={APP_VIEWS.BATCH_ANALYTICS} icon={PieChart} label="Financial Reports" />
          <div className="pt-4 border-t border-slate-200/40 mt-4">
             <NavItem view="admin" icon={ShieldCheck} label="System Admin" isAdmin />
          </div>
        </nav>
        
        <div className="mt-auto pt-8 border-t border-slate-200/60 space-y-5">
           <div className="px-5 py-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
               <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connectivity</span>
                    <div className={`w-2 h-2 rounded-full ${syncError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} />
               </div>
               {isSyncing ? (
                 <div className="text-slate-900 font-bold text-xs flex items-center gap-2">
                   <RefreshCw className="animate-spin" size={12} /> Syncing...
                 </div>
               ) : (
                 <div className={`font-bold text-xs flex items-center gap-2 ${syncError ? 'text-rose-600' : 'text-slate-900'}`}>
                   {syncError ? <CloudOff size={14} /> : <Cloud size={14} />}
                   {syncError ? 'Local Mode' : 'Cloud Synchronized'}
                 </div>
               )}
           </div>

           <button onClick={refreshData} className="w-full flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-900 transition-colors py-2 group">
             <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" /> Full System Sync
           </button>
           
           <div className="text-[9px] text-slate-300 text-center uppercase tracking-[0.3em] font-black opacity-60">
             Build {BUILD_VERSION}
           </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto h-screen print:h-auto print:overflow-visible text-slate-900 custom-scrollbar">
        <header className="mb-12 flex justify-between items-start print:hidden">
          <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5">
                Authorized Access Repository
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif tracking-tight">
                {currentView === APP_VIEWS.DASHBOARD && 'Strategic Overview'}
                {currentView === APP_VIEWS.NEW_ORDER && (editingOrder ? 'Modify Entry' : 'Create Transaction')}
                {currentView === APP_VIEWS.ORDER_LIST && 'Inventory Database'}
                {currentView === APP_VIEWS.BATCH_ANALYTICS && 'Performance Analytics'}
                {currentView === 'admin' && 'Cloud Infrastructure'}
              </h1>
          </div>
          <button className="md:hidden p-3 bg-white shadow-sm border border-slate-100 rounded-xl text-slate-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <div className="print:w-full">
          {currentView === APP_VIEWS.DASHBOARD && <Dashboard orders={orders} batchCosts={batchCosts} />}
          {currentView === APP_VIEWS.NEW_ORDER && <OrderForm initialData={editingOrder || undefined} customerContext={customerContext || undefined} existingBatches={Array.from(new Set(orders.map(o => o.batchName)))} onSubmit={handleCreateOrUpdateOrder} onCancel={() => { 
            if (editingOrder || customerContext) {
              setCurrentView(APP_VIEWS.ORDER_LIST);
            } else {
              setCurrentView(APP_VIEWS.DASHBOARD);
            }
            setEditingOrder(null); 
            setCustomerContext(null); 
          }} />}
          {currentView === APP_VIEWS.ORDER_LIST && <OrderList orders={orders} batchCosts={batchCosts} onDelete={handleDeleteOrder} onEdit={(o) => { setEditingOrder(o); setCurrentView(APP_VIEWS.NEW_ORDER); }} onAddMore={(o) => { setCustomerContext(o); setCurrentView(APP_VIEWS.NEW_ORDER); }} onEditBatchCost={(batchName) => { setBatchToEditInAnalytics(batchName); setCurrentView(APP_VIEWS.BATCH_ANALYTICS); }} onUpdateOrders={handleBulkUpdateOrders} />}
          {currentView === APP_VIEWS.BATCH_ANALYTICS && <BatchAnalytics orders={orders} batchCosts={batchCosts} onUpdateBatchCost={handleUpdateBatchCost} initialEditBatch={batchToEditInAnalytics} />}
          {currentView === 'admin' && <Admin />}
        </div>
      </main>

      {/* Security Checkpoint */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200 border border-slate-100">
              <div className="flex flex-col items-center text-center mb-8">
                 <div className="w-16 h-16 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                    <Lock size={24} />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900 font-serif">Admin Authentication</h2>
                 <p className="text-xs text-slate-500 font-medium mt-1">Please enter your secure access key</p>
              </div>

              <form onSubmit={verifyPassword} className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Access Key</label>
                    <input 
                       autoFocus
                       type="password"
                       value={passwordInput}
                       onChange={(e) => {
                         setPasswordInput(e.target.value);
                         setPasswordError(false);
                       }}
                       className={`w-full px-5 py-3 rounded-xl border outline-none transition-all font-mono tracking-widest text-sm ${passwordError ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-100' : 'border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-100 bg-slate-50'}`}
                       placeholder="••••••••"
                    />
                    {passwordError && (
                      <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                        <AlertTriangle size={10} /> Authentication Failed
                      </p>
                    )}
                 </div>

                 <div className="flex gap-3 pt-2">
                    <button 
                       type="button"
                       onClick={() => {
                         setShowPasswordPrompt(false);
                         setPasswordInput("");
                         setPasswordError(false);
                       }}
                       className="flex-1 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all"
                    >
                       Back
                    </button>
                    <button 
                       type="submit"
                       className="flex-1 py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                       Authorize
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
