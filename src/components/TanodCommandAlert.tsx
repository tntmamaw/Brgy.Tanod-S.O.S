import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shift, User } from '../types';
import { Howl } from 'howler';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const siren = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/1004/1004-preview.mp3'], // Emergency siren
  loop: false,
  volume: 0.8,
});

import { useTanodStore } from '../store/useTanodStore';

export default function TanodCommandAlert({ profile, isTestMode }: { profile: User, isTestMode?: boolean }) {
  const { shifts } = useTanodStore();
  const [activeAlert, setActiveAlert] = useState<Shift | null>(null);

  const pendingShifts = shifts.filter(s => {
    const isTarget = isTestMode || s.tanodId === profile.uid;
    return isTarget && s.tanodResponse === 'pending';
  });

  useEffect(() => {
    if (pendingShifts.length > 0 && !activeAlert) {
      setActiveAlert(pendingShifts[0]);
    } else if (pendingShifts.length === 0 && activeAlert) {
      setActiveAlert(null);
    }
  }, [pendingShifts, activeAlert]);

  useEffect(() => {
    if (activeAlert) {
      siren.play();
      const timeout = setTimeout(() => {
        siren.stop();
      }, 3000);
      
      return () => {
        clearTimeout(timeout);
        siren.stop();
      };
    }
  }, [activeAlert]);

  const handleResponse = async (shiftId: string, response: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        tanodResponse: response,
        status: response === 'accepted' ? 'active' : 'scheduled' // or maybe keep 'scheduled' if accepted? 
      });
      toast.success(response === 'accepted' ? 'Task Accepted' : 'Task Rejected');
      siren.stop();
      setActiveAlert(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit response');
    }
  };

  if (!activeAlert) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-[#16191F] border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] w-full max-w-sm rounded-[32px] overflow-hidden"
        >
          <div className="bg-red-500 p-6 text-center animate-pulse">
            <AlertTriangle className="w-16 h-16 text-white mx-auto mb-2" />
            <h2 className="text-white text-2xl font-black italic uppercase tracking-widest">Command Alert</h2>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-center text-[#8E9299] font-medium">
              You have been assigned a new task by the Commander:
            </p>
            
            <div className="bg-[#0F1115] p-4 rounded-2xl border border-[#2D3139]">
              <p className="text-xs text-[#8E9299] uppercase font-bold tracking-widest mb-1">Sector</p>
              <p className="text-white font-bold">{activeAlert.sector}</p>
              
              <div className="mt-3">
                <p className="text-xs text-[#8E9299] uppercase font-bold tracking-widest mb-1">Time</p>
                <p className="text-white font-medium text-sm">
                  {new Date(activeAlert.startTime).toLocaleTimeString()} - {new Date(activeAlert.endTime).toLocaleTimeString()}
                </p>
              </div>

              {activeAlert.notes && (
                <div className="mt-3">
                  <p className="text-xs text-[#8E9299] uppercase font-bold tracking-widest mb-1">Instructions</p>
                  <p className="text-white font-medium text-sm italic">"{activeAlert.notes}"</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleResponse(activeAlert.id, 'rejected')}
                className="flex-1 py-4 bg-[#252932] hover:bg-gray-700 text-white font-black uppercase italic tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-colors"
              >
                <X className="w-5 h-5" /> Reject
              </button>
              <button
                onClick={() => handleResponse(activeAlert.id, 'accepted')}
                className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white font-black uppercase italic tracking-widest rounded-2xl shadow-xl shadow-green-500/20 flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" /> Accept
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
