import React, { useState, useMemo, useEffect } from 'react';
import { Order, BatchCost } from '../types';
import { TrendingUp, Download, Save, CheckCircle } from 'lucide-react';
import { saveSummaryEntry, SummaryEntry } from '../services/storage';

interface NetRevenueProps {
  orders: Order[];
  batchCosts?: BatchCost[];
  onUpdateSummary?: (data: any) => void;
}

export const NetRevenue: React.FC<NetRevenueProps> = ({ orders, batchCosts = [], onUpdateSummary }) => {
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [deliveryFee, setDeliveryFee] = useState<number | ''>('');
  const [oatPayment, setOatPayment] = useState<number | ''>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const FIXED_EXPENSE = 30000;

  // Get all unique batches
  const uniqueBatches = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.batchName))).sort().reverse();
  }, [orders]);

  // Parse batch name to extract year and month
  const parseBatchName = (name: string) => {
    const regex = /^BATCH-(\d{4})(\d{2})-/;
    const match = name.match(regex);
    if (match) {
      return { year: match[1], month: match[2] };
    }
    return null;
  };

  // Get batches for selected month/year
  const batchesForMonth = useMemo(() => {
    return uniqueBatches.filter(batch => {
      const parsed = parseBatchName(batch);
      return parsed && parsed.year === selectedYear && parsed.month === selectedMonth;
    });
  }, [uniqueBatches, selectedYear, selectedMonth]);

  // Calculate total sales for selected month
  const monthlyStats = useMemo(() => {
    const monthBatches = batchesForMonth;
    let totalSales = 0;
    let totalItems = 0;
    let totalAdvance = 0;
    let totalRemaining = 0;

    orders.forEach(order => {
      if (monthBatches.includes(order.batchName)) {
        const itemTotal = order.sellingPrice * order.quantity;
        totalSales += itemTotal;
        totalItems += order.quantity;
        totalAdvance += order.advancePaid;
        
        if (!order.isFullPaymentReceived) {
          totalRemaining += Math.max(0, itemTotal - order.advancePaid);
        }
      }
    });

    return { totalSales, totalItems, totalAdvance, totalRemaining };
  }, [orders, batchesForMonth]);

  // Calculate net profit
  const profitCalculation = useMemo(() => {
    const sales = monthlyStats.totalSales;
    const cost = isBatchClosed && costPrice !== '' ? Number(costPrice) : 0;
    const delivery = isBatchClosed && deliveryFee !== '' ? Number(deliveryFee) : 0;
    const oat = isBatchClosed && oatPayment !== '' ? Number(oatPayment) : 0;
    
    const totalDeductions = cost + delivery + oat + FIXED_EXPENSE;
    const netProfit = sales - totalDeductions;

    return { sales, cost, delivery, oat, totalDeductions, netProfit };
  }, [monthlyStats, costPrice, deliveryFee, oatPayment, isBatchClosed]);

  const handleSaveData = async () => {
    const monthYearStr = `${selectedYear}-${selectedMonth}`;
    const summaryData: SummaryEntry = {
      month: monthYearStr,
      batches: batchesForMonth.join(', '),
      totalSales: profitCalculation.sales,
      costPrice: isBatchClosed && costPrice !== '' ? Number(costPrice) : null,
      deliveryFee: isBatchClosed && deliveryFee !== '' ? Number(deliveryFee) : null,
      oatPayment: isBatchClosed && oatPayment !== '' ? Number(oatPayment) : null,
      fixedExpense: FIXED_EXPENSE,
      netProfit: profitCalculation.netProfit,
      isBatchClosed,
      savedAt: new Date().toISOString()
    };
    
    await saveSummaryEntry(summaryData);
    setSaveMessage('✓ Summary saved to Google Sheets');
    setTimeout(() => setSaveMessage(null), 3000);
    
    if (onUpdateSummary) {
      onUpdateSummary(summaryData);
    }
  };

  const inputClasses = "w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none transition-all bg-white text-slate-900 placeholder-slate-400";
  const selectClasses = "px-4 py-2 rounded-lg border border-slate-200 focus:border-rose-500 outline-none bg-white text-slate-900";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 to-rose-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={28} />
          <h1 className="text-3xl font-bold">Net Revenue Analysis</h1>
        </div>
        <p className="text-rose-100">Calculate monthly profitability with sales, deductions, and fixed expenses</p>
      </div>

      {/* Month/Year Selection */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Select Period</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={selectClasses}>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={selectClasses}>
              {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {batchesForMonth.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <span className="font-bold">Batches for this month:</span> {batchesForMonth.join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Sales Summary */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Sales Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <p className="text-xs font-bold text-emerald-600 uppercase">Total Sales</p>
            <p className="text-2xl font-bold text-emerald-900 mt-2">BTN {profitCalculation.sales.toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs font-bold text-blue-600 uppercase">Total Items</p>
            <p className="text-2xl font-bold text-blue-900 mt-2">{monthlyStats.totalItems}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-xs font-bold text-purple-600 uppercase">Advance Paid</p>
            <p className="text-2xl font-bold text-purple-900 mt-2">BTN {monthlyStats.totalAdvance.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-xs font-bold text-orange-600 uppercase">Pending</p>
            <p className="text-2xl font-bold text-orange-900 mt-2">BTN {monthlyStats.totalRemaining.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Batch Closed Status & Deductions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isBatchClosed}
              onChange={(e) => setIsBatchClosed(e.target.checked)}
              className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500"
            />
            <span className="font-semibold text-slate-900">Mark batch as closed</span>
          </label>
          {isBatchClosed && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">CLOSED</span>}
        </div>

        {!isBatchClosed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <p className="text-sm text-amber-900">⚠️ <span className="font-semibold">Deductions will be empty</span> until you mark this batch as closed</p>
          </div>
        )}

        <h3 className="text-lg font-semibold text-slate-800 mb-4">Deductions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cost Price (BTN)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">BTN</span>
              <input
                type="number"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                disabled={!isBatchClosed}
                className={`${inputClasses} pl-12 ${!isBatchClosed ? 'bg-slate-50 opacity-50 cursor-not-allowed' : ''}`}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Fee (Ashim Pema) (BTN)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">BTN</span>
              <input
                type="number"
                min="0"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                disabled={!isBatchClosed}
                className={`${inputClasses} pl-12 ${!isBatchClosed ? 'bg-slate-50 opacity-50 cursor-not-allowed' : ''}`}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Oat Payment (BTN)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">BTN</span>
              <input
                type="number"
                min="0"
                value={oatPayment}
                onChange={(e) => setOatPayment(e.target.value === '' ? '' : parseFloat(e.target.value))}
                disabled={!isBatchClosed}
                className={`${inputClasses} pl-12 ${!isBatchClosed ? 'bg-slate-50 opacity-50 cursor-not-allowed' : ''}`}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Fixed Monthly Expense:</span> <span className="font-bold text-slate-900">BTN {FIXED_EXPENSE.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Profit Calculation */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
        <h3 className="text-xl font-bold mb-6">Net Profit Calculation</h3>
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-300">Total Sales</span>
            <span className="font-semibold text-emerald-400">+ BTN {profitCalculation.sales.toLocaleString()}</span>
          </div>
          <div className="h-px bg-slate-700"></div>
          
          {isBatchClosed && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300">Cost Price</span>
                <span className="font-semibold text-rose-400">- BTN {profitCalculation.cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300">Delivery Fee (Ashim Pema)</span>
                <span className="font-semibold text-rose-400">- BTN {profitCalculation.delivery.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300">Oat Payment</span>
                <span className="font-semibold text-rose-400">- BTN {profitCalculation.oat.toLocaleString()}</span>
              </div>
            </>
          )}
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-300">Fixed Monthly Expense</span>
            <span className="font-semibold text-rose-400">- BTN {FIXED_EXPENSE.toLocaleString()}</span>
          </div>
          
          <div className="h-px bg-slate-700"></div>
          <div className="flex justify-between items-center text-lg pt-2">
            <span className="font-bold">Net Profit</span>
            <span className={`text-2xl font-bold ${profitCalculation.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              BTN {profitCalculation.netProfit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        {saveMessage && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top">
            <CheckCircle size={18} />
            {saveMessage}
          </div>
        )}
        <button
          onClick={handleSaveData}
          className="flex-1 px-6 py-3 bg-rose-600 text-white font-medium rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all flex justify-center items-center gap-2"
        >
          <Save size={20} />
          Save to Summary Sheet
        </button>
        <button
          className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-all flex justify-center items-center gap-2"
        >
          <Download size={20} />
          Export as PDF
        </button>
      </div>
    </div>
  );
};
