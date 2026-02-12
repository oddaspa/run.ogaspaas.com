import React from 'react';
import { Zap, Activity, Heart, Award, Box, TrendingUp, ShieldCheck, CloudSun, MapPin, Footprints } from 'lucide-react';

/**
 * Common Metric Utility
 */
export const MetricItem = ({ label, value, sub, colorClass = 'text-slate-900' }) => (
  <div>
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <p className={`text-sm font-black ${colorClass}`}>{value || '--'}</p>
    {sub && <p className="text-[9px] font-bold text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

/**
 * PROFILE: User Profile Component
 */
export const ProfileCard = ({ data }) => {
  if (!data) return null;
  return (
    <div className="flex items-center gap-6 p-4">
      <div className="relative">
        <img src={data.profileImageUrlLarge} className="w-20 h-20 rounded-3xl border-2 border-slate-200 object-cover bg-slate-100 shadow-sm" alt="" />
        <div className="absolute -bottom-1 -right-1 bg-blue-600 p-1.5 rounded-xl border-2 border-white shadow-md">
           <ShieldCheck size={12} className="text-white" />
        </div>
      </div>
      <div className="flex-1">
        <h4 className="text-xl font-black text-slate-900">{data.fullName || data.userName}</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.location || 'Garmin Athlete'}</p>
        <div className="flex gap-4 mt-3">
          <MetricItem label="System ID" value={data.systemuserId || data.systemuser_id} />
          <MetricItem label="System" value={data.measurementSystem?.toUpperCase()} />
        </div>
      </div>
    </div>
  );
};

/**
 * READINESS: Circular Gauge
 */
export const ReadinessGauge = ({ data }) => {
  const readiness = Array.isArray(data) ? data[0] : data;
  if (!readiness) return null;
  const dash = 364.4;
  const offset = dash * (1 - (readiness.score || 0) / 100);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
        <svg className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r="58" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle 
            cx="64" cy="64" r="58" fill="none" stroke="#3b82f6" strokeWidth="10" 
            strokeDasharray={dash} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-black text-slate-900">{readiness.score}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score</span>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-4 sm:gap-y-5 w-full">
        <MetricItem label="Sleep" value={readiness.sleepScoreFactorFeedback} sub={`${readiness.sleepScore} pts`} colorClass={readiness.sleepScoreFactorFeedback === 'POOR' ? 'text-red-600' : 'text-slate-900'} />
        <MetricItem label="Recovery" value={readiness.recoveryTimeFactorFeedback} sub={`${Math.round(readiness.recoveryTime/60)}h`} colorClass={readiness.recoveryTimeFactorFeedback === 'POOR' ? 'text-red-600' : 'text-slate-900'} />
        <MetricItem label="HRV" value={readiness.hrvFactorFeedback} sub={`${readiness.hrvWeeklyAverage}ms avg`} colorClass={readiness.hrvFactorFeedback === 'POOR' ? 'text-red-600' : 'text-slate-900'} />
        <MetricItem label="Load" value={readiness.acwrFactorFeedback} sub={`Acute: ${readiness.acuteLoad}`} colorClass={readiness.acwrFactorFeedback === 'POOR' ? 'text-red-600' : 'text-slate-900'} />
      </div>
    </div>
  );
};

/**
 * SLEEP: Distribution Bar
 */
export const SleepVisualizer = ({ data }) => {
  const sleep = data?.dailySleepDTO || {};
  if (!sleep.sleepTimeSeconds) return null;
  const durationStr = `${Math.floor(sleep.sleepTimeSeconds / 3600)}h ${Math.floor((sleep.sleepTimeSeconds % 3600) / 60)}m`;
  const stages = [
    { label: 'Deep', seconds: sleep.deepSleepSeconds || 0, color: 'bg-blue-800' },
    { label: 'REM', seconds: sleep.remSleepSeconds || 0, color: 'bg-purple-600' },
    { label: 'Light', seconds: sleep.lightSleepSeconds || 0, color: 'bg-blue-400' },
    { label: 'Awake', seconds: sleep.awakeSleepSeconds || 0, color: 'bg-slate-300' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Duration</p>
          <h4 className="text-3xl sm:text-4xl font-black text-slate-900">{durationStr}</h4>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-emerald-600 uppercase px-2 py-1 bg-emerald-50 rounded-lg">{sleep.sleepScoreFeedback?.replace(/_/g, ' ')}</span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Score: <span className="text-slate-900">{sleep.sleepScores?.overall?.value}</span></p>
        </div>
      </div>
      <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
        {stages.map((s, i) => (
          <div key={i} style={{ width: `${(s.seconds/sleep.sleepTimeSeconds)*100}%` }} className={`${s.color} h-full transition-all duration-700 shadow-inner`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${s.color} shadow-sm`} />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * TRAINING STATUS: Status and VO2 Max
 */
export const StatusVisualizer = ({ data }) => {
  const statusData = data?.mostRecentTrainingStatus?.latestTrainingStatusData;
  const deviceId = statusData ? Object.keys(statusData)[0] : null;
  const status = deviceId ? statusData[deviceId] : {};
  const vo2Max = data?.mostRecentVO2Max?.generic?.vo2MaxValue || 0;
  const load = status.acuteTrainingLoadDTO || {};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
            <TrendingUp className="text-emerald-500" size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
            <h4 className="text-base font-black text-slate-900">{status.trainingStatusFeedbackPhrase?.replace(/_/g, ' ') || 'UNKNOWN'}</h4>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">VO2 Max</p>
          <span className="text-2xl sm:text-3xl font-black text-slate-900">{Math.round(vo2Max)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 px-2">
        <MetricItem label="Acute Load" value={load.dailyTrainingLoadAcute} sub="Optimal range" colorClass="text-slate-900" />
        <MetricItem label="ACWR" value={load.dailyAcuteChronicWorkloadRatio} sub={load.acwrStatus} colorClass="text-slate-900" />
      </div>
    </div>
  );
};

/**
 * PROGRESS: Generic Progress Bar (Body Battery, Stats)
 */
export const ProgressBar = ({ label, current, max = 100, unit, colorClass = 'bg-blue-600', icon: Icon }) => (
  <div className="flex items-center gap-4 w-full">
    {Icon && (
      <div className="p-3 bg-white rounded-xl text-blue-600 shrink-0 shadow-sm border border-slate-100">
        <Icon size={18} />
      </div>
    )}
    <div className="flex-1">
      <div className="flex justify-between mb-2 items-baseline">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-black text-slate-900">{current}<span className="text-[10px] text-slate-400 ml-1.5 font-bold uppercase">/ {max} {unit}</span></span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full p-0.5 border border-slate-200">
        <div 
          className={`h-full ${colorClass} rounded-full transition-all duration-1000 shadow-sm`} 
          style={{ width: `${Math.min((current/max)*100, 100)}%` }} 
        />
      </div>
    </div>
  </div>
);

/**
 * HRV: Heart Rate Variability
 */
export const HrvVisualizer = ({ data }) => {
  const hrv = data?.hrvSummary || data?.dailyHrvValue || (Array.isArray(data) ? data[0] : {});
  const baseline = hrv.baseline || {};
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
      <div className="bg-slate-50 p-4 sm:p-5 rounded-[1.5rem] border border-slate-200 flex flex-col items-center shrink-0 shadow-sm w-fit">
        <Heart className="text-red-500 mb-1.5" size={28} />
        <span className="text-2xl sm:text-3xl font-black text-slate-900">{hrv.lastNightAvg || '--'}</span>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center">ms avg</span>
      </div>
      <div className="flex-1 space-y-3 w-full text-center sm:text-left">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status: <span className="text-blue-600">{hrv.status}</span></p>
        <div className="grid grid-cols-2 gap-6">
          <MetricItem label="Weekly" value={`${hrv.weeklyAvg} ms`} />
          <MetricItem label="Baseline" value={`${baseline.balancedLow}-${baseline.balancedUpper} ms`} />
        </div>
      </div>
    </div>
  );
};

/**
 * ACTIVITY: Summary Card
 */
export const ActivityCard = ({ data }) => {
  if (!data) return null;
  const activity = Array.isArray(data) ? data[0] : data;
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight mb-1 truncate">{activity.activityName}</h4>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{activity.startTimeLocal?.split(' ')[0]}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-sm shrink-0">
           <Activity className="text-blue-600" size={20} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
        <MetricItem label="Dist" value={`${(activity.distance/1000).toFixed(1)} km`} />
        <MetricItem label="Time" value={`${Math.floor(activity.duration/60)}m`} />
        <MetricItem label="Avg HR" value={`${activity.averageHR} bpm`} />
      </div>
      <div className="flex flex-wrap gap-3">
         {activity.activityWeather && (
           <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
             <CloudSun size={12} className="text-orange-500" />
             <span className="text-[10px] font-black text-slate-600">{Math.round(activity.activityWeather.temp)}°C</span>
           </div>
         )}
         <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 max-w-full">
            <MapPin size={12} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-600 truncate">{activity.locationName || 'Unknown'}</span>
         </div>
      </div>
    </div>
  );
};

/**
 * GEAR: Equipment List
 */
export const GearVisualizer = ({ data }) => {
  if (!data || !Array.isArray(data)) return null;
  return (
    <div className="space-y-4">
      {data.slice(0, 3).map(item => (
        <div key={item.uuid} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center group hover:bg-white transition-colors">
          <div className="flex items-center gap-4">
             <div className="p-2.5 bg-white rounded-xl text-slate-400 border border-slate-100 shadow-sm group-hover:text-blue-500 transition-colors"><Box size={16} /></div>
             <div className="min-w-0">
               <p className="text-xs font-black text-slate-900 truncate">{item.customMakeModel || item.gearName}</p>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.brandName}</p>
             </div>
          </div>
          <div className="text-right shrink-0">
             <p className="text-sm font-black text-slate-900">{Math.round(item.totalDistance/1000)}<span className="text-[10px] text-slate-400 ml-1 uppercase">km</span></p>
             <div className="w-16 sm:w-20 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden border border-slate-100">
                <div className="h-full bg-blue-600 shadow-sm" style={{ width: `${Math.min((item.totalDistance/800000)*100, 100)}%` }} />
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * RECORD: Personal Best Card
 */
export const RecordCard = ({ data }) => {
  if (!data) return null;
  const labels = { 1: "1K", 2: "1 Mile", 3: "5K", 4: "10K", 5: "Half Marathon", 6: "Marathon" };
  const records = Array.isArray(data) ? data : [data];
  return (
    <div className="grid grid-cols-1 gap-3">
      {records.slice(0, 4).map(pr => (
        <div key={pr.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:border-blue-200 transition-all">
          <div>
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-0.5">{pr.activityType}</span>
            <span className="text-xs font-black text-slate-900 uppercase">{labels[pr.typeId] || 'Personal Best'}</span>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-slate-900">{Math.floor(pr.value/60)}:{(pr.value%60).toFixed(0).padStart(2, '0')}</span>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{pr.actStartDateTimeInGMTFormatted?.split('T')[0]}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
