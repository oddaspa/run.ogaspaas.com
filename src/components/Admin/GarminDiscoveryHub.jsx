import React, { useState, useEffect, useMemo } from 'react';
import { Database, ChevronRight, ChevronDown, Search, Activity, Heart, Zap, Clock, ShieldCheck, Box, RefreshCw, Link as LinkIcon, AlertCircle, FileJson, Play, TrendingUp } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { ReadinessGauge, SleepVisualizer, ProgressBar, RecordCard, ProfileCard, HrvVisualizer, StatusVisualizer, ActivityCard, GearVisualizer } from '../Visualizations/GarminVisuals';

const ENDPOINTS = [
  { id: 'get_user_profile', category: 'Profile', label: 'User Profile' },
  { id: 'get_full_name', category: 'Profile', label: 'Full Name' },
  { id: 'get_userprofile_settings', category: 'Profile', label: 'User Settings' },
  { id: 'get_unit_system', category: 'Profile', label: 'Unit System' },
  
  { id: 'get_activities', category: 'Activities', label: 'Activity List', params: { start: 0, limit: 10 } },
  { id: 'get_activity', category: 'Activities', label: 'Activity Summary', requires: ['activity_id'] },
  { id: 'get_activity_details', category: 'Activities', label: 'Activity Details (Charts)', requires: ['activityId'] },
  { id: 'get_activity_splits', category: 'Activities', label: 'Activity Splits', requires: ['activityId'] },
  { id: 'get_activity_hr_in_timezones', category: 'Activities', label: 'HR in Zones', requires: ['activityId'] },
  { id: 'get_activity_weather', category: 'Activities', label: 'Weather', requires: ['activityId'] },
  
  { id: 'get_stats', category: 'Health', label: 'Daily Stats', requires: ['cdate'] },
  { id: 'get_sleep_data', category: 'Health', label: 'Sleep Data', requires: ['cdate'] },
  { id: 'get_hrv_data', category: 'Health', label: 'HRV Data', requires: ['cdate'] },
  { id: 'get_training_readiness', category: 'Health', label: 'Training Readiness', requires: ['cdate'] },
  { id: 'get_training_status', category: 'Health', label: 'Training Status', requires: ['cdate'] },
  { id: 'get_body_battery', category: 'Health', label: 'Body Battery', requires: ['date'] },
  { id: 'get_rhr_day', category: 'Health', label: 'Resting HR', requires: ['cdate'] },
  { id: 'get_stress_data', category: 'Health', label: 'Stress Data', requires: ['cdate'] },
  { id: 'get_fitnessage_data', category: 'Health', label: 'Fitness Age' },
  
  { id: 'get_gear', category: 'Equipment', label: 'User Gear', requires: ['system_user_id'] },
  { id: 'get_gear_stats', category: 'Equipment', label: 'Gear Stats', requires: ['gearUUID'] },
  { id: 'get_personal_record', category: 'Achievement', label: 'Personal Records' },
  { id: 'get_earned_badges', category: 'Achievement', label: 'Badges' },
];

export default function GarminDiscoveryHub() {
  const [context, setContext] = useState({
    activityId: null,
    date: new Date().toISOString().split('T')[0],
    system_user_id: null,
    gearUUID: null,
  });
  
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({});

  const categories = useMemo(() => {
    const groups = {};
    ENDPOINTS.forEach(ep => {
      if (!groups[ep.category]) groups[ep.category] = [];
      groups[ep.category].push(ep);
    });
    return groups;
  }, []);

  const fetchEndpoint = async (endpoint) => {
    const epConfig = ENDPOINTS.find(e => e.id === endpoint);
    if (!epConfig) return;

    // Build params from context
    const params = { ...(epConfig.params || {}) };
    if (epConfig.requires) {
      let missing = [];
      epConfig.requires.forEach(req => {
        // Map context activityId to either activityId or activity_id based on requirement
        if (req === 'activity_id' && context.activityId) {
          params[req] = context.activityId;
        }
        // Universal date mapping: Map context.date to cdate, date, or fordate
        else if ((req === 'cdate' || req === 'date' || req === 'fordate') && context.date) {
          params[req] = context.date;
        }
        else if (!context[req]) {
          missing.push(req);
        }
        else {
          params[req] = context[req];
        }
      });
      
      if (missing.length > 0) {
        alert(`Missing context: ${missing.join(', ')}. Try fetching Profile or Activity List first.`);
        return;
      }
    }

    setLoading(prev => ({ ...prev, [endpoint]: true }));
    try {
      const getEndpointData = httpsCallable(functions, 'get_garmin_endpoint_data');
      const result = await getEndpointData({ endpoint, params });
      
      if (result.data.success) {
        const data = result.data.data;
        setResults(prev => ({ ...prev, [endpoint]: data }));
        
        // Auto-extract context
        if (endpoint === 'get_user_profile') {
          setContext(prev => ({ ...prev, system_user_id: data.systemuserId || data.systemuser_id }));
        } else if (endpoint === 'get_activities' && data.length > 0) {
          setContext(prev => ({ ...prev, activityId: data[0].activityId }));
        } else if (endpoint === 'get_gear' && data.length > 0) {
          setContext(prev => ({ ...prev, gearUUID: data[0].uuid }));
        }
      } else {
        alert(`Error: ${result.data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to fetch ${endpoint}`);
    } finally {
      setLoading(prev => ({ ...prev, [endpoint]: false }));
    }
  };

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 h-full overflow-hidden flex bg-slate-900 text-slate-300">
      {/* Sidebar: Endpoints */}
      <aside className="w-80 border-r border-slate-800 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-800 shrink-0">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Database className="text-blue-500" size={20} /> Discovery Hub
          </h1>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input 
              type="text" 
              placeholder="Search endpoints..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {Object.entries(categories).map(([category, endpoints]) => {
            const filtered = endpoints.filter(e => e.label.toLowerCase().includes(searchQuery.toLowerCase()));
            if (filtered.length === 0) return null;
            
            return (
              <div key={category} className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">{category}</h3>
                <div className="space-y-1">
                  {filtered.map(ep => (
                    <button
                      key={ep.id}
                      onClick={() => fetchEndpoint(ep.id)}
                      disabled={loading[ep.id]}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group ${results[ep.id] ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Activity size={14} className={loading[ep.id] ? "animate-spin text-blue-500" : ""} />
                        <span className="text-xs font-bold truncate">{ep.label}</span>
                      </div>
                      {ep.requires && <LinkIcon size={12} className="opacity-40" />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Context Status */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 space-y-3 shrink-0">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Context</h4>
          <div className="grid grid-cols-2 gap-2">
            <ContextBadge label="Date" value={context.date} active />
            <ContextBadge label="User" value={context.system_user_id} active={!!context.system_user_id} />
            <ContextBadge label="Activity" value={context.activityId} active={!!context.activityId} />
            <ContextBadge label="Gear" value={context.gearUUID} active={!!context.gearUUID} />
          </div>
        </div>
      </aside>

      {/* Main Content: Inspection */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800/50 via-slate-900 to-slate-900">
        {Object.keys(results).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="bg-slate-800 p-8 rounded-[3rem] mb-6">
              <RefreshCw size={64} className="text-slate-600 animate-in spin-in-12" />
            </div>
            <h2 className="text-2xl font-black text-white">Ready for Discovery</h2>
            <p className="max-w-xs mt-2 font-bold text-sm">Select an endpoint from the sidebar to fetch and inspect its payload.</p>
          </div>
        ) : (
          Object.keys(results).reverse().map(endpoint => (
            <DataSection 
              key={endpoint}
              id={endpoint}
              config={ENDPOINTS.find(e => e.id === endpoint)}
              data={results[endpoint]}
              isOpen={expandedSections[endpoint] !== false}
              onToggle={() => toggleSection(endpoint)}
              onRefresh={() => fetchEndpoint(endpoint)}
            />
          ))
        )}
      </main>
    </div>
  );
}

function ContextBadge({ label, value, active }) {
  return (
    <div className={`p-2 rounded-lg border flex flex-col ${active ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-900 border-slate-800 opacity-40'}`}>
      <span className="text-[8px] font-black uppercase text-slate-500">{label}</span>
      <span className="text-[10px] font-black text-white truncate">{value || 'None'}</span>
    </div>
  );
}

// Visualizer Components for different data types
function Visualizer({ id, data }) {
  if (!data) return null;

  const renderContent = () => {
    switch (id) {
      case 'get_user_profile':
        return <ProfileCard data={data} />;
      case 'get_training_readiness':
        return <ReadinessGauge data={data} />;
      case 'get_sleep_data':
        return <SleepVisualizer data={data} />;
      case 'get_training_status':
        return <StatusVisualizer data={data} />;
      case 'get_hrv_data':
        return <HrvVisualizer data={data} />;
      case 'get_activities':
      case 'get_activity':
        return <ActivityCard data={data} />;
      case 'get_gear':
        return <GearVisualizer data={data} />;
      case 'get_personal_record':
        return <RecordCard data={data} />;
      case 'get_body_battery':
        const bb = Array.isArray(data) ? data[0] : data;
        const currentBB = bb.bodyBatteryValues?.[bb.bodyBatteryValues.length - 1]?.[1] || 0;
        return <ProgressBar label="Body Battery" current={currentBB} max={100} colorClass="bg-yellow-400" icon={Zap} />;
      case 'get_stats':
        const stats = data.userDailySummaryId ? data : (Array.isArray(data) ? data[0] : {});
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProgressBar label="Steps" current={stats.totalSteps || 0} max={stats.dailyStepGoal || 10000} icon={Footprints} colorClass="bg-emerald-500" />
            <ProgressBar label="Intensity" current={stats.moderateIntensityMinutes || 0} max={stats.intensityMinutesGoal || 150} icon={TrendingUp} colorClass="bg-orange-500" />
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3 text-slate-500 italic text-xs py-4">
            <FileJson size={14} /> No specific visualizer for this endpoint yet. Showing raw data below.
          </div>
        );
    }
  };

  return (
    <div className="mb-8 p-6 bg-slate-900/30 rounded-3xl border border-slate-700/50">
      <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
        <Activity size={12} /> UI Preview Concept
      </div>
      {renderContent()}
    </div>
  );
}

function MetricItem({ label, value, sub }) {
  const colors = {
    GOOD: 'text-emerald-500',
    POOR: 'text-red-500',
    OPTIMAL: 'text-blue-500'
  };
  return (
    <div>
      <p className="text-[9px] font-black text-slate-500 uppercase">{label}</p>
      <p className={`text-xs font-black ${colors[value] || 'text-white'}`}>{value}</p>
      <p className="text-[8px] font-bold text-slate-600">{sub}</p>
    </div>
  );
}

function DataSection({ id, config, data, isOpen, onToggle, onRefresh }) {
  return (
    <section className="bg-slate-800/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-lg shadow-blue-900/40">
            <FileJson className="text-white" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{config.category}</span>
              <span className="text-[10px] font-bold text-slate-600">/</span>
              <span className="text-[10px] font-bold text-slate-500 font-mono">{id}()</span>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">{config.label}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={onRefresh} className="p-3 hover:bg-slate-700 rounded-2xl transition-all text-slate-400 hover:text-white" title="Refresh">
            <RefreshCw size={20} />
          </button>
          <button onClick={onToggle} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-all text-white">
            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-8 pb-8 space-y-6">
          <Visualizer id={id} data={data} />

          {/* Summary Preview (If array or object) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.isArray(data) ? (
              <SummaryCard label="Item Count" value={data.length} icon={<Box size={16} />} />
            ) : (
              <SummaryCard label="Keys" value={Object.keys(data).length} icon={<Box size={16} />} />
            )}
            <SummaryCard label="Payload Size" value={`${(JSON.stringify(data).length / 1024).toFixed(1)} KB`} icon={<Database size={16} />} />
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex items-center gap-3">
               <AlertCircle size={18} className="text-yellow-500" />
               <p className="text-[10px] font-bold text-slate-400 leading-tight">Values used for this call are persisted in the active context sidebar.</p>
            </div>
          </div>

          {/* Raw JSON */}
          <div className="relative group">
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <Play size={10} /> Copy JSON
               </button>
            </div>
            <pre className="p-8 bg-slate-950 rounded-[2rem] overflow-x-auto text-[11px] leading-relaxed font-mono text-blue-400 border border-slate-900 custom-scrollbar">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value, icon }) {
  return (
    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex items-center gap-4">
      <div className="text-blue-500 opacity-50">{icon}</div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}
