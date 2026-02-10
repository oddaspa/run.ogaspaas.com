import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { MapPin, BarChart3, Settings, Save, Zap, Clock, Activity, Map as MapIcon } from 'lucide-react';
import polyline from '@mapbox/polyline';
import { auth, signInWithGoogle, logout, saveStravaConfig, getStravaConfig, functions, saveStravaData } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import Dashboard from './components/Dashboard/Dashboard';
import RoutePlanner from './components/Map/RoutePlanner';

const NavLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${
        isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={16} />
      {children}
    </Link>
  );
};

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
  const [activityStreams, setActivityStreams] = useState({});
  const [activeStreamType, setActiveStreamType] = useState('heartrate');
  const [gear, setGear] = useState({});
  const [starredRoutes, setStarredRoutes] = useState([]);

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
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const nextWindow = Math.ceil((minutes + 1) / 15) * 15;
        const diffSeconds = ((nextWindow - minutes - 1) * 60) + (60 - seconds);
        setSecondsToReset(diffSeconds);
      }

      if (result.data.activities) {
        const decodedActivities = result.data.activities.map(a => {
          if (a.decodedPolyline) return a;
          let decodedPolyline = null;
          if (a.map && a.map.summary_polyline) {
            try { decodedPolyline = polyline.decode(a.map.summary_polyline); } catch (e) { console.error(e); }
          }
          return { ...a, decodedPolyline };
        });
        setStravaActivities(decodedActivities);
        
        const activitiesToSave = decodedActivities.map(({ decodedPolyline, ...rest }) => rest);
        
        await saveStravaData(
          user.uid, 
          activitiesToSave, 
          result.data.athleteStats, 
          result.data.athleteZones, 
          result.data.athleteProfile,
          result.data.gear,
          starredRoutes
        );
      }
      if (result.data.athleteStats) setAthleteStats(result.data.athleteStats);
      if (result.data.athleteZones) setAthleteZones(result.data.athleteZones);
      if (result.data.athleteProfile) setAthleteProfile(result.data.athleteProfile);
      if (result.data.gear) setGear(result.data.gear);

      try {
        const getRoutes = httpsCallable(functions, 'getStravaStarredRoutes');
        const routeResult = await getRoutes();
        if (routeResult.data.routes) setStarredRoutes(routeResult.data.routes);
      } catch (e) { console.error("Route fetch failed", e); }

    } catch (err) { 
      console.error(err);
      if (err.message?.includes('429')) setRateLimitExceeded(true);
    } finally { setIsLoading(false); }
  };

  const fetchStravaActivityDetail = async (activityId) => {
    setSelectedActivityId(activityId);
    setIsLoading(true);
    try {
      const getDetail = httpsCallable(functions, 'getStravaActivityDetail');
      const result = await getDetail({ activityId });
      
      if (result.data.activity) {
        const activity = result.data.activity;
        if (activity.map?.polyline) {
          const decoded = polyline.decode(activity.map.polyline);
          setStravaActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...activity, decodedPolyline: decoded } : a));
          setMapCenter(decoded[0]);
        } else {
          setStravaActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...activity } : a));
        }

        try {
          const getStreams = httpsCallable(functions, 'getStravaActivityStreams');
          const streamResult = await getStreams({ activityId });
          if (streamResult.data.streams) {
            const streams = streamResult.data.streams;
            const timeStream = streams.find(s => s.type === 'time')?.data || [];
            const hrStream = streams.find(s => s.type === 'heartrate')?.data || [];
            const cadenceStream = streams.find(s => s.type === 'cadence')?.data || [];
            const distanceStream = streams.find(s => s.type === 'distance')?.data || [];
            const altitudeStream = streams.find(s => s.type === 'altitude')?.data || [];
            const velocityStream = streams.find(s => s.type === 'velocity_smooth')?.data || [];

            const chartData = timeStream.map((t, i) => {
              const speed = velocityStream[i] || 0;
              // Pace in seconds per kilometer (1000m / speed m/s)
              const paceSkm = speed > 0.5 ? (1000 / speed) : null;
              
              return {
                time: t,
                distance: Number((distanceStream[i] / 1000).toFixed(2)),
                heartrate: hrStream[i] || null,
                cadence: (cadenceStream[i] * 2) || null,
                altitude: altitudeStream[i] || null,
                pace: paceSkm
              };
            });

            setActivityStreams(prev => ({ ...prev, [activityId]: chartData }));
          }
        } catch (streamErr) { console.error("Failed to fetch streams", streamErr); }
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
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && user) {
      const exchangeCode = async () => {
        setIsLoading(true);
        try {
          const exchangeStravaCode = httpsCallable(functions, 'exchangeStravaCode');
          await exchangeStravaCode({ code });
          // Clear URL params and fetch activities
          window.history.replaceState({}, document.title, window.location.pathname);
          fetchStravaActivities();
        } catch (err) { console.error("Code exchange failed", err); }
        finally { setIsLoading(false); }
      };
      exchangeCode();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const config = await getStravaConfig(u.uid);
        if (config) {
          setStravaClientId(config.stravaClientId || '');
          setStravaClientSecret(config.stravaClientSecret || '');
          setStravaRefreshToken(config.stravaRefreshToken || '');
          
          if (config.cachedActivities) {
            const loadedActivities = config.cachedActivities.map(a => {
              let decodedPolyline = null;
              if (a.map && a.map.summary_polyline) {
                try { decodedPolyline = polyline.decode(a.map.summary_polyline); } catch (e) { console.error(e); }
              }
              return { ...a, decodedPolyline };
            });
            setStravaActivities(loadedActivities);
          }
          if (config.cachedStats) setAthleteStats(config.cachedStats);
          if (config.cachedZones) setAthleteZones(config.cachedZones);
          if (config.cachedProfile) setAthleteProfile(config.cachedProfile);
          if (config.cachedGear) setGear(config.cachedGear);
          if (config.cachedRoutes) setStarredRoutes(config.cachedRoutes);
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
    <div className="flex flex-col h-screen w-full bg-white font-sans overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 shadow-sm flex justify-between items-center z-[2000]">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2 rounded-xl shadow-lg"><MapPin size={22} className="text-white" /></div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">RouteFlow</h1>
            </div>
            <nav className="hidden md:flex items-center gap-4">
              <NavLink to="/" icon={MapIcon}>Planner</NavLink>
              <NavLink to="/dashboard" icon={BarChart3}>Dashboard</NavLink>
            </nav>
          </div>
          
          <div className="flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-3">
                {rateLimitExceeded && (
                  <div className="bg-red-50 text-red-500 text-[10px] px-3 py-1.5 rounded-xl font-black flex items-center gap-2">
                    <Clock size={12} /> {countdownText}
                  </div>
                )}
                <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200 shadow-inner">
                  <button onClick={() => fetchStravaActivities(false)} disabled={isLoading} className="px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white hover:shadow-sm transition-all disabled:opacity-50">Sync</button>
                  <button onClick={() => fetchStravaActivities(true)} disabled={isLoading} className="px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-orange-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"><Zap size={10} />Deep</button>
                </div>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900"><Settings size={22} /></button>
            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-slate-100">
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-[1.2rem] border-2 border-white shadow-lg object-cover" />
                <button onClick={logout} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest">Sign Out</button>
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-slate-200">Sign In</button>
            )}
          </div>
        </header>

        {showSettings && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><Settings className="text-blue-500" /> Config</h2>
                <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-xl font-light">×</button>
              </div>
              <form onSubmit={handleSaveStrava} className="space-y-6">
                <InputField label="Client ID" value={stravaClientId} onChange={setStravaClientId} />
                <InputField label="Client Secret" value={stravaClientSecret} onChange={setStravaClientSecret} type="password" />
                <InputField label="Refresh Token" value={stravaRefreshToken} onChange={setStravaRefreshToken} type="password" />
                <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-slate-300 uppercase text-xs tracking-widest mt-4"><Save size={18} /> Save Settings</button>
              </form>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={
            <RoutePlanner 
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
              removeWaypoint={removeWaypoint}
              showSidebar={showSidebar} setShowSidebar={setShowSidebar}
              showStats={showStats} setShowStats={setShowStats}
              stats={stats}
              activityStreams={activityStreams}
              activeStreamType={activeStreamType}
              setActiveStreamType={setActiveStreamType}
              starredRoutes={starredRoutes}
            />
          } />
          <Route path="/dashboard" element={
            <Dashboard 
              stravaActivities={stravaActivities} 
              athleteStats={athleteStats} 
              athleteZones={athleteZones} 
              athleteProfile={athleteProfile} 
              rateLimitExceeded={rateLimitExceeded} 
              countdownText={countdownText} 
              gear={gear}
            />
          } />
        </Routes>
      </div>
  );
}

function InputField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all" 
      />
    </div>
  );
}

export default App;
