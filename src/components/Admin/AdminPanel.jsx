import React, { useState } from 'react';
import { Terminal, Database, Clock, ChevronRight, ChevronDown, Activity, ShieldCheck } from 'lucide-react';

export default function AdminPanel({ apiLogs }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Terminal className="text-blue-500" /> API Telemetry
            </h2>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">
              Monitoring Garmin Connect Integration
            </p>
          </div>
          <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-200">
            <ShieldCheck size={16} /> Admin Mode
          </div>
        </header>

        <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
              <Clock size={16} /> Recent Requests
            </h3>
            <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-slate-400 border border-slate-100">
              {apiLogs.length} LOGS
            </span>
          </div>

          <div className="divide-y divide-slate-50">
            {apiLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic">
                No API calls recorded in this session.
              </div>
            ) : (
              apiLogs.map((log) => (
                <div key={log.id} className="group transition-colors hover:bg-slate-50/50">
                  <button 
                    onClick={() => toggleExpand(log.id)}
                    className="w-full p-6 flex items-center gap-4 text-left"
                  >
                    <div className={`p-3 rounded-2xl ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      <Activity size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-wider">{log.functionName}</h4>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Status: <span className={log.status === 'success' ? 'text-emerald-500' : 'text-red-500'}>{log.status}</span>
                      </p>
                    </div>
                    {expandedId === log.id ? <ChevronDown size={20} className="text-slate-300" /> : <ChevronRight size={20} className="text-slate-300" />}
                  </button>

                  {expandedId === log.id && (
                    <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                      <div className="bg-slate-900 rounded-[1.5rem] p-6 overflow-hidden relative">
                        <div className="absolute top-4 right-4 flex gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 opacity-50"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-50"></div>
                          <div className="w-2 h-2 rounded-full bg-green-500 opacity-50"></div>
                        </div>
                        <h5 className="text-blue-400 font-black text-[9px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Database size={12} /> Response Payload
                        </h5>
                        <pre className="text-blue-100/80 text-[11px] font-mono leading-relaxed overflow-x-auto custom-scrollbar max-h-[400px]">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                      {log.params && (
                        <div className="mt-4 p-4 border border-slate-100 rounded-2xl bg-white">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Request Parameters</p>
                          <code className="text-[11px] text-slate-600 font-mono">
                            {JSON.stringify(log.params)}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
