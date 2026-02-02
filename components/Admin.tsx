
import React, { useState } from 'react';
import { Copy, Check, Terminal, ShieldCheck, Database, ExternalLink, Cloud, Hash, Link as LinkIcon } from 'lucide-react';
import { WEB_APP_URL, APP_NAME, DEPLOYMENT_ID } from '../constants';

export const Admin: React.FC = () => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const scriptCode = `/**
 * NeedyNeeds Inventory Cloud Bridge
 * Deploy as Web App with:
 * - Execute as: Me
 * - Who has access: Anyone
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Ensure sheets exist
  let orderSheet = ss.getSheetByName("Orders");
  if (!orderSheet) orderSheet = ss.insertSheet("Orders");
  
  let costSheet = ss.getSheetByName("BatchCosts");
  if (!costSheet) costSheet = ss.insertSheet("BatchCosts");

  const orders = orderSheet.getDataRange().getValues();
  const costs = costSheet.getDataRange().getValues();

  // Remove headers for JSON response
  orders.shift();
  costs.shift();

  const data = {
    orders: orders,
    costs: costs
  };

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const postData = JSON.parse(e.postData.contents);
  const action = postData.action;
  const data = postData.data;

  if (action === "syncOrders") {
    const sheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
    sheet.clear();
    const headers = [
      "ID", "Group ID", "Created At", "Batch Name", "Customer Name", 
      "Address", "Phone Number", "Product Name", "Selling Price", 
      "Quantity", "Advance Paid", "Transport Mode", 
      "Is Full Payment Received", "Note"
    ];
    sheet.appendRow(headers);
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
  }

  if (action === "syncCosts") {
    const sheet = ss.getSheetByName("BatchCosts") || ss.insertSheet("BatchCosts");
    sheet.clear();
    const headers = ["Batch Name", "Total Cost Price", "Oat Input", "Delivery Qty"];
    sheet.appendRow(headers);
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const handleCopy = (text: string, type: 'script' | 'id' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'script') { setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }
    if (type === 'id') { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
    if (type === 'url') { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck size={160} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-serif font-bold mb-4">Cloud Synchronization Engine</h2>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed mb-6">
            Connecting {APP_NAME} to your Google Sheets provides real-time persistence and 
            collaborative access. Follow the protocol below to establish the bridge.
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10">
              <Database size={14} className="text-rose-500" /> Secure Protocol
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10">
              <Terminal size={14} className="text-emerald-500" /> Apps Script v8
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Credentials Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
          <Cloud className="text-rose-500" size={20} />
          <h3 className="font-bold text-slate-900 uppercase tracking-widest text-xs">Cloud Credentials</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Hash size={12} /> Deployment ID
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 text-[10px] font-mono font-bold text-slate-600 break-all">
                {DEPLOYMENT_ID}
              </div>
              <button onClick={() => handleCopy(DEPLOYMENT_ID, 'id')} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0">
                {copiedId ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <LinkIcon size={12} /> Web App URL
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 text-[10px] font-mono font-bold text-slate-600 truncate">
                {WEB_APP_URL}
              </div>
              <button onClick={() => handleCopy(WEB_APP_URL, 'url')} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0">
                {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">01</span>
            Setup Google Sheet
          </h3>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Create a new Google Sheet. From the menu, navigate to <span className="font-bold text-slate-800">Extensions > Apps Script</span>.
          </p>
          <ul className="space-y-2 text-xs text-slate-500">
            <li className="flex items-center gap-2">• Rename project to "{APP_NAME} Cloud Bridge"</li>
            <li className="flex items-center gap-2">• Delete existing code in Code.gs</li>
            <li className="flex items-center gap-2">• Paste the code block shown below</li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">02</span>
            Deploy Web App
          </h3>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Click <span className="font-bold text-slate-800">Deploy > New Deployment</span>. Select <span className="font-bold text-slate-800">Web App</span>.
          </p>
          <ul className="space-y-2 text-xs text-slate-500">
            <li className="flex items-center gap-2">• <b>Execute as:</b> Me</li>
            <li className="flex items-center gap-2">• <b>Who has access:</b> Anyone</li>
            <li className="flex items-center gap-2">• Copy the Web App URL and paste it in constants.ts</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <Terminal size={18} className="text-slate-400" />
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bridge Code (Code.gs)</span>
          </div>
          <button 
            onClick={() => handleCopy(scriptCode, 'script')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${copiedScript ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {copiedScript ? <Check size={14} /> : <Copy size={14} />}
            {copiedScript ? 'Copied to Clipboard' : 'Copy Script Code'}
          </button>
        </div>
        <div className="p-6 bg-[#1e1e1e] max-h-[400px] overflow-y-auto custom-scrollbar font-mono text-xs text-indigo-300 leading-relaxed">
          <pre>{scriptCode}</pre>
        </div>
      </div>

      <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-start gap-4">
         <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
           <ExternalLink size={20} />
         </div>
         <div>
            <h4 className="font-bold text-rose-900 mb-1">Current Configuration</h4>
            <p className="text-sm text-rose-700 leading-relaxed mb-3">
              Your app is currently communicating with the endpoint below. Ensure this matches your deployment.
            </p>
            <code className="text-[10px] font-bold bg-white/50 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-900 break-all block">
              {WEB_APP_URL || 'NO_URL_CONFIGURED'}
            </code>
         </div>
      </div>
    </div>
  );
};
