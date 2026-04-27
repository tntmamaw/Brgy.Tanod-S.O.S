/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { DutyLog } from './types';

// Mock data based on the provided design
const alerts = [
  { id: 1, title: "Barangay S.o.S Alerted", meta: "Purok 4, Zone B • 2m ago", active: true },
  { id: 2, title: "Medical Emergency", meta: "122 Mabini St • 14m ago", active: false },
  { id: 3, title: "Unidentified Intruder", meta: "Public Plaza • 45m ago", active: false },
];

export default function App() {
  const [dutyLogs, setDutyLogs] = useState<DutyLog[]>([]);
  const [newTanodName, setNewTanodName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        let roleToSet = userDoc.exists() ? userDoc.data().role : 'resident';

        // Auto-upgrade to admin if email matches
        if (currentUser.email === 'rubenlleg12@gmail.com' && roleToSet !== 'admin') {
            await setDoc(userRef, { email: currentUser.email, role: 'admin' }, { merge: true });
            roleToSet = 'admin';
        }
        
        setRole(roleToSet);
      } else {
        setRole(null);
      }
    });

    const q = query(collection(db, 'dutyLogs'), orderBy('dutyDate', 'desc'));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DutyLog));
      setDutyLogs(logs);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeLogs();
    };
  }, []);

  const [authError, setAuthError] = useState<string | null>(null);

  const login = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        setAuthError("Sign-in popup was closed. Please try again.");
      } else {
        setAuthError(`Sign-in error: ${error.message}`);
      }
    }
  };

  const addDutyLog = async () => {
    if (!newTanodName) return;
    await addDoc(collection(db, 'dutyLogs'), {
      tanodName: newTanodName,
      dutyDate: new Date().toISOString().split('T')[0]
    });
    setNewTanodName('');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1115] text-white p-4">
        <button onClick={login} className="bg-[#FF4B4B] text-white p-4 rounded font-bold mb-4">Login with Google</button>
        {authError && <p className="text-red-500 text-sm max-w-sm text-center">{authError}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[300px,1fr] gap-8">
        {/* Header */}
        <header className="md:col-span-2 flex justify-between items-center pb-4 border-b border-[#2D3139]">
          <div className="text-2xl font-extrabold tracking-tighter text-[#FF4B4B] flex items-center gap-2">
            <div className="w-3 h-3 bg-[#FF4B4B] rounded-full shadow-[0_0_10px_#FF4B4B] animate-pulse"></div>
            BRGY. TANOD S.O.S ({role?.toUpperCase()})
          </div>
          <div className="bg-[rgba(76,175,80,0.1)] text-[#4CAF50] px-4 py-1 rounded-full text-xs font-semibold uppercase border border-[rgba(76,175,80,0.3)]">
            System Online: {dutyLogs.length} Tanods Active
          </div>
        </header>

        {/* Sidebar */}
        <aside className="space-y-4">
          <h2 className="text-lg">Live Alerts</h2>
          {alerts.map(alert => (
            <div key={alert.id} className={`p-4 rounded-[16px] border ${alert.active ? 'bg-[#2D1B1B] border-[#FF4B4B]' : 'bg-[#252932] border-[#2D3139]'} cursor-pointer`}>
              <div className="font-bold text-sm mb-1">{alert.title}</div>
              <div className="text-xs text-[#8E9299]">{alert.meta}</div>
            </div>
          ))}
          
          <div className="mt-8 p-4 bg-[#1A1D23] rounded-[16px] border border-[#2D3139]">
            <div className="text-xs uppercase text-[#8E9299]">Head Developer/System Owner</div>
            <div className="text-lg font-bold mt-1">Ruben Llego</div>
            <div className="mt-4">
              <p className="text-sm text-[#8E9299] text-center">Contact via Messenger: @ruben.llego.ben</p>
            </div>
            <button onClick={() => signOut(auth)} className="text-xs text-[#FF4B4B] mt-4 w-full">Logout</button>
          </div>
        </aside>

        {/* Bento Grid */}
        <main className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-4 md:h-[600px]">
          {role === 'admin' && (
            <div className="md:col-span-2 border-l-4 border-[#FF4B4B] bg-[#1A1D23] rounded-[24px] p-6">
              <div className="text-xs uppercase text-[#8E9299] tracking-widest mb-3">Tanod Duty Management</div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTanodName}
                  onChange={(e) => setNewTanodName(e.target.value)}
                  placeholder="Tanod Name"
                  className="bg-[#252932] text-white p-2 rounded flex-grow"
                />
                <button onClick={addDutyLog} className="bg-[#FF4B4B] text-white p-2 px-4 rounded font-bold">Add Tanod</button>
              </div>
              <div className="mt-4">
                  {dutyLogs.map(log => (
                      <div key={log.id} className="text-sm border-b border-[#2D3139] py-1">{log.tanodName} - {log.dutyDate}</div>
                  ))}
              </div>
            </div>
          )}
          
          <div className="bg-[#1A1D23] border border-[#2D3139] rounded-[24px] p-6">
            <div className="text-xs uppercase text-[#8E9299] tracking-widest mb-3">Current Status</div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#FF9800] text-black">DISPATCHED</div>
          </div>

          <div className="md:col-span-2 md:row-span-2 bg-[#1A1D23] border border-[#2D3139] rounded-[24px] p-6">
            <div className="text-xs uppercase text-[#8E9299] tracking-widest mb-3">Live GPS Location</div>
            <div className="w-full h-48 md:h-full bg-[#0A0C10] rounded-[16px] relative flex items-center justify-center">
              <div className="w-5 h-5 bg-[#FF4B4B] rounded-full [clip-path:polygon(0_0,100%_0,50%_100%)] rotate-[-45deg] absolute top-[40%] left-[60%] shadow-[0_0_15px_rgba(255,75,75,0.6)]"></div>
              <div className="absolute bottom-2 right-2 text-[10px] text-[#444]">14.5995° N, 120.9842° E</div>
            </div>
          </div>

          <div className="bg-[#1A1D23] border border-[#2D3139] rounded-[24px] p-6">
            <div className="text-xs uppercase text-[#8E9299] tracking-widest mb-3">Residential Address</div>
            <div className="text-lg font-semibold leading-relaxed">Blk 7, Lot 12, Phase 2<br />Brgy. San Jose, Quezon City</div>
          </div>

          <div className="bg-[#FF4B4B] text-white rounded-[24px] p-6">
            <div className="text-xs uppercase text-[rgba(255,255,255,0.7)] tracking-widest mb-3">Quick Action</div>
            <div className="text-2xl font-extrabold">SOUND SIREN</div>
            <div className="text-xs mt-2">Trigger local community alarm</div>
          </div>
        </main>
      </div>
    </div>
  );
}
