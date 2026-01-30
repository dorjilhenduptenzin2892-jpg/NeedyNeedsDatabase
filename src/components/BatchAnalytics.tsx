
import React, { useMemo, useState, useEffect } from 'react';
import { Order, BatchSummary, BatchCost, CustomerTrend } from '../types';
import { DELIVERY_FEE_PER_ITEM, OAT_RATE, APP_NAME } from '../constants';
import { Download, Edit3, X, Save, AlertTriangle, CheckCircle, Users, BarChart3, MapPin, Phone } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BatchAnalyticsProps {
  orders: Order[];
  batchCosts: BatchCost[];
  onUpdateBatchCost: (cost: BatchCost) => void;
  initialEditBatch?: string | null;
}

export const BatchAnalytics: React.FC<BatchAnalyticsProps> = ({ orders, batchCosts, onUpdateBatchCost, initialEditBatch }) => {
  const [viewMode, setViewMode] = useState<'batch' | 'monthly' | 'trends'>('batch');
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  
  // Save workflow states
  const [saveStatus, setSaveStatus] = useState<'idle' | 'confirming' | 'success'>('idle');
  
  // Local state for the edit form
  const [editForm, setEditForm] = useState<{
    costPrice: number | '';
    oatInput: number | '';
    deliveryFeeQty: number | '';
  }>({
    costPrice: '',
    oatInput: '',
    deliveryFeeQty: ''
  });

  // Reset save status when modal opens/closes
  useEffect(() => {
    if (!editingBatch) {
      setSaveStatus('idle');
    }
  }, [editingBatch]);

  // --- CALCULATIONS ---

  // 1. Calculate Unit Costs Per Batch (Cost Per Item)
  const batchUnitCosts = useMemo(() => {
     const map: Record<string, { costPrice: number, oat: number, delivery: number }> = {};
     
     // First, group orders by batch to get total items per batch
     const batchItems: Record<string, number> = {};
     orders.forEach(o => {
        batchItems[o.batchName] = (batchItems[o.batchName] || 0) + o.quantity;
     });

     const allBatches = new Set([...Object.keys(batchItems), ...batchCosts.map(c => c.batchName)]);
     
     allBatches.forEach(batchName => {
        const costConfig = batchCosts.find(c => c.batchName === batchName);
        const totalItems = batchItems[batchName] || 0;
        
        // Prevent division by zero
        if (totalItems === 0) {
            map[batchName] = { costPrice: 0, oat: 0, delivery: 0 };
            return;
        }

        const totalCostPrice = costConfig?.totalCostPrice || 0;
        const oatPayment = (costConfig?.oatInputValue || 0) * OAT_RATE;
        const finalDeliveryQty = costConfig?.deliveryFeeQuantity !== undefined ? costConfig.deliveryFeeQuantity : totalItems;
        const deliveryFee = finalDeliveryQty * DELIVERY_FEE_PER_ITEM;

        map[batchName] = {
            costPrice: totalCostPrice / totalItems,
            oat: oatPayment / totalItems,
            delivery: deliveryFee / totalItems
        };
     });
     
     return map;
  }, [orders, batchCosts]);

  // 2. Group by Batch (For Batch Report)
  const batchData = useMemo(() => {
    const batches: Record<string, Order[]> = {};
    orders.forEach(o => {
      if (!batches[o.batchName]) batches[o.batchName] = [];
      batches[o.batchName].push(o);
    });

    return Object.entries(batches).map(([name, batchOrders]) => {
      // Find stored costs
      const costConfig = batchCosts.find(c => c.batchName === name) || { totalCostPrice: 0, oatInputValue: 0, deliveryFeeQuantity: undefined };
      
      const orderCount = batchOrders.length; 
      const totalItems = batchOrders.reduce((acc, o) => acc + o.quantity, 0);
      const totalSales = batchOrders.reduce((acc, o) => acc + (o.sellingPrice * o.quantity), 0);
      
      // Expenses
      const finalDeliveryQty = costConfig.deliveryFeeQuantity !== undefined ? costConfig.deliveryFeeQuantity : totalItems;
      const deliveryFee = finalDeliveryQty * DELIVERY_FEE_PER_ITEM;
      
      const oatPayment = (costConfig.oatInputValue || 0) * OAT_RATE;
      const totalCostPrice = costConfig.totalCostPrice || 0;
      
      const totalExpenses = deliveryFee + oatPayment + totalCostPrice;
      const netProfit = totalSales - totalExpenses;
      
      const date = new Date(batchOrders[0].createdAt);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      return {
        batchName: name,
        orderCount,
        totalItems,
        totalSales,
        deliveryFee,
        oatPayment,
        totalCostPrice,
        netProfit,
        monthYear,
        oatInputValue: costConfig.oatInputValue || 0,
        deliveryFeeQuantity: finalDeliveryQty
      } as BatchSummary;
    }).sort((a, b) => b.monthYear.localeCompare(a.monthYear));
  }, [orders, batchCosts]);

  // 3. Customer Trends Analysis
  const customerTrends: CustomerTrend[] = useMemo(() => {
    const customers: Record<string, CustomerTrend> = {};
    
    orders.forEach(order => {
      const key = order.phoneNumber ? order.phoneNumber : order.customerName.toLowerCase().trim();
      
      if (!customers[key]) {
        customers[key] = {
          phoneNumber: order.phoneNumber,
          customerName: order.customerName,
          primaryAddress: order.address,
          totalOrders: 0,
          totalSales: 0,
          totalCostPrice: 0,
          totalOat: 0,
          totalDelivery: 0,
          netProfit: 0,
          lastOrderDate: 0,
        };
      }
      
      const c = customers[key];
      c.totalOrders += 1;
      
      const sales = order.sellingPrice * order.quantity;
      c.totalSales += sales;
      
      // Calculate costs for this order based on its batch unit costs
      const unitCosts = batchUnitCosts[order.batchName] || { costPrice: 0, oat: 0, delivery: 0 };
      
      const orderCostPrice = unitCosts.costPrice * order.quantity;
      const orderOat = unitCosts.oat * order.quantity;
      const orderDelivery = unitCosts.delivery * order.quantity;

      c.totalCostPrice += orderCostPrice;
      c.totalOat += orderOat;
      c.totalDelivery += orderDelivery;

      c.netProfit += (sales - (orderCostPrice + orderOat + orderDelivery));
      
      c.lastOrderDate = Math.max(c.lastOrderDate, order.createdAt);
    });

    return Object.values(customers).sort((a, b) => b.totalSales - a.totalSales);
  }, [orders, batchUnitCosts]);

  // 4. Group by Month (For Month Report)
  const monthlyData = useMemo(() => {
    const months: Record<string, BatchSummary> = {};
    batchData.forEach(batch => {
      if (!months[batch.monthYear]) {
        months[batch.monthYear] = {
          batchName: 'All Batches',
          monthYear: batch.monthYear,
          orderCount: 0,
          totalItems: 0,
          totalSales: 0,
          deliveryFee: 0,
          oatPayment: 0,
          totalCostPrice: 0,
          netProfit: 0,
          oatInputValue: 0,
          deliveryFeeQuantity: 0
        };
      }
      const m = months[batch.monthYear];
      m.orderCount += batch.orderCount;
      m.totalItems += batch.totalItems;
      m.totalSales += batch.totalSales;
      m.deliveryFee += batch.deliveryFee;
      m.oatPayment += batch.oatPayment;
      m.totalCostPrice += batch.totalCostPrice;
      m.netProfit += batch.netProfit;
    });
    return Object.values(months).sort((a, b) => b.monthYear.localeCompare(a.monthYear));
  }, [batchData]);


  // Handle external trigger for editing
  useEffect(() => {
    if (initialEditBatch) {
      const batch = batchData.find(b => b.batchName === initialEditBatch);
      if (batch) {
        setEditingBatch(batch.batchName);
        const storedCost = batchCosts.find(c => c.batchName === batch.batchName);
        const initialDeliveryQty = storedCost?.deliveryFeeQuantity !== undefined ? storedCost.deliveryFeeQuantity : batch.totalItems;

        setEditForm({
          costPrice: batch.totalCostPrice || '',
          oatInput: batch.oatInputValue || '',
          deliveryFeeQty: initialDeliveryQty
        });
      }
    }
  }, [initialEditBatch, batchData, batchCosts]);

  const displayData = viewMode === 'batch' ? batchData : monthlyData;

  const handleEditClick = (batch: BatchSummary) => {
    setEditingBatch(batch.batchName);
    const storedCost = batchCosts.find(c => c.batchName === batch.batchName);
    const initialDeliveryQty = storedCost?.deliveryFeeQuantity !== undefined ? storedCost.deliveryFeeQuantity : batch.totalItems;

    setEditForm({
      costPrice: batch.totalCostPrice || '',
      oatInput: batch.oatInputValue || '',
      deliveryFeeQty: initialDeliveryQty
    });
  };

  const handleSaveCost = () => {
    if (editingBatch) {
      const alreadyExists = batchCosts.some(c => c.batchName === editingBatch);
      if (!alreadyExists || saveStatus === 'confirming') {
        onUpdateBatchCost({
          batchName: editingBatch,
          totalCostPrice: editForm.costPrice === '' ? 0 : editForm.costPrice,
          oatInputValue: editForm.oatInput === '' ? 0 : editForm.oatInput,
          deliveryFeeQuantity: editForm.deliveryFeeQty === '' ? 0 : editForm.deliveryFeeQty
        });
        setSaveStatus('success');
        setTimeout(() => {
          setEditingBatch(null);
        }, 1500);
      } else {
        setSaveStatus('confirming');
      }
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // -- Header --
    doc.setFillColor(244, 63, 94); // Rose-500
    doc.circle(20, 20, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("NN", 17, 21.5);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(APP_NAME, 35, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Where comfort meets little champions", 35, 26);

    // Title
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    let reportTitle = "Batch Profit Report";
    if (viewMode === 'monthly') reportTitle = "Monthly Profit Report";
    if (viewMode === 'trends') reportTitle = "Customer Trends Report";
    
    doc.text(reportTitle, pageWidth - 20, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 20, 26, { align: 'right' });

    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.line(14, 35, pageWidth - 14, 35);

    // -- Table Generation --
    
    if (viewMode === 'trends') {
        // CUSTOMER TRENDS PDF
        const tableColumn = [
            "Customer",
            "Phone",
            "Orders",
            "Total Sales",
            "Cost Price",
            "Oat Pay",
            "Delivery",
            "Net Profit"
        ];
        
        const tableRows = customerTrends.map(c => [
            c.customerName,
            c.phoneNumber,
            c.totalOrders,
            `BTN ${c.totalSales.toLocaleString()}`,
            `BTN ${c.totalCostPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}`,
            `BTN ${c.totalOat.toLocaleString(undefined, {maximumFractionDigits: 0})}`,
            `BTN ${c.totalDelivery.toLocaleString(undefined, {maximumFractionDigits: 0})}`,
            `BTN ${c.netProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}`
        ]);

        autoTable(doc, {
            startY: 45,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { halign: 'center', textColor: 50 },
            columnStyles: { 
                0: { halign: 'left' },
                3: { fontStyle: 'bold', textColor: [20, 83, 45] }, // Total Sales (Green)
                7: { fontStyle: 'bold', textColor: [79, 70, 229] }  // Net Profit (Indigo)
            },
            foot: [[
                'Totals',
                '',
                customerTrends.reduce((a, b) => a + b.totalOrders, 0),
                `BTN ${customerTrends.reduce((a, b) => a + b.totalSales, 0).toLocaleString()}`,
                `BTN ${customerTrends.reduce((a, b) => a + b.totalCostPrice, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`,
                `BTN ${customerTrends.reduce((a, b) => a + b.totalOat, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`,
                `BTN ${customerTrends.reduce((a, b) => a + b.totalDelivery, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`,
                `BTN ${customerTrends.reduce((a, b) => a + b.netProfit, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`
            ]],
            footStyles: { fillColor: [240, 253, 244], textColor: [20, 83, 45], fontStyle: 'bold', halign: 'center' }
        });

    } else {
        // BATCH / MONTHLY PDF
        const tableColumn = [
          viewMode === 'batch' ? "Batch Name" : "Month",
          "TOTAL ORDERS",
          "TOTAL SALES",
          "TOTAL COST PRICE",
          "DELIVERY FEE",
          "OAT PAYMENT",
          "NET PROFIT"
        ];
    
        const tableRows = displayData.map(d => [
          viewMode === 'batch' ? d.batchName : d.monthYear,
          d.orderCount,
          `BTN ${d.totalSales.toLocaleString()}`,
          `BTN ${d.totalCostPrice.toLocaleString()}`,
          `BTN ${d.deliveryFee.toLocaleString()}`,
          `BTN ${d.oatPayment.toLocaleString()}`,
          `BTN ${d.netProfit.toLocaleString()}`
        ]);
    
        autoTable(doc, {
          startY: 45,
          head: [tableColumn],
          body: tableRows,
          theme: 'striped',
          headStyles: {
            fillColor: [46, 125, 50],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
          },
          bodyStyles: {
            halign: 'center',
            textColor: 50
          },
          columnStyles: {
            0: { halign: 'left' },
            6: { fontStyle: 'bold', textColor: [79, 70, 229] }
          },
          foot: [[
            'Totals', 
            displayData.reduce((a, b) => a + b.orderCount, 0),
            `BTN ${displayData.reduce((a, b) => a + b.totalSales, 0).toLocaleString()}`,
            `BTN ${displayData.reduce((a, b) => a + b.totalCostPrice, 0).toLocaleString()}`,
            `BTN ${displayData.reduce((a, b) => a + b.deliveryFee, 0).toLocaleString()}`,
            `BTN ${displayData.reduce((a, b) => a + b.oatPayment, 0).toLocaleString()}`,
            `BTN ${displayData.reduce((a, b) => a + b.netProfit, 0).toLocaleString()}`,
          ]],
          footStyles: {
            fillColor: [240, 253, 244],
            textColor: [20, 83, 45],
            fontStyle: 'bold',
            halign: 'center'
          }
        });
    }

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    
    doc.setFillColor(50, 50, 50);
    doc.rect(14, finalY, pageWidth - 28, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    
    let totalProfit = 0;
    if (viewMode === 'trends') {
        totalProfit = customerTrends.reduce((acc, curr) => acc + curr.netProfit, 0);
    } else {
        totalProfit = displayData.reduce((acc, curr) => acc + curr.netProfit, 0);
    }

    doc.text("NET PROFIT TOTAL", 20, finalY + 6.5);
    doc.text(`BTN ${totalProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}`, pageWidth - 20, finalY + 6.5, { align: 'right' });

    doc.save(`${APP_NAME}_Report_${viewMode}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const inputClasses = "w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative pb-20">
       {/* Edit Modal */}
       {editingBatch && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
             
              {saveStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Saved Successfully!</h3>
                  <p className="text-slate-500 mt-2">Closing window...</p>
                </div>
             ) : (
               <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Edit Costs for {editingBatch}</h3>
                  <button onClick={() => setEditingBatch(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Batch Cost Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400">BTN</span>
                      <input
                        type="number"
                        min="0"
                        value={editForm.costPrice}
                        onChange={(e) => setEditForm(prev => ({ ...prev, costPrice: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className={`${inputClasses} pl-12 bg-white`}
                        placeholder=""
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Fee Quantity (Rate: {DELIVERY_FEE_PER_ITEM})</label>
                    <div className="flex gap-4">
                        <input
                          type="number"
                          min="0"
                          value={editForm.deliveryFeeQty}
                          onChange={(e) => setEditForm(prev => ({ ...prev, deliveryFeeQty: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                          className={`${inputClasses} bg-white flex-1`}
                          placeholder=""
                        />
                        <div className="flex items-center justify-end min-w-[120px] bg-slate-50 px-3 rounded-lg border border-slate-200">
                          <span className="text-sm font-bold text-slate-700">BTN {((editForm.deliveryFeeQty === '' ? 0 : editForm.deliveryFeeQty) * DELIVERY_FEE_PER_ITEM)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Default is Total Items if left empty.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Oat Payment Quantity (Rate: {OAT_RATE})</label>
                    <div className="flex gap-4">
                        <input
                          type="number"
                          min="0"
                          value={editForm.oatInput}
                          onChange={(e) => setEditForm(prev => ({ ...prev, oatInput: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                          className={`${inputClasses} bg-white flex-1`}
                          placeholder=""
                        />
                        <div className="flex items-center justify-end min-w-[120px] bg-slate-50 px-3 rounded-lg border border-slate-200">
                          <span className="text-sm font-bold text-slate-700">BTN {((editForm.oatInput === '' ? 0 : editForm.oatInput) * OAT_RATE).toFixed(1)}</span>
                        </div>
                    </div>
                  </div>

                  {saveStatus === 'confirming' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 mt-4 animate-in slide-in-from-top-2">
                       <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                       <div className="text-sm text-amber-800">
                         <p className="font-bold">Costs already exist!</p>
                         <p>Are you sure you want to update the costs for this batch?</p>
                       </div>
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button onClick={() => setEditingBatch(null)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button 
                       onClick={handleSaveCost}
                       className={`flex-1 py-3 text-white font-medium rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all 
                        ${saveStatus === 'confirming' 
                           ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' 
                           : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                      {saveStatus === 'confirming' ? 'Yes, Update' : <><Save size={18} /> Save Costs</>}
                    </button>
                  </div>
                </div>
               </>
             )}
           </div>
         </div>
       )}

       {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
         <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button 
               onClick={() => setViewMode('batch')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${viewMode === 'batch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart3 size={16} className="inline mr-2" />
              By Batch
            </button>
            <button 
               onClick={() => setViewMode('monthly')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${viewMode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart3 size={16} className="inline mr-2" />
              By Month
            </button>
            <button 
               onClick={() => setViewMode('trends')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${viewMode === 'trends' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={16} className="inline mr-2" />
              Customer Trends
            </button>
         </div>

         <button 
            onClick={handleDownloadPDF}
           className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
         >
           <Download size={18} />
           Download PDF Report
         </button>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          
           {viewMode === 'trends' ? (
             <table className="w-full">
               <thead className="bg-slate-50 border-b border-slate-200">
                 <tr>
                   <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                   <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Total Orders</th>
                   
                   <th className="px-6 py-4 text-right text-xs font-bold text-slate-900 uppercase tracking-wider bg-emerald-50/50">Total Sales</th>

                   {/* Breakdown Columns */}
                   <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wider bg-rose-50/50">Cost Price</th>
                   <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wider bg-rose-50/50">Oat Pay</th>
                   <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wider bg-rose-50/50">Delivery</th>
                   
                   <th className="px-6 py-4 text-right text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/50">Net Profit</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {customerTrends.map((customer, idx) => (
                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4">
                       <div className="flex flex-col">
                         <span className="font-bold text-slate-900">{customer.customerName}</span>
                         {customer.phoneNumber && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={10} /> {customer.phoneNumber}</span>}
                         {customer.primaryAddress && <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {customer.primaryAddress}</span>}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-center text-slate-600">
                       <span className="inline-block px-2 py-0.5 bg-slate-100 rounded-full text-xs font-bold">{customer.totalOrders}</span>
                     </td>
                     
                     <td className="px-6 py-4 text-sm text-right font-bold text-emerald-700 bg-emerald-50/30">BTN {customer.totalSales.toLocaleString()}</td>

                     {/* Cost Breakdown */}
                     <td className="px-6 py-4 text-sm text-right text-rose-600 bg-rose-50/30">BTN {customer.totalCostPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                     <td className="px-6 py-4 text-sm text-right text-rose-600 bg-rose-50/30">BTN {customer.totalOat.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                     <td className="px-6 py-4 text-sm text-right text-rose-600 bg-rose-50/30">BTN {customer.totalDelivery.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>

                     <td className="px-6 py-4 text-sm text-right font-bold text-indigo-700 bg-indigo-50/30">BTN {customer.netProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                   </tr>
                 ))}
                 {customerTrends.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No customer data available yet.</td></tr>
                 )}
               </tbody>
             </table>
          ) : (
             <table className="w-full">
               <thead className="bg-slate-50 border-b border-slate-200">
                 <tr>
                   <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                     {viewMode === 'batch' ? 'Batch Name' : 'Month'}
                   </th>
                   <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">TOTAL ORDERS</th>
                   <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">TOTAL SALES</th>
                   
                   {/* Expenses Columns */}
                   <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wider bg-rose-50/50">TOTAL COST PRICE</th>
                   <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wider bg-rose-50/50">DELIVERY FEE</th>
                   <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wider bg-rose-50/50">OAT PAYMENT</th>
                   
                   <th className="px-6 py-4 text-right text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/50">NET PROFIT</th>
                   {viewMode === 'batch' && <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">ACTIONS</th>}
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {displayData.map((row, idx) => (
                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4 text-sm font-medium text-slate-900">
                       {viewMode === 'batch' ? row.batchName : row.monthYear}
                     </td>
                     <td className="px-6 py-4 text-sm text-center text-slate-600">{row.orderCount}</td>
                     <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">BTN {row.totalSales.toLocaleString()}</td>
                     
                     <td className="px-6 py-4 text-sm text-right text-rose-600 bg-rose-50/30">
                       BTN {row.totalCostPrice.toLocaleString()}
                     </td>
                     <td className="px-6 py-4 text-sm text-right text-rose-600 bg-rose-50/30">
                       BTN {row.deliveryFee.toLocaleString()}
                       {viewMode === 'batch' && (
                          <div className="text-[10px] text-rose-400">Qty: {row.deliveryFeeQuantity}</div>
                       )}
                     </td>
                     <td className="px-6 py-4 text-sm text-right text-rose-600 bg-rose-50/30">
                       BTN {row.oatPayment.toLocaleString()}
                       {viewMode === 'batch' && (
                          <div className="text-[10px] text-rose-400">Qty: {row.oatInputValue}</div>
                       )}
                     </td>
                     
                     <td className="px-6 py-4 text-sm text-right font-bold text-indigo-600 bg-indigo-50/30">
                       BTN {row.netProfit.toLocaleString()}
                     </td>

                      {viewMode === 'batch' && (
                       <td className="px-6 py-4 text-center">
                         <button 
                            onClick={() => handleEditClick(row)}
                           className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                           title="Edit Costs"
                         >
                           <Edit3 size={16} />
                         </button>
                       </td>
                     )}
                   </tr>
                 ))}
                 {displayData.length === 0 && (
                   <tr>
                     <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                       No data available.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
          )}
        </div>
      </div>
    </div>
  );
};
