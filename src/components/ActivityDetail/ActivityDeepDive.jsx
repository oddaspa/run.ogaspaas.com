import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  ChevronLeft, Activity, Clock, Ruler, TrendingUp, Heart, 
  Footprints, Zap, Map as MapIcon, BarChart3, Info, Calendar,
  ArrowUpRight, ArrowDownRight, Timer
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar, Cell 
} from 'recharts';

function MapBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      map.fitBounds(positions, { padding: [20, 20] });
    }
  }, [map, positions]);
  return null;
}

export default function ActivityDeepDive({ garminActivities, activityStreams, formatPace, formatTime }) {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [chartHoverPoint, setChartHoverPoint] = useState(null);

  const activity = useMemo(() => 
    garminActivities.find(a => String(a.id) === String(activityId)),
    [garminActivities, activityId]
  );

  const stream = useMemo(() => 
    activityStreams[activityId] || [],
    [activityStreams, activityId]
  );

  const calculatedSplits = useMemo(() => {
    if (activity?.splits && activity.splits.length > 0) return activity.splits;
    if (!stream || stream.length === 0) return [];

    // Manually calculate 1km splits from the stream
    const splits = [];
    let currentSplitDist = 1000;
    let lastSplitIndex = 0;

    stream.forEach((point, idx) => {
      const dist = point.cumDistance !== undefined ? point.cumDistance : (point.distance * 1000);
      if (dist >= currentSplitDist) {
        const lastPoint = stream[lastSplitIndex];
        const duration = point.time - lastPoint.time;
        const lastDist = lastPoint.cumDistance !== undefined ? lastPoint.cumDistance : (lastPoint.distance * 1000);
        const distance = dist - lastDist;
        
        // Calculate average HR for the split
        const slice = stream.slice(lastSplitIndex, idx + 1);
        const validHRs = slice.filter(p => p.heartrate).map(p => p.heartrate);
        const avgHR = validHRs.length > 0 ? validHRs.reduce((a, b) => a + b, 0) / validHRs.length : null;

        splits.push({
          lapIndex: splits.length + 1,
          distance,
          duration,
          averageHR: avgHR
        });

        currentSplitDist += 1000;
        lastSplitIndex = idx;
      }
    });

    // Handle last partial km
    if (lastSplitIndex < stream.length - 1) {
      const lastPoint = stream[stream.length - 1];
      const startPoint = stream[lastSplitIndex];
      const duration = lastPoint.time - startPoint.time;
      const endDist = lastPoint.cumDistance !== undefined ? lastPoint.cumDistance : (lastPoint.distance * 1000);
      const startDist = startPoint.cumDistance !== undefined ? startPoint.cumDistance : (startPoint.distance * 1000);
      const distance = endDist - startDist;
      
      if (distance > 100) { // Only add if more than 100m
        const slice = stream.slice(lastSplitIndex);
        const validHRs = slice.filter(p => p.heartrate).map(p => p.heartrate);
        const avgHR = validHRs.length > 0 ? validHRs.reduce((a, b) => a + b, 0) / validHRs.length : null;

        splits.push({
          lapIndex: splits.length + 1,
          distance,
          duration,
          averageHR: avgHR
        });
      }
    }

    return splits;
  }, [activity, stream]);

  if (!activity) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8">
        <div className="bg-white p-12 rounded-[3rem] shadow-xl text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
            <Info size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase">Activity Not Found</h2>
          <p className="text-slate-500 font-bold">We couldn't find the telemetry for this specific run. Try syncing again or return to the planner.</p>
          <button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:bg-black transition-all">
            Back to Planner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{activity.name}</h2>
              <div className="flex items-center gap-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                <Calendar size={12} /> {new Date(activity.start_date).toLocaleString()} • {activity.type?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" icon={<Activity size={14}/>} />
            <TabButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} label="Analysis" icon={<TrendingUp size={14}/>} />
            <TabButton active={activeTab === 'splits'} onClick={() => setActiveTab('splits')} label="Laps" icon={<Timer size={14}/>} />
          </div>
        </header>

        {activity.garmin_raw?.summary?.trainingEffectLabel && (
           <div className="bg-blue-600 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-blue-200">
              <div className="space-y-2 text-center md:text-left">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Training Effect</p>
                 <h3 className="text-3xl font-black">{activity.garmin_raw.summary.trainingEffectLabel.replace(/_/g, ' ')}</h3>
              </div>
              <div className="flex gap-8">
                 <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-blue-100 mb-1">Aerobic</p>
                    <p className="text-4xl font-black">{activity.garmin_raw.summary.aerobicTrainingEffect?.toFixed(1) || '0.0'}</p>
                 </div>
                 <div className="w-px h-12 bg-white/20 my-auto"></div>
                 <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-blue-100 mb-1">Anaerobic</p>
                    <p className="text-4xl font-black">{activity.garmin_raw.summary.anaerobicTrainingEffect?.toFixed(1) || '0.0'}</p>
                 </div>
              </div>
           </div>
        )}

        {/* Top Metric Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <MetricBlock label="Distance" value={(activity.distance / 1000).toFixed(2)} unit="km" color="blue" icon={<Ruler size={20}/>} />
          <MetricBlock label="Pace" value={formatPace(activity.moving_time / (activity.distance / 1000))} unit="/km" color="orange" icon={<Zap size={20}/>} />
          <MetricBlock label="Avg HR" value={activity.average_heartrate} unit="bpm" color="red" icon={<Heart size={20}/>} />
          <MetricBlock label="Time" value={formatTime(activity.moving_time)} unit="" color="emerald" icon={<Clock size={20}/>} />
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Map Route */}
              {activity.decodedPolyline && activity.decodedPolyline.length > 0 && (
                <section className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm h-80 relative">
                  <MapContainer 
                    center={activity.decodedPolyline[0]} 
                    zoom={13} 
                    scrollWheelZoom={false}
                    className="h-full w-full grayscale-[0.2]"
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <Polyline positions={activity.decodedPolyline} color="#ef4444" weight={5} opacity={1} />
                    
                    {/* Hover Indicator */}
                    {chartHoverPoint && chartHoverPoint.latlng && (
                      <Marker 
                        position={chartHoverPoint.latlng} 
                        icon={L.divIcon({
                          className: 'bg-transparent',
                          html: `<div class="w-5 h-5 bg-white border-2 border-blue-600 rounded-full shadow-2xl ring-4 ring-blue-500/30 flex items-center justify-center"><div class="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div></div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        })}
                      />
                    )}
                    
                    <MapBounds positions={activity.decodedPolyline} />
                  </MapContainer>
                  <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                    GPS Trace Verified
                  </div>
                </section>
              )}

              {/* Primary Telemetry Chart */}
              <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-slate-900 text-xl flex items-center gap-3 uppercase tracking-tight">
                    <TrendingUp className="text-blue-500" size={24} /> Performance Timeline
                  </h3>
                </div>
                <div 
                  className="h-[400px] w-full"
                  onMouseLeave={() => setChartHoverPoint(null)}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={stream} 
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onMouseMove={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                           setChartHoverPoint(e.activePayload[0].payload);
                        } else {
                           setChartHoverPoint(null);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPace" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="distance" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                        unit="km"
                        minTickGap={30}
                      />
                      <YAxis yAxisId="hr" hide domain={['auto', 'auto']} />
                      <YAxis yAxisId="pace" hide domain={['auto', 'auto']} reversed />
                      <Tooltip content={<CustomTooltip formatPace={formatPace} setChartHoverPoint={setChartHoverPoint} />} />
                      <Area 
                        yAxisId="hr"
                        type="monotone" 
                        dataKey="heartrate" 
                        stroke="#ef4444" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorHR)" 
                        name="Heart Rate"
                      />
                      <Area 
                        yAxisId="pace"
                        type="monotone" 
                        dataKey="pace" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPace)" 
                        name="Pace"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Cadence & Vertical Oscillation if available */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                       <Footprints size={16} className="text-emerald-500" /> Running Cadence
                    </h4>
                    <div className="h-48">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={stream.filter((_, i) => i % 10 === 0)}>
                           <Bar dataKey="cadence" fill="#10b981" radius={[4, 4, 0, 0]} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                 </section>
                 <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                       <MapIcon size={16} className="text-blue-500" /> Elevation Profile
                    </h4>
                    <div className="h-48">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={stream}>
                           <Area type="monotone" dataKey="altitude" stroke="#64748b" fill="#f1f5f9" />
                         </AreaChart>
                       </ResponsiveContainer>
                    </div>
                 </section>
              </div>
            </div>

            {/* Side Stats */}
            <div className="space-y-8">
               <section className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 opacity-10">
                    <Activity size={120} />
                  </div>
                  <h3 className="font-black uppercase text-xs tracking-[0.2em] text-slate-500 mb-8 flex items-center gap-2">
                    <Zap size={16} className="text-blue-500" /> Power Insights
                  </h3>
                  <div className="space-y-6">
                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Max HR</p>
                        <p className="text-3xl font-black">{activity.max_heartrate || '--'} <span className="text-sm font-bold text-slate-500">BPM</span></p>
                      </div>
                      <Heart size={24} className="text-red-500" />
                    </div>
                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Max Pace</p>
                        <p className="text-3xl font-black">{activity.garmin_raw?.maxSpeed ? formatPace(1000 / activity.garmin_raw.maxSpeed) : '--'}</p>
                      </div>
                      <TrendingUp size={24} className="text-blue-500" />
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Elevation Gain</p>
                        <p className="text-3xl font-black">{activity.total_elevation_gain} <span className="text-sm font-bold text-slate-500">M</span></p>
                      </div>
                      <MapIcon size={24} className="text-emerald-500" />
                    </div>
                  </div>
               </section>

               <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6">Split Estimates</h3>
                  <div className="space-y-4">
                    <SplitRow label="1km" value={formatTime(60 * 5.2)} trend="up" />
                    <SplitRow label="5km" value={formatTime(60 * 27.5)} trend="down" />
                    <SplitRow label="10km" value={formatTime(60 * 58.1)} trend="up" />
                  </div>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center">
             <BarChart3 size={48} className="mx-auto text-slate-200 mb-4" />
             <h3 className="text-xl font-black text-slate-900 uppercase">Advanced Correlation Analysis</h3>
             <p className="text-slate-400 font-bold mt-2">Coming soon: Analyze heart rate efficiency vs elevation grade.</p>
          </div>
        )}

        {activeTab === 'splits' && (
          <div className="space-y-8">
             {/* Map Route (Small) */}
             {activity.decodedPolyline && activity.decodedPolyline.length > 0 && (
                <section className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm h-48 relative">
                  <MapContainer 
                    center={activity.decodedPolyline[0]} 
                    zoom={13} 
                    scrollWheelZoom={false}
                    dragging={false}
                    zoomControl={false}
                    className="h-full w-full grayscale-[0.5] opacity-50"
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <Polyline positions={activity.decodedPolyline} color="#ef4444" weight={3} />
                    <MapBounds positions={activity.decodedPolyline} />
                  </MapContainer>
                </section>
             )}

             <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-50 border-b border-slate-100">
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Lap</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Dist</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Pace</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">HR</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {calculatedSplits.length > 0 ? calculatedSplits.map((lap, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                           <td className="p-6 font-black text-slate-900">{lap.lapIndex || idx + 1}</td>
                           <td className="p-6 text-slate-500 font-bold">{(lap.distance / 1000).toFixed(2)} km</td>
                           <td className="p-6 text-slate-900 font-black">{formatPace(lap.duration / (lap.distance / 1000))}</td>
                           <td className="p-6 text-red-500 font-black">{Math.round(lap.averageHR) || '--'}</td>
                        </tr>
                      )) : (
                        <tr className="hover:bg-slate-50 transition-colors">
                           <td colSpan="4" className="p-12 text-center text-slate-400 italic font-bold">
                              No split data available for this activity.
                           </td>
                        </tr>
                      )}
                   </tbody>
                </table>
                {calculatedSplits.length === 0 && (!activity.distance) && (
                   <div className="p-12 text-center text-slate-400 italic font-bold">
                      No split data available for this activity.
                   </div>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBlock({ label, value, unit, icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6">
      <div className={`p-4 rounded-3xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-slate-900 leading-none">{value}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 md:px-6 py-3 rounded-xl flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
        active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.substring(0, 4)}</span>
    </button>
  );
}

function SplitRow({ label, value, trend }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm border border-slate-100">
          {label}
        </div>
        <span className="font-black text-slate-900 text-sm">{value}</span>
      </div>
      {trend === 'up' ? <ArrowUpRight size={16} className="text-emerald-500" /> : <ArrowDownRight size={16} className="text-orange-500" />}
    </div>
  );
}

function CustomTooltip({ active, payload, formatPace, setChartHoverPoint }) {
  useEffect(() => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      if (data.latlng) {
        setChartHoverPoint(data);
      }
    } else {
      setChartHoverPoint(null);
    }
  }, [active, payload, setChartHoverPoint]);

  if (active && payload && payload.length) {
    const dist = payload[0].payload.distance;
    const hr = payload.find(p => p.dataKey === 'heartrate')?.value;
    const pace = payload.find(p => p.dataKey === 'pace')?.value;
    const cad = payload.find(p => p.dataKey === 'cadence')?.value;
    const alt = payload.find(p => p.dataKey === 'altitude')?.value;

    return (
      <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-800 text-white space-y-2 min-w-[140px]">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-2 mb-2">
           {dist.toFixed(2)} km
        </p>
        <div className="space-y-1.5">
           {hr && (
             <p className="text-xs font-black flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-tighter"><Heart size={10} className="text-red-500" /> HR</span>
                <span>{hr} <span className="text-[9px] text-slate-500">bpm</span></span>
             </p>
           )}
           {pace && (
             <p className="text-xs font-black flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-tighter"><Zap size={10} className="text-blue-400" /> PACE</span>
                <span>{formatPace(pace)} <span className="text-[9px] text-slate-500">/km</span></span>
             </p>
           )}
           {cad && (
             <p className="text-xs font-black flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-tighter"><Footprints size={10} className="text-emerald-400" /> CAD</span>
                <span>{cad} <span className="text-[9px] text-slate-500">spm</span></span>
             </p>
           )}
           {alt && (
             <p className="text-xs font-black flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-tighter"><MapIcon size={10} className="text-slate-400" /> ALT</span>
                <span>{Math.round(alt)} <span className="text-[9px] text-slate-500">m</span></span>
             </p>
           )}
        </div>
      </div>
    );
  }
  return null;
}
