import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { Alert, User } from '../types';
import { AlertTriangle, MapPin, Zap, CheckCircle, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Howl } from 'howler';
import { PoliceLights } from './PoliceLights';

const alarm = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/1004/1004-preview.mp3'],
  loop: true,
  volume: 0.6,
});

import { useIncidentStore } from '../store/useIncidentStore';
import { logIncidentAction } from '../services/logService';

export default function TanodDashboard({ profile, onTabChange }: { profile: User | null, onTabChange: (tab: string) => void }) {
  const { alerts } = useIncidentStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [shiftLog, setShiftLog] = useState<Alert[]>([]);

  // Filter alerts for this tanod: pending OR specifically assigned/responded by them
  const filteredAlerts = alerts.filter(a => 
    a.status === 'pending' || 
    a.assignedTo === profile?.uid || 
    a.respondedBy === profile?.uid
  );

  useEffect(() => {
    if (!profile || profile.role !== 'tanod') return;

    // Play loud siren for 10 seconds if there's a new pending alert
    const hasPending = filteredAlerts.some(a => a.status === 'pending');
    if (hasPending) {
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
  }, [filteredAlerts, profile]);

  useEffect(() => {
    if (!profile || profile.role !== 'tanod') return;

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
      alarm.stop();
    };
  }, [profile]);

  const handleUpdateStatus = async (alert: Alert, status: Alert['status']) => {
    try {
      const updateData: any = { status };
      
      if (status === 'responding') {
        updateData.respondedBy = profile?.uid || 'unknown';
        if (profile?.name) updateData.respondedByName = profile.name;
        updateData.respondedAt = new Date().toISOString();
      }
      
      if (status === 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolutionNotes = `Cleared by ${profile?.name || 'Tanod Responder'}`;
        
        // Try to find an admin to assign as 'on duty'
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

        // Auto-create an incident log from this alert
        await addDoc(collection(db, 'incidents'), {
          alertId: alert.id,
          tanodId: profile?.uid || 'unknown',
          tanodName: profile?.name || 'Unknown Tanod',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString(),
          location: alert.customMessage || 'Location via GPS',
          gpsLocation: alert.location,
          type: alert.type,
          description: `Automatically created from a resolved alert.\nCitizen: ${alert.residentName}\nResponse note: ${updateData.resolutionNotes}`,
          status: 'resolved',
          respondedAt: alert.respondedAt || updateData.respondedAt || new Date().toISOString(),
          resolvedAt: updateData.resolvedAt,
          adminOnDuty: adminName
        });
      }

      await updateDoc(doc(db, 'alerts', alert.id), updateData);

      // Sync to Supabase (Robust update/insert)
      try {
        await supabase
          .from('incidents')
          .upsert([{ 
            id: alert.id,
            type: alert.type,
            lat: alert.location.lat,
            lng: alert.location.lng,
            status: updateData.status,
            tanod_id: profile?.uid || null 
          }]);
      } catch (suErr) {
        console.error('Supabase status sync failed:', suErr);
      }
      
      // Log for audit
      await logIncidentAction({ ...alert, ...updateData });
    } catch (error: any) {
      console.error("Error updating alert:", error);
      window.alert('Failed to update status.');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <PoliceLights active={isFlashing} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between glass-panel p-4 rounded-3xl mb-2">
            <h3 className="text-lg font-black italic tracking-tighter flex items-center gap-2 uppercase font-mono">
              <Zap className="w-5 h-5 text-emergency shadow-glow-red" />
              LIVE INCIDENT FEED
            </h3>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 bg-emergency rounded-full animate-pulse shadow-glow-red" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Real-time Stream</span>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.length === 0 ? (
                <div className="glass-panel border-white/5 rounded-[40px] p-24 text-center">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 opacity-10" />
                  <p className="text-white/30 font-black uppercase tracking-widest text-xs font-mono">No active incidents detected.</p>
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
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105",
                            alert.status === 'pending' ? "bg-emergency text-white sos-glow" : "bg-info text-white"
                          )}>
                            <AlertTriangle className="w-7 h-7" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-black text-xl text-white italic tracking-tighter uppercase font-mono">{alert.residentName}</h4>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm font-mono",
                                alert.status === 'pending' ? "bg-emergency text-white" : "bg-info/20 text-info"
                              )}>
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-xs text-white/40 font-bold flex items-center gap-2 font-mono uppercase tracking-tight">
                              <MapPin className="w-3 h-3 text-emergency" /> {new Date(alert.timestamp).toLocaleTimeString()} • ALERT T+{Math.floor((Date.now() - new Date(alert.timestamp).getTime()) / 60000)}M
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-brand-bg rounded-2xl p-4 border border-white/5">
                              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 font-mono">Incident Type</p>
                              <p className="text-base font-bold text-white uppercase italic tracking-tighter font-mono flex items-center gap-2">
                                {alert.type === 'medical' && '🏥'}
                                {alert.type === 'fire' && '🔥'}
                                {alert.type === 'crime' && '🚨'}
                                {alert.type === 'flood' && '🌊'}
                                {alert.type}
                              </p>
                           </div>
                           <div className="bg-brand-bg rounded-2xl p-4 border border-white/5">
                              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 font-mono">Citizen ID</p>
                              <p className="text-base font-bold text-white uppercase italic tracking-tighter font-mono truncate">
                                RES-{alert.residentId.slice(-6)}
                              </p>
                           </div>
                        </div>

                        {alert.customMessage && (
                          <div className="bg-emergency/5 rounded-2xl p-4 border border-emergency/10 italic text-white/80 text-sm leading-relaxed">
                            "{alert.customMessage}"
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 shrink-0 justify-center">
                        <a 
                          href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-bg border border-white/10 text-white text-xs font-black rounded-2xl hover:bg-brand-card hover:border-emergency/50 transition-all uppercase tracking-widest font-mono"
                        >
                          <MapPin className="w-4 h-4 text-emergency" /> GPS ROUTE
                        </a>
                        
                        {alert.status === 'pending' && (
                          <button 
                            onClick={() => handleUpdateStatus(alert, 'responding')}
                            className="flex-1 py-4 px-8 bg-emergency text-white text-xs font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-glow-red uppercase tracking-widest font-mono select-none"
                          >
                            ACCEPT DEPLOYMENT
                          </button>
                        )}
                        {alert.status === 'responding' && alert.respondedBy === profile?.uid && (
                          <button 
                            onClick={() => handleUpdateStatus(alert, 'resolved')}
                            className="flex-1 py-4 px-8 bg-success text-white text-xs font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg uppercase tracking-widest font-mono select-none"
                          >
                            CLOSE INCIDENT
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
          
          <div className="bg-info rounded-[32px] p-6 text-white shadow-lg overflow-hidden relative group">
             <div className="relative z-10">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 font-mono">Status</p>
               <p className="text-2xl font-black italic tracking-tighter uppercase font-mono">ON ACTIVE DUTY</p>
               <p className="text-[10px] mt-4 opacity-80 uppercase tracking-tight font-mono">Officer: {profile?.name}</p>
             </div>
             <Shield className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
