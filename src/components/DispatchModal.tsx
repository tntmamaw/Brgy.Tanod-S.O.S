import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Alert } from '../types';
import { X, Shield, Send } from 'lucide-react';
import { cn } from '../lib/utils';

interface DispatchModalProps {
  alert: Alert;
  onClose: () => void;
}

export default function DispatchModal({ alert, onClose }: DispatchModalProps) {
  const [tanods, setTanods] = useState<User[]>([]);
  const [selectedTanod, setSelectedTanod] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'tanod'), where('status', '==', 'approved'));
    return onSnapshot(q, (snapshot) => {
      setTanods(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    });
  }, []);

  const handleDispatch = async () => {
    if (!selectedTanod) return;
    setSubmitting(true);
    try {
      const tanod = tanods.find(t => t.uid === selectedTanod);
      await updateDoc(doc(db, 'alerts', alert.id), {
        status: 'responding',
        respondedBy: selectedTanod,
        respondedByName: tanod?.name || 'Assigned Tanod',
        respondedAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error(err);
      window.alert('Failed to dispatch tanod. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-[#16191F] border border-[#2D3139] w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-[#2D3139] flex justify-between items-center bg-[#1A1D23]">
          <div>
            <h3 className="font-black italic text-2xl tracking-tighter uppercase text-white">Dispatch Responder</h3>
            <p className="text-[#8E9299] text-[10px] font-black uppercase tracking-[0.2em]">Select an available Tanod unit</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#252932] rounded-full transition-colors text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
          {tanods.length === 0 ? (
            <div className="text-center py-12 text-[#8E9299]">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="font-bold">No Tanods available for dispatch.</p>
            </div>
          ) : (
            tanods.map(tanod => (
              <button
                key={tanod.uid}
                onClick={() => setSelectedTanod(tanod.uid)}
                className={cn(
                  "w-full flex items-center gap-4 p-5 rounded-3xl border transition-all text-left",
                  selectedTanod === tanod.uid 
                    ? "bg-[#FF4B4B]/10 border-[#FF4B4B] shadow-[0_0_20px_rgba(255,75,75,0.1)]" 
                    : "bg-[#0F1115] border-[#2D3139] hover:border-[#8E9299]/30"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  selectedTanod === tanod.uid ? "bg-[#FF4B4B] text-white" : "bg-[#252932] text-[#8E9299]"
                )}>
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-lg text-white uppercase italic tracking-tighter truncate">{tanod.name}</p>
                  <p className="text-xs text-[#8E9299] font-bold uppercase tracking-widest">Active • Sector Alpha</p>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-4 flex items-center justify-center transition-all",
                  selectedTanod === tanod.uid ? "border-[#FF4B4B] bg-white scale-110" : "border-[#2D3139]"
                )} />
              </button>
            ))
          )}
        </div>

        <div className="p-8 bg-[#1A1D23] border-t border-[#2D3139] flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-5 font-black italic text-sm text-[#8E9299] hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button 
            disabled={!selectedTanod || submitting}
            onClick={handleDispatch}
            className={cn(
              "flex-[2] py-5 rounded-2xl font-black italic text-sm tracking-widest shadow-xl transition-all flex items-center justify-center gap-2",
              selectedTanod 
                ? "bg-[#FF4B4B] text-white hover:scale-105" 
                : "bg-[#252932] text-[#8E9299] cursor-not-allowed"
            )}
          >
            {submitting ? 'DISPATCHING...' : <><Send className="w-4 h-4" /> CONFIRM DISPATCH</>}
          </button>
        </div>
      </div>
    </div>
  );
}
