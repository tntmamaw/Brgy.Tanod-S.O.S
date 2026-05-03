import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shift, User } from '../types';
import { Calendar, Clock, MapPin, User as UserIcon, Plus, X, Trash2, CheckCircle2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function PatrolScheduler({ profile }: { profile: any }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tanods, setTanods] = useState<User[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedTanod, setSelectedTanod] = useState('');
  const [sector, setSector] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tanod')) return;

    // Listen for shifts
    const qShift = query(collection(db, 'shifts'), orderBy('startTime', 'desc'));
    const unsubShift = onSnapshot(qShift, (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    });

    // Listen for Tanods
    const qTanod = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubTanod = onSnapshot(qTanod, (snap) => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setTanods(allUsers.filter(u => u.role === 'tanod' && u.status === 'approved'));
    });

    return () => {
      unsubShift();
      unsubTanod();
    };
  }, []);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTanod || !sector || !startTime || !endTime) return;

    setLoading(true);
    try {
      const tanod = tanods.find(t => t.uid === selectedTanod);
      await addDoc(collection(db, 'shifts'), {
        tanodId: selectedTanod,
        tanodName: tanod?.name || 'Unknown Officer',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        sector,
        status: 'scheduled',
        notes,
        createdAt: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error creating shift:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTanod('');
    setSector('');
    setStartTime('');
    setEndTime('');
    setNotes('');
  };

  const updateShiftStatus = async (id: string, status: Shift['status']) => {
    try {
      await updateDoc(doc(db, 'shifts', id), { status });
    } catch (error) {
      console.error("Error updating shift status:", error);
    }
  };

  const deleteShift = async (id: string) => {
    if (window.confirm('Delete this patrol assignment?')) {
      try {
        await deleteDoc(doc(db, 'shifts', id));
      } catch (error) {
        console.error("Error deleting shift:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#16191F] p-6 rounded-[32px] border border-[#2D3139] shadow-xl">
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Patrol Scheduler</h2>
          <p className="text-[#8E9299] text-xs font-medium">Manage officer shifts and patrol sectors</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#FF4B4B] rounded-2xl hover:scale-105 transition-all shadow-lg font-black text-xs uppercase italic tracking-widest"
        >
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shifts.map((shift) => (
          <motion.div 
            layout
            key={shift.id}
            className="bg-[#16191F] border border-[#2D3139] p-6 rounded-[32px] space-y-4 hover:border-[#FF4B4B]/30 transition-all group relative overflow-hidden"
          >
            {/* Status Indicator */}
            <div className={cn(
              "absolute top-0 right-0 px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] rounded-bl-2xl",
              shift.status === 'scheduled' ? "bg-blue-500/20 text-blue-500" :
              shift.status === 'active' ? "bg-amber-500/20 text-amber-500" :
              "bg-green-500/20 text-green-500"
            )}>
              {shift.status}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#252932] flex items-center justify-center border border-[#2D3139]">
                <UserIcon className="w-6 h-6 text-[#FF4B4B]" />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-lg text-white truncate">{shift.tanodName}</h4>
                <p className="text-[10px] text-[#8E9299] uppercase font-black tracking-widest flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {shift.sector}
                </p>
              </div>
            </div>

            <div className="space-y-2 py-4 border-y border-[#2D3139]/50">
              <div className="flex items-center gap-3 text-xs text-[#8E9299]">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(shift.startTime), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#8E9299]">
                <Clock className="w-4 h-4" />
                <span>{format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}</span>
              </div>
            </div>

            {shift.notes && (
              <p className="text-xs text-[#8E9299] italic italic">"{shift.notes}"</p>
            )}

            <div className="flex gap-2 pt-2">
              {shift.status === 'scheduled' && (
                <button 
                  onClick={() => updateShiftStatus(shift.id, 'active')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <Play className="w-3 h-3" /> Start
                </button>
              )}
              {shift.status === 'active' && (
                <button 
                  onClick={() => updateShiftStatus(shift.id, 'completed')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600/10 text-green-500 rounded-xl hover:bg-green-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <CheckCircle2 className="w-3 h-3" /> Done
                </button>
              )}
              <button 
                onClick={() => deleteShift(shift.id)}
                className="p-2 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {shifts.length === 0 && (
          <div className="col-span-full py-12 text-center text-[#8E9299] bg-[#16191F] rounded-[32px] border border-dashed border-[#2D3139]">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold italic">No patrol shifts scheduled yet.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16191F] border border-[#2D3139] w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[#2D3139] flex justify-between items-center bg-[#1A1D23]">
                <h3 className="font-black italic text-2xl tracking-tighter uppercase">New Patrol Assignment</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-[#252932] rounded-full transition-colors text-[#8E9299] hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateShift} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest mb-2 block">Officer</label>
                    <select 
                      required
                      value={selectedTanod}
                      onChange={(e) => setSelectedTanod(e.target.value)}
                      className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:outline-none focus:border-[#FF4B4B] transition-all"
                    >
                      <option value="">Select an Officer...</option>
                      {tanods.map(t => (
                        <option key={t.uid} value={t.uid}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest mb-2 block">Patrol Sector / Zone</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Zone 4 Market"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:outline-none focus:border-[#FF4B4B] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest mb-2 block">Start Time</label>
                      <input 
                        required
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:outline-none focus:border-[#FF4B4B] transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest mb-2 block">End Time</label>
                      <input 
                        required
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:outline-none focus:border-[#FF4B4B] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest mb-2 block">Special Instructions</label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:outline-none focus:border-[#FF4B4B] transition-all h-24"
                      placeholder="Enter notes..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-[#252932] text-white font-black uppercase italic tracking-widest rounded-2xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-[#FF4B4B] text-white font-black uppercase italic tracking-widest rounded-2xl shadow-xl shadow-red-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Assign Patrol'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
