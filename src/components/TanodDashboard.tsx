import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Alert, User } from '../types';
import { AlertTriangle, MapPin, Zap, CheckCircle } from 'lucide-react';
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
      
      // Log for audit
      await logIncidentAction({ ...alert, ...updateData });
    } catch (error: any) {
      console.error("Error updating alert:", error);
      window.alert('Failed to update status.');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PoliceLights active={isFlashing} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF4B4B]" />
              LIVE INCIDENT FEED
            </h3>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.length === 0 ? (
                <div className="bg-[#16191F] border border-[#2D3139] rounded-[40px] p-20 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
                  <p className="text-[#8E9299] font-bold">No active incidents.</p>
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
                      "bg-[#16191F] border border-[#2D3139] rounded-[32px] p-6 relative overflow-hidden transition-all",
                      alert.status === 'pending' && "border-[#FF4B4B] shadow-[0_0_20px_rgba(255,75,75,0.15)] ring-1 ring-[#FF4B4B]/20"
                    )}
                  >
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      <div className="flex-1 space-y-3 md:space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            alert.status === 'pending' ? "bg-[#FF4B4B] text-white" : "bg-blue-500 text-white"
                          )}>
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-lg text-white">{alert.residentName}</h4>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                alert.status === 'pending' ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                              )}>
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-xs text-[#8E9299] font-medium flex items-center gap-2">
                              <MapPin className="w-3 h-3" /> {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="bg-[#0F1115] rounded-2xl p-4 border border-[#2D3139]">
                           <p className="text-[10px] font-black text-[#8E9299] uppercase tracking-[0.2em] mb-1">Emergency Type</p>
                           <p className="text-sm font-bold text-white uppercase italic tracking-tighter">{alert.type}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 shrink-0 justify-center">
                        <a 
                          href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#252932] text-white text-xs font-bold rounded-xl hover:bg-[#2D3139] border border-[#2D3139] transition-all uppercase"
                        >
                          <MapPin className="w-4 h-4 text-[#FF4B4B]" /> GPS Route
                        </a>
                        
                        {alert.status === 'pending' && (
                          <button 
                            onClick={() => handleUpdateStatus(alert, 'responding')}
                            className="flex-1 py-3 px-6 bg-[#FF4B4B] text-white text-xs font-black rounded-xl hover:scale-105 transition-all shadow-lg uppercase"
                          >
                            Accept / En Route
                          </button>
                        )}
                        {alert.status === 'responding' && alert.respondedBy === profile?.uid && (
                          <button 
                            onClick={() => handleUpdateStatus(alert, 'resolved')}
                            className="flex-1 py-3 px-6 bg-green-600 text-white text-xs font-black rounded-xl hover:scale-105 transition-all shadow-lg uppercase"
                          >
                            Mark Resolved
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
          <div className="bg-[#16191F] border border-[#2D3139] rounded-[40px] p-8 shadow-xl">
             <h4 className="text-[10px] font-black uppercase text-[#8E9299] tracking-[0.3em] mb-6">Your Shift Log</h4>
             <div className="space-y-3 max-h-[400px] overflow-y-auto">
               {shiftLog.length === 0 ? (
                 <p className="text-[10px] text-[#8E9299] italic">No incidents resolved yet.</p>
               ) : (
                 shiftLog.map(log => (
                   <div key={log.id} className="p-3 bg-[#0F1115] rounded-2xl border border-[#2D3139] flex flex-col gap-1">
                     <span className="text-[10px] font-bold text-white uppercase">{log.type}</span>
                     <span className="text-[9px] text-[#8E9299]">{log.resolvedAt ? new Date(log.resolvedAt).toLocaleTimeString() : 'Done'} - {log.residentName}</span>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
