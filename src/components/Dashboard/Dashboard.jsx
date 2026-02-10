import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, Trophy, Clock, Target, Zap, Activity, Heart, Footprints, TrendingUp, ShieldAlert, Award } from 'lucide-react';

export default function Dashboard({ 
  stravaActivities, 
  athleteStats, 
  athleteZones, 
  athleteProfile, 
  rateLimitExceeded, 
  countdownText,
  gear 
}) {
  const insights = useMemo(() => {
    if (!stravaActivities || stravaActivities.length === 0) return null;
    
    const runs = [...stravaActivities].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const validRuns = runs.filter(r => r.distance && r.distance > 0);
    const now = new Date();

    // Cumulative & Recent Averages
    const cumulativeDistance = athleteStats?.all_run_totals?.distance || validRuns.reduce((acc, r) => acc + (r.distance || 0), 0);
    const cumulativeElevation = athleteStats?.all_run_totals?.elevation_gain || validRuns.reduce((acc, r) => acc + (r.total_elevation_gain || 0), 0);
    
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const last28DaysRuns = runs.filter(r => new Date(r.start_date) > fourWeeksAgo);
    const weeklyAvgDist = last28DaysRuns.reduce((acc, r) => acc + (r.distance || 0), 0) / 4000;
    const weeklyAvgTime = last28DaysRuns.reduce((acc, r) => acc + (r.moving_time || 0), 0) / 4;

    const formatPace = (p) => {
      if (!p || isNaN(p) || !isFinite(p)) return "0:00";
      return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')}`;
    };

    const formatTime = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

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

    // Performance Stats
    const activitiesWithHR = validRuns.filter(r => r.has_heartrate && r.average_heartrate);
    const avgHR = activitiesWithHR.length > 0 
      ? Math.round(activitiesWithHR.reduce((acc, r) => acc + r.average_heartrate, 0) / activitiesWithHR.length)
      : null;

    const activitiesWithCadence = validRuns.filter(r => r.average_cadence);
    const avgCadence = activitiesWithCadence.length > 0
      ? Math.round(activitiesWithCadence.reduce((acc, r) => acc + r.average_cadence, 0) / activitiesWithCadence.length) * 2
      : null;

    // Gear
    const usedGear = Object.values(gear || {}).sort((a, b) => b.distance - a.distance);

    // Best Efforts (Estimated from activities)
    const topRuns = [...validRuns].sort((a, b) => b.distance - a.distance);

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
      lastActivity: runs[runs.length - 1]
    };
  }, [stravaActivities, athleteStats, athleteProfile, gear]);

  if (!insights) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8 text-center">
      <BarChart3 size={48} className="mb-4 opacity-20" />
      <p className="text-lg font-bold text-slate-600">Syncing Strava data...</p>
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
                src={athleteProfile?.profile} 
                alt="" 
                className="w-32 h-32 rounded-[2.5rem] border-4 border-white shadow-2xl object-cover"
              />
              <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-2xl shadow-lg">
                <Trophy size={20} />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">
                  {athleteProfile?.firstname} {athleteProfile?.lastname}
                </h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Strava Pro Athlete</p>
              </div>
              <div className="flex gap-8 justify-center md:justify-start">
                <StatMini label="Following" value={insights.following} />
                <StatMini label="Followers" value={insights.followers} />
                <StatMini label="Activities" value={insights.totalActivities} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            {rateLimitExceeded && (
              <div className="bg-red-500 text-white text-[10px] px-4 py-2 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-200 flex items-center gap-2 w-full justify-center">
                <ShieldAlert size={14} /> Rate Limit Hit - Reset in {countdownText}
              </div>
            )}
            <div className="bg-slate-900 text-white p-6 rounded-3xl w-full md:w-72 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Activity size={80} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Latest Activity</p>
              <p className="text-lg font-black line-clamp-1">{insights.lastActivity?.name}</p>
              <p className="text-xs text-orange-500 font-bold mt-1">
                {(insights.lastActivity?.distance / 1000).toFixed(2)} km • {new Date(insights.lastActivity?.start_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </header>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard icon={<Zap />} color="blue" label="Total Distance" value={insights.cumulativeDistance} unit="KM" />
          <MetricCard icon={<Target />} color="orange" label="Total Elevation" value={insights.cumulativeElevation} unit="M" />
          <MetricCard icon={<Heart />} color="red" label="Avg Heart Rate" value={insights.avgHR} unit="BPM" />
          <MetricCard icon={<Footprints />} color="emerald" label="Avg Cadence" value={insights.avgCadence} unit="SPM" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Volume Chart */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-900 text-xl flex items-center gap-3">
                  <BarChart3 className="text-blue-500" size={24} /> Volume (Last 12)
                </h3>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                  <TrendingUp size={16} className="text-green-500" />
                  <span className="text-xs font-bold text-slate-600">Trending Up</span>
                </div>
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

            {/* Gear Tracker */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-900 text-xl mb-6 flex items-center gap-3">
                <Zap className="text-yellow-500" size={24} /> Gear Locker
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.usedGear.length > 0 ? insights.usedGear.map(item => (
                  <div key={item.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 hover:border-blue-200 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-white p-3 rounded-2xl shadow-sm">
                        <Activity size={20} className="text-blue-500" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.brand_name}</span>
                    </div>
                    <p className="font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{item.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">{(item.distance / 1000).toFixed(0)}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase">KM tracked</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min((item.distance / 1000000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )) : (
                  <p className="text-slate-400 text-sm italic">No gear data available. Sync deep to fetch gear.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {/* Consistency & Streak */}
            <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] opacity-50 flex items-center gap-2">
                  <Clock size={16} /> Consistency
                </h3>
                <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-black">
                  {insights.streakWeeks} WEEK STREAK
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
            <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] opacity-50 mb-8 flex items-center gap-2">
                  <Award size={18} /> Best Efforts
                </h3>
                <div className="space-y-4">
                  {insights.allTimePRs?.slice(0, 3).map(pr => (
                    <div key={pr.label} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{pr.label}</span>
                      <span className="font-black text-slate-900">{pr.val}</span>
                    </div>
                  ))}
                </div>
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
