import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import { Search, Undo2, Redo2, ArrowUpDown, Loader2, MapPin, Activity, Ruler, Calendar, Trash2, Clock, Footprints, Heart, TrendingUp, BarChart3, Layers } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

function MapEvents({ onMapClick, onEmptyClick, enabled, setHoveredActivityId }) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick(e.latlng);
      } else {
        onEmptyClick();
      }
    },
    mousemove: (e) => {
      // Clear hover if moving over empty map area
      if (e.originalEvent.target.classList.contains('leaflet-container')) {
        setHoveredActivityId(null);
      }
    }
  });
  return null;
}

function MapController({ centerPos, bottomOffset }) {
  const map = useMapEvents({});
  React.useEffect(() => {
    if (centerPos) {
      // Center with an offset to account for the bottom drawer
      const targetPoint = map.project(centerPos, map.getZoom());
      targetPoint.y += bottomOffset / 2;
      const targetLatLng = map.unproject(targetPoint, map.getZoom());
      map.flyTo(targetLatLng, 13);
    }
  }, [centerPos, map, bottomOffset]);
  return null;
}

export default function RoutePlanner({ 
  stravaActivities, 
  selectedActivityId, 
  setSelectedActivityId, 
  isLoading, 
  fetchStravaActivityDetail, 
  mapCenter, setMapCenter, 
  waypoints, updateWaypoint, addWaypoint, removeWaypoint,
  history, redoStack, undo, redo, reverseRoute,
  routePath, distance, clearRoute,
  searchQuery, setSearchQuery, handleSearch,
  showSidebar, setShowSidebar,
  showStats, setShowStats, stats,
  activityStreams, activeStreamType, setActiveStreamType,
  starredRoutes
}) {
  const [gpsOnly, setGpsOnly] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [hoveredActivityId, setHoveredActivityId] = useState(null);
  const [showHR, setShowHR] = useState(true);
  const [showCadence, setShowCadence] = useState(false);
  const [showPace, setShowPace] = useState(false);
  const [showAltitude, setShowAltitude] = useState(false);
  const [showSecondaryMetric, setShowSecondaryMetric] = useState(false);
  const [xAxisType, setXAxisType] = useState('distance');

  const filteredActivities = useMemo(() => 
    gpsOnly ? stravaActivities.filter(a => a.decodedPolyline) : stravaActivities,
    [stravaActivities, gpsOnly]
  );

  const selectedActivity = useMemo(() => 
    stravaActivities.find(a => a.id === selectedActivityId),
    [stravaActivities, selectedActivityId]
  );

  // Clear hover when selection changes to prevent "sticky" highlights
  useEffect(() => {
    setHoveredActivityId(null);
  }, [selectedActivityId]);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Sleek Sidebar */}
      <aside 
        className={`bg-white border-r border-slate-200 transition-all duration-500 ease-in-out overflow-hidden flex flex-col z-[1002] ${
          showSidebar ? 'w-80' : 'w-0'
        }`}
      >
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest">
              <Activity size={16} className="text-orange-500" /> Activities
            </h2>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black">
              {filteredActivities.length}
            </span>
          </div>
          
          <div className="flex gap-2">
            <FilterToggle active={gpsOnly} onClick={() => setGpsOnly(!gpsOnly)} label="GPS ONLY" />
            <FilterToggle active={showHeatmap} onClick={() => setShowHeatmap(!showHeatmap)} label="HEATMAP" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-slate-50/30">
          {filteredActivities.map((activity) => (
            <ActivityItem 
              key={activity.id}
              activity={activity}
              isSelected={selectedActivityId === activity.id}
              onClick={() => {
                setSelectedActivityId(activity.id);
                if (activity.decodedPolyline) setMapCenter(activity.decodedPolyline[0]);
                else fetchStravaActivityDetail(activity.id);
              }}
            />
          ))}
        </div>
      </aside>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Floating Controls */}
        <div className="absolute top-6 left-8 z-[1001] flex flex-col gap-4">
          <form onSubmit={handleSearch} className="bg-white/90 backdrop-blur-xl p-2 rounded-3xl shadow-2xl border border-white flex items-center gap-2 w-80">
            <div className="pl-3 text-slate-400"><Search size={18} /></div>
            <input 
              type="text" 
              placeholder="Search destination..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-slate-400 py-2" 
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-200">GO</button>
          </form>

          <div className="bg-white/90 backdrop-blur-xl p-2 rounded-3xl shadow-2xl border border-white flex flex-col gap-1 w-fit">
            <ControlButton 
              onClick={() => setIsPlanningMode(!isPlanningMode)} 
              active={isPlanningMode}
              icon={<MapPin size={20} className={isPlanningMode ? 'text-blue-500' : 'text-slate-600'} />} 
              title={isPlanningMode ? "Exit Planning Mode" : "Start Planning Mode"}
            />
            <div className="h-px bg-slate-100 mx-2 my-1"></div>
            <ControlButton onClick={undo} disabled={history.length === 0} icon={<Undo2 size={20} />} />
            <ControlButton onClick={redo} disabled={redoStack.length === 0} icon={<Redo2 size={20} />} />
            <div className="h-px bg-slate-100 mx-2 my-1"></div>
            <ControlButton onClick={reverseRoute} disabled={waypoints.length < 2} icon={<ArrowUpDown size={20} />} />
            <ControlButton onClick={clearRoute} disabled={waypoints.length === 0} icon={<Trash2 size={20} className="text-red-500" />} />
          </div>
        </div>

        <main className="flex-1 relative">
          {isLoading && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest animate-in fade-in zoom-in duration-300">
              <Loader2 size={16} className="animate-spin text-blue-400" /> Syncing Telemetry
            </div>
          )}
          
          <MapContainer center={[63.4305, 10.3951]} zoom={13} zoomControl={false} className="h-full w-full grayscale-[0.2]">
            <MapController centerPos={mapCenter} bottomOffset={selectedActivity ? window.innerHeight / 3 : 0} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapEvents 
              onMapClick={addWaypoint} 
              onEmptyClick={() => setSelectedActivityId(null)}
              enabled={isPlanningMode} 
              setHoveredActivityId={setHoveredActivityId}
            />
            
            {waypoints.map((pos, idx) => (
              <Marker key={`${idx}-${pos.lat}`} position={pos} draggable eventHandlers={{ dragend: (e) => updateWaypoint(idx, e.target.getLatLng()) }}>
                <Popup>
                   <div className="p-2 text-center">
                     <p className="font-black text-[10px] uppercase text-slate-400 mb-2">Waypoint {idx + 1}</p>
                     <button onClick={() => removeWaypoint(idx)} className="text-red-500 font-bold text-xs flex items-center gap-1"><Trash2 size={12}/> REMOVE</button>
                   </div>
                </Popup>
              </Marker>
            ))}

            {routePath.length > 0 && <Polyline positions={routePath} color="#3b82f6" weight={6} opacity={0.9} />}
            
            {showHeatmap && stravaActivities
              .filter(a => a.decodedPolyline && a.id !== selectedActivityId)
              .map((activity) => (
              <React.Fragment key={activity.id}>
                {/* Visual Line */}
                <Polyline 
                  positions={activity.decodedPolyline} 
                  color="#f97316" 
                  weight={2} 
                  opacity={0.2} 
                  interactive={false}
                />
                {/* Interaction / Hit Area */}
                <Polyline 
                  positions={activity.decodedPolyline} 
                  color="transparent"
                  weight={15} 
                  opacity={0}
                  bubblingMouseEvents={false}
                  eventHandlers={{ 
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedActivityId(activity.id);
                      if (!activityStreams[activity.id]) {
                        fetchStravaActivityDetail(activity.id);
                      }
                    },
                    mouseover: () => setHoveredActivityId(activity.id),
                    mouseout: () => setHoveredActivityId(null)
                  }}
                />
              </React.Fragment>
            ))}

            {/* Hover Highlight Layer */}
            {hoveredActivityId && hoveredActivityId !== selectedActivityId && (
              <Polyline
                key={`hover-${hoveredActivityId}`}
                positions={stravaActivities.find(a => a.id === hoveredActivityId)?.decodedPolyline || []}
                color="#3b82f6"
                weight={4}
                opacity={0.8}
                interactive={false}
              />
            )}

            {/* Selected Activity Highlighting (Rendered last for top z-index) */}
            {selectedActivity?.decodedPolyline && (
              <Polyline 
                key={`selected-${selectedActivityId}`}
                positions={selectedActivity.decodedPolyline} 
                color="#ef4444" 
                weight={8} 
                opacity={1}
                className="drop-shadow-2xl"
                bubblingMouseEvents={false}
                eventHandlers={{
                  click: (e) => L.DomEvent.stopPropagation(e)
                }}
              >
                <Popup className="custom-strava-popup">
                   <div className="p-4 min-w-[220px] space-y-4">
                     <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                       <div>
                         <h4 className="font-black text-slate-900 text-sm leading-tight">{selectedActivity.name}</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(selectedActivity.start_date).toLocaleDateString()}</p>
                       </div>
                       <div className="bg-orange-50 p-1.5 rounded-lg text-orange-600">
                         <Activity size={14} />
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                       <PopupStat label="DISTANCE" value={(selectedActivity.distance / 1000).toFixed(2)} unit="km" />
                       <PopupStat label="PACE" value={formatPace(selectedActivity.moving_time / (selectedActivity.distance / 1000))} unit="/km" />
                       <PopupStat label="ELEVATION" value={selectedActivity.total_elevation_gain} unit="m" />
                       <PopupStat label="TIME" value={Math.floor(selectedActivity.moving_time / 60)} unit="m" />
                     </div>

                     {stats && (
                       <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                           <TrendingUp size={10} /> Performance vs Avg
                         </p>
                         <div className="space-y-2">
                           <ComparisonBar 
                             label="Distance" 
                             current={selectedActivity.distance / 1000} 
                             avg={stats.totalDistance / stats.count} 
                           />
                         </div>
                       </div>
                     )}
                     
                     <button 
                       onClick={() => {
                        if (!activityStreams[selectedActivityId]) fetchStravaActivityDetail(selectedActivityId);
                       }}
                       className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200 hover:bg-black transition-all"
                     >
                       VIEW TELEMETRY
                     </button>
                   </div>
                </Popup>
              </Polyline>
            )}
          </MapContainer>
        </main>

        {/* Selected Activity Details & Streams */}
        {selectedActivity && (
          <div className="bg-white border-t border-slate-200 p-6 z-[1003] shadow-2xl animate-in slide-in-from-bottom duration-500 h-1/3 flex flex-col overflow-hidden">
            <div className="max-w-7xl mx-auto space-y-6 w-full flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedActivity.name}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(selectedActivity.start_date).toLocaleString()} • {selectedActivity.sport_type || selectedActivity.type}</p>
                  </div>
                  <div className="h-12 w-px bg-slate-100"></div>
                  <div className="flex gap-10">
                    <DetailStat label="Distance" value={(selectedActivity.distance / 1000).toFixed(2)} unit="km" />
                    <DetailStat label="Pace" value={formatPace(selectedActivity.moving_time / (selectedActivity.distance / 1000))} unit="/km" />
                    {selectedActivity.average_heartrate && <DetailStat label="Heart Rate" value={Math.round(selectedActivity.average_heartrate)} unit="bpm" color="red" />}
                    {selectedActivity.average_cadence && <DetailStat label="Cadence" value={Math.round(selectedActivity.average_cadence * 2)} unit="spm" color="emerald" />}
                    <DetailStat label="Elevation" value={selectedActivity.total_elevation_gain} unit="m" />
                    <DetailStat label="Time" value={formatTimeTooltip(selectedActivity.moving_time)} unit="" />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {stats && (
                    <div className="hidden xl:flex flex-col gap-2 min-w-[200px] bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <TrendingUp size={10} /> Performance vs Avg
                      </p>
                      <ComparisonBar 
                        label="Distance" 
                        current={selectedActivity.distance / 1000} 
                        avg={stats.totalDistance / stats.count} 
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4">
                    {activityStreams[selectedActivityId] && (
                      <div className="flex gap-2">
                        <div className="flex bg-slate-100 p-1.5 rounded-[1.2rem] border border-slate-200">
                          <StreamToggle active={xAxisType === 'distance'} onClick={() => setXAxisType('distance')} label="Dist" />
                          <StreamToggle active={xAxisType === 'time'} onClick={() => setXAxisType('time')} label="Time" />
                        </div>
                        <div className="flex bg-slate-100 p-1.5 rounded-[1.2rem] border border-slate-200">
                            <StreamToggle active={showHR} onClick={() => setShowHR(!showHR)} label="HR" />
                            <StreamToggle active={showCadence} onClick={() => setShowCadence(!showCadence)} label="CAD" />
                            <StreamToggle active={showPace} onClick={() => setShowPace(!showPace)} label="PACE" />
                            <StreamToggle active={showAltitude} onClick={() => setShowAltitude(!showAltitude)} label="ALT" />
                            <StreamToggle 
                              active={showSecondaryMetric} 
                              onClick={() => setShowSecondaryMetric(!showSecondaryMetric)} 
                              label={xAxisType === 'distance' ? 'TIME' : 'DIST'} 
                            />
                        </div>
                      </div>
                    )}
                    <button onClick={() => setSelectedActivityId(null)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all text-2xl font-light">×</button>
                  </div>
                </div>
              </div>

              {activityStreams[selectedActivityId] && (
                <div className="flex-1 w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityStreams[selectedActivityId]} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey={xAxisType} 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                        tickFormatter={(val) => xAxisType === 'time' ? formatTimeTooltip(val) : `${val}km`}
                        dy={10}
                      />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip 
                        labelClassName="hidden"
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: '900' }}
                        formatter={(val, name) => {
                          if (name === 'heartrate') return [val, 'HR (bpm)'];
                          if (name === 'cadence') return [val, 'CAD (spm)'];
                          if (name === 'pace') return [formatPace(val), 'Pace'];
                          if (name === 'altitude') return [`${val.toFixed(1)}m`, 'Altitude'];
                          if (name === 'distance') return [`${val} km`, 'Distance'];
                          if (name === 'time') return [formatTimeTooltip(val), 'Time'];
                          return [val, name];
                        }}
                        labelFormatter={(label) => xAxisType === 'time' ? formatTimeTooltip(label) : `${label} km`}
                      />
                      {showHR && (
                        <Line 
                          type="monotone" 
                          dataKey="heartrate" 
                          stroke="#ef4444" 
                          strokeWidth={3} 
                          dot={false}
                          animationDuration={1000}
                          yAxisId="primary"
                        />
                      )}
                      {showCadence && (
                        <Line 
                          type="monotone" 
                          dataKey="cadence" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={false}
                          animationDuration={1000}
                          yAxisId="primary"
                        />
                      )}
                      {showPace && (
                        <Line 
                          type="monotone" 
                          dataKey="pace" 
                          stroke="#f59e0b" 
                          strokeWidth={3} 
                          dot={false}
                          animationDuration={1000}
                          yAxisId="pace"
                        />
                      )}
                      {showAltitude && (
                        <Line 
                          type="monotone" 
                          dataKey="altitude" 
                          stroke="#94a3b8" 
                          strokeWidth={2} 
                          dot={false}
                          animationDuration={1000}
                          yAxisId="altitude"
                        />
                      )}
                      {showSecondaryMetric && (
                        <Line 
                          type="monotone" 
                          dataKey={xAxisType === 'distance' ? 'time' : 'distance'} 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          dot={false}
                          animationDuration={1000}
                          yAxisId="secondary"
                        />
                      )}
                      <YAxis yAxisId="primary" hide domain={['auto', 'auto']} />
                      <YAxis yAxisId="pace" hide domain={['auto', 'auto']} reversed />
                      <YAxis yAxisId="altitude" hide domain={['auto', 'auto']} />
                      <YAxis yAxisId="secondary" hide domain={['auto', 'auto']} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatPace(p) {
  if (!p || isNaN(p) || !isFinite(p)) return "0:00";
  return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')}`;
}

function formatTimeTooltip(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

function ActivityItem({ activity, isSelected, onClick }) {
  const hasGPS = !!activity.decodedPolyline;
  
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${
        isSelected 
          ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100' 
          : 'border-white bg-white hover:border-orange-200 hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-black text-slate-800 text-sm line-clamp-1 group-hover:text-orange-600 transition-colors">
          {activity.name}
        </h3>
        <div 
          title={hasGPS ? "GPS Verified" : "Manual/Treadmill (No GPS)"}
          className={`p-1 rounded-md ${hasGPS ? 'text-blue-500 bg-blue-50' : 'text-slate-300 bg-slate-50'}`}
        >
          {hasGPS ? <MapPin size={12} /> : <Layers size={12} />}
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-1.5"><Ruler size={12} className="text-slate-300"/> {(activity.distance / 1000).toFixed(1)}KM</span>
        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-300"/> {new Date(activity.start_date).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

function PopupStat({ label, value, unit }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-sm font-black text-slate-900">{value || '--'}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  );
}

function ComparisonBar({ label, current, avg }) {
  const diff = current - avg;
  const isBetter = diff >= 0;
  const percent = Math.min(Math.abs(diff / avg) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-bold">
        <span className="text-slate-500">{label}</span>
        <span className={isBetter ? 'text-green-600' : 'text-orange-500'}>
          {isBetter ? '+' : ''}{diff.toFixed(1)} {isBetter ? 'better' : 'below'} avg
        </span>
      </div>
      <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${isBetter ? 'bg-green-500' : 'bg-orange-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function FilterToggle({ active, onClick, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl text-[9px] font-black tracking-[0.15em] transition-all border ${
        active ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function ControlButton({ onClick, disabled, icon, active, title }) {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      title={title}
      className={`p-3 rounded-2xl transition-all active:scale-90 ${
        active ? 'bg-blue-50 shadow-inner' : 'hover:bg-slate-50 text-slate-600'
      } disabled:opacity-20`}
    >
      {icon}
    </button>
  );
}

function DetailStat({ label, value, unit, color }) {
  const colors = { red: 'text-red-600', emerald: 'text-emerald-600', default: 'text-slate-900' };
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-black ${colors[color] || colors.default}`}>{value}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  );
}

function StreamToggle({ active, onClick, label }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 rounded-[0.9rem] text-[10px] font-black transition-all ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}
