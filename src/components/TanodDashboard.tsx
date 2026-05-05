import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { Alert, User } from '../types';
import { AlertTriangle, MapPin, Zap, CheckCircle, Shield, Volume2, VolumeX, Info, Filter, FilePlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { PoliceLights } from './PoliceLights';
import AboutModal from './AboutModal';
import { InstallAppButton } from './InstallAppButton';
import IncidentForm from './IncidentForm';
import AnimatedButton from './AnimatedButton';
import FlameAnimation from './FlameAnimation';

import { useIncidentStore } from '../store/useIncidentStore';
import { logIncidentAction } from '../services/logService';

export default function TanodDashboard({ profile, onTabChange, deferredPrompt, onInstall, sirenActive, onToggleSiren }: { profile: User | null, onTabChange: (tab: string) => void, deferredPrompt?: any, onInstall?: () => void, sirenActive: boolean, onToggleSiren: () => void }) {
  const { alerts } = useIncidentStore();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [loadingAlertIds, setLoadingAlertIds] = useState<Set<string>>(new Set());
  const [processedAlertIds, setProcessedAlertIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [shiftLog, setShiftLog] = useState<Alert[]>([]);
  const [isReportFormOpen, setIsReportFormOpen] = useState(false);

  // Filtering State
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [filterTime, setFilterTime] = useState<string>('ALL');

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // Filter alerts for this tanod: pending OR specifically assigned/responded by them
  const dashboardAlerts = alerts.filter(alert => {
    // 1. Tanod specific constraint
    const isRelevant = 
      (alert.status === 'pending' || 
       alert.assignedTo === profile?.uid || 
       alert.respondedBy === profile?.uid);
    
    if (!isRelevant) return false;

    // 2. Status Filter
    if (filterStatus === 'ACTIVE') {
      if (['resolved', 'cancelled'].includes(alert.status)) return false;
    } else if (filterStatus !== 'ALL') {
      if (alert.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
    }

    // 3. Type Filter
    if (filterType !== 'ALL') {
      const typeLower = filterType.toLowerCase();
      const alertTypeLower = alert.type.toLowerCase();
      
      const typeEnum: Record<string, string[]> = {
        'medical': ['medical', 'medical emergency'],
        'fire': ['fire', 'fire alert'],
        'crime': ['crime', 'criminal activity'],
        'disaster': ['disaster', 'natural disaster']
      };
      
      const aliases = typeEnum[typeLower] || [typeLower];
      const isTypeMatch = aliases.some(alias => alertTypeLower.includes(alias));
      
      if (!isTypeMatch) return false;
    }

    // 4. Time Filter
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

  useEffect(() => {
    if (!profile || profile.role !== 'tanod') return;

    // Handle flashing lights only, sound is global in App.tsx
    const hasPending = dashboardAlerts.some(a => a.status === 'pending');
    if (hasPending || sirenActive) {
      setIsFlashing(true);
    } else {
      setIsFlashing(false);
    }
  }, [dashboardAlerts, profile, sirenActive]);

  useEffect(() => {
    if (!profile || profile.role !== 'tanod' || !db) return;

    // Shift log (resolved by me today)
    const qLog = query(
      collection(db, 'alerts'),
      where('respondedBy', '==', profile.uid),
      where('status', '==', 'resolved'),
      orderBy('resolvedAt', 'desc')
    );
    const unsubLog = onSnapshot(qLog, (snapshot) => {
      setShiftLog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert)));
    });

    return () => {
      unsubLog();
    };
  }, [profile]);

  const handleUpdateStatus = async (alert: Alert, status: Alert['status']) => {
    if (!db) return;
    setLoadingAlertIds(prev => new Set(prev).add(alert.id));
    try {
      const updateData: any = { 
        status, 
        updatedAt: new Date().toISOString() 
      };
      
      if (status === 'responding') {
        updateData.respondedBy = profile?.uid || 'unknown';
        updateData.respondedByName = profile?.name || 'Tanod Unit';
        updateData.respondedAt = new Date().toISOString();
        updateData.assignedTo = profile?.uid || 'unknown';
        updateData.assignedToName = profile?.name || 'Tanod Unit';
      }
      
      if (status === 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolutionNotes = `Cleared by ${profile?.name || 'Tanod Responder'}`;
        
        let adminName = 'Unknown Admin';
        try {
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          const adminDocs = await getDocs(adminQuery);
          if (!adminDocs.empty) {
            adminName = adminDocs.docs[0].data().name || 'Admin';
          }
        } catch (e) {
          console.error('Failed to fetch admin');
        }

        await addDoc(collection(db, 'incidents'), {
          alertId: alert.id,
          tanodId: profile?.uid || 'unknown',
          tanodName: profile?.name || 'Unknown Tanod',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString(),
          location: alert.customMessage || 'Location via GPS',
          gpsLocation: alert.location,
          type: alert.type,
          description: `Automatically created from a resolved alert.\nCitizen: ${alert.residentName}\nResponse note: ${updateData.resolutionNotes}${alert.responderNotes ? `\nResponder Situation Report: ${alert.responderNotes}` : ''}`,
          status: 'resolved',
          respondedAt: alert.respondedAt || updateData.respondedAt || new Date().toISOString(),
          resolvedAt: updateData.resolvedAt,
          adminOnDuty: adminName
        });
      }

      await setDoc(doc(db, 'alerts', alert.id), updateData, { merge: true });

      if (profile?.uid) {
        try {
          const userStatus = status === 'resolved' ? 'On-Duty' : status;
          await updateDoc(doc(db, 'users', profile.uid), { 
            status: userStatus,
            activeAlertId: status === 'resolved' ? null : alert.id
          });
          
          if (status === 'responding') {
            setProcessedAlertIds(prev => new Set(prev).add(alert.id));
          }
        } catch(e) {
          console.error('Failed to update roster status:', e);
        }
      }

      // Sync to Supabase
      try {
        await supabase
          .from('report_logs')
          .upsert([{ 
            id: alert.id,
            incident_id: alert.id,
            type: alert.type,
            location_lat: alert.location.lat,
            location_lng: alert.location.lng,
            lat: alert.location.lat, 
            lng: alert.location.lng,
            status: status,
            tanod_id: profile?.uid || null 
          }]);
      } catch (suErr) {
        console.error('Supabase status sync failed:', suErr);
      }
      
      await logIncidentAction({ ...alert, ...updateData });
    } catch (error: any) {
      console.error("Error updating alert:", error);
    } finally {
      setLoadingAlertIds(prev => {
        const next = new Set(prev);
        next.delete(alert.id);
        return next;
      });
    }
  };

  const handleRejectAlert = async (alert: Alert) => {
    if (!db) return;
    try {
      const updateData: any = { 
        status: 'pending', 
        updatedAt: new Date().toISOString(),
        assignedTo: null,
        assignedToName: null,
        respondedBy: null,
        respondedByName: null,
        respondedAt: null
      };
      
      await setDoc(doc(db, 'alerts', alert.id), updateData, { merge: true });
      
      // Log the rejection
      await logIncidentAction({ 
        ...alert, 
        ...updateData, 
        resolutionNotes: `SOS assignment rejected by ${profile?.name || 'anonymous tanod'}` 
      });

      // Clear tanod active alert if they were assigned
      if (profile?.uid) {
        await setDoc(doc(db, 'users', profile.uid), { 
          activeAlertId: null,
          status: 'On-Duty'
        }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to reject alert:', e);
    }
  };

  const handleSaveResponderNote = async (alertId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'alerts', alertId), {
        responderNotes: noteText,
        updatedAt: new Date().toISOString()
      });
      setEditingNoteId(null);
      setNoteText('');
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 md:space-y-8 pb-20"
    >
      <PoliceLights active={isFlashing} />
      
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white font-mono leading-none flex items-center gap-3">
            <Shield className="w-8 h-8 text-success shadow-glow-green" />
            Tanod Responder Portal
          </h2>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mt-2 bg-white/5 inline-block px-3 py-1 rounded-full border border-white/5">Securing Brgy. Intelligence Network</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <button
            onClick={() => setIsReportFormOpen(true)}
            className="flex items-center gap-3 px-6 py-2.5 rounded-xl bg-emergency/10 border border-emergency/30 hover:bg-emergency/20 transition-all group shadow-glow-red"
            id="file-report-btn"
          >
            <FilePlus className="w-4 h-4 text-emergency group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black text-emergency uppercase tracking-[0.25em] font-mono">File Incident Report</span>
          </button>
          <button
            onClick={() => setIsAboutOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
            id="tanod-about-btn"
          >
            <Info className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold text-white/40 group-hover:text-white uppercase tracking-[0.25em] font-mono">Project Vision & Guidelines</span>
          </button>
        </div>
      </motion.div>

      <AboutModal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)} 
        role={profile?.role} 
      />

      <AnimatePresence>
        {isReportFormOpen && profile && (
          <IncidentForm 
            profile={profile} 
            onClose={() => setIsReportFormOpen(false)} 
          />
        )}
      </AnimatePresence>

      {deferredPrompt && (
        <motion.button
          variants={itemVariants}
          onClick={onInstall}
          className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-info/10 text-info font-black border border-info/30 hover:bg-info/20 mb-4 transition-all hover:scale-[1.01] active:scale-95 uppercase tracking-[0.2em] font-mono shadow-[0_0_20px_rgba(59,130,246,0.2)] group"
        >
          <span className="text-lg group-hover:scale-125 transition-transform">📲</span>
          <span>INSTALL TANOD MOBILE APP</span>
        </motion.button>
      )}

      <motion.div variants={itemVariants}>
        <div className="glass-panel bg-brand-bg/60 backdrop-blur-3xl border-white/5 rounded-[40px] p-8 text-white shadow-2xl overflow-hidden relative group border-t border-l border-white/10">
           <div className="absolute top-8 right-8 flex items-center justify-center">
             <div className="absolute w-12 h-12 bg-success/20 rounded-full animate-pulse blur-2xl shadow-[0_0_15px_rgba(34,197,94,0.4)]" />
             <span className="relative text-2xl drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse">🟢</span>
           </div>
           
           <div className="relative z-10">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 font-mono flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
               Service Status
             </p>
             <div className="flex flex-col">
               <span className="text-4xl font-black italic tracking-tighter uppercase font-mono text-white leading-none">STATUS ON ACTIVE</span>
               <div className="flex items-center gap-1 mt-1">
                 <span className="text-4xl font-black italic tracking-tighter uppercase font-mono text-success leading-none">DUTY</span>
               </div>
             </div>
             <div className="mt-8 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                   <Shield className="w-5 h-5 text-success/60" />
                 </div>
                 <div>
                   <p className="text-[10px] opacity-40 uppercase tracking-widest font-mono font-black border-l border-success/30 pl-2">Designated Officer</p>
                   <p className="text-sm font-bold uppercase italic tracking-tight font-mono border-l border-success/30 pl-2">{profile?.name}</p>
                 </div>
               </div>

               <button 
                onClick={onToggleSiren}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest group shadow-2xl",
                  sirenActive 
                    ? "bg-emergency border-white/20 text-white animate-pulse" 
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20"
                )}
               >
                 {sirenActive ? (
                   <>
                    <VolumeX className="w-4 h-4 group-hover:scale-110" /> Stop Siren
                   </>
                 ) : (
                   <>
                    <Volume2 className="w-4 h-4 group-hover:scale-110" /> Test Siren
                   </>
                 )}
               </button>
             </div>
           </div>
           
           <Shield className="absolute -bottom-10 -right-10 w-48 h-48 opacity-[0.03] group-hover:rotate-12 transition-transform text-white pointer-events-none" />
           <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none" />
        </div>
      </motion.div>
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between glass-panel p-4 rounded-3xl">
              <h3 className="text-lg font-black italic tracking-tighter flex items-center gap-2 uppercase font-mono">
                <Zap className="w-5 h-5 text-emergency shadow-glow-red" />
                LIVE INCIDENT FEED
              </h3>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-emergency rounded-full animate-pulse shadow-glow-red" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Real-time Stream</span>
              </div>
            </div>

            {/* Tactical Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 glass-panel p-3 rounded-[28px] border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 px-3">
                <Filter className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[9px] font-black uppercase text-white/20 tracking-widest font-mono">Operational Sigs</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-brand-bg/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-white/50 font-mono outline-none focus:border-info/30 transition-colors uppercase tracking-wider cursor-pointer hover:bg-brand-bg md:w-auto w-full"
                >
                  <option value="ACTIVE">ACTIVE_ONLY</option>
                  <option value="ALL">ALL_STATUS</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RESPONDING">RESPONDING</option>
                </select>

                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-brand-bg/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-white/50 font-mono outline-none focus:border-info/30 transition-colors uppercase tracking-wider cursor-pointer hover:bg-brand-bg md:w-auto w-full"
                >
                  <option value="ALL">ALL_TYPES</option>
                  <option value="MEDICAL">MEDICAL</option>
                  <option value="FIRE">FIRE</option>
                  <option value="CRIME">CRIME</option>
                  <option value="DISASTER">DISASTER</option>
                </select>

                <select 
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="bg-brand-bg/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-white/50 font-mono outline-none focus:border-info/30 transition-colors uppercase tracking-wider cursor-pointer hover:bg-brand-bg md:w-auto w-full"
                >
                  <option value="ALL">ALL_TIME</option>
                  <option value="1H">LAST_1H</option>
                  <option value="4H">LAST_4H</option>
                  <option value="24H">LAST_24H</option>
                </select>
              </div>

              <div className="ml-auto px-4 py-1.5 bg-white/5 rounded-lg border border-white/5 md:block hidden">
                <span className="text-[9px] font-black text-white/40 uppercase font-mono tracking-tighter">
                   {dashboardAlerts.length} <span className="text-white/20">TARGETS_FOUND</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {dashboardAlerts.length === 0 ? (
                <div className="glass-panel border-white/5 rounded-[40px] p-24 text-center relative overflow-hidden group">
                  <div className="scanline opacity-5" />
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 opacity-10 group-hover:opacity-20 transition-opacity" />
                  <p className="text-white/30 font-black uppercase tracking-[0.3em] text-[10px] font-mono">No matching incidents detected.</p>
                  <p className="text-white/10 text-[8px] font-mono mt-2 tracking-widest">AWAITING TRANSMISSION...</p>
                </div>
              ) : (
                dashboardAlerts.map(alert => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={alert.id}
                    className={cn(
                      "glass-panel border-white/5 rounded-[32px] p-6 relative overflow-hidden transition-all group",
                      alert.status === 'pending' && (
                        alert.aiAnalysis && alert.aiAnalysis.severityScore > 7 ? "border-emergency/50 shadow-glow-red bg-emergency/5" :
                        alert.aiAnalysis && alert.aiAnalysis.severityScore >= 5 ? "border-warning/50 shadow-glow-orange bg-warning/5" :
                        "border-emergency/30 shadow-glow-red ring-1 ring-emergency/10 bg-emergency/5"
                      ),
                      alert.status === 'responding' && "border-info/30 shadow-lg bg-info/5"
                    )}
                  >
                    <div className="scanline opacity-10" />
                    
                    {alert.status === 'pending' && alert.aiAnalysis && alert.aiAnalysis.severityScore >= 7 && (
                      <div className="absolute -bottom-8 -right-8 opacity-20 pointer-events-none rotate-12 group-hover:opacity-30 transition-opacity">
                        <FlameAnimation size="lg" />
                      </div>
                    )}

                    {alert.status === 'pending' && (
                      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none z-[100]">
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
                    
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 relative z-10">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-16 h-16 rounded-[24px] flex items-center justify-center shrink-0 shadow-2xl transition-all group-hover:scale-105",
                            alert.status === 'pending' ? "bg-emergency text-white sos-glow shadow-glow-red" : "bg-info text-white"
                          )}>
                            <AlertTriangle className="w-8 h-8" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-black text-2xl text-white italic tracking-tighter uppercase font-mono leading-none">{alert.residentName}</h4>
                              <div className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm font-mono border",
                                alert.status === 'pending' ? "bg-emergency/20 text-emergency border-emergency/30 animate-pulse" : "bg-info/20 text-info border-info/30"
                              )}>
                                {alert.status}
                              </div>
                            </div>
                            <p className="text-[10px] text-white/40 font-bold flex items-center gap-2 font-mono uppercase tracking-[0.1em]">
                              <MapPin className="w-3 h-3 text-emergency" /> TRANSMISSION T+{Math.floor((Date.now() - new Date(alert.timestamp).getTime()) / 60000)}M • {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                            {alert.assignedTo === profile?.uid && alert.status === 'pending' && (
                              <div className="mt-3 px-3 py-2 bg-emergency/10 border border-emergency/30 rounded-xl flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emergency animate-pulse" />
                                <div>
                                  <p className="text-[9px] font-black uppercase text-emergency tracking-tighter font-mono">Designated for SOS</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-brand-bg/80 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 font-mono">Incident Protocol</p>
                              <p className="text-base font-bold text-white uppercase italic tracking-tighter font-mono flex items-center gap-2">
                                <span className="text-xl">
                                  {alert.type === 'medical' && '🏥'}
                                  {alert.type === 'fire' && '🔥'}
                                  {alert.type === 'crime' && '🚨'}
                                  {alert.type === 'flood' && '🌊'}
                                </span>
                                {alert.type}
                              </p>
                           </div>
                           <div className="bg-brand-bg/80 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 font-mono">Mission ID</p>
                              <p className="text-base font-bold text-white uppercase italic tracking-tighter font-mono truncate">
                                INC-{alert.id.slice(0, 8).toUpperCase()}
                              </p>
                           </div>
                        </div>

                        {alert.customMessage && (
                          <div className="bg-emergency/5 rounded-2xl p-4 border border-white/5 italic text-white/90 text-sm leading-relaxed font-mono shadow-inner">
                            <span className="text-emergency mr-2 font-black not-italic opacity-50">&gt;&gt;</span>
                            {alert.customMessage}
                          </div>
                        )}

                        {alert.aiAnalysis && (
                          <div className={cn(
                            "rounded-2xl p-4 border backdrop-blur-sm",
                            alert.aiAnalysis.severityScore > 7 ? "bg-emergency/5 border-emergency/20" : 
                            alert.aiAnalysis.severityScore >= 5 ? "bg-warning/5 border-warning/20" :
                            "bg-caution/5 border-caution/20"
                          )}>
                             <div className="flex justify-between items-center mb-2">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] font-mono">Priority Intelligence</p>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-[4px] text-[8px] font-black font-mono uppercase tracking-tighter shadow-sm",
                                    alert.aiAnalysis.severityScore > 7 ? "bg-emergency text-white" : 
                                    alert.aiAnalysis.severityScore >= 5 ? "bg-warning text-black" :
                                    "bg-caution text-black"
                                  )}>
                                    {alert.aiAnalysis.severityScore > 7 ? 'CRITICAL' : alert.aiAnalysis.severityScore >= 5 ? 'HIGH' : 'NORMAL'}
                                  </span>
                             </div>
                             <p className="text-xs font-bold text-white/90 leading-tight italic font-mono">"{alert.aiAnalysis.summary}"</p>
                             <div className="flex gap-1 mt-3">
                                {[...Array(10)].map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={cn(
                                      "h-1.5 flex-1 rounded-full transition-all",
                                      i < alert.aiAnalysis!.severityScore 
                                        ? (alert.aiAnalysis!.severityScore > 7 ? 'bg-emergency' : alert.aiAnalysis!.severityScore >= 5 ? 'bg-warning' : 'bg-caution')
                                        : 'bg-white/5'
                                    )} 
                                  />
                                ))}
                             </div>
                          </div>
                        )}

                        {/* Responder Notes Section */}
                        {alert.status === 'responding' && (
                          <div className="bg-info/5 rounded-2xl p-4 border border-info/20 shadow-inner">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[9px] font-black text-info/60 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
                                <Shield className="w-3 h-3" /> Tactical Responder Notes
                              </p>
                              {editingNoteId !== alert.id ? (
                                <button 
                                  onClick={() => {
                                    setEditingNoteId(alert.id);
                                    setNoteText(alert.responderNotes || '');
                                  }}
                                  className="text-[8px] font-black text-info hover:text-white transition-colors underline uppercase font-mono"
                                >
                                  {alert.responderNotes ? 'Edit Note' : 'Add Note'}
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setEditingNoteId(null)}
                                  className="text-[8px] font-black text-white/40 hover:text-white transition-colors uppercase font-mono"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>

                            {editingNoteId === alert.id ? (
                              <div className="space-y-3">
                                <textarea
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  placeholder="Enter mission updates, casualties, or required reinforcements..."
                                  className="w-full bg-brand-bg/50 border border-info/30 rounded-xl p-3 text-xs text-white placeholder:text-white/20 font-mono outline-none focus:border-info min-h-[80px]"
                                />
                                <button
                                  onClick={() => handleSaveResponderNote(alert.id)}
                                  className="w-full py-2 bg-info text-white text-[9px] font-black rounded-lg hover:bg-info/80 transition-all uppercase tracking-widest font-mono"
                                >
                                  Update Situation Report
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-white/80 font-mono italic leading-relaxed">
                                {alert.responderNotes ? (
                                  <>
                                    <span className="text-info mr-2 opacity-50 font-black not-italic">&gt;&gt;</span>
                                    {alert.responderNotes}
                                  </>
                                ) : (
                                  <span className="text-white/20 italic">No situation report entered yet. Intelligence missing.</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 shrink-0 justify-center">
                        <a 
                          href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-3 px-8 py-5 bg-brand-bg border border-white/10 text-white text-[10px] font-black rounded-2xl hover:bg-brand-card hover:border-emergency/50 transition-all uppercase tracking-widest font-mono shadow-lg active:scale-95"
                        >
                          <MapPin className="w-4 h-4 text-emergency" /> INITIALIZE GPS
                        </a>
                        {alert.status === 'pending' && (
                          <div className="flex gap-2">
                             <AnimatedButton 
                                onClick={() => handleUpdateStatus(alert, 'responding')}
                                isLoading={loadingAlertIds.has(alert.id)}
                                isSuccess={processedAlertIds.has(alert.id)}
                                label="ACCEPT SOS"
                                successLabel="ACCEPTED"
                                className="flex-1 bg-success shadow-glow-green"
                              />
                              <button 
                                onClick={() => handleRejectAlert(alert)}
                                className="py-5 px-6 bg-white/5 border border-white/10 text-white/40 text-[10px] font-black rounded-2xl hover:bg-emergency/10 hover:text-emergency hover:border-emergency/30 transition-all uppercase tracking-[0.2em] font-mono select-none flex items-center justify-center gap-2"
                              >
                                <X className="w-4 h-4" /> REJECT
                              </button>
                          </div>
                        )}
                        {alert.status === 'responding' && alert.respondedBy === profile?.uid && (
                          <button 
                            onClick={() => handleUpdateStatus(alert, 'resolved')}
                            className="flex-1 py-5 px-10 bg-success text-white text-[10px] font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(52,199,89,0.3)] uppercase tracking-[0.2em] font-mono select-none italic"
                          >
                            MARK RESOLVED
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel border-white/5 rounded-[40px] p-8 shadow-command">
             <div className="flex items-center justify-between mb-8">
               <h4 className="text-[10px] font-black uppercase text-white tracking-[0.3em] font-mono leading-none">Command Log</h4>
               <span className="text-[8px] text-white/40 font-mono">Today</span>
             </div>
             <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
               {shiftLog.length === 0 ? (
                 <div className="py-12 flex flex-col items-center justify-center opacity-20">
                    <CheckCircle className="w-12 h-12 mb-4" />
                    <p className="text-[10px] text-white font-black uppercase tracking-widest font-mono">No data logged</p>
                 </div>
               ) : (
                 shiftLog.map(log => (
                   <div key={log.id} className="p-4 bg-brand-bg/50 rounded-2xl border border-white/5 flex flex-col gap-2 hover:border-white/10 transition-colors">
                     <div className="flex justify-between items-start">
                       <span className="text-xs font-black text-white uppercase italic tracking-tighter font-mono">{log.type}</span>
                       <span className="text-[9px] font-mono text-white/40">{new Date(log.resolvedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                     <span className="text-[10px] text-white/60 font-medium uppercase tracking-tight">{log.residentName}</span>
                   </div>
                 ))
               )}
             </div>
          </div>
          
          <div className="pt-2">
            <InstallAppButton />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
