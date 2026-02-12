import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, Trophy, Clock, Target, Zap, Activity, Heart, Footprints, TrendingUp, ShieldAlert, Award, User, Settings, Globe, ShieldCheck, CloudSun, MapPin, Box } from 'lucide-react';
import { ReadinessGauge, SleepVisualizer, ProgressBar, RecordCard, ProfileCard, HrvVisualizer, StatusVisualizer, ActivityCard, GearVisualizer } from '../Visualizations/GarminVisuals';

export default function Dashboard({ 
  stravaActivities, 
  athleteStats, 
  athleteZones, 
  athleteProfile, 
  gear,
  formatPace: propFormatPace,
  formatTime: propFormatTime,
  onFetchNewData,
  isLoading
}) {
  const insights = useMemo(() => {
    if (!stravaActivities || stravaActivities.length === 0) return null;
    
    const runs = [...stravaActivities].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const validRuns = runs.filter(r => r.distance && r.distance > 0);
    const now = new Date();

    // Cumulative & Recent Averages
    const cumulativeDistance = Math.round(athleteStats?.all_run_totals?.distance || athleteStats?.summary?.totalDistance || athleteStats?.summary?.distance || validRuns.reduce((acc, r) => acc + (r.distance || 0), 0));
    const cumulativeElevation = Math.round(athleteStats?.all_run_totals?.elevation_gain || athleteStats?.summary?.totalElevationGain || athleteStats?.summary?.elevationGain || validRuns.reduce((acc, r) => acc + (r.total_elevation_gain || 0), 0));
    
    // Garmin readiness insights
    const trainingReadiness = athleteStats?.trainingReadiness?.[0] || athleteStats?.readiness;
    const trainingStatus = athleteStats?.trainingStatus?.mostRecentTrainingStatus?.latestTrainingStatusData || athleteStats?.status?.mostRecentTrainingStatus?.latestTrainingStatusData;
    const deviceId = Object.keys(trainingStatus || {})[0];
    const statusInfo = deviceId ? trainingStatus[deviceId] : null;
    const vo2Max = athleteStats?.trainingStatus?.mostRecentVO2Max?.generic?.vo2MaxValue || athleteStats?.status?.mostRecentVO2Max?.generic?.vo2MaxValue;
    
    // Wellness Data
    const bodyBattery = athleteStats?.bodyBattery?.bodyBatteryMostRecentValue || athleteStats?.health?.bodyBattery?.bodyBatteryMostRecentValue;
    const sleepScore = athleteStats?.sleep?.dailySleepDTO?.sleepScores?.overall?.value || athleteStats?.health?.sleep?.dailySleepDTO?.sleepScores?.overall?.value;
    const restingHR = athleteStats?.rhr?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE?.[0]?.value || athleteStats?.health?.rhr?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE?.[0]?.value;

    // Best Efforts
    const prs = athleteStats?.records || [];
    const bestEfforts = prs.map(pr => {
      const labels = { 1: "1K", 2: "1 Mile", 3: "5K", 4: "10K", 5: "Half Marathon", 6: "Marathon" };
      return {
        label: labels[pr.typeId] || pr.activityType || 'Record',
        val: propFormatTime(pr.value),
        date: pr.actStartDateTimeInGMTFormatted?.split('T')[0]
      };
    }).sort((a, b) => {
      const aLab = a.label || '';
      const bLab = b.label || '';
      return (aLab.includes('K') ? parseInt(aLab) : 0) - (bLab.includes('K') ? parseInt(bLab) : 0);
    });

    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const last28DaysRuns = runs.filter(r => new Date(r.start_date) > fourWeeksAgo);
    const weeklyAvgDist = last28DaysRuns.reduce((acc, r) => acc + (r.distance || 0), 0) / 4;
    const weeklyAvgTime = last28DaysRuns.reduce((acc, r) => acc + (r.moving_time || 0), 0) / 4;

    // Chart Data (Last 12)
    const chartData = runs.slice(-12).map(r => ({
      date: new Date(r.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      distance: Number((r.distance / 1000).toFixed(1)),
      originalDistance: r.distance / 1000
    }));

    // Weekly Streak
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const currentWeekActivities = weekDays.map((label, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);
      const hasActivity = runs.some(r => {
        const d = new Date(r.start_date);
        return d >= dayDate && d <= dayEnd;
      });
      return { label, day: dayDate.getDate(), hasActivity };
    });

    let streakWeeks = 0;
    if (runs.length > 0) {
      for (let i = 0; i < 52; i++) {
        const s = new Date(weekStart);
        s.setDate(s.getDate() - (i * 7));
        const hasActivity = runs.some(r => {
          const d = new Date(r.start_date);
          return d >= s && d <= new Date(s.getTime() + 7 * 24 * 60 * 60 * 1000);
        });
        if (hasActivity) streakWeeks++;
        else break;
      }
    }

    // Performance Stats
    const activitiesWithHR = validRuns.filter(r => (r.has_heartrate || r.source === 'garmin') && r.average_heartrate);
    const avgHR = activitiesWithHR.length > 0 
      ? Math.round(activitiesWithHR.reduce((acc, r) => acc + r.average_heartrate, 0) / activitiesWithHR.length)
      : null;

    const activitiesWithCadence = validRuns.filter(r => r.average_cadence);
    const avgCadence = activitiesWithCadence.length > 0
      ? Math.round(activitiesWithCadence.reduce((acc, r) => acc + r.average_cadence, 0) / activitiesWithCadence.length) * (activitiesWithCadence[0].source === 'garmin' ? 1 : 2)
      : null;

    // Gear
    const usedGear = Object.values(gear || {}).sort((a, b) => b.distance - a.distance);

    const formatPace = (p) => {
      if (propFormatPace) return propFormatPace(p);
      if (!p || isNaN(p) || !isFinite(p)) return "0:00";
      return `${Math.floor(p / 60)}:${Math.round(p % 60).toString().padStart(2, '0')}`;
    };

    const formatTime = (seconds) => {
      if (propFormatTime) return propFormatTime(seconds);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return {
      cumulativeDistance: (cumulativeDistance / 1000).toFixed(0),
      cumulativeElevation: Math.round(cumulativeElevation),
      weeklyAvgDist: weeklyAvgDist.toFixed(1),
      weeklyAvgTime: formatTime(weeklyAvgTime),
      streakWeeks,
      currentWeekActivities,
      chartData,
      avgHR,
      avgCadence,
      usedGear,
      followers: athleteProfile?.follower_count || 0,
      following: athleteProfile?.friend_count || 0,
      totalActivities: athleteStats?.all_run_totals?.count || runs.length,
      lastActivity: runs[runs.length - 1],
      trainingReadiness,
      statusInfo,
      vo2Max,
      bodyBattery,
      sleepScore,
      restingHR,
      bestEfforts,
      formatPace,
      formatTime
    };
  }, [stravaActivities, athleteStats, athleteProfile, gear, propFormatTime, propFormatPace]);

  if (!insights) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8 text-center">
      <BarChart3 size={48} className="mb-4 opacity-20" />
      <p className="text-lg font-bold text-slate-600">Syncing Garmin data...</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Sleek Profile Header */}
        <header className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
            <div className="relative">
              <img 
                src={athleteProfile?.profile || "https://res.garmin.com/en/products/010-02810-10/v/c1_01_md.png"} 
                alt="" 
                className="w-32 h-32 rounded-[2.5rem] border-4 border-white shadow-2xl object-cover bg-slate-50"
              />
              <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-2xl shadow-lg">
                <Trophy size={20} />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">
                  {athleteProfile?.fullName || athleteProfile?.displayName || 'Athlete'}
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Garmin Connect Athlete</p>
                  <button 
                    onClick={onFetchNewData} 
                    disabled={isLoading}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-blue-500 disabled:opacity-50"
                    title="Refresh Data"
                  >
                    <Activity size={14} className={isLoading ? "animate-pulse" : ""} />
                  </button>
                </div>
              </div>
              <div className="flex gap-8 justify-center md:justify-start">
                <StatMini label="Following" value={insights.following || '--'} />
                <StatMini label="Followers" value={insights.followers || '--'} />
                <StatMini label="Activities" value={insights.totalActivities} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="bg-slate-900 text-white p-6 rounded-3xl w-full md:w-72 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Activity size={80} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Latest Activity</p>
              <p className="text-lg font-black line-clamp-1">{insights.lastActivity?.name}</p>
              <p className="text-xs text-blue-500 font-bold mt-1">
                {(insights.lastActivity?.distance / 1000).toFixed(2)} km • {new Date(insights.lastActivity?.start_date).toLocaleDateString()}
              </p>
              <p className="text-[10px] text-slate-400 font-bold">
                {insights.formatTime(insights.lastActivity?.moving_time)} • {insights.formatPace(insights.lastActivity?.moving_time / (insights.lastActivity?.distance / 1000))} /km
              </p>
            </div>
          </div>
        </header>

        {/* Primary Garmin Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <DashboardSection title="Training Readiness" icon={<ShieldAlert className="text-blue-500" />}>
            <ReadinessGauge data={athleteStats?.health?.readiness || athleteStats?.readiness} />
          </DashboardSection>

          <DashboardSection title="Sleep Analysis" icon={<Clock className="text-purple-500" />}>
            <SleepVisualizer data={athleteStats?.health?.sleep || athleteStats?.sleep} />
          </DashboardSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <DashboardSection title="Training Status" icon={<TrendingUp className="text-emerald-500" />}>
            <StatusVisualizer data={athleteStats?.health?.status || athleteStats?.status || athleteStats} />
          </DashboardSection>

          <DashboardSection title="Heart Health (HRV)" icon={<Heart className="text-red-500" />}>
            <HrvVisualizer data={athleteStats?.health?.hrv || athleteStats?.hrv} />
          </DashboardSection>

          <DashboardSection title="Daily Energy" icon={<Zap className="text-yellow-500" />}>
             <div className="space-y-6">
                <ProgressBar 
                  label="Body Battery" 
                  current={(athleteStats?.health?.bodyBattery || athleteStats?.bodyBattery)?.bodyBatteryMostRecentValue || 0} 
                  icon={Zap} 
                  colorClass="bg-yellow-400" 
                />
                <ProgressBar 
                  label="Daily Steps" 
                  current={(athleteStats?.health?.stats || athleteStats?.stats)?.totalSteps || 0} 
                  max={(athleteStats?.health?.stats || athleteStats?.stats)?.dailyStepGoal || 10000} 
                  icon={Footprints} 
                  colorClass="bg-emerald-500" 
                />
             </div>
          </DashboardSection>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard icon={<Zap />} color="blue" label="Total Distance" value={insights.cumulativeDistance} unit="KM" />
          <MetricCard icon={<Target />} color="orange" label="Total Elevation" value={insights.cumulativeElevation} unit="M" />
          <MetricCard icon={<Heart />} color="red" label="Avg Heart Rate" value={insights.avgHR} unit="BPM" />
          <MetricCard icon={<Footprints />} color="emerald" label="Avg Cadence" value={insights.avgCadence} unit="SPM" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Volume Chart */}
            <section className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h3 className="font-black text-slate-800 text-sm md:text-xl flex items-center gap-3 uppercase tracking-wider">
                  <BarChart3 className="text-blue-500" size={20} /> Volume (Last 12)
                </h3>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc', radius: 12 }} 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} 
                    />
                    <Bar dataKey="distance" radius={[10, 10, 10, 10]} barSize={32}>
                      {insights.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.originalDistance > 10 ? '#3b82f6' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Recent Activity */}
            <DashboardSection title="Latest Activity" icon={<Activity className="text-blue-500" />}>
               <ActivityCard data={athleteStats?.activities || stravaActivities} />
            </DashboardSection>

            {/* Gear Tracker */}
            <section className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 text-sm md:text-xl mb-6 flex items-center gap-3 uppercase tracking-wider">
                <Box className="text-yellow-500" size={20} /> Gear Locker
              </h3>
              <GearVisualizer data={athleteStats?.gear || Object.values(gear || {})} />
            </section>
          </div>

          <div className="space-y-8">
            {/* Consistency & Streak */}
            <section className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h3 className="font-black text-slate-700 uppercase text-[10px] md:text-xs tracking-[0.2em] opacity-50 flex items-center gap-2">
                  <Clock size={16} /> Consistency
                </h3>
                <div className="bg-orange-50 text-orange-600 px-2 md:px-3 py-1 rounded-full text-[9px] md:text-xs font-black">
                  {insights.streakWeeks}W STREAK
                </div>
              </div>
              <div className="flex justify-between gap-2">
                {insights.currentWeekActivities.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400">{day.label}</span>
                    <div className={`w-full aspect-square rounded-2xl flex items-center justify-center font-black text-xs transition-all duration-500 ${day.hasActivity ? 'bg-orange-500 text-white shadow-xl shadow-orange-200 scale-110' : 'bg-slate-50 text-slate-300'}`}>
                      {day.day}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Averages */}
            <section className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200">
              <h3 className="font-black uppercase text-xs tracking-[0.2em] text-slate-500 mb-8 flex items-center gap-2">
                <TrendingUp size={16} /> Recent Average
              </h3>
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Weekly Volume</p>
                    <p className="text-3xl font-black">{insights.weeklyAvgDist} <span className="text-sm font-bold text-slate-500 uppercase">KM</span></p>
                  </div>
                  <div className="h-10 w-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Zap size={20} className="text-blue-500" />
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Time Active</p>
                    <p className="text-3xl font-black">{insights.weeklyAvgTime}</p>
                  </div>
                  <div className="h-10 w-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Clock size={20} className="text-orange-500" />
                  </div>
                </div>
              </div>
            </section>

            {/* Achievements/Personal Records */}
            <section className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
               <h3 className="font-black text-slate-700 uppercase text-[10px] md:text-xs tracking-[0.2em] opacity-50 mb-6 md:mb-8 flex items-center gap-2">
                  <Award size={18} /> Best Efforts
                </h3>
                <RecordCard data={athleteStats?.records || []} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, color }) {
  const colors = {
    blue: "text-blue-600 bg-blue-50",
    orange: "text-orange-600 bg-orange-50",
    red: "text-red-600 bg-red-50",
    emerald: "text-emerald-600 bg-emerald-50",
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-slate-900">{value || '--'}</span>
          <span className="text-xs font-bold text-slate-400 uppercase">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-2xl font-black text-slate-900">{value}</span>
    </div>
  );
}

function DashboardSection({ title, icon, children }) {
  return (
    <section className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 border border-slate-200 shadow-sm flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
          {icon}
        </div>
        <h3 className="font-black text-slate-700 uppercase text-xs tracking-[0.2em]">{title}</h3>
      </div>
      <div className="bg-slate-50/30 rounded-[1.2rem] md:rounded-[1.5rem] p-4 md:p-6 border border-slate-100/80">
        {children}
      </div>
    </section>
  );
}
