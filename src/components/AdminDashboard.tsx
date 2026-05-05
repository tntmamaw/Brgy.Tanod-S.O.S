import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, getCountFromServer, addDoc, setDoc } from 'firebase/firestore';
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
  MoreVertical,
  Info,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import DispatchModal from './DispatchModal';
import FlameAnimation from './FlameAnimation';
import AboutModal from './AboutModal';
import { InstallAppButton } from './InstallAppButton';
import { TanodLogo } from './Branding';
import { ReviewArchivedLogsDrawer } from './Admin/ReviewArchivedLogsDrawer';
import { PoliceLights } from './PoliceLights';

import { useIncidentStore } from '../store/useIncidentStore';
import { useTanodStore } from '../store/useTanodStore';
import { logIncidentAction } from '../services/logService';

import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function AdminDashboard({ profile, onTabChange, deferredPrompt, onInstall, sirenActive, onToggleSiren }: { profile: User | null, onTabChange: (tab: string) => void, deferredPrompt?: any, onInstall?: () => void, sirenActive: boolean, onToggleSiren: () => void }) {
  const { alerts } = useIncidentStore();
  const { patrols } = useTanodStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [selectedAlertForDispatch, setSelectedAlertForDispatch] = useState<Alert | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  // Filtering State
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [filterTime, setFilterTime] = useState<string>('ALL');

  // derive stats from alerts store to ensure real-time consistency
  const activeAlertsCount = alerts.filter(a => a.status === 'pending' || a.status === 'responding').length;
  const pendingAlertsCount = alerts.filter(a => a.status === 'pending').length;
  
  const [residentsCount, setResidentsCount] = useState(0);
  const [pendingRegCount, setPendingRegCount] = useState(0);

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tanod' && profile.role !== 'superadmin')) return;

    // Handle flashing lights only, sound is global in App.tsx
    const hasActive = alerts.some(a => a.status === 'pending');
    if (hasActive || sirenActive) {
      setIsFlashing(true);
    } else {
      setIsFlashing(false);
    }
  }, [alerts, profile, sirenActive]);

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tanod' && profile.role !== 'superadmin')) return;

    // Real-time Residents stats
    const approvedQ = query(collection(db, 'residents'), where('status', '==', 'approved'));
    const pendingQ = query(collection(db, 'residents'), where('status', '==', 'pending'));

    const unsubApproved = onSnapshot(approvedQ, (snapshot) => {
      setResidentsCount(snapshot.size);
    });

    const unsubPending = onSnapshot(pendingQ, (snapshot) => {
      setPendingRegCount(snapshot.size);
    });

    return () => {
      unsubApproved();
      unsubPending();
    };
  }, [profile]);

  const filteredAlerts = alerts.filter(alert => {
    // 1. Status Filter
    if (filterStatus === 'ACTIVE') {
      if (alert.status === 'resolved' || alert.status === 'cancelled') return false;
    } else if (filterStatus !== 'ALL') {
      if (alert.status !== filterStatus.toLowerCase()) return false;
    }

    // 2. Type Filter
    const typeEnum: Record<string, string> = {
      'MEDICAL': 'Medical Emergency',
      'FIRE': 'Fire Alert',
      'CRIME': 'Criminal Activity',
      'DISASTER': 'Natural Disaster'
    };
    
    if (filterType !== 'ALL') {
      const match = typeEnum[filterType] || filterType;
      // Partial match or direct match
      if (!alert.type.toUpperCase().includes(filterType) && alert.type !== match) return false;
    }

    // 3. Time Filter
    if (filterTime !== 'ALL') {
      const alertDate = new Date(alert.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - alertDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (filterTime === '1H' && diffHours > 1) return false;
      if (filterTime === '4H' && diffHours > 4) return false;
      if (filterTime === '24H' && diffHours > 24) return false;
    }

    return true;
  });

  const handleUpdateStatus = async (alert: Alert, status: Alert['status']) => {
    try {
      const updateData: any = { 
        status, 
        updatedAt: new Date().toISOString() 
      };
      
      if (status === 'responding') {
        updateData.respondedBy = profile?.uid || 'unknown';
        updateData.respondedByName = profile?.name || 'Admin Dispatch';
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

      // Use setDoc merge true to be robust against missing documents
      await setDoc(doc(db, 'alerts', alert.id), updateData, { merge: true });
      
      // Update Tanod status in roster if we know who they are
      const tanodId = alert.respondedBy || updateData.respondedBy;
      if (tanodId && tanodId !== 'unknown') {
        try {
          const isResolved = status === 'resolved' || status === 'cancelled';
          const newRosterStatus = isResolved ? 'On-Duty' : status;
          const userUpdate: any = { status: newRosterStatus };
          
          if (isResolved) {
            userUpdate.activeAlertId = null;
          } else if (status === 'responding') {
            userUpdate.activeAlertId = alert.id;
          }
          
          await setDoc(doc(db, 'users', tanodId), userUpdate, { merge: true });
        } catch (e) {
          console.warn(`[AdminDashboard] Failed to update user roster status for ${tanodId}:`, e);
        }
      }
      
      // Log for audit
      await logIncidentAction({ ...alert, ...updateData });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `alerts/${alert.id}`);
    }
  };

  const [onDutyTanods, setOnDutyTanods] = useState<User[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users'), where('role', '==', 'tanod'));
    return onSnapshot(q, (snapshot) => {
      setOnDutyTanods(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users-tanods');
    });
  }, [profile]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 md:space-y-8 pb-20"
    >
      {deferredPrompt && (
        <motion.button
          variants={itemVariants}
          onClick={onInstall}
          className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-info/10 text-info font-black border border-info/30 hover:bg-info/20 mb-8 transition-all hover:scale-[1.01] active:scale-95 uppercase tracking-[0.2em] font-mono shadow-[0_0_20px_rgba(59,130,246,0.2)] group"
        >
          <span className="text-lg group-hover:scale-125 transition-transform">📲</span>
          <span>INSTALL TANOD MOBILE APP</span>
        </motion.button>
      )}
      <PoliceLights active={isFlashing} />
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4 mb-10 relative">
        <div className="scanline opacity-10 pointer-events-none" />
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white font-mono leading-none flex items-center gap-4">
            <TanodLogo size={48} animated={false} className="text-emergency shadow-glow-red" />
            Commander Overview
          </h2>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mt-3 bg-white/5 inline-block px-3 py-1 rounded-full border border-white/5">Active Surveillance & Dispatch Interface</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAboutOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
            id="admin-about-btn"
          >
            <Info className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold text-white/40 group-hover:text-white uppercase tracking-widest font-mono">System Overview & Mission</span>
          </button>
          <ReviewArchivedLogsDrawer profile={profile} />
        </div>
      </motion.div>

      <AboutModal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)} 
        role={profile?.role} 
      />

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          label="Approved Residents" 
          value={residentsCount} 
          icon={Users} 
          color="text-info" 
          bg="bg-info/10" 
        />
        <StatCard 
          label="Pending Registration" 
          value={pendingRegCount} 
          icon={Clock} 
          color="text-caution" 
          bg="bg-caution/10" 
          pulse={pendingRegCount > 0}
        />
        <StatCard 
          label="Active SOS Alerts" 
          value={activeAlertsCount} 
          icon={AlertTriangle} 
          color="text-emergency" 
          bg="bg-emergency/10" 
          pulse={pendingAlertsCount > 0}
        />
        <StatCard 
          label="Online Tanods" 
          value={patrols.filter(p => p.isActive).length || 0} 
          icon={Shield}
          color="text-success" 
          bg="bg-success/10" 
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between glass-panel p-4 rounded-3xl">
              <h3 className="text-lg font-black italic tracking-tighter flex items-center gap-2 uppercase font-mono">
                <Zap className="w-5 h-5 text-emergency shadow-glow-red" />
                LIVE EMERGENCY FEED
              </h3>
              <span className="px-3 py-1 bg-emergency/10 text-emergency text-[8px] font-black rounded-full animate-pulse tracking-[0.2em]">MONITORING ACTIVE</span>
            </div>

            {/* Tactical Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 glass-panel p-3 rounded-[28px] border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 px-3">
                <Filter className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[9px] font-black uppercase text-white/20 tracking-widest font-mono">Operations Filter</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Status Filter */}
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-brand-bg/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-white/50 font-mono outline-none focus:border-info/30 transition-colors uppercase tracking-wider cursor-pointer hover:bg-brand-bg"
                >
                  <option value="ACTIVE">STATUS: ACTIVE_ONLY</option>
                  <option value="ALL">STATUS: ALL_INTEL</option>
                  <option value="PENDING">STATUS: PENDING</option>
                  <option value="RESPONDING">STATUS: RESPONDING</option>
                  <option value="RESOLVED">STATUS: ARCHIVED</option>
                </select>

                {/* Type Filter */}
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-brand-bg/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-white/50 font-mono outline-none focus:border-info/30 transition-colors uppercase tracking-wider cursor-pointer hover:bg-brand-bg"
                >
                  <option value="ALL">TYPE: ALL_SIGS</option>
                  <option value="MEDICAL">TYPE: MEDICAL</option>
                  <option value="FIRE">TYPE: FIRE</option>
                  <option value="CRIME">TYPE: CRIME</option>
                  <option value="DISASTER">TYPE: DISASTER</option>
                </select>

                {/* Time Filter */}
                <select 
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="bg-brand-bg/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-white/50 font-mono outline-none focus:border-info/30 transition-colors uppercase tracking-wider cursor-pointer hover:bg-brand-bg"
                >
                  <option value="ALL">TIME: TOTAL_HIST</option>
                  <option value="1H">TIME: LAST_1H</option>
                  <option value="4H">TIME: LAST_4H</option>
                  <option value="24H">TIME: LAST_24H</option>
                </select>
              </div>

              <div className="ml-auto px-4 py-1.5 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[9px] font-black text-white/40 uppercase font-mono tracking-tighter">
                   {filteredAlerts.length} <span className="text-white/20">TARGETS_FOUND</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.length === 0 ? (
                <div className="glass-panel border-white/5 rounded-[40px] p-24 text-center">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 opacity-10" />
                  <p className="text-white/30 font-black uppercase tracking-widest text-xs font-mono">No matching emergency alerts detected.</p>
                </div>
              ) : (
                filteredAlerts.map(alert => (
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
                    {alert.status === 'pending' && alert.aiAnalysis && alert.aiAnalysis.severityScore >= 7 && (
                      <div className="absolute -bottom-8 -right-8 opacity-10 pointer-events-none rotate-12 group-hover:opacity-20 transition-opacity">
                        <FlameAnimation size="lg" />
                      </div>
                    )}
                    {alert.status === 'pending' && (
                      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                        <div className={cn(
                          "absolute top-4 -right-10 text-white text-[9px] font-black py-1 px-12 rotate-45 uppercase shadow-lg font-mono",
                          alert.aiAnalysis && alert.aiAnalysis.severityScore > 7 ? "bg-emergency" : 
                          alert.aiAnalysis && alert.aiAnalysis.severityScore >= 5 ? "bg-warning text-black" :
                          "bg-caution text-black"
                        )}>
                          {alert.aiAnalysis && alert.aiAnalysis.severityScore > 7 ? 'CRITICAL' : 
                           alert.aiAnalysis && alert.aiAnalysis.severityScore >= 5 ? 'HIGH' : 'NORMAL'}
                        </div>
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
                              {(alert as any).isManualLocation && (
                                <span className="text-[8px] bg-info/10 text-info px-1.5 py-0.5 rounded border border-info/20 ml-2">MANUAL_PIN</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="bg-brand-bg rounded-2xl p-4 border border-white/5">
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 font-mono">Emergency Classification</p>
                          <p className="text-sm font-bold text-white uppercase italic tracking-tighter font-mono">{alert.type}</p>
                        </div>
                        {alert.status === 'responding' && (alert.assignedToName || alert.respondedByName) && (
                          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-info/5 rounded-xl border border-info/10">
                            <Shield className="w-3 h-3 text-info" />
                            <span className="text-[9px] font-black uppercase text-info/60 font-mono tracking-widest">Responder: {alert.assignedToName || alert.respondedByName}</span>
                          </div>
                        )}
                        {alert.responderNotes && (
                          <div className="mt-2 p-4 bg-info/5 border border-info/20 rounded-2xl">
                             <p className="text-[8px] font-black text-info/60 uppercase tracking-[0.2em] mb-2 font-mono flex items-center gap-2">
                               <Shield className="w-3 h-3" /> Latest Situation Report
                             </p>
                             <p className="text-xs text-white/90 font-mono italic leading-relaxed">
                               <span className="text-info mr-2 opacity-50 font-black not-italic">&gt;&gt;</span>
                               {alert.responderNotes}
                             </p>
                          </div>
                        )}
                      </div>

                      {alert.aiAnalysis && (
                        <div className="flex-1 space-y-4">
                          <div className={cn(
                            "rounded-2xl p-4 border backdrop-blur-sm",
                            alert.aiAnalysis.severityScore > 7 ? "bg-emergency/5 border-emergency/20" : 
                            alert.aiAnalysis.severityScore >= 5 ? "bg-warning/5 border-warning/20" :
                            "bg-caution/5 border-caution/20"
                          )}>
                             <div className="flex justify-between items-center mb-3">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] font-mono">AI THREAT INTEL</p>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-[4px] text-[8px] font-black font-mono uppercase tracking-tighter shadow-sm",
                                    alert.aiAnalysis.severityScore > 7 ? "bg-emergency text-white" : 
                                    alert.aiAnalysis.severityScore >= 5 ? "bg-warning text-black" :
                                    "bg-caution text-black"
                                  )}>
                                    {alert.aiAnalysis.severityScore > 7 ? 'CRITICAL' : alert.aiAnalysis.severityScore >= 5 ? 'HIGH_PRIORITY' : 'NORMAL_PRIORITY'}
                                  </span>
                                </div>
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
                                  <div 
                                    key={i} 
                                    className={cn(
                                      "w-2 h-4 rounded-sm transition-all", 
                                      i < alert.aiAnalysis!.severityScore 
                                        ? (alert.aiAnalysis!.severityScore > 7 ? 'bg-emergency shadow-glow-red' : alert.aiAnalysis!.severityScore >= 5 ? 'bg-warning shadow-glow-orange' : 'bg-caution shadow-glow-amber') 
                                        : 'bg-white/5'
                                    )} 
                                  />
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
          <div className="glass-panel border-white/5 rounded-[48px] p-10 shadow-command relative overflow-hidden">
            <div className="scanline opacity-5" />
            <div className="flex items-center justify-between mb-10">
              <h4 className="text-[11px] font-black uppercase text-white/40 tracking-[0.4em] font-mono leading-none">Personnel Status</h4>
              <span className="w-2 h-2 bg-success rounded-full animate-pulse shadow-[0_0_10px_rgba(52,199,89,0.5)]" />
            </div>
            <div className="space-y-5 max-h-[450px] overflow-y-auto pr-3 scrollbar-hide">
              {onDutyTanods.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center opacity-10">
                  <Shield className="w-16 h-16 mb-4" />
                  <p className="text-[10px] text-white font-black uppercase tracking-widest font-mono text-center">Zero Units Detected</p>
                </div>
              ) : (
                onDutyTanods.map(t => {
                  const pMatch = patrols.find(p => p.tanodId === t.uid);
                  const isOnline = pMatch?.isActive;
                  const lastUpdate = pMatch?.lastUpdate;

                  return (
                    <div key={t.uid} className="flex items-center gap-5 p-5 bg-brand-bg/40 rounded-[28px] border border-white/5 hover:border-info/40 hover:bg-brand-bg/60 transition-all group relative overflow-hidden">
                      <div className="w-14 h-14 rounded-[20px] bg-brand-card flex items-center justify-center border border-white/5 group-hover:bg-info/10 group-hover:border-info/20 shadow-inner group-hover:shadow-info/10 transition-all relative z-10">
                        <Shield className={cn(
                          "w-7 h-7 transition-colors",
                          isOnline ? "text-success" : "text-white/20 group-hover:text-info",
                          (t.status as string) === 'responding' && "text-emergency"
                        )} />
                      </div>
                      <div className="relative z-10 flex-1 min-w-0">
                        <p className="text-base font-black text-white/90 leading-tight font-mono uppercase italic tracking-tight truncate">{t.name}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            (t.status as string) === 'responding' ? "bg-emergency animate-pulse" : (isOnline ? "bg-success" : "bg-white/10")
                          )} />
                          <p className={cn(
                            "text-[9px] font-black uppercase tracking-[0.2em] font-mono",
                            (t.status as string) === 'responding' ? "text-emergency" : (isOnline ? "text-success/70" : "text-white/20")
                          )}>{(t.status as string) === 'responding' ? 'RESPONDING' : (isOnline ? 'ON-DUTY' : 'OFFLINE')}</p>
                          {t.activeAlertId && (
                            <span className="text-[7px] px-1.5 py-0.5 rounded-md bg-emergency/10 text-emergency font-black border border-emergency/20">
                              #{t.activeAlertId.slice(-6).toUpperCase()}
                            </span>
                          )}
                          {lastUpdate && (
                            <span className="text-[8px] font-mono text-white/20 uppercase ml-auto">
                              Ping: {new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex flex-col gap-4 mt-12">
              <button 
                onClick={() => onTabChange('roster')}
                className="w-full py-6 bg-brand-bg border border-white/5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-info hover:border-info/30 hover:bg-info/5 transition-all font-mono shadow-inner group flex items-center justify-center gap-2"
              >
                UNIT CONFIGURATION <span className="inline-block transform group-hover:translate-x-1 transition-transform ml-2">→</span>
              </button>
              <button 
                onClick={() => onTabChange('schedule')}
                className="w-full py-6 bg-brand-bg border border-white/5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-amber-500 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all font-mono shadow-inner group flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" /> PATROL SCHEDULER <span className="inline-block transform group-hover:translate-x-1 transition-transform ml-2">→</span>
              </button>
            </div>
          </div>
          
          <div className="bg-emergency rounded-[40px] p-10 text-white shadow-glow-red relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3 opacity-60 font-mono">Panic Protocol</p>
              <p className="text-3xl font-black italic tracking-tighter mb-8 font-mono leading-none">GLOBAL AUDIO BROADCAST</p>
              <button 
                onClick={onToggleSiren}
                className={cn(
                  "w-full py-5 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl uppercase italic tracking-[0.2em] text-xs font-mono border",
                  sirenActive 
                    ? "bg-white text-emergency border-white animate-pulse" 
                    : "bg-emergency/50 text-white border-white/30 hover:bg-emergency hover:border-white"
                )}
              >
                {sirenActive ? "STOP GLOBAL SIREN" : "TRIGGER GLOBAL BROADCAST"}
              </button>
            </div>
            <AlertTriangle className="absolute -bottom-10 -right-10 w-56 h-56 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700" />
          </div>
        </div>
      </motion.div>
      
      {selectedAlertForDispatch && (
        <DispatchModal 
          alert={selectedAlertForDispatch} 
          onClose={() => setSelectedAlertForDispatch(null)} 
          patrols={patrols}
        />
      )}
      <InstallAppButton />
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, pulse }: any) {
  return (
    <div className="glass-panel border-white/5 rounded-[40px] p-8 relative overflow-hidden group transition-all hover:bg-brand-card active:scale-[0.98]">
      <div className="scanline opacity-5" />
      <div className={cn("p-5 rounded-[24px] inline-flex mb-8 transition-all group-hover:scale-110 shadow-2xl relative z-10", bg, color, pulse && "animate-pulse shadow-glow-red")}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="relative z-10">
        <h4 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-2 font-mono">{label}</h4>
        <p className="text-5xl font-black text-white italic tracking-tighter font-mono leading-none">{value}</p>
      </div>
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/2 rounded-full blur-3xl group-hover:scale-150 transition-all duration-700"></div>
    </div>
  );
}
