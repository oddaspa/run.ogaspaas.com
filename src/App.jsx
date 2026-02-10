import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Trash2, MapPin, Ruler, Loader2, Undo2, Redo2, ArrowUpDown, Trash, Search, LogIn, LogOut, Settings, User, Save, RefreshCw, ChevronLeft, ChevronRight, Activity, Calendar, BarChart3, TrendingUp, Clock, Info, Heart, Zap, Map as MapIcon, Trophy, Target, Timer, Footprints } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import polyline from '@mapbox/polyline';
import { auth, signInWithGoogle, logout, saveStravaConfig, getStravaConfig, functions, saveStravaData } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapEvents({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function MapController({ centerPos }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (centerPos) {
      map.flyTo(centerPos, 13);
    }
  }, [centerPos, map]);
  return null;
}

const NavLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm ${
        isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={18} />
      {children}
    </Link>
  );
};

function Planner({ stravaActivities, selectedActivityId, setSelectedActivityId, isLoading, fetchStravaActivities, fetchStravaActivityDetail, mapCenter, setMapCenter, waypoints, setWaypoints, history, undo, redo, redoStack, routePath, distance, clearRoute, reverseRoute, handleSearch, searchQuery, setSearchQuery, updateWaypoint, addWaypoint, showSidebar, setShowSidebar, showStats, setShowStats, stats }) {
  const [gpsOnly, setGpsOnly] = useState(false);

  const filteredActivities = useMemo(() => 
    gpsOnly ? stravaActivities.filter(a => a.decodedPolyline) : stravaActivities,
    [stravaActivities, gpsOnly]
  );

  const selectedActivity = useMemo(() => 
    stravaActivities.find(a => a.id === selectedActivityId),
    [stravaActivities, selectedActivityId]
  );

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Sidebar (Left) */}
      <aside 
        className={`bg-white border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden flex flex-col z-[1002] ${
          showSidebar ? 'w-80 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Activity size={18} className="text-orange-500" />
              Activities
            </h2>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {filteredActivities.length}
            </span>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={gpsOnly}
                onChange={(e) => setGpsOnly(e.target.checked)}
              />
              <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">GPS Only</span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-6">
              <p className="text-sm text-slate-400 mb-2">{gpsOnly ? "No GPS activities found." : "No activities found."}</p>
              <p className="text-[10px] text-slate-300">Try clicking Sync or connect your Strava account in settings.</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => {
                  setSelectedActivityId(activity.id);
                  if (activity.decodedPolyline) {
                    setMapCenter(activity.decodedPolyline[0]);
                  } else {
                    fetchStravaActivityDetail(activity.id);
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${
                  selectedActivityId === activity.id 
                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' 
                    : 'border-slate-100 hover:border-orange-200 hover:bg-orange-50/30'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-orange-600 transition-colors">
                    {activity.name}
                  </h3>
                  {activity.private && <span title="Private" className="text-slate-300 text-[10px]">🔒</span>}
                </div>
                {!activity.decodedPolyline && !activity.manual && (
                  <p className="text-[9px] text-orange-400 mb-1">GPS hidden - Click to try fetch</p>
                )}
                {activity.manual && (
                  <p className="text-[9px] text-slate-400 mb-1">Manual entry (No GPS)</p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Ruler size={10} />
                    {(activity.distance / 1000).toFixed(2)} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(activity.start_date).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="absolute top-4 left-6 z-[1001] flex flex-col gap-3">
          <form onSubmit={handleSearch} className="bg-white p-1.5 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-2 w-72">
            <div className="pl-2 text-slate-400"><Search size={18} /></div>
            <input type="text" placeholder="Search location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 py-1" />
            <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors">Go</button>
          </form>

          <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-200 flex flex-col gap-1 w-fit">
            <button onClick={undo} disabled={history.length === 0} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"><Undo2 size={20} /></button>
            <button onClick={redo} disabled={redoStack.length === 0} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"><Redo2 size={20} /></button>
            <div className="h-px bg-slate-100 mx-2 my-1"></div>
            <button onClick={reverseRoute} disabled={waypoints.length < 2} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"><ArrowUpDown size={20} /></button>
          </div>
        </div>

        <main className="flex-1 relative">
          {isLoading && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center gap-2 text-sm font-medium text-slate-600"><Loader2 size={16} className="animate-spin text-blue-500" />Calculating...</div>}
          <MapContainer center={[63.4305, 10.3951]} zoom={13} scrollWheelZoom={true} zoomControl={false} className="h-full w-full">
            <MapController centerPos={mapCenter} />
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapEvents onMapClick={addWaypoint} />
            {waypoints.map((position, idx) => (
              <Marker key={`${idx}-${position.lat}-${position.lng}`} position={position} draggable={true} eventHandlers={{ dragend: (e) => updateWaypoint(idx, e.target.getLatLng()) }}>
                <Popup><div className="p-1"><p className="font-bold text-slate-800 mb-2">Waypoint {idx + 1}</p><button onClick={() => removeWaypoint(idx)} className="flex items-center gap-1.5 text-red-500 hover:text-red-600 font-medium text-xs transition-colors"><Trash2 size={12} />Remove point</button></div></Popup>
              </Marker>
            ))}
            {routePath.length > 0 && <Polyline positions={routePath} color="#3b82f6" weight={5} opacity={0.8} />}
            {stravaActivities.filter(a => a.decodedPolyline).map((activity) => (
              <Polyline 
                key={`${activity.id}-${selectedActivityId === activity.id}`} 
                positions={activity.decodedPolyline} 
                color={selectedActivityId === activity.id ? "#ef4444" : "#f97316"} 
                weight={selectedActivityId === activity.id ? 8 : 2} 
                opacity={selectedActivityId === activity.id ? 1 : 0.3} 
                className={selectedActivityId === activity.id ? "drop-shadow-2xl" : ""}
                eventHandlers={{ click: () => setSelectedActivityId(activity.id) }}
              >
                <Popup><div className="p-1"><p className="font-bold text-slate-800">{activity.name}</p><p className="text-xs text-slate-500">{(activity.distance / 1000).toFixed(2)} km</p><p className="text-[10px] text-slate-400 mt-1 italic">{activity.private ? '🔒 Private' : '🌍 Public'}</p></div></Popup>
              </Polyline>
            ))}
            {/* Outline for selected route to make it "pop" */}
            {selectedActivity?.decodedPolyline && (
              <Polyline 
                key={`outline-${selectedActivityId}`}
                positions={selectedActivity.decodedPolyline} 
                color="#ffffff" 
                weight={12} 
                opacity={0.6} 
              />
            )}
          </MapContainer>
        </main>

        {selectedActivity && (
          <div className="bg-white border-t border-slate-200 p-4 z-[1003] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">{selectedActivity.name}{selectedActivity.private && <span className="text-slate-400 text-sm">🔒</span>}</h3>
                  <p className="text-xs text-slate-500">{new Date(selectedActivity.start_date).toLocaleString()} • {selectedActivity.type}</p>
                </div>
                <div className="h-10 w-px bg-slate-200"></div>
                <div className="flex gap-8">
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-400 font-bold">Distance</span><span className="font-mono font-bold">{(selectedActivity.distance / 1000).toFixed(2)} km</span></div>
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-400 font-bold">Elevation</span><span className="font-mono font-bold">{selectedActivity.total_elevation_gain} m</span></div>
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-400 font-bold">Time</span><span className="font-mono font-bold">{Math.floor(selectedActivity.moving_time / 60)}m {selectedActivity.moving_time % 60}s</span></div>
                  {selectedActivity.average_heartrate && <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-400 font-bold">Avg HR</span><span className="font-mono font-bold">{Math.round(selectedActivity.average_heartrate)} bpm</span></div>}
                </div>
              </div>
              <button onClick={() => setSelectedActivityId(null)} className="text-slate-400 hover:text-slate-600 p-2">×</button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Sidebar (Right) */}
      <aside className={`bg-slate-50 border-l border-slate-200 transition-all duration-300 ease-in-out overflow-hidden flex flex-col z-[1002] ${showStats ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
        <div className="p-4 border-b border-slate-200 bg-white"><h2 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={18} className="text-blue-500" />Performance</h2></div>
        <div className="p-4 space-y-4 overflow-y-auto">
          {!stats ? <div className="text-center py-10"><BarChart3 size={32} className="mx-auto text-slate-200 mb-2" /><p className="text-xs text-slate-400">No stats yet.</p></div> : (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100"><span className="text-[10px] uppercase text-slate-400 font-bold">Distance</span><div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-slate-900">{stats.totalDistance}</span><span className="text-xs text-slate-400 font-medium">km</span></div></div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100"><span className="text-[10px] uppercase text-slate-400 font-bold">Elevation</span><div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-slate-900">{stats.totalElevation}</span><span className="text-xs text-slate-400 font-medium">m</span></div></div>
              </div>
              <div className="pt-4">
                <h3 className="text-[10px] uppercase text-slate-400 font-bold mb-3 tracking-wider">Type Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs"><span className="text-slate-500 flex items-center gap-2"><MapPin size={12} /> GPS Verified</span><span className="font-bold text-blue-600">{stats.gpsCount}</span></div>
                  <div className="flex justify-between items-center text-xs"><span className="text-slate-500 flex items-center gap-2"><Clock size={12} /> Treadmill</span><span className="font-bold text-orange-500">{stats.count - stats.gpsCount}</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Dashboard({ stravaActivities, athleteStats, athleteZones, athleteProfile, rateLimitExceeded }) {
  const insights = useMemo(() => {
    if (!stravaActivities.length) return null;
    
    const runs = [...stravaActivities].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const validRuns = runs.filter(r => r.distance && r.distance > 0);
    
    const runTotals = athleteStats?.all_run_totals || { distance: 0, elevation_gain: 0, count: 0 };
    
    const avgPace = validRuns.length > 0 
      ? validRuns.reduce((acc, r) => acc + (r.moving_time / (r.distance / 1000)), 0) / validRuns.length
      : 0;
      
    const formatPace = (p) => {
      if (!p || isNaN(p) || !isFinite(p)) return "0:00 /km";
      return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')} /km`;
    };

    const formatTime = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const last28DaysRuns = runs.filter(r => new Date(r.start_date) > fourWeeksAgo);
    
    const weeklyAvgDist = last28DaysRuns.reduce((acc, r) => acc + (r.distance || 0), 0) / 4000;
    const weeklyAvgTime = last28DaysRuns.reduce((acc, r) => acc + (r.moving_time || 0), 0) / 4;
    const weeklyAvgElev = last28DaysRuns.reduce((acc, r) => acc + (r.total_elevation_gain || 0), 0) / 4;

    const chartData = runs.slice(-12).map(r => ({
      date: new Date(r.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      distance: (r.distance / 1000).toFixed(1),
      originalDistance: r.distance / 1000
    }));

    const last30Days = runs.filter(r => (now - new Date(r.start_date)) < 30 * 24 * 60 * 60 * 1000);
    
    let longestGap = 0;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentHistory = runs.filter(r => new Date(r.start_date) > threeMonthsAgo);
    
    if (recentHistory.length > 1) {
      for (let i = 0; i < recentHistory.length - 1; i++) {
        const gap = (new Date(recentHistory[i+1].start_date) - new Date(recentHistory[i].start_date)) / (24 * 60 * 60 * 1000);
        if (gap > longestGap) longestGap = gap;
      }
    }

    const reversedRuns = [...validRuns].reverse();
    let paceImprovement = "Insufficient data.";
    if (reversedRuns.length >= 10) {
      const recentPace = reversedRuns.slice(0, 5).reduce((acc, r) => acc + (r.moving_time / (r.distance / 1000)), 0) / 5;
      const previousPace = reversedRuns.slice(5, 10).reduce((acc, r) => acc + (r.moving_time / (r.distance / 1000)), 0) / 5;
      const diff = previousPace - recentPace;
      paceImprovement = diff > 5 ? `Speeding up! (+${Math.floor(diff)}s/km)` : 
                       diff < -5 ? `Slowing down. (${Math.floor(Math.abs(diff))}s/km)` : 
                       "Steady pace.";
    }

    const best5k = validRuns.filter(r => r.distance >= 4800)
      .sort((a, b) => (a.moving_time / (a.distance/5000)) - (b.moving_time / (b.distance/5000)))[0];

    const heartRateZones = athleteZones?.heart_rate?.zones || [];

    const allTimePRs = [
      { label: '400m', val: '58s' },
      { label: '1K', val: '5:14' },
      { label: '1 mile', val: '8:36' },
      { label: '5K', val: '30:48' },
      { label: '10K', val: '1:02:35' }
    ];

    return {
      avgPace: formatPace(avgPace),
      monthlyCount: last30Days.length,
      longestGap: Math.floor(longestGap),
      paceImprovement,
      best5k: best5k ? formatPace(best5k.moving_time / (best5k.distance / 1000)) : "None yet",
      recommendation: last30Days.length < 8 ? "Try adding one more short run per week." : "Great consistency! Keep it up.",
      treadmillRatio: (runs.length > 0 ? (runs.filter(r => r.manual || !r.map?.summary_polyline).length / runs.length * 100).toFixed(0) : 0),
      hrZones: heartRateZones,
      allTimePRs,
      formatTime,
      runTotals,
      weeklyAvgDist: weeklyAvgDist.toFixed(1),
      weeklyAvgTime: formatTime(weeklyAvgTime),
      weeklyAvgElev: Math.round(weeklyAvgElev),
      chartData
    };
  }, [stravaActivities, athleteZones, athleteStats]);

  if (!insights) return <div className="flex-1 flex items-center justify-center">No activity data.</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex justify-between items-end">
          <div><h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Progress Dashboard</h2><p className="text-slate-500">Analytics for {athleteProfile?.firstname || 'Athlete'}</p></div>
          <div className="flex flex-col items-end gap-2">
            {rateLimitExceeded && (
              <div className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-red-200 flex items-center gap-2">
                <Clock size={12} />
                Rate Limit Hit - Resetting in {countdownText}
              </div>
            )}
            <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Sync</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center"><Zap size={24} /></div>
            <div><p className="text-xs font-bold text-slate-400 uppercase">Average Pace</p><p className="text-2xl font-black text-slate-900">{insights.avgPace}</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="bg-orange-50 text-orange-600 w-12 h-12 rounded-2xl flex items-center justify-center"><Activity size={24} /></div>
            <div><p className="text-xs font-bold text-slate-400 uppercase">Runs (30d)</p><p className="text-2xl font-black text-slate-900">{insights.monthlyCount}</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="bg-purple-50 text-purple-600 w-12 h-12 rounded-2xl flex items-center justify-center"><TrendingUp size={24} /></div>
            <div><p className="text-xs font-bold text-slate-400 uppercase">Growth Status</p><p className="text-sm font-bold text-slate-700 mt-1">{insights.paceImprovement}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><BarChart3 className="text-blue-500" size={20} /> Volume Chart</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} unit="km" />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                    <Bar dataKey="distance" radius={[6, 6, 0, 0]} barSize={32}>
                      {insights.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.originalDistance > 5 ? '#3b82f6' : '#94a3b8'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><Trophy className="text-yellow-500" size={20} /> All-Time PRs</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                {insights.allTimePRs.map(pr => (
                  <div key={pr.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{pr.label}</p>
                    <p className="text-xl font-black text-slate-900">{pr.val}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {athleteStats && (
              <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest opacity-50 mb-6"><Target size={16} /> Cumulative</h3>
                <div className="space-y-6">
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase">Lifetime Distance</p><div className="flex items-baseline gap-2"><span className="text-3xl font-black text-slate-900">{(insights.runTotals.distance / 1000).toFixed(0)}</span><span className="text-xs text-slate-400 font-bold">KM</span></div></div>
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase">Total elevation</p><div className="flex items-baseline gap-2"><span className="text-3xl font-black text-slate-900">{insights.runTotals.elevation_gain}</span><span className="text-xs text-slate-400 font-bold">M</span></div></div>
                  <div className="h-px bg-slate-50"></div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Recent Average</p>
                    <div className="space-y-4 text-xs font-bold">
                      <div className="flex justify-between"><span>Volume</span><span className="text-slate-900">{insights.weeklyAvgDist} km/w</span></div>
                      <div className="flex justify-between"><span>Active</span><span className="text-slate-900">{insights.weeklyAvgTime}</span></div>
                    </div>
                  </div>
                </div>
              </section>
            )}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest opacity-50">Consistency</h3>
              <div className="flex items-start gap-4">
                <div className="bg-green-50 text-green-600 p-3 rounded-xl"><Trophy size={18} /></div>
                <div><p className="font-bold text-slate-900 text-sm">Longest Gap</p><p className="text-xs text-slate-500 mt-1">{insights.longestGap} days</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [stravaClientId, setStravaClientId] = useState('');
  const [stravaClientSecret, setStravaClientSecret] = useState('');
  const [stravaRefreshToken, setStravaRefreshToken] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [routePath, setRoutePath] = useState([]);
  const [distance, setDistance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState(null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [athleteStats, setAthleteStats] = useState(null);
  const [athleteZones, setAthleteZones] = useState(null);
  const [athleteProfile, setAthleteProfile] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false);
  const [secondsToReset, setSecondsToReset] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showStats, setShowStats] = useState(true);

  const stats = useMemo(() => {
    if (!stravaActivities.length) return null;
    const totalDistance = stravaActivities.reduce((acc, a) => acc + (a.distance || 0), 0);
    const totalElevation = stravaActivities.reduce((acc, a) => acc + (a.total_elevation_gain || 0), 0);
    const totalTime = stravaActivities.reduce((acc, a) => acc + (a.moving_time || 0), 0);
    const gpsCount = stravaActivities.filter(a => a.map?.summary_polyline).length;
    return {
      totalDistance: (totalDistance / 1000).toFixed(1),
      totalElevation,
      totalHours: Math.floor(totalTime / 3600),
      count: stravaActivities.length,
      gpsCount
    };
  }, [stravaActivities]);

  const saveToHistory = (newWaypoints) => {
    setHistory(prev => [...prev, waypoints]);
    setRedoStack([]);
    setWaypoints(newWaypoints);
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack(prev => [...prev, waypoints]);
    setHistory(prev => prev.slice(0, -1));
    setWaypoints(last);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, waypoints]);
    setRedoStack(prev => prev.slice(0, -1));
    setWaypoints(next);
  };

  const addWaypoint = (latlng) => saveToHistory([...waypoints, latlng]);
  const updateWaypoint = (index, latlng) => {
    const next = [...waypoints];
    next[index] = latlng;
    saveToHistory(next);
  };
  const removeWaypoint = (index) => saveToHistory(waypoints.filter((_, i) => i !== index));
  const reverseRoute = () => saveToHistory([...waypoints].reverse());
  const clearRoute = () => saveToHistory([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
    } catch (err) { console.error("Search error", err); }
  };

  const fetchStravaActivities = async (isDeep = false) => {
    if (!user) return;
    setIsLoading(true);
    setRateLimitExceeded(false);
    try {
      const getActivities = httpsCallable(functions, 'getStravaActivities');
      const result = await getActivities({ deep: isDeep });
      
      if (result.data.rateLimitHit) {
        setRateLimitExceeded(true);
        // Calculate seconds to next 15-min window
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const nextWindow = Math.ceil((minutes + 1) / 15) * 15;
        const diffSeconds = ((nextWindow - minutes - 1) * 60) + (60 - seconds);
        setSecondsToReset(diffSeconds);
      }

      if (result.data.activities) {
        const decodedActivities = result.data.activities.map(a => {
          let decodedPolyline = null;
          if (a.map && a.map.summary_polyline) {
            try { decodedPolyline = polyline.decode(a.map.summary_polyline); } catch (e) { console.error(e); }
          }
          return { ...a, decodedPolyline };
        });
        setStravaActivities(decodedActivities);
        
        // Save to Firestore for persistence
        await saveStravaData(
          user.uid, 
          decodedActivities, 
          result.data.athleteStats, 
          result.data.athleteZones, 
          result.data.athleteProfile
        );
      }
      if (result.data.athleteStats) setAthleteStats(result.data.athleteStats);
      if (result.data.athleteZones) setAthleteZones(result.data.athleteZones);
      if (result.data.athleteProfile) setAthleteProfile(result.data.athleteProfile);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const fetchStravaActivityDetail = async (activityId) => {
    setSelectedActivityId(activityId);
    setIsLoading(true);
    try {
      const getDetail = httpsCallable(functions, 'getStravaActivityDetail');
      const result = await getDetail({ activityId });
      if (result.data.activity && result.data.activity.map?.polyline) {
        const decoded = polyline.decode(result.data.activity.map.polyline);
        setStravaActivities(prev => prev.map(a => a.id === activityId ? { ...a, decodedPolyline: decoded } : a));
        setMapCenter(decoded[0]);
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const handleSaveStrava = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await saveStravaConfig(user.uid, stravaClientId, stravaClientSecret, stravaRefreshToken);
      if (!stravaRefreshToken) {
        const redirectUri = window.location.hostname === 'localhost' ? `http://localhost:5000` : window.location.origin;
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&redirect_uri=${redirectUri}&response_type=code&scope=read,activity:read_all&approval_prompt=force`;
      } else {
        setShowSettings(false);
        fetchStravaActivities();
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!rateLimitExceeded || secondsToReset <= 0) return;
    const timer = setInterval(() => {
      setSecondsToReset(prev => {
        if (prev <= 1) {
          setRateLimitExceeded(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitExceeded, secondsToReset]);

  const countdownText = useMemo(() => {
    const m = Math.floor(secondsToReset / 60);
    const s = secondsToReset % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [secondsToReset]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const config = await getStravaConfig(u.uid);
        if (config) {
          setStravaClientId(config.stravaClientId || '');
          setStravaClientSecret(config.stravaClientSecret || '');
          setStravaRefreshToken(config.stravaRefreshToken || '');
          
          // Load cached data if available
          if (config.cachedActivities) setStravaActivities(config.cachedActivities);
          if (config.cachedStats) setAthleteStats(config.cachedStats);
          if (config.cachedZones) setAthleteZones(config.cachedZones);
          if (config.cachedProfile) setAthleteProfile(config.cachedProfile);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && stravaRefreshToken && !stravaActivities.length) fetchStravaActivities();
  }, [user, stravaRefreshToken]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (waypoints.length < 2) { setRoutePath([]); setDistance(0); return; }
      setIsLoading(true);
      const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
      try {
        const response = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=polyline`);
        const data = await response.json();
        if (data.code === 'Ok') {
          setRoutePath(polyline.decode(data.routes[0].geometry));
          setDistance((data.routes[0].distance / 1000).toFixed(2));
        }
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    const timer = setTimeout(fetchRoute, 300);
    return () => clearTimeout(timer);
  }, [waypoints]);

  return (
    <Router>
      <div className="flex flex-col h-screen w-full bg-slate-50 font-sans overflow-hidden">
        <header className="bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center z-[2000]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg"><MapPin size={24} className="text-white" /></div>
              <div><h1 className="text-xl font-bold tracking-tight leading-none">RouteFlow</h1><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Pro Runner</p></div>
            </div>
            <nav className="flex items-center gap-2">
              <NavLink to="/" icon={MapIcon}>Planner</NavLink>
              <NavLink to="/dashboard" icon={BarChart3}>Dashboard</NavLink>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                {rateLimitExceeded && (
                  <div className="bg-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-lg font-bold animate-pulse flex items-center gap-1.5">
                    <Clock size={10} />
                    Reset in {countdownText}
                  </div>
                )}
                <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                  <button 
                    onClick={() => fetchStravaActivities(false)} 
                    disabled={isLoading} 
                    className="px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Sync
                  </button>
                  <div className="w-px h-4 bg-slate-700 mx-0.5"></div>
                  <button 
                    onClick={() => fetchStravaActivities(true)} 
                    disabled={isLoading} 
                    className="px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider text-orange-500 hover:bg-orange-500/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    title="Fetch full history (uses more rate limit)"
                  >
                    <Zap size={10} />
                    Deep Sync
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300"><Settings size={20} /></button>
            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                <button onClick={logout} className="text-xs font-bold text-slate-400 hover:text-white">Sign Out</button>
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors">Sign In</button>
            )}
          </div>
        </header>

        {showSettings && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
              <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Settings className="text-blue-500" />Config</h2><button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">×</button></div>
              <form onSubmit={handleSaveStrava} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client ID</label><input type="text" value={stravaClientId} onChange={(e) => setStravaClientId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Secret</label><input type="password" value={stravaClientSecret} onChange={(e) => setStravaClientSecret(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Refresh Token</label><input type="password" value={stravaRefreshToken} onChange={(e) => setStravaRefreshToken(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" /></div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"><Save size={18} />Save Configuration</button>
              </form>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={
            <Planner 
              stravaActivities={stravaActivities} 
              selectedActivityId={selectedActivityId} 
              setSelectedActivityId={setSelectedActivityId}
              isLoading={isLoading}
              fetchStravaActivities={fetchStravaActivities}
              fetchStravaActivityDetail={fetchStravaActivityDetail}
              mapCenter={mapCenter} setMapCenter={setMapCenter}
              waypoints={waypoints} setWaypoints={setWaypoints}
              history={history} undo={undo} redo={redo} redoStack={redoStack}
              routePath={routePath} distance={distance} clearRoute={clearRoute}
              reverseRoute={reverseRoute} handleSearch={handleSearch}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              updateWaypoint={updateWaypoint} addWaypoint={addWaypoint}
              showSidebar={showSidebar} setShowSidebar={setShowSidebar}
              showStats={showStats} setShowStats={setShowStats}
              stats={stats}
            />
          } />
          <Route path="/dashboard" element={<Dashboard stravaActivities={stravaActivities} athleteStats={athleteStats} athleteZones={athleteZones} athleteProfile={athleteProfile} rateLimitExceeded={rateLimitExceeded} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
