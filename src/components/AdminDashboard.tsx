import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, getCountFromServer, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Alert, User } from '../types';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  Shield, 
  Phone, 
  MapPin, 
  ExternalLink,
  Zap,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Howl } from 'howler';
import DispatchModal from './DispatchModal';
import { TanodLogo } from './Branding';
import { ReviewArchivedLogsDrawer } from './Admin/ReviewArchivedLogsDrawer';
import { PoliceLights } from './PoliceLights';

const alarm = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/1004/1004-preview.mp3'],
  loop: true,
  volume: 0.6,
});

import { useIncidentStore } from '../store/useIncidentStore';
import { useTanodStore } from '../store/useTanodStore';
import { logIncidentAction } from '../services/logService';

export default function AdminDashboard({ profile, onTabChange }: { profile: User | null, onTabChange: (tab: string) => void }) {
  const { alerts } = useIncidentStore();
  const { patrols } = useTanodStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [selectedAlertForDispatch, setSelectedAlertForDispatch] = useState<Alert | null>(null);
  const [stats, setStats] = useState({
    residents: 0,
    pendingReg: 0,
    activeAlerts: 0,
    resolvedToday: 0
  });

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tanod')) return;

    // Play loud siren for 10 seconds if there's a new pending alert
    const hasActive = alerts.some(a => a.status === 'pending');
    if (hasActive) {
      if (!alarm.playing()) {
        alarm.volume(1.0);
        alarm.play();
        setIsFlashing(true);
        setTimeout(() => { 
          alarm.stop(); 
          setIsFlashing(false);
        }, 10000);
      }
    } else {
      alarm.stop();
      setIsFlashing(false);
    }
  }, [alerts, profile]);

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tanod')) return;

    // Stats
    const fetchStats = async () => {
      const residentsSnapshot = await getCountFromServer(query(collection(db, 'residents'), where('status', '==', 'approved')));
      const pendingRegSnapshot = await getCountFromServer(query(collection(db, 'residents'), where('status', '==', 'pending')));
      
      setStats(prev => ({
        ...prev,
        residents: residentsSnapshot.data().count,
        pendingReg: pendingRegSnapshot.data().count
      }));
    };
    
    // Live Stats
    const activeAlertsQ = query(collection(db, 'alerts'), where('status', '==', 'pending'));
    const unsubActiveStats = onSnapshot(activeAlertsQ, (snapshot) => {
      setStats(prev => ({ ...prev, activeAlerts: snapshot.size }));
    }, (error) => {
      console.error("Dashboard Active Stats listener error:", error);
    });

    fetchStats();
    return () => {
      unsubActiveStats();
      alarm.stop();
    };
  }, []);

  const handleUpdateStatus = async (alert: Alert, status: Alert['status']) => {
    try {
      const updateData: any = { status };
      
      if (status === 'responding') {
        updateData.respondedBy = profile?.uid || 'unknown';
        updateData.respondedAt = new Date().toISOString();
      }
      
      if (status === 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolutionNotes = `Cleared by ${profile?.name || 'Admin'}`; // Simple default
        
        await addDoc(collection(db, 'incidents'), {
          alertId: alert.id,
          tanodId: profile?.uid || 'unknown',
          tanodName: alert.respondedByName || profile?.name || 'Unknown',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString(),
          location: alert.customMessage || 'Location via GPS',
          gpsLocation: alert.location,
          type: alert.type,
          description: `Automatically created from a resolved alert.\nCitizen: ${alert.residentName}\nResponse note: ${updateData.resolutionNotes}`,
          status: 'resolved',
          respondedAt: alert.respondedAt || updateData.respondedAt || new Date().toISOString(),
          resolvedAt: updateData.resolvedAt,
          adminOnDuty: profile?.name || 'Unknown'
        });
      }

      await updateDoc(doc(db, 'alerts', alert.id), updateData);
      
      // Update Tanod status in roster if we know who they are
      const tanodId = alert.respondedBy || updateData.respondedBy;
      if (tanodId && tanodId !== 'unknown') {
        try {
          const newRosterStatus = status === 'resolved' ? 'On-Duty' : status;
          await updateDoc(doc(db, 'users', tanodId), { status: newRosterStatus });
        } catch (e) {
          console.warn('Failed to update Tanod status from Admin dashboard:', e);
        }
      }
      
      // Log for audit
      await logIncidentAction({ ...alert, ...updateData });
    } catch (error: any) {
      console.error("Error updating alert:", error);
      window.alert('Permission Denied: Ensure you are logged in as Admin/Tanod.');
    }
  };

  const [onDutyTanods, setOnDutyTanods] = useState<User[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users'), where('role', '==', 'tanod'));
    return onSnapshot(q, (snapshot) => {
      setOnDutyTanods(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    }, (error) => {
      console.error("Dashboard Tanods listener error:", error);
    });
  }, [profile]);

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <PoliceLights active={isFlashing} />
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white font-mono leading-none">Commander Overview</h2>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] mt-2">Active Surveillance & Dispatch Interface</p>
        </div>
        <ReviewArchivedLogsDrawer profile={profile} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          label="Approved Residents" 
          value={stats.residents} 
          icon={Users} 
          color="text-info" 
          bg="bg-info/10" 
        />
        <StatCard 
          label="Pending Registration" 
          value={stats.pendingReg} 
          icon={Clock} 
          color="text-caution" 
          bg="bg-caution/10" 
          pulse={stats.pendingReg > 0}
        />
        <StatCard 
          label="Active SOS Alerts" 
          value={stats.activeAlerts} 
          icon={AlertTriangle} 
          color="text-emergency" 
          bg="bg-emergency/10" 
          pulse={stats.activeAlerts > 0}
        />
        <StatCard 
          label="Online Tanods" 
          value={onDutyTanods.length || 0} 
          icon={Shield}
          color="text-success" 
          bg="bg-success/10" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between glass-panel p-4 rounded-3xl">
            <h3 className="text-lg font-black italic tracking-tighter flex items-center gap-2 uppercase font-mono">
              <Zap className="w-5 h-5 text-emergency shadow-glow-red" />
              LIVE EMERGENCY FEED
            </h3>
            <span className="px-3 py-1 bg-emergency/10 text-emergency text-[8px] font-black rounded-full animate-pulse tracking-[0.2em]">MONITORING ACTIVE</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {alerts.filter(a => a.status !== 'resolved').length === 0 ? (
                <div className="glass-panel border-white/5 rounded-[40px] p-24 text-center">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 opacity-10" />
                  <p className="text-white/30 font-black uppercase tracking-widest text-xs font-mono">No active emergency alerts detected.</p>
                </div>
              ) : (
                alerts.filter(a => a.status !== 'resolved').map(alert => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={alert.id}
                    className={cn(
                      "glass-panel border-white/5 rounded-[32px] p-6 relative overflow-hidden transition-all group",
                      alert.status === 'pending' && "border-emergency/30 shadow-glow-red ring-1 ring-emergency/10"
                    )}
                  >
                    {alert.status === 'pending' && (
                      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                        <div className="absolute top-4 -right-10 bg-emergency text-white text-[9px] font-black py-1 px-12 rotate-45 uppercase shadow-lg font-mono">CRITICAL</div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                            alert.status === 'pending' ? "bg-emergency text-white sos-glow" : "bg-brand-bg text-white/40 border border-white/10"
                          )}>
                            <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-1">
                              <h4 className="font-black text-lg md:text-xl text-white truncate max-w-[150px] uppercase font-mono italic tracking-tighter">{alert.residentName}</h4>
                              <span className={cn(
                                "px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest font-mono",
                                alert.status === 'pending' ? "bg-emergency text-white" :
                                alert.status === 'responding' ? "bg-info/20 text-info border border-info/30" :
                                "bg-success/20 text-success border border-success/30"
                              )}>
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/40 font-bold flex items-center gap-2 font-mono uppercase tracking-tight">
                              <MapPin className="w-3 h-3 text-emergency" /> SECTOR 7 • {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="bg-brand-bg rounded-2xl p-4 border border-white/5">
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 font-mono">Emergency Classification</p>
                          <p className="text-sm font-bold text-white uppercase italic tracking-tighter font-mono">{alert.type}</p>
                        </div>
                      </div>

                      {alert.aiAnalysis && (
                        <div className="flex-1 space-y-4">
                          <div className={cn(
                            "rounded-2xl p-4 border backdrop-blur-sm",
                            alert.aiAnalysis.urgency === 'CRITICAL' ? "bg-emergency/5 border-emergency/20" : 
                            alert.aiAnalysis.urgency === 'HIGH' ? "bg-caution/5 border-caution/20" :
                            "bg-info/5 border-info/20"
                          )}>
                             <div className="flex justify-between items-center mb-3">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] font-mono">AI THREAT INTEL</p>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-[4px] text-[8px] font-black font-mono",
                                  alert.aiAnalysis.urgency === 'CRITICAL' ? "bg-emergency text-white" : "bg-caution text-black"
                                )}>{alert.aiAnalysis.urgency}</span>
                             </div>
                             <p className="text-xs font-bold text-white/90 leading-relaxed mb-4 italic font-mono">"{alert.aiAnalysis.summary}"</p>
                             <div className="flex flex-wrap gap-2">
                                {alert.aiAnalysis.riskFactors.slice(0, 3).map(risk => (
                                  <span key={risk} className="text-[8px] font-black bg-white/5 border border-white/5 px-2 py-1 rounded text-white/40 uppercase tracking-tighter font-mono">⚠ {risk}</span>
                                ))}
                             </div>
                          </div>
                          <div className="flex items-center justify-between px-2">
                             <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] font-mono">Threat Severity</span>
                             <div className="flex gap-1">
                                {[...Array(10)].map((_, i) => (
                                  <div key={i} className={cn("w-2 h-4 rounded-sm transition-all", i < alert.aiAnalysis!.severityScore ? (alert.aiAnalysis!.severityScore > 7 ? 'bg-emergency shadow-glow-red' : 'bg-emergency/60') : 'bg-white/5')} />
                                ))}
                             </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-3 shrink-0 justify-center">
                        <a 
                          href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-bg border border-white/10 text-white text-xs font-black rounded-2xl hover:bg-brand-card hover:border-emergency/50 transition-all font-mono tracking-widest"
                        >
                          <MapPin className="w-4 h-4 text-emergency" /> TRACK GPS
                        </a>
                        <div className="flex gap-2">
                          {alert.status === 'pending' && (
                            <button 
                              onClick={() => setSelectedAlertForDispatch(alert)}
                              className="flex-1 py-4 bg-emergency text-white text-xs font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-glow-red uppercase font-mono tracking-widest"
                            >
                              Dispatch
                            </button>
                          )}
                          {(alert.status === 'pending' || alert.status === 'responding') && (
                            <button 
                              onClick={() => handleUpdateStatus(alert, 'resolved')}
                              className="flex-1 py-4 bg-success text-white text-xs font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg uppercase font-mono tracking-widest"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass-panel border-white/5 rounded-[40px] p-8 shadow-command">
            <h4 className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] font-mono mb-8 lg:mb-12">Personnel Status</h4>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
              {onDutyTanods.length === 0 ? (
                <p className="text-[10px] text-white/30 italic font-mono text-center py-12 uppercase tracking-widest">No tanods online</p>
              ) : (
                onDutyTanods.map(t => (
                  <div key={t.uid} className="flex items-center gap-4 p-4 bg-brand-bg rounded-2xl border border-white/5 hover:border-info/30 transition-all group">
                    <div className="w-12 h-12 rounded-xl bg-brand-card flex items-center justify-center border border-white/5 group-hover:bg-info/10 transition-colors">
                      <Shield className="w-6 h-6 text-white/40 group-hover:text-info transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white leading-tight font-mono uppercase italic">{t.name}</p>
                      <p className={cn(
                        "text-[9px] font-black uppercase tracking-[0.1em] font-mono mt-1",
                        t.status === 'responding' ? "text-emergency animate-pulse" : "text-success"
                      )}>{t.status || 'Active'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={() => onTabChange('roster')}
              className="w-full mt-10 py-5 bg-brand-bg border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white hover:border-white/30 transition-all font-mono"
            >
              UNIT MANAGEMENT
            </button>
          </div>
          
          <div className="bg-emergency rounded-[40px] p-10 text-white shadow-glow-red relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3 opacity-60 font-mono">Panic Protocol</p>
              <p className="text-3xl font-black italic tracking-tighter mb-8 font-mono leading-none">GLOBAL AUDIO ALARM</p>
              <button 
                onClick={() => {
                  alert("🚨 GLOBAL PANIC ALARM ACTIVATED! ALL TANODS ALERTED. 🚨");
                  onTabChange('map');
                }}
                className="w-full py-5 bg-white text-emergency font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl uppercase italic tracking-[0.2em] text-xs font-mono"
              >
                Trigger All Units
              </button>
            </div>
            <AlertTriangle className="absolute -bottom-10 -right-10 w-56 h-56 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700" />
          </div>
        </div>
      </div>
      
      {selectedAlertForDispatch && (
        <DispatchModal 
          alert={selectedAlertForDispatch} 
          onClose={() => setSelectedAlertForDispatch(null)} 
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, pulse }: any) {
  return (
    <div className="glass-panel border-white/5 rounded-[32px] p-6 relative overflow-hidden group">
      <div className={cn("p-4 rounded-2xl inline-flex mb-6 transition-all group-hover:scale-110 shadow-lg", bg, color, pulse && "animate-pulse shadow-glow-red")}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1 font-mono">{label}</h4>
        <p className="text-4xl font-black text-white italic tracking-tighter font-mono">{value}</p>
      </div>
      <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-all"></div>
    </div>
  );
}
