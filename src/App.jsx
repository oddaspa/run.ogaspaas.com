import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { MapPin, BarChart3, Settings, Save, Zap, Clock, Activity, Map as MapIcon } from 'lucide-react';
import polyline from '@mapbox/polyline';
// import { auth, signInWithGoogle, logout, saveStravaConfig, getStravaConfig, functions, saveStravaData } from './firebase';
// import { auth, signInWithGoogle, logout, functions } from './firebase';
import { auth, signInWithGoogle, logout, functions, saveGarminData } from './firebase';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
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
  const [waypoints, setWaypoints] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [routePath, setRoutePath] = useState([]);
  const [distance, setDistance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState(null);
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
  const [garminActivities, setGarminActivities] = useState([]);
  const [garminStats, setGarminStats] = useState(null);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaState, setMfaState] = useState(null);
  const [isGarminLinked, setIsGarminLinked] = useState(false);

  const stats = useMemo(() => {
    if (!garminActivities.length) return null;
    const totalDistance = garminActivities.reduce((acc, a) => acc + (a.distance || 0), 0);
    const totalElevation = garminActivities.reduce((acc, a) => acc + (a.total_elevation_gain || 0), 0);
    const totalTime = garminActivities.reduce((acc, a) => acc + (a.moving_time || 0), 0);
    const gpsCount = garminActivities.filter(a => a.decodedPolyline).length;
    return {
      totalDistance: (totalDistance / 1000).toFixed(1),
      totalElevation,
      totalHours: Math.floor(totalTime / 3600),
      count: garminActivities.length,
      gpsCount
    };
  }, [garminActivities]);

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

  const fetchGarminActivities = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const getActivities = httpsCallable(functions, 'get_garmin_activities');
      const result = await getActivities();
      
      if (result.data.activities) {
        const mappedActivities = result.data.activities.map(a => {
          return {
            id: a.activityId,
            name: a.activityName,
            start_date: a.startTimeLocal,
            distance: a.distance,
            moving_time: a.movingDuration || a.duration,
            total_elevation_gain: a.elevationGain,
            type: a.activityType.typeKey,
            sport_type: a.activityType.typeKey,
            average_heartrate: a.averageHR,
            max_heartrate: a.maxHR,
            average_cadence: a.averageRunningCadenceInStepsPerMinute || a.averageRunCadence, 
            garmin_raw: a,
            source: 'garmin'
          };
        });
        setGarminActivities(mappedActivities);
        
        // Handle Garmin stats/profile if returned
        if (result.data.stats) {
            setGarminStats(result.data.stats);
            // Use Garmin's name/data
            setAthleteProfile({
                fullName: result.data.fullName || result.data.stats.displayName || 'Garmin User',
                profile: result.data.activities[0]?.ownerProfileImageUrlLarge || null 
            });
        }
        
        await saveGarminData(user.uid, mappedActivities, result.data.stats);
      }
    } catch (err) {
      console.error("Garmin fetch failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGarminActivityDetail = async (activityId) => {
    setSelectedActivityId(activityId);
    setIsLoading(true);
    try {
      const getDetail = httpsCallable(functions, 'get_garmin_activity_details');
      const result = await getDetail({ activityId });
      
      if (result.data.details) {
        const details = result.data.details;
        const descriptors = details.metricDescriptors || [];
        const metricsData = details.activityDetailMetrics || [];

        // Map keys to their indices in the metrics arrays
        const keyToIndex = {};
        descriptors.forEach(d => { keyToIndex[d.key] = d.metricsIndex; });

        const latIdx = keyToIndex['directLatitude'];
        const lonIdx = keyToIndex['directLongitude'];
        const hrIdx = keyToIndex['directHeartRate'];
        const speedIdx = keyToIndex['directSpeed'];
        const cadenceIdx = keyToIndex['directRunCadence'] || keyToIndex['directDoubleCadence'];
        const altIdx = keyToIndex['directElevation'];
        const distIdx = keyToIndex['sumDistance'];
        const timeIdx = keyToIndex['sumDuration'];

        // 1. Process Polyline and Chart Data
        const decodedPolyline = [];
        const chartData = [];

        metricsData.forEach((m, i) => {
          const metrics = m.metrics;
          const lat = metrics[latIdx];
          const lon = metrics[lonIdx];
          
          if (lat !== null && lon !== null) {
            decodedPolyline.push([lat, lon]);
          }

          const s = metrics[speedIdx] || 0;
          const hr = metrics[hrIdx];
          const dist = metrics[distIdx] ? metrics[distIdx] / 1000 : 0;
          
          chartData.push({
            time: metrics[timeIdx] ? metrics[timeIdx] / 1000 : i,
            distance: Number(dist.toFixed(2)),
            heartrate: hr,
            cadence: metrics[cadenceIdx],
            altitude: metrics[altIdx],
            pace: s > 0.5 ? (1000 / s) : null,
            efficiency: (hr > 40 && s > 0.5) ? (s / hr) : null,
            latlng: (lat !== null && lon !== null) ? [lat, lon] : null
          });
        });

        setActivityStreams(prev => ({ ...prev, [activityId]: chartData }));
        if (decodedPolyline.length > 0) {
          setGarminActivities(prev => prev.map(a => a.id === activityId ? { ...a, decodedPolyline } : a));
          setMapCenter(decodedPolyline[0]);
        }
      }
    } catch (err) {
      console.error("Garmin detail fetch failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkGarmin = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      const linkAccount = httpsCallable(functions, 'link_garmin_account');
      const result = await linkAccount({ 
        email: garminEmail, 
        password: garminPassword,
        mfaCode: mfaCode 
      });
      
      if (result.data.status === 'needs_mfa') {
        setMfaState(result.data.state);
        alert("MFA Code required. Check your email/app and enter it below.");
      } else if (result.data.success) {
        setIsGarminLinked(true);
        setMfaState(null);
        setMfaCode('');
        alert("Garmin account linked successfully!");
        fetchGarminActivities();
      } else if (result.data.error) {
        alert("Error linking Garmin: " + result.data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to link Garmin account.");
    } finally {
      setIsLoading(false);
    }
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
            const latlngStream = streams.find(s => s.type === 'latlng')?.data || [];

            const chartData = timeStream.map((t, i) => {
              const speed = velocityStream[i] || 0;
              const hr = hrStream[i] || 0;
              // Pace in seconds per kilometer (1000m / speed m/s)
              const paceSkm = speed > 0.5 ? (1000 / speed) : null;
              
              // Performance efficiency: Speed (m/s) divided by HR (bpm)
              // Higher speed at lower heart rate = higher efficiency
              const efficiency = (hr > 40 && speed > 0.5) ? (speed / hr) : null;
              
              return {
                time: t,
                distance: Number((distanceStream[i] / 1000).toFixed(2)),
                heartrate: hr || null,
                cadence: (cadenceStream[i] * 2) || null,
                altitude: altitudeStream[i] || null,
                pace: paceSkm,
                latlng: latlngStream[i] || null,
                efficiency
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
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Use direct Firestore access instead of Strava-named helper
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        const config = docSnap.exists() ? docSnap.data() : null;
        
        if (config) {
          if (config.cachedGarminActivities) {
            const loadedActivities = config.cachedGarminActivities.map(a => {
              let decodedPolyline = null;
              if (a.decodedPolyline) {
                decodedPolyline = a.decodedPolyline;
              } else if (a.map && a.map.summary_polyline) {
                try { decodedPolyline = polyline.decode(a.map.summary_polyline); } catch (e) { console.error(e); }
              }
              return { ...a, decodedPolyline };
            });
            setGarminActivities(loadedActivities);
          }
          if (config.cachedGarminStats) setGarminStats(config.cachedGarminStats);
          if (config.cachedZones) setAthleteZones(config.cachedZones);
          if (config.cachedProfile) setAthleteProfile(config.cachedProfile);
          if (config.cachedGear) setGear(config.cachedGear);
          if (config.cachedRoutes) setStarredRoutes(config.cachedRoutes);
          
          if (config.garminEmail) {
            setIsGarminLinked(true);
            setGarminEmail(config.garminEmail);
          }
        }
      } else {
        // Clear all state when signing out
        setGarminActivities([]);
        setGarminStats(null);
        setAthleteZones(null);
        setAthleteProfile(null);
        setActivityStreams({});
        setSelectedActivityId(null);
        setGear({});
        setStarredRoutes([]);
        setWaypoints([]);
        setHistory([]);
        setRedoStack([]);
        setRoutePath([]);
        setDistance(0);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && isGarminLinked && !garminActivities.length) fetchGarminActivities();
  }, [user, isGarminLinked]);

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
                <button 
                  onClick={fetchGarminActivities} 
                  disabled={isLoading} 
                  className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Activity size={14} /> Garmin Sync
                </button>
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
              <div className="my-8">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3"><Activity className="text-blue-500" /> Garmin Connect</h3>
                <form onSubmit={handleLinkGarmin} className="space-y-4">
                  <InputField label="Garmin Email" value={garminEmail} onChange={setGarminEmail} />
                  <InputField label="Garmin Password" value={garminPassword} onChange={setGarminPassword} type="password" />
                  {mfaState && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <InputField label="MFA Code" value={mfaCode} onChange={setMfaCode} />
                    </div>
                  )}
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-200 uppercase text-xs tracking-widest mt-4">
                    <Zap size={18} /> {mfaState ? 'Confirm MFA' : (isGarminLinked ? 'Update Garmin Link' : 'Link Garmin Account')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={
            <RoutePlanner 
              stravaActivities={garminActivities} 
              selectedActivityId={selectedActivityId} 
              setSelectedActivityId={setSelectedActivityId}
              isLoading={isLoading}
              fetchStravaActivities={fetchGarminActivities}
              fetchStravaActivityDetail={fetchGarminActivityDetail}
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
              athleteZones={athleteZones}
            />
          } />
          <Route path="/dashboard" element={
            <Dashboard 
              stravaActivities={garminActivities} 
              athleteStats={garminStats} 
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
