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

const alarm = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/1004/1004-preview.mp3'],
  loop: true,
  volume: 0.6,
});

export default function AdminDashboard({ profile, onTabChange }: { profile: User | null, onTabChange: (tab: string) => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlertForDispatch, setSelectedAlertForDispatch] = useState<Alert | null>(null);
  const [stats, setStats] = useState({
    residents: 0,
    pendingReg: 0,
    activeAlerts: 0,
    resolvedToday: 0
  });

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tanod')) return;

    // Alerts Feed
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsubAlerts = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      setAlerts(list);
      
      // Play loud siren for 10 seconds if there's a new pending alert
      const hasActive = list.some(a => a.status === 'pending');
      if (hasActive) {
        if (!alarm.playing()) {
          alarm.volume(1.0);
          alarm.play();
          setTimeout(() => { alarm.stop(); }, 10000);
        }
      } else {
        alarm.stop();
      }
    }, (error) => {
      console.error("Dashboard Alerts listener error:", error);
    });

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
      unsubAlerts();
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
        updateData.resolutionNotes = 'Cleared by commander'; // Simple default
      }

      await updateDoc(doc(db, 'alerts', alert.id), updateData);
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
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-3 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF4B4B]" />
              LIVE EMERGENCY FEED
            </h3>
            <span className="px-3 py-1 bg-[#FF4B4B]/10 text-[#FF4B4B] text-[10px] font-black rounded-full animate-pulse">MONITORING ACTIVE</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {alerts.length === 0 ? (
                <div className="bg-[#16191F] border border-[#2D3139] rounded-[40px] p-20 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
                  <p className="text-[#8E9299] font-bold">No emergency alerts reported.</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={alert.id}
                    className={cn(
                      "bg-[#16191F] border border-[#2D3139] rounded-[32px] p-6 relative overflow-hidden transition-all",
                      alert.status === 'pending' && "border-[#FF4B4B] shadow-[0_0_20px_rgba(255,75,75,0.15)] ring-1 ring-[#FF4B4B]/20"
                    )}
                  >
                    {alert.status === 'pending' && (
                      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                        <div className="absolute top-4 -right-8 bg-[#FF4B4B] text-white text-[10px] font-black py-1 px-10 rotate-45 uppercase shadow-lg">New</div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      <div className="flex-1 space-y-3 md:space-y-4">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={cn(
                            "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0",
                            alert.status === 'pending' ? "bg-[#FF4B4B] text-white" : "bg-[#252932] text-[#8E9299]"
                          )}>
                            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <h4 className="font-black text-base md:text-lg text-white truncate max-w-[150px]">{alert.residentName}</h4>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                alert.status === 'pending' ? "bg-red-500/20 text-red-500" :
                                alert.status === 'responding' ? "bg-blue-500/20 text-blue-500" :
                                "bg-green-500/20 text-green-500"
                              )}>
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-xs text-[#8E9299] font-medium flex items-center gap-2">
                              <MapPin className="w-3 h-3" /> Zone B, Sector 4 • {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="bg-[#0F1115] rounded-2xl p-4 border border-[#2D3139]">
                          <p className="text-[10px] font-black text-[#8E9299] uppercase tracking-[0.2em] mb-1">Emergency Type</p>
                          <p className="text-sm font-bold text-white uppercase italic tracking-tighter">{alert.type}</p>
                        </div>
                      </div>

                      {alert.aiAnalysis && (
                        <div className="flex-1 space-y-3">
                          <div className={cn(
                            "rounded-2xl p-4 border",
                            alert.aiAnalysis.urgency === 'CRITICAL' ? "bg-red-500/10 border-red-500/30" : 
                            alert.aiAnalysis.urgency === 'HIGH' ? "bg-amber-500/10 border-amber-500/30" :
                            "bg-blue-500/10 border-blue-500/30"
                          )}>
                             <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-black text-[#8E9299] uppercase tracking-[0.2em]">AI Intelligence</p>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-[4px] text-[8px] font-black",
                                  alert.aiAnalysis.urgency === 'CRITICAL' ? "bg-red-500 text-white" : "bg-amber-500 text-black"
                                )}>{alert.aiAnalysis.urgency}</span>
                             </div>
                             <p className="text-xs font-bold text-white leading-relaxed mb-2">"{alert.aiAnalysis.summary}"</p>
                             <div className="flex flex-wrap gap-1">
                                {alert.aiAnalysis.riskFactors.slice(0, 2).map(risk => (
                                  <span key={risk} className="text-[8px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-[#8E9299] uppercase">⚠️ {risk}</span>
                                ))}
                             </div>
                          </div>
                          <div className="flex items-center justify-between px-2">
                             <span className="text-[9px] font-bold text-[#8E9299] uppercase tracking-widest">Severity Score</span>
                             <div className="flex gap-0.5">
                                {[...Array(10)].map((_, i) => (
                                  <div key={i} className={cn("w-2 h-4 rounded-sm", i < alert.aiAnalysis!.severityScore ? (alert.aiAnalysis!.severityScore > 7 ? 'bg-red-500' : 'bg-[#FF4B4B]') : 'bg-white/5')} />
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
                          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#252932] text-white text-xs font-bold rounded-xl hover:bg-[#2D3139] border border-[#2D3139] transition-all"
                        >
                          <MapPin className="w-4 h-4 text-[#FF4B4B]" /> TRACK GPS
                        </a>
                        <div className="flex gap-2">
                          {alert.status === 'pending' && (
                            <button 
                              onClick={() => setSelectedAlertForDispatch(alert)}
                              className="flex-1 py-3 bg-[#FF4B4B] text-white text-xs font-black rounded-xl hover:scale-105 transition-all shadow-lg uppercase"
                            >
                              Dispatch
                            </button>
                          )}
                          {(alert.status === 'pending' || alert.status === 'responding') && (
                            <button 
                              onClick={() => handleUpdateStatus(alert, 'resolved')}
                              className="flex-1 py-3 bg-green-600 text-white text-xs font-black rounded-xl hover:scale-105 transition-all shadow-lg uppercase"
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
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          label="Approved Residents" 
          value={stats.residents} 
          icon={Users} 
          color="text-blue-500" 
          bg="bg-blue-500/10" 
        />
        <StatCard 
          label="Pending Registration" 
          value={stats.pendingReg} 
          icon={Clock} 
          color="text-amber-500" 
          bg="bg-amber-500/10" 
          pulse={stats.pendingReg > 0}
        />
        <StatCard 
          label="Active SOS Alerts" 
          value={stats.activeAlerts} 
          icon={AlertTriangle} 
          color="text-red-500" 
          bg="bg-red-500/10" 
          pulse={stats.activeAlerts > 0}
        />
        <StatCard 
          label="Online Tanods" 
          value={onDutyTanods.length || 0} 
          icon={() => <TanodLogo size={24} animated={false} className="w-6 h-6" />} 
          color="text-green-500" 
          bg="bg-green-500/10" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#16191F] border border-[#2D3139] rounded-[40px] p-8 shadow-xl">
            <h4 className="text-[10px] font-black uppercase text-[#8E9299] tracking-[0.3em] mb-6">Tanods On Duty</h4>
            <div className="space-y-4">
              {onDutyTanods.length === 0 ? (
                <p className="text-[10px] text-[#8E9299] italic">No tanods online</p>
              ) : (
                onDutyTanods.map(t => (
                  <div key={t.uid} className="flex items-center gap-4 p-4 bg-[#0F1115] rounded-2xl border border-[#2D3139]">
                    <div className="w-10 h-10 rounded-xl bg-[#252932] flex items-center justify-center">
                      <Shield className="w-5 h-5 text-[#8E9299]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{t.name}</p>
                      <p className={cn(
                        "text-[10px] font-bold uppercase",
                        t.status === 'responding' ? "text-[#FF4B4B]" : "text-green-500"
                      )}>{t.status || 'Active'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={() => onTabChange('roster')}
              className="w-full mt-6 py-4 border border-[#2D3139] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#8E9299] hover:text-white hover:bg-[#252932] transition-all"
            >
              Manage Units
            </button>
          </div>
          
          <div className="bg-[#FF4B4B] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">Crisis Mode</h4>
              <p className="text-2xl font-black italic tracking-tighter mb-6">GLOBAL PANIC ALARM</p>
              <button 
                onClick={() => {
                  alert("🚨 GLOBAL PANIC ALARM ACTIVATED! ALL TANODS ALERTED. 🚨");
                  onTabChange('map');
                }}
                className="w-full py-4 bg-white text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl uppercase italic tracking-widest text-xs"
              >
                Trigger All Units
              </button>
            </div>
            <AlertTriangle className="absolute -bottom-10 -right-10 w-48 h-48 opacity-10 group-hover:scale-110 transition-transform" />
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
  const renderIcon = () => {
    if (!Icon) return null;
    if (typeof Icon === 'function') return <Icon className="w-6 h-6" />;
    if (typeof Icon === 'object' && Icon.$$typeof) return <Icon className="w-6 h-6" />;
    return Icon;
  };

  return (
    <div className="bg-[#16191F] border border-[#2D3139] rounded-[32px] p-6 relative overflow-hidden group">
      <div className={cn("p-4 rounded-2xl inline-flex mb-6 transition-all group-hover:scale-110", bg, color, pulse && "animate-pulse")}>
        {renderIcon()}
      </div>
      <div>
        <h4 className="text-[10px] font-black uppercase text-[#8E9299] tracking-[0.2em] mb-1 font-mono">{label}</h4>
        <p className="text-4xl font-black text-white italic tracking-tighter font-mono">{value}</p>
      </div>
      <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-all"></div>
    </div>
  );
}
