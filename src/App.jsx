import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { MapPin, BarChart3, Settings, Save, Zap, Clock, Activity, Map as MapIcon, LogOut, Terminal } from 'lucide-react';
import polyline from '@mapbox/polyline';
// import { auth, signInWithGoogle, logout, saveStravaConfig, getStravaConfig, functions, saveStravaData } from './firebase';
// import { auth, signInWithGoogle, logout, functions } from './firebase';
import { auth, signInWithGoogle, logout, functions, saveGarminData, saveActivityStream } from './firebase';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import Dashboard from './components/Dashboard/Dashboard';
import RoutePlanner from './components/Map/RoutePlanner';
import AdminPanel from './components/Admin/AdminPanel';
import GarminDiscoveryHub from './components/Admin/GarminDiscoveryHub';
import ActivityDeepDive from './components/ActivityDetail/ActivityDeepDive';

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

const MobileNavLink = ({ to, icon: Icon }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`p-2 rounded-lg transition-all ${
        isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'
      }`}
    >
      <Icon size={18} />
    </Link>
  );
};

function App() {
  const navigate = useNavigate();
  const formatPace = (secondsPerKm) => {
    if (!secondsPerKm || isNaN(secondsPerKm) || !isFinite(secondsPerKm)) return "0:00";
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeTooltip = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return h > 0 
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [user, setUser] = useState(null);
  const [apiLogs, setApiLogs] = useState([]);
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
      totalDistance: (totalDistance / 1000).toFixed(0),
      totalElevation: Math.round(totalElevation),
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

  const addApiLog = (functionName, data, status = 'success', params = null) => {
    const newLog = {
      id: Date.now() + Math.random().toString(36).substring(7),
      timestamp: new Date(),
      functionName,
      data,
      status,
      params
    };
    setApiLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50
  };

  const fetchGarminSplits = async (activityId) => {
    // Check if we already have splits in the activity state
    const activity = garminActivities.find(a => String(a.id) === String(activityId));
    if (activity?.splits) return;

    try {
      const getSplits = httpsCallable(functions, 'get_garmin_activity_splits');
      const splitsResult = await getSplits({ activityId });
      if (splitsResult.data.splits) {
        addApiLog('get_garmin_activity_splits', splitsResult.data.splits, 'success', { activityId });
        const splits = splitsResult.data.splits.lapDTOs;
        
        setGarminActivities(prev => {
          const next = prev.map(a => 
            String(a.id) === String(activityId) 
              ? { ...a, splits } 
              : a
          );
          // Save the enriched activity list to Firestore
          if (user) saveGarminData(user.uid, next, garminStats);
          return next;
        });
      }
    } catch (splitsErr) { console.error("Failed to fetch splits", splitsErr); }
  };

  const fetchGarminActivities = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const getActivities = httpsCallable(functions, 'get_garmin_activities');
      const result = await getActivities();
      
      if (result.data.activities) {
        addApiLog('get_garmin_activities', result.data);
        const mappedActivities = result.data.activities.map(a => {
          return {
            id: a.activityId,
            name: a.activityName,
            start_date: a.startTimeLocal,
            distance: Math.round(a.distance),
            moving_time: Math.round(a.movingDuration || a.duration || 0),
            total_elevation_gain: Math.round(a.elevationGain || 0),
            type: a.activityType.typeKey,
            sport_type: a.activityType.typeKey,
            average_heartrate: Math.round(a.averageHR),
            max_heartrate: Math.round(a.maxHR),
            average_cadence: Math.round(a.averageRunningCadenceInStepsPerMinute || a.averageRunCadence), 
            lat: a.startLatitude,
            lng: a.startLongitude,
            garmin_raw: a,
            source: 'garmin'
          };
        });

        // Automatically fetch details for GPS activities (non-treadmill)
        mappedActivities.forEach(activity => {
          if (activity.type !== 'treadmill_running') {
            fetchGarminActivityDetail(activity.id);
          }
        });

        setGarminActivities(mappedActivities);
        
        // Handle Garmin stats/profile if returned
        if (result.data) {
            setGarminStats(result.data);
            setAthleteProfile({
                fullName: result.data.fullName || result.data.health?.stats?.displayName || 'Garmin User',
                profile: result.data.activities[0]?.ownerProfileImageUrlLarge || null 
            });
            if (result.data.gear) setGear(result.data.gear);
        }
        
        await saveGarminData(user.uid, mappedActivities, result.data);
      }
    } catch (err) {
      console.error("Garmin fetch failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGarminActivityDetail = async (activityId) => {
    if (!user) return;
    setSelectedActivityId(activityId);

    // Check cache first
    if (activityStreams[activityId]) {
      addApiLog('get_garmin_activity_details', { status: 'Using local cache' }, 'success', { activityId });
      return;
    }
    
    // Check Firestore cache
    try {
      const streamRef = doc(db, "users", user.uid, "streams", String(activityId));
      const streamSnap = await getDoc(streamRef);
      if (streamSnap.exists()) {
        const data = streamSnap.data();
        let stream = data.stream || [];
        
        // Heal logic for incorrectly scaled time from previous version
        if (stream.length > 50 && stream[stream.length - 1].time < 10) {
          stream = stream.map(p => ({ ...p, time: Math.round(p.time * 1000) }));
        }

        setActivityStreams(prev => ({ ...prev, [activityId]: stream }));
        addApiLog('get_garmin_activity_details', data.rawDetails || { status: 'Using Firestore cache', streamLength: stream.length }, 'success', { activityId });
        
        // Check if we need to fetch splits (if they weren't in the cached activity)
        const currentActivity = garminActivities.find(a => String(a.id) === String(activityId));
        if (currentActivity && !currentActivity.splits) {
          fetchGarminSplits(activityId);
        }
        return;
      }
    } catch (e) { console.error("Cache check failed", e); }

    setIsLoading(true);
    try {
      const getDetail = httpsCallable(functions, 'get_garmin_activity_details');
      const result = await getDetail({ activityId });
      
      if (result.data.details) {
        addApiLog('get_garmin_activity_details', result.data, 'success', { activityId });
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
          const lat = latIdx !== undefined ? metrics[latIdx] : null;
          const lon = lonIdx !== undefined ? metrics[lonIdx] : null;
          
          if (lat !== null && lon !== null && lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) {
            decodedPolyline.push([lat, lon]);
          }

          const s = speedIdx !== undefined ? metrics[speedIdx] : 0;
          const hr = hrIdx !== undefined ? metrics[hrIdx] : null;
          const dist = (distIdx !== undefined && metrics[distIdx] !== null) ? metrics[distIdx] : 0;
          const cadence = cadenceIdx !== undefined ? metrics[cadenceIdx] : null;
          const alt = altIdx !== undefined ? metrics[altIdx] : null;
          const time = timeIdx !== undefined ? metrics[timeIdx] : null;
          
          // Speed to Pace conversion
          let currentPace = null;
          if (s > 0.5) {
            currentPace = 1000 / s;
            // Sanity check: cap pace at 20 min/km to avoid extreme spikes in charts
            if (currentPace > 1200) currentPace = 1200;
          }

          chartData.push({
            time: time !== null ? (time > 1000000000000 ? Math.round((time - metricsData[0].metrics[timeIdx]) / 1000) : Math.round(time)) : i,
            distance: Number((dist / 1000).toFixed(2)),
            heartrate: hr !== null ? Math.round(hr) : null,
            cadence: cadence !== null ? Math.round(cadence) : null,
            altitude: alt !== null ? Math.round(alt) : null,
            pace: currentPace,
            efficiency: (hr !== null && hr > 40 && s > 0.5) ? (s / hr) : null,
            latlng: (lat !== null && lon !== null && lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null,
            // Track total cumulative distance in meters for split generation
            cumDistance: dist
          });
        });

        setActivityStreams(prev => ({ ...prev, [activityId]: chartData }));
        if (decodedPolyline.length > 0) {
          setGarminActivities(prev => prev.map(a => a.id === activityId ? { ...a, decodedPolyline, lat: decodedPolyline[0][0], lng: decodedPolyline[0][1] } : a));
          setMapCenter(decodedPolyline[0]);
        }

        // Save to Firestore with raw details for future admin inspection
        await saveActivityStream(user.uid, activityId, chartData, result.data.details);
      }

      // Fetch Splits automatically
      fetchGarminSplits(activityId);

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
              }
              return { ...a, decodedPolyline };
            });
            setGarminActivities(loadedActivities);

            // Fetch details and splits for activities without splits data
            loadedActivities.forEach(activity => {
              if (activity.type !== 'treadmill_running' && !activity.splits) {
                // Fetch detail will also trigger split fetch
                fetchGarminActivityDetail(activity.id);
              }
            });
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
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 p-3 md:p-4 shadow-sm flex justify-between items-center z-[2000] sticky top-0">
          <div className="flex items-center gap-4 md:gap-12">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-slate-900 p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-lg shrink-0">
                <MapPin size={18} className="text-white md:w-[22px] md:h-[22px]" />
              </div>
              <h1 className="text-sm md:text-xl font-black tracking-tighter text-slate-900 uppercase">RouteFlow</h1>
            </div>
            <nav className="hidden md:flex items-center gap-1 lg:gap-4">
              <NavLink to="/" icon={MapIcon}>Planner</NavLink>
              <NavLink to="/dashboard" icon={BarChart3}>Dashboard</NavLink>
            </nav>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6 shrink-0">
            {/* Mobile Nav Toggle */}
            <div className="md:hidden flex bg-slate-100 p-1 rounded-xl border border-slate-200">
               <MobileNavLink to="/" icon={MapIcon} />
               <MobileNavLink to="/dashboard" icon={BarChart3} />
            </div>

            {user && (
              <button 
                onClick={fetchGarminActivities} 
                disabled={isLoading} 
                className="bg-blue-600 text-white p-2 md:px-4 md:py-2.5 rounded-lg md:rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-100"
              >
                <Activity size={14} /> <span className="hidden lg:inline">Garmin Sync</span>
              </button>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 md:p-2.5 hover:bg-slate-100 rounded-xl md:rounded-2xl transition-all text-slate-400 hover:text-slate-900"><Settings size={20} className="md:w-[22px] md:h-[22px]" /></button>
            {user ? (
              <div className="flex items-center gap-2 md:gap-4 pl-2 md:pl-4 border-l border-slate-100">
                <img src={user.photoURL} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-[1.2rem] border-2 border-white shadow-md md:shadow-lg object-cover" />
                <button onClick={logout} className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 hover:text-red-500 tracking-widest transition-colors flex items-center gap-1">
                  <LogOut size={12} className="md:hidden" />
                  <span className="hidden xs:inline">Sign Out</span>
                  <span className="xs:hidden">Out</span>
                </button>
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="bg-slate-900 hover:bg-black text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl shadow-slate-200">In</button>
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

              <div className="pt-6 border-t border-slate-100 space-y-2">
                <Link 
                  to="/discovery" 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase text-[10px] tracking-widest"
                >
                  <Terminal size={18} /> API Discovery Hub
                </Link>
                <Link 
                  to="/admin" 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase text-[10px] tracking-widest"
                >
                  <Activity size={18} /> View API Telemetry
                </Link>
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
              formatPace={formatPace}
              formatTimeTooltip={formatTimeTooltip}
            />
          } />
          <Route path="/dashboard" element={
            <Dashboard 
              stravaActivities={garminActivities} 
              athleteStats={garminStats} 
              athleteZones={athleteZones} 
              athleteProfile={athleteProfile} 
              gear={gear}
              formatPace={formatPace}
              formatTime={formatTimeTooltip}
              onFetchNewData={fetchGarminActivities}
              isLoading={isLoading}
            />
          } />
          <Route path="/admin" element={<AdminPanel apiLogs={apiLogs} />} />
          <Route path="/discovery" element={<GarminDiscoveryHub />} />
          <Route path="/activity/:activityId" element={
            <ActivityDeepDive 
              garminActivities={garminActivities}
              activityStreams={activityStreams}
              formatPace={formatPace}
              formatTime={formatTimeTooltip}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
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
