/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc,
  updateDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { supabase } from './lib/supabase';
import { User, Alert, UserRole, PatrolLocation, EmergencyType, ResidentProfile } from './types';
import { 
  Bell, 
  Shield, 
  Map as MapIcon, 
  LogOut, 
  User as UserIcon, 
  AlertTriangle, 
  FileText, 
  Phone,
  LayoutDashboard,
  Clock,
  Navigation,
  FileCheck,
  Plus,
  Settings as SettingsIcon,
  X,
  MapPin,
  Users
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Howl } from 'howler';
import ActiveMap from './components/ActiveMap';
import LiveMap from './LiveMap';
import AdminDashboard from './components/AdminDashboard';
import TanodDashboard from './components/TanodDashboard';
import { Shift } from './types';
import { format } from 'date-fns';
import { queueSOS } from './lib/offlineQueue';
import AdminResidents from './components/AdminResidents';
import PatrolScheduler from './components/PatrolScheduler';
import RegistrationForm from './components/RegistrationForm';
import IncidentForm from './components/IncidentForm';
import ReportMap from './components/ReportMap';
import { TanodLogo, TanodWordmark, BackgroundPattern, AppIcon } from './components/Branding';
import { analyzeIncident } from './services/aiService';
import { db as dexieDb } from './lib/mapDb';
import { startGPSTracking, calculateDistance } from './services/gpsService';
import { Toaster, toast } from 'react-hot-toast';
import { scheduleDailyLogReset } from './lib/scheduler.mock';

// Siren sound
const siren = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/1004/1004-preview.mp3'], // Emergency siren
  loop: true,
  volume: 0.5,
});

import TanodCommandAlert from './components/TanodCommandAlert';
import BackgroundServices from './components/BackgroundServices';
import { useAuthStore } from './store/useAuthStore';
import { useIncidentStore } from './store/useIncidentStore';
import { useTanodStore } from './store/useTanodStore';

export default function App() {
  const { 
    profile, 
    setProfile, 
    residentProfile, 
    setResidentProfile, 
    isLoading: loading, 
    setIsLoading: setLoading 
  } = useAuthStore();
  const { alerts } = useIncidentStore();
  const { patrols } = useTanodStore();
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'tracker' | 'reports' | 'directory' | 'schedule' | 'residents' | 'roster' | 'settings'>('home');
  const [isIncidentFormOpen, setIsIncidentFormOpen] = useState(false);

  const [isRegistering, setIsRegistering] = useState(false);
  const [viewOverride, setViewOverride] = useState<'admin' | 'tanod' | 'resident' | null>(null);

  const isRuben = user?.email === 'rubenlleg12@gmail.com';
  const effectiveRole = viewOverride || profile?.role;
  const effectiveProfile = profile ? { 
    ...profile, 
    role: effectiveRole as 'admin' | 'tanod' | 'resident',
    name: isRuben ? 'RubenLlego' : profile.name
  } : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const isAdminEmail = firebaseUser.email === 'rubenlleg12@gmail.com';
        
        // First check if they have a standard user profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (userDoc.exists()) {
          setProfile({ id: userDoc.id, ...userDoc.data() } as User);
        } else if (isAdminEmail) {
          // Auto-bootstrap master admin
          const adminProfile: Partial<User> = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Master Admin',
            email: firebaseUser.email || '',
            role: 'admin',
            createdAt: new Date().toISOString(),
            status: 'approved'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), adminProfile);
          setProfile(adminProfile as User);
        } else {
          setProfile(null);
        }

        const resDoc = await getDoc(doc(db, 'residents', firebaseUser.uid));
        if (resDoc.exists()) {
          setResidentProfile({ id: resDoc.id, ...resDoc.data() } as ResidentProfile);
        }
      } else {
        setProfile(null);
        setResidentProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Alert sound logic for Tanods
    if (!profile || (profile.role !== 'tanod' && profile.role !== 'admin')) return;

    const hasActive = alerts.some(a => a.status === 'pending');
    if (hasActive) {
      if (!siren.playing()) {
        siren.volume(1.0);
        siren.play();
        setTimeout(() => { siren.stop(); }, 10000);
      }
    } else {
      siren.stop();
    }
    
    return () => siren.stop();
  }, [alerts, profile?.role]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      return await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.info('Login was cancelled by the user.');
      } else {
        console.error("Login failed", error);
      }
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoResidentLogin = async () => {
    if (!auth.currentUser) {
      try {
        await handleLogin();
      } catch (error) {
        return; // User cancelled login
      }
    }

    const realUid = auth.currentUser?.uid || 'demo-resident-123';
    
    // Mock user for demo purposes
    const mockUser = {
      ...(auth.currentUser || {}),
      uid: realUid,
      displayName: 'Juan Dela Cruz (Demo)',
      email: 'juan.demo@example.com',
      photoURL: 'https://placehold.co/400x400?text=Juan'
    } as FirebaseUser;

    const mockProfile: User = {
      id: realUid,
      uid: realUid,
      name: 'Juan Dela Cruz (Demo)',
      email: 'juan.demo@example.com',
      role: 'resident',
      createdAt: new Date().toISOString(),
      status: 'approved',
      phone: '09123456789'
    };

    const mockResidentProfile: ResidentProfile = {
      ...mockProfile,
      id: realUid,
      fullName: 'Juan Dela Cruz (Demo)',
      age: 28,
      gender: 'Male',
      dob: '1996-05-20',
      civilStatus: 'Single',
      idType: 'PhilSys',
      idNumber: '1234-5678-9012',
      idPhotoUrl: 'https://placehold.co/600x400?text=ID+SKIP',
      selfieUrl: 'https://placehold.co/400x400?text=SELFIE+SKIP',
      mobileNumber: '09123456789',
      altContactName: 'Maria Dela Cruz',
      altContactNumber: '09987654321',
      houseNumber: 'Blk 12 Lot 5',
      street: 'Sampaguita St.',
      householdCount: 4,
      specialNeeds: 'No',
      specialNeedsInfo: '',
      gpsLat: 13.0641,
      gpsLng: 120.7303,
      status: 'approved',
      registeredAt: new Date().toISOString(),
      uid: realUid
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setResidentProfile(mockResidentProfile);
    setLoading(false);
  };

  const handleSetRole = async (role: UserRole) => {
    if (!user) return;
    const newProfile: Partial<User> = {
      uid: user.uid,
      name: user.displayName || 'Anonymous User',
      email: user.email || '',
      role: role,
      createdAt: new Date().toISOString(),
      status: role === 'resident' ? 'pending' : 'approved'
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile(newProfile as User);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
        <BackgroundPattern />
        <div className="relative mb-12">
           <div className="absolute inset-0 bg-emergency/20 blur-[100px] rounded-full animate-pulse" />
           <TanodLogo size={120} animated={true} className="relative z-10 filter drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]" />
        </div>
        <div className="space-y-4 relative z-10">
          <h2 className="text-2xl font-black italic tracking-tighter text-white font-mono uppercase leading-none">Initializing Link</h2>
          <div className="flex gap-1 justify-center">
            <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-emergency rounded-full" />
            <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-emergency rounded-full" />
            <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-emergency rounded-full" />
          </div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] font-mono mt-4">Establishing Secure Command Connection</p>
        </div>
      </div>
    );
  }

  // If registering, show form
  if (isRegistering) return <RegistrationForm onCancel={() => setIsRegistering(false)} onComplete={() => { setIsRegistering(false); window.location.reload(); }} />;

  // If no user, show login
  if (!user) return <LoginView onLogin={handleLogin} onRegister={() => setIsRegistering(true)} isLoggingIn={isLoggingIn} onDemoResident={handleDemoResidentLogin} />;

  // Special case: Resident Portal (Registration Flow)
  if (user && !profile && !residentProfile) return <RoleSelection onSelect={handleSetRole} onRegister={() => setIsRegistering(true)} />;

  // Resident Pending/Rejected State
  if (effectiveRole === 'resident' && profile && !viewOverride) {
    if (profile.status === 'pending') return <PendingApproval user={user} />;
    if (profile.status === 'rejected') return <RejectedScreen reason={residentProfile?.rejectionReason || 'Documents verification failed.'} />;
  }

  const items = navItems.filter(item => {
    if (effectiveRole === 'admin') return true;
    if (effectiveRole === 'tanod') {
      return !['residents', 'settings'].includes(item.id);
    }
    // Residents only see Dashboard, Map, Directory, Settings
    return ['home', 'map', 'directory', 'settings'].includes(item.id);
  });

  return (
    <div className="min-h-screen bg-brand-bg text-white font-sans flex flex-col md:flex-row h-screen overflow-hidden relative">
      <Toaster />
      <BackgroundPattern />
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-5 glass-panel border-b border-white/5 shrink-0 z-[60] shadow-command">
        <div className="flex items-center gap-3">
          <TanodLogo size={36} animated={false} />
          <span className="font-black italic tracking-tighter text-lg uppercase font-mono text-white leading-none">Brgy.TANOD <span className="text-emergency">🆘</span> ALERT</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 text-white/40 hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/5 active:scale-90"
        >
          {isMobileMenuOpen ? (
            <Plus className="w-6 h-6 rotate-45" />
          ) : (
            <div className="flex flex-col gap-1.5 w-6">
              <span className="w-full h-0.5 bg-current rounded-full"></span>
              <span className="w-2/3 h-0.5 bg-current rounded-full ml-auto"></span>
              <span className="w-full h-0.5 bg-current rounded-full"></span>
            </div>
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-brand-bg/80 backdrop-blur-md z-[55]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={cn(
        "fixed inset-y-0 left-0 w-80 glass-panel border-r border-white/5 flex flex-col shrink-0 z-[100] transition-transform duration-500 ease-out md:relative md:translate-x-0 md:w-72 shadow-command",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="absolute top-0 left-0 w-full h-full bg-brand-bg/20 -z-10" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emergency/5 blur-[100px] rounded-full" />
        
        <div className="p-10 pt-12">
          <TanodWordmark width={220} className="mx-auto filter drop-shadow-lg" />
          <div className="mt-4 flex flex-col items-center">
             <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
             <span className="text-[10px] font-black tracking-[0.4em] text-white/20 uppercase mt-4 font-mono italic">Central Command</span>
          </div>
        </div>

        <div className="flex-1 px-6 space-y-2 overflow-y-auto custom-scrollbar pt-4">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 relative group",
                  isActive 
                    ? "bg-emergency text-white shadow-glow-red scale-[1.02] italic font-black" 
                    : "text-white/40 hover:bg-white/5 hover:text-white"
                )}
              >
                {!isActive && (
                   <div className="absolute inset-y-2 left-2 w-1 bg-emergency rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-white/20 group-hover:text-white")} />
                <span className="text-xs uppercase tracking-widest font-mono">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6 mt-auto border-t border-white/5 bg-brand-bg/30">
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-brand-bg/50 mb-6 border border-white/5 shadow-inner">
            <div className="w-12 h-12 rounded-2xl bg-brand-card overflow-hidden flex items-center justify-center border border-white/5 shrink-0 shadow-lg">
              {user.email === 'rubenlleg12@gmail.com' ? (
                <img src="/ruben_avatar.jpg" referrerPolicy="no-referrer" alt="Profile" className="w-full h-full object-cover" />
              ) : user.photoURL ? (
                <img src={user.photoURL} referrerPolicy="no-referrer" alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 text-white/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate uppercase font-mono italic text-white leading-none mb-1">
                {user.email === 'rubenlleg12@gmail.com' ? 'RubenLlego' : profile?.name || 'Unknown Unit'}
              </p>
              <p className="text-[8px] text-white/30 uppercase tracking-widest font-mono font-bold">
                {user.email === 'rubenlleg12@gmail.com' ? 'SYSTEM_PRIME' : profile?.role || 'INITIATING'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)} 
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white/40 hover:text-emergency hover:bg-emergency/5 transition-all text-[10px] font-black uppercase tracking-[0.2em] font-mono border border-transparent hover:border-emergency/10"
          >
            <LogOut className="w-4 h-4" />
            SIGNOUT_SESSION
          </button>
        </div>
      </nav>

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 flex flex-col">
      <header className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-8 shrink-0 relative z-10 w-full glass-panel p-4 md:p-6 rounded-[32px] shadow-command">
          <div className="flex-1 w-full">
            <div className="flex justify-between items-start w-full">
              <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase font-mono text-white">
                {activeTab}
              </h1>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black tracking-widest text-emergency uppercase mt-1">Brgy.TANOD DashBoard Panel</span>
                <span className="text-[8px] font-mono text-white/40 uppercase tracking-[0.2em]">SECURE SYSTEM v2.4.0</span>
              </div>
            </div>
            <p className="text-white/40 text-[10px] font-bold tracking-[0.1em] uppercase mt-1 font-mono">
              Brgy.TANOD 🆘 ALERT — EMERGENCY INTELLIGENCE INFRASTRUCTURE
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            {profile?.role === 'admin' && (
              <div className="flex bg-brand-bg/50 border border-white/10 rounded-2xl overflow-hidden p-1">
                <button 
                  onClick={() => { setViewOverride(null); setActiveTab('home'); }} 
                  className={cn("px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all", !viewOverride ? "bg-emergency text-white shadow-glow-red" : "text-white/40 hover:text-white")}
                >
                  ADMIN
                </button>
                <button 
                  onClick={() => { setViewOverride('tanod'); setActiveTab('home'); }} 
                  className={cn("px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all", viewOverride === 'tanod' ? "bg-emergency text-white shadow-glow-red" : "text-white/40 hover:text-white")}
                >
                  TANOD
                </button>
                <button 
                  onClick={() => { setViewOverride('resident'); setActiveTab('home'); }} 
                  className={cn("px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all", viewOverride === 'resident' ? "bg-emergency text-white shadow-glow-red" : "text-white/40 hover:text-white")}
                >
                  CLIENT
                </button>
              </div>
            )}
            {(effectiveRole === 'tanod' || effectiveRole === 'admin') && (
              <button 
                onClick={() => setIsIncidentFormOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-emergency rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-glow-red font-black text-xs tracking-widest"
              >
                <Plus className="w-4 h-4 stroke-[3px]" /> NEW INCIDENT
              </button>
            )}
            <button className="p-3 bg-brand-card border border-white/10 rounded-2xl hover:bg-brand-card/80 relative transition-all group">
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {alerts.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emergency border-2 border-brand-bg rounded-full animate-ping"></span>}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex-1">
            {activeTab === 'home' && effectiveProfile && (
              <DashboardView profile={effectiveProfile} alerts={alerts} patrols={patrols} onTabChange={setActiveTab} isOnline={isOnline} />
            )}
            {activeTab === 'map' && (
              <div className="h-full min-h-[500px] flex flex-col gap-4">
                <div className="bg-[#16191F] p-4 rounded-xl border border-[#2D3139] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold font-mono uppercase">Global Area Map</h3>
                    <p className="text-xs text-[#8E9299]">Live view of all emergency alerts and active patrols</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-black tracking-widest text-[#8E9299]">
                    <div className="flex items-center gap-2"><span className="text-base">🔴</span> RESIDENT SOS</div>
                    <div className="flex items-center gap-2"><span className="text-base">🟢</span> TANOD ON DUTY</div>
                  </div>
                </div>
                <ActiveMap alerts={alerts} patrols={patrols} />
              </div>
            )}
            {activeTab === 'tracker' && (
              <div className="h-full min-h-[500px] flex flex-col gap-4">
                <div className="bg-[#16191F] p-4 rounded-xl border border-[#2D3139] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold font-mono uppercase">Live GPS Tracker</h3>
                    <p className="text-xs text-[#8E9299]">Real-time Tanod-to-Citizen streaming via WebSockets/Firebase</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-black tracking-widest text-[#8E9299]">
                    <div className="flex items-center gap-2"><span className="text-base">🔴</span> RESIDENT SOS</div>
                    <div className="flex items-center gap-2"><span className="text-base">🟢</span> TANOD ON DUTY</div>
                  </div>
                </div>
                <LiveMap />
              </div>
            )}
            {activeTab === 'residents' && effectiveRole === 'admin' && effectiveProfile && <AdminResidents profile={effectiveProfile} />}
            {activeTab === 'directory' && <DirectoryView />}
            {activeTab === 'schedule' && effectiveProfile && <ScheduleView role={effectiveRole as any} profile={effectiveProfile} />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'roster' && <TanodRosterView />}
          </motion.div>
        </AnimatePresence>

        {isIncidentFormOpen && effectiveProfile && (
          <IncidentForm profile={effectiveProfile} onClose={() => setIsIncidentFormOpen(false)} />
        )}
        {effectiveProfile && effectiveRole === 'tanod' && <TanodCommandAlert profile={effectiveProfile} isTestMode={viewOverride === 'tanod'} />}
        <BackgroundServices />
      </main>
    </div>
  );
}

function RejectedScreen({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <BackgroundPattern />
      <div className="w-24 h-24 bg-emergency/10 rounded-full flex items-center justify-center mb-8 border border-emergency/30 shadow-glow-red animate-pulse">
        <X className="w-12 h-12 text-emergency" />
      </div>
      <h2 className="text-4xl font-black italic tracking-tighter mb-4 text-white uppercase font-mono">ACCESS DENIED</h2>
      <p className="text-white/40 max-w-md mb-8 text-lg font-bold uppercase tracking-widest font-mono">Account clearance rejected by administration</p>
      
      <div className="glass-panel border-emergency/20 p-8 rounded-[40px] w-full max-w-md mb-12 shadow-glow-red">
        <p className="text-[10px] font-black uppercase text-emergency tracking-[0.3em] mb-4 font-mono">Reason for rejection</p>
        <p className="text-white font-bold italic text-lg font-mono leading-relaxed">"{reason}"</p>
      </div>

      <button 
        onClick={() => auth.signOut()}
        className="px-12 py-5 bg-brand-card border border-white/10 text-white font-black italic rounded-2xl hover:bg-brand-bg hover:border-emergency transition-all shadow-xl font-mono tracking-widest uppercase"
      >
        TERMINATE SESSION
      </button>
    </div>
  );
}

function PendingApproval({ user }: { user: FirebaseUser }) {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <BackgroundPattern />
      <div className="w-24 h-24 bg-caution/10 rounded-[32px] flex items-center justify-center mb-8 border border-caution/30 shadow-lg animate-pulse">
        <Clock className="w-12 h-12 text-caution" />
      </div>
      <h1 className="text-4xl font-black italic tracking-tighter mb-4 text-white uppercase font-mono">CLEARANCE PENDING</h1>
      <p className="text-white/40 max-w-md mb-12 text-lg font-bold uppercase tracking-widest font-mono">Profile Verification in Progress</p>
      
      <div className="glass-panel border-white/5 p-8 rounded-[40px] w-full max-w-md mb-12">
        <p className="text-white/60 text-sm leading-relaxed font-medium">
          Resident profile for <span className="text-white font-black italic">{user.displayName}</span> is under evaluation. Automated SMS dispatch will trigger upon approval.
        </p>
      </div>

      <button 
        onClick={() => signOut(auth)} 
        className="px-12 py-5 bg-brand-card border border-white/10 text-white font-black italic rounded-2xl hover:bg-brand-bg hover:border-caution transition-all shadow-xl font-mono tracking-widest uppercase flex items-center gap-3"
      >
        <LogOut className="w-5 h-5 text-caution" /> Sign Out
      </button>
    </div>
  );
}

const navItems = [
  { id: 'home', label: '📡 Command', icon: LayoutDashboard },
  { id: 'map', label: '🗺 Map', icon: MapIcon },
  { id: 'tracker', label: '📍 Live GPS', icon: Navigation },
  { id: 'residents', label: '👥 Residents', icon: Users },
  { id: 'roster', label: '👮 Tanods', icon: Shield },
  { id: 'schedule', label: '📅 Schedule', icon: Clock },
  { id: 'reports', label: '📜 Reports', icon: FileText },
  { id: 'directory', label: '🆘 SOS Help', icon: Phone },
  { id: 'settings', label: '⚙️ Config', icon: SettingsIcon },
];

function LoginView({ onLogin, onRegister, isLoggingIn, onDemoResident }: { onLogin: () => void, onRegister: () => void, isLoggingIn: boolean, onDemoResident: () => void }) {
  const handleRegister = async () => {
    try {
      await onLogin();
      onRegister();
    } catch (error) {
      console.error('Login failed during registration flow:', error);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <BackgroundPattern />
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-emergency/20 blur-[100px] rounded-full animate-pulse" />
        <TanodLogo size={180} className="relative z-10 drop-shadow-[0_0_30px_rgba(255,75,75,0.3)]" />
      </div>
      
      <h1 className="text-6xl font-black tracking-tighter mb-4 text-white z-10 font-mono italic">
        BRGY.<span className="text-emergency">TANOD</span> S.O.S
      </h1>
      <p className="text-white/40 max-w-sm mb-16 text-lg z-10 font-bold uppercase tracking-[0.2em] font-mono leading-tight">
        TACTICAL COMMUNITY RESPONSE NETWORK
      </p>

      <div className="space-y-4 w-full max-w-xs z-10">
        <button 
          disabled={isLoggingIn}
          onClick={onLogin}
          className="w-full bg-white text-black font-black py-6 rounded-3xl flex items-center justify-center gap-3 hover:bg-[#E2E2E2] active:scale-95 transition-all shadow-2xl disabled:opacity-50 uppercase tracking-widest font-mono text-sm italic"
        >
          {isLoggingIn ? (
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          )}
          {isLoggingIn ? 'Establishing...' : 'Authenticate Unit'}
        </button>
        
        <button 
          disabled={isLoggingIn}
          onClick={handleRegister}
          className="w-full glass-panel border-white/10 text-white font-black py-6 rounded-3xl hover:bg-white/5 transition-all disabled:opacity-50 uppercase tracking-widest font-mono text-xs"
        >
          Resident Registration
        </button>

        <div className="pt-8 relative">
           <div className="absolute left-0 right-0 top-12 h-px bg-white/5" />
           <button 
             disabled={isLoggingIn}
             onClick={onDemoResident}
             className="w-full bg-emergency/10 border border-emergency/30 text-emergency font-black py-5 rounded-2xl hover:bg-emergency/20 transition-all shadow-glow-red disabled:opacity-50 uppercase tracking-widest font-mono text-[10px] italic flex items-center justify-center gap-2"
           >
             <span className="animate-pulse">✨</span> PREVIEW RESIDENT MODE
           </button>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-[10px] font-black text-white/10 uppercase tracking-[0.5em] font-mono">
        System Ver 4.2.0 • Encryption Active
      </div>
    </div>
  );
}

function RoleSelection({ onSelect, onRegister }: { onSelect: (role: UserRole) => void, onRegister: () => void }) {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <BackgroundPattern />
      <h2 className="text-4xl font-black italic tracking-tighter mb-2 text-white uppercase font-mono z-10">ASSIGNMENT</h2>
      <p className="text-white/40 text-lg mb-16 uppercase tracking-[0.3em] font-mono z-10">Select operational profile</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
        <RoleCard 
          title="Resident Portal" 
          desc="Standard access for profile management and SOS alerts." 
          icon={UserIcon} 
          onClick={onRegister}
          color="emergency"
        />
        <RoleCard 
          title="Tanod Officer" 
          desc="Tactical response unit and incident management interface." 
          icon={Shield} 
          onClick={() => onSelect('tanod')}
          color="info"
        />
      </div>
    </div>
  );
}

function RoleCard({ title, desc, icon: Icon, onClick, color }: any) {
  const isEmergency = color === 'emergency';
  return (
    <button 
      onClick={onClick} 
      className="p-12 glass-panel border-white/5 rounded-[48px] hover:border-white/20 hover:bg-white/5 transition-all text-left group active:scale-95 flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl group-hover:bg-white/10 transition-colors" />
      
      <div className={cn(
        "w-20 h-20 rounded-3xl flex items-center justify-center mb-10 transition-all shadow-xl group-hover:scale-110",
        isEmergency ? "bg-emergency text-white sos-glow" : "bg-info text-white shadow-info/20"
      )}>
        <Icon className="w-10 h-10" />
      </div>
      <h3 className="text-3xl font-black mb-4 text-white italic tracking-tighter font-mono uppercase leading-none">{title}</h3>
      <p className="text-white/40 text-base leading-relaxed font-bold uppercase tracking-tight font-mono">{desc}</p>
    </button>
  );
}

function ResidentDashboard({ profile, patrols, isOnline }: { profile: User, patrols: PatrolLocation[], isOnline: boolean }) {
  const [sending, setSending] = useState(false);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [sosTypeToSubmit, setSosTypeToSubmit] = useState<EmergencyType | null>(null);
  const [isChoosingCategory, setIsChoosingCategory] = useState(false);
  const [sosDescription, setSosDescription] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'alerts'), 
      where('residentId', '==', profile.uid),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as Omit<Alert, 'id'>;
        if (data.status !== 'resolved') {
          setActiveAlert({ id: snapshot.docs[0].id, ...data } as Alert);
        } else {
          setActiveAlert(null);
        }
      }
    });
  }, [profile.uid]);

  const handleSOS = async (type: EmergencyType = 'other', description: string) => {
    setSosTypeToSubmit(null);
    setSosDescription('');
    setSending(true);
    try {
      // 1. Get GPS with fallback
      let pos: GeolocationPosition | null = null;
      try {
        pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { 
            enableHighAccuracy: true, 
            timeout: 5000, 
            maximumAge: 0 
          })
        );
      } catch (gpsErr) {
        console.warn('GPS failed, proceeding with empty location', gpsErr);
      }

      // 2. AI Analysis (optional for speed)
      let aiAnalysis = { incidentType: type, severity: 'high', priority: 1, action: 'dispatch' };
      try {
        aiAnalysis = await analyzeIncident(description || `Emergency ${type} alert.`, type) as any;
      } catch (aiErr) {
        console.warn('AI analysis failed', aiErr);
      }
      
      const locationObj: any = pos ? { 
        lat: pos.coords.latitude, 
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      } : { lat: 0, lng: 0 }; // Fallback to placeholder or last known if we had a persistent state

      const alertId = crypto.randomUUID();
      const alertData: any = {
        id: alertId,
        residentId: profile?.uid || '',
        residentName: profile?.name || 'Unknown Resident',
        type: (aiAnalysis.incidentType?.toLowerCase() || type) as any,
        location: locationObj,
        status: 'pending',
        timestamp: new Date().toISOString(),
        aiAnalysis: aiAnalysis
      };
      
      if (profile?.phone) alertData.residentMobile = profile.phone;
      if (description) alertData.customMessage = description;
      
      // 3. Offline-Aware Save
      if (isOnline) {
        await setDoc(doc(db, 'alerts', alertId), alertData);
        
        // Parallel Save to Supabase (Upsert for robustness)
        try {
          await supabase.from('incidents').upsert([{
            id: alertId,
            type: alertData.type,
            status: alertData.status,
            lat: alertData.location.lat,
            lng: alertData.location.lng,
            tanod_id: null
          }]);
        } catch (supaErr) {
          console.error('Supabase save failed:', supaErr);
        }
      } else {
        queueSOS(alertData);
        toast.error('Offline Mode: Alert queued for sync.', { icon: '📡' });
      }
    } catch (err) {
      console.error('Fatal SOS error:', err);
      toast.error('Critical failure. Please call hotlines directly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 relative">
      <AnimatePresence>
        {activeAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel border-emergency/50 rounded-[40px] p-8 shadow-glow-red overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-emergency/20 overflow-hidden">
               <motion.div 
                 animate={{ x: ['-100%', '100%'] }}
                 transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                 className="w-1/2 h-full bg-emergency shadow-glow-red"
               />
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 bg-emergency rounded-[28px] flex items-center justify-center relative sos-glow">
                  <TanodLogo size={56} animated={false} className="z-10" />
                  <div className="absolute inset-0 bg-emergency rounded-[28px] blur-2xl opacity-40 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-2xl font-black italic tracking-tighter text-white uppercase font-mono leading-tight">Emergency Incident Live</h4>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] bg-emergency px-2 py-0.5 rounded-full font-black tracking-widest uppercase">ACTIVE SOS</span>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] font-mono">
                      {activeAlert.type} • T+{Math.floor((Date.now() - new Date(activeAlert.timestamp).getTime()) / 60000)}m reported
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 max-w-lg w-full">
                <div className="relative h-3 bg-brand-bg rounded-full overflow-hidden mb-3 border border-white/5">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: activeAlert.status === 'pending' ? '33.33%' : 
                             activeAlert.status === 'responding' ? '66.66%' : '100%' 
                    }}
                    className="absolute top-0 left-0 h-full bg-emergency shadow-[0_0_15px_rgba(255,59,48,0.5)]"
                  />
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.3em] font-mono">
                  <span className={activeAlert.status === 'pending' ? 'text-emergency' : 'text-white/20'}>[Alert Sent]</span>
                  <span className={activeAlert.status === 'responding' ? 'text-emergency' : 'text-white/20'}>[Unit En Route]</span>
                  <span className={activeAlert.status === 'resolved' ? 'text-success' : 'text-white/20'}>[Resolved]</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setCancellingId(activeAlert.id)}
                  className="px-8 py-4 bg-brand-bg border border-white/10 text-white/60 text-xs font-black rounded-2xl hover:text-white hover:border-emergency/50 transition-all uppercase tracking-widest active:scale-95 group"
                >
                  <span className="group-hover:text-emergency transition-colors">Abort SOS Protocol</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!activeAlert && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel border-white/5 rounded-[48px] p-8 md:p-16 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-emergency/10 blur-[120px] -mr-48 -mt-48 transition-all group-hover:bg-emergency/20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-info/5 blur-[100px] -ml-32 -mb-32"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 italic text-white uppercase font-mono leading-none">Command Ready</h2>
            <p className="text-white/40 max-w-lg text-lg mb-16 font-medium leading-relaxed">
              Immediate connection to the Barangay Emergency Network. <span className="text-white font-bold italic">Push to neutralize risk.</span>
            </p>
            
            <button 
              disabled={sending}
              onClick={() => setIsChoosingCategory(true)}
              className={cn(
                "relative w-64 h-64 md:w-80 md:h-80 rounded-full flex flex-col items-center justify-center gap-4 transition-all duration-700 shadow-glow-red group active:scale-90",
                sending ? "bg-emergency/50 scale-95" : "bg-emergency hover:bg-emergency/90"
              )}
            >
              <div className="absolute inset-0 bg-emergency rounded-full filter blur-[40px] opacity-20 animate-pulse group-hover:opacity-40 transition-opacity"></div>
              <div className="absolute inset-4 border-[1px] border-white/20 rounded-full border-dashed animate-[spin_10s_linear_infinite] opacity-50"></div>
              
              <div className="z-10 group-hover:scale-110 transition-transform duration-500">
                <TanodLogo size={140} animated={!sending} className="drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
              </div>
              
              <span className="z-10 text-2xl font-black italic tracking-tighter text-white font-mono mt-2">
                {sending ? 'COMM LINK...' : 'INITIATE SOS'}
              </span>

              {/* Ping Ring */}
              <div className="absolute inset-0 rounded-full border-4 border-emergency/30 animate-[ping_2s_infinite]"></div>
            </button>
          </div>
        </motion.div>
      )}

      <div className="bg-[#16191F] border border-[#2D3139] rounded-[32px] md:rounded-[40px] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="font-bold text-xl flex items-center gap-2 text-white uppercase italic tracking-tighter">
            <MapIcon className="w-5 h-5 text-[#FF4B4B]" /> LIVE PATROL STATUS
          </h3>
          <div className="flex items-center gap-4 text-xs font-black tracking-widest text-[#8E9299]">
            <div className="flex items-center gap-2"><span className="text-base">🔴</span> RESIDENT SOS</div>
            <div className="flex items-center gap-2"><span className="text-base">🟢</span> TANOD ON DUTY</div>
          </div>
        </div>
        <div className="h-64 rounded-[30px] overflow-hidden border border-[#2D3139]">
          <ActiveMap alerts={activeAlert ? [activeAlert] : []} patrols={patrols} />
        </div>
        <p className="text-[#8E9299] text-xs mt-4 text-center">There are {patrols.length} Tanod units currently patrolling the Barangay.</p>
      </div>

      <div>
        <h3 className="font-bold text-xl mb-6 text-white uppercase italic tracking-tighter">Emergency Hotlines</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'PNP', number: '117', color: 'bg-blue-500' },
            { name: 'FIRE', number: '911', color: 'bg-orange-500' },
            { name: 'RESCUE', number: '0917-SOS', color: 'bg-[#FF4B4B]' },
            { name: 'HALL', number: '123-4567', color: 'bg-green-500' },
          ].map(c => (
            <button 
              key={c.name} 
              onClick={() => window.location.href = `tel:${c.number}`}
              className="flex flex-col items-center gap-2 p-6 bg-[#16191F] border border-[#2D3139] rounded-[32px] hover:border-white/20 transition-all group"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-lg", c.color)}>
                <Phone className="w-6 h-6 text-white" />
              </div>
              <p className="text-[10px] font-black text-[#8E9299] uppercase tracking-widest leading-none">{c.name}</p>
              <p className="text-sm font-black text-white italic tracking-tighter">{c.number}</p>
            </button>
          ))}
        </div>
      </div>

      <RecentAlerts residentId={profile.uid} />

      {/* SOS Category Modal */}
      <AnimatePresence>
        {isChoosingCategory && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16191F] border border-[#2D3139] w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-6"
            >
              <h3 className="font-black italic text-xl md:text-2xl tracking-tighter text-white mb-2 uppercase text-center">Select Emergency</h3>
              <p className="text-[#8E9299] text-xs font-medium mb-6 text-center">What is the nature of the emergency?</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {(['medical', 'fire', 'crime', 'flood'] as EmergencyType[]).map(type => {
                  const getIcon = (t: string) => {
                    switch(t) {
                      case 'medical': return '🏥';
                      case 'fire': return '🔥';
                      case 'crime': return '🚨';
                      case 'flood': return '🌊';
                      default: return '⚠️';
                    }
                  };
                  return (
                     <button 
                      key={type}
                      onClick={() => { setIsChoosingCategory(false); setSosTypeToSubmit(type); }}
                      className="p-6 bg-[#0F1115] border border-[#2D3139] rounded-3xl hover:bg-[#1A1D23] hover:border-[#FF4B4B] transition-all group flex flex-col items-center"
                    >
                      <div className="w-16 h-16 bg-[#252932] rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#FF4B4B] transition-colors text-3xl">
                        <span>{getIcon(type)}</span>
                      </div>
                      <p className="text-sm font-black uppercase text-[#8E9299] tracking-widest group-hover:text-white">{type}</p>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsChoosingCategory(false)}
                  className="flex-1 py-4 bg-[#252932] text-white font-black rounded-2xl hover:bg-[#2D3139] transition-all text-sm uppercase italic tracking-tighter"
                >
                  Cancel Tracking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SOS Description Modal */}
      <AnimatePresence>
        {sosTypeToSubmit && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16191F] border border-[#2D3139] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-6"
            >
              <h3 className="font-black italic text-xl md:text-2xl tracking-tighter text-white mb-2 uppercase">Describe Emergency</h3>
              <p className="text-[#8E9299] text-xs font-medium mb-6">Briefly describe the situation to help Tanods prepare properly.</p>
              
              <textarea 
                value={sosDescription}
                onChange={(e) => setSosDescription(e.target.value)}
                placeholder="e.g. Accident near gate, Fire in kitchen"
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white placeholder-[#8E9299] mb-6 focus:outline-none focus:border-[#FF4B4B] min-h-[120px]"
              />
              
              <div className="flex gap-3">
                <button 
                  onClick={() => { setSosTypeToSubmit(null); setSosDescription(''); }}
                  className="flex-1 py-3 bg-[#252932] text-white font-bold rounded-xl hover:bg-[#2D3139] transition-all text-sm uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSOS(sosTypeToSubmit, sosDescription)}
                  className="flex-1 py-3 bg-[#FF4B4B] text-white font-bold rounded-xl hover:bg-red-700 transition-all text-sm uppercase"
                >
                  Send Alert
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel SOS Modal */}
      <AnimatePresence>
        {cancellingId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16191F] border border-[#2D3139] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-6"
            >
              <h3 className="font-black italic text-xl md:text-2xl tracking-tighter text-white mb-6 uppercase text-center">Cancel Alert?</h3>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setCancellingId(null)}
                  className="flex-1 py-3 bg-[#252932] text-white font-bold rounded-xl hover:bg-[#2D3139] transition-all text-sm uppercase"
                >
                  No, Keep SOS
                </button>
                <button 
                  onClick={async () => {
                    await updateDoc(doc(db, 'alerts', cancellingId), { status: 'cancelled' });
                    setCancellingId(null);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all text-sm uppercase"
                >
                  Yes, Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecentAlerts({ residentId }: { residentId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'alerts'),
      where('residentId', '==', residentId),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    return onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Alert)));
    });
  }, [residentId]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-6">
      <h3 className="font-bold text-xl text-white uppercase italic tracking-tighter">My Recent Alerts</h3>
      <div className="space-y-4">
        {alerts.map(alert => (
          <div key={alert.id} className="bg-[#16191F] border border-[#2D3139] p-6 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#252932] rounded-xl flex items-center justify-center">
                <AlertTriangle className={cn("w-5 h-5", alert.status === 'pending' ? 'text-red-500' : 'text-[#8E9299]')} />
              </div>
              <div>
                <p className="text-white font-bold text-sm uppercase tracking-tight">{alert.type} Emergency</p>
                <p className="text-[10px] text-[#8E9299] font-bold uppercase tracking-widest">{new Date(alert.timestamp).toLocaleString()}</p>
              </div>
            </div>
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
              alert.status === 'pending' ? "bg-red-500/10 text-red-500" :
              alert.status === 'responding' ? "bg-blue-500/10 text-blue-500" :
              "bg-green-500/10 text-green-500"
            )}>
              {alert.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardView({ profile, alerts, patrols, onTabChange, isOnline }: { profile: User, alerts: Alert[], patrols: PatrolLocation[], onTabChange: (tab: string) => void, isOnline: boolean }) {
  if (profile.role === 'resident') return <ResidentDashboard profile={profile} patrols={patrols} isOnline={isOnline} />;
  if (profile.role === 'tanod') return <TanodDashboard profile={profile} onTabChange={onTabChange} />;
  if (profile.role === 'admin') return <AdminDashboard profile={profile} onTabChange={onTabChange} />;
  return <div className="text-center p-12 text-[#8E9299]">Unauthorized Access</div>;
}


function DirectoryView() {
  const contacts = [
    { name: 'PNP HOTLINE', number: '117', icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'FIRE STATION', number: '911', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { name: 'BARANGAY HALL', number: '8-123-4567', icon: Phone, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'RESCUE', number: '0917-SOS-BRGY', icon: Bell, color: 'text-[#FF4B4B]', bg: 'bg-[rgba(255,75,75,0.1)]' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {contacts.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.name} className="p-6 md:p-8 bg-[#16191F] border border-[#2D3139] rounded-[32px] md:rounded-[40px] flex flex-col md:flex-row justify-between items-center hover:border-white/20 transition-all shadow-xl group gap-6 md:gap-0">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 text-center md:text-left">
               <div className={cn("p-6 rounded-[30px] group-hover:scale-110 transition-transform", c.bg, c.color)}>
                  <Icon className="w-8 h-8 md:w-8 md:h-8" />
               </div>
               <div>
                  <h4 className="font-extrabold text-[#8E9299] text-[10px] md:text-xs tracking-widest">{c.name}</h4>
                  <p className="text-2xl md:text-3xl font-black italic text-white mt-1 tracking-tighter">{c.number}</p>
               </div>
            </div>
            <button 
              onClick={() => {
                try {
                  window.location.href = `tel:${c.number.replace(/-/g, '')}`;
                } catch(e) {
                  window.open(`tel:${c.number.replace(/-/g, '')}`, '_top');
                }
              }}
              className="w-full md:w-auto p-4 md:p-5 flex items-center justify-center bg-white rounded-2xl hover:bg-[#FF4B4B] hover:text-white text-black transition-all active:scale-95 shadow-2xl"
            >
               <Phone className="w-6 h-6 md:w-8 md:h-8" />
               <span className="ml-2 font-bold md:hidden">CALL</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TanodRosterView() {
  const [tanods, setTanods] = useState<User[]>([]);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitEmail, setNewUnitEmail] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'tanod'));
    return onSnapshot(q, (snap) => {
      setTanods(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
  }, []);

  const handleAddUnit = async () => {
    if (!newUnitName.trim() || !newUnitEmail.trim()) return;
    try {
      await addDoc(collection(db, 'users'), {
        uid: Date.now().toString(),
        name: newUnitName,
        email: newUnitEmail,
        role: 'tanod',
        status: 'approved',
        createdAt: new Date().toISOString()
      });
      setAddingUnit(false);
      setNewUnitName('');
      setNewUnitEmail('');
    } catch (e) {
      console.error(e);
      alert('Error adding unit');
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-panel p-8 md:p-12 rounded-[48px] border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-command">
        <div>
          <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-white font-mono leading-none">Tanod Roster</h2>
          <p className="text-white/40 font-bold text-xs md:text-sm uppercase tracking-[0.3em] font-mono mt-3">Tactical Peacekeeping Force Inventory</p>
        </div>
        <button 
          onClick={() => setAddingUnit(true)}
          className="w-full md:w-auto justify-center px-10 py-5 bg-emergency text-white font-black italic rounded-2xl hover:scale-105 transition-all flex items-center gap-3 text-xs shadow-glow-red font-mono tracking-widest uppercase">
          <Plus className="w-5 h-5 text-white" /> REGISTER UNIT
        </button>
      </div>

      <AnimatePresence>
        {addingUnit && (
          <div className="fixed inset-0 bg-brand-bg/90 backdrop-blur-md z-[9999] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 20 }}
              className="glass-panel border-white/10 w-full max-w-lg rounded-[48px] overflow-hidden shadow-command flex flex-col p-10 md:p-14 relative"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emergency/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
              
              <h3 className="font-black italic text-2xl md:text-3xl tracking-tighter text-white mb-4 uppercase font-mono leading-none">Initialize New Unit</h3>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-10 font-mono">Deploy authorized personnel to the network</p>
              
              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase mb-2 block font-mono">Operator Identity</label>
                  <input 
                    type="text"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Officer Cruz"
                    className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 text-white placeholder-white/10 focus:outline-none focus:border-emergency/50 font-mono font-bold italic"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase mb-2 block font-mono">Communication Link (Email)</label>
                  <input 
                    type="email"
                    value={newUnitEmail}
                    onChange={(e) => setNewUnitEmail(e.target.value)}
                    placeholder="unit_alpha@brgy.gov"
                    className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 text-white placeholder-white/10 focus:outline-none focus:border-emergency/50 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setAddingUnit(false)}
                  className="flex-1 py-5 glass-panel border-white/10 text-white/40 font-black rounded-2xl hover:bg-white/5 transition-all text-xs uppercase font-mono tracking-widest"
                >
                  ABORT
                </button>
                <button 
                  onClick={handleAddUnit}
                  className="flex-1 py-5 bg-emergency text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase font-mono tracking-widest italic shadow-glow-red"
                >
                  CONFIRM DEPLOYMENT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tanods.map((t) => (
          <div key={t.uid} className="glass-panel border-white/5 rounded-[40px] p-8 relative overflow-hidden group hover:border-white/10 transition-all shadow-command">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 transition-all group-hover:bg-success/15"></div>
            
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 bg-brand-card rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-success/30 transition-colors shadow-lg">
                <TanodLogo size={44} animated={false} className="drop-shadow-lg" />
              </div>
              <div className="min-w-0">
                <h4 className="text-2xl font-black italic tracking-tighter text-white truncate uppercase font-mono leading-none mb-1">{t.name}</h4>
                <p className="font-mono text-white/30 text-[9px] uppercase font-bold tracking-[0.2em]">{t.id || `UNIT-${t.uid.slice(0, 4).toUpperCase()}`}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-4 bg-brand-bg/50 rounded-2xl border border-white/5">
                <span className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] font-mono">Deployment Status</span>
                <span className="flex items-center gap-2 text-[10px] font-black uppercase text-success italic font-mono">
                   <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse shadow-glow-success" />
                   ACTIVE_DUTY
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-brand-bg/50 rounded-2xl border border-white/5">
                <span className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] font-mono">Assigned Sector</span>
                <span className="text-[10px] font-black uppercase text-white italic font-mono">QUADRANT_ALPHA</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => alert(`Accessing tactical profile for ${t.name}`)}
                className="flex-1 py-4 glass-panel border-white/10 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:border-white/30 rounded-2xl transition-all font-mono">
                Logistics
              </button>
              <button 
                onClick={() => alert(`Retrieving operational history for ${t.name}`)}
                className="flex-1 py-4 glass-panel border-white/10 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:border-white/30 rounded-2xl transition-all font-mono">
                History
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleView({ role, profile }: { role: UserRole, profile: User | null }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('startTime', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (role === 'admin') return <PatrolScheduler profile={profile} />;

  return (
    <div className="glass-panel border-white/5 rounded-[48px] p-8 md:p-14 shadow-command max-w-5xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-info/5 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" />
      
      <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter mb-12 border-l-8 border-emergency pl-8 uppercase font-mono text-white leading-none">
        OPERATIONAL DEPLOYMENT
      </h3>
      
      {loading ? (
        <div className="py-24 text-center animate-pulse text-white/20 font-mono font-bold tracking-widest">ESTABLISHING DATA LINK...</div>
      ) : (
        <div className="space-y-6 md:space-y-8 relative z-10">
          {shifts.map((s) => {
            const isActive = s.status === 'active';
            return (
              <div key={s.id} className={cn(
                "p-8 md:p-12 glass-panel rounded-[40px] border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 transition-all group",
                isActive && "bg-info/5 border-info/30 shadow-info/10"
              )}>
                <div className="text-center md:text-left flex-1">
                  <div className="flex items-center justify-center md:justify-start gap-4 mb-3">
                    <p className={cn("text-[10px] font-black tracking-[0.3em] font-mono", isActive ? "text-info" : "text-white/20")}>
                      T-MINUS {format(new Date(s.startTime), 'HH:mm')} - {format(new Date(s.endTime), 'HH:mm')}
                    </p>
                    {isActive && (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-info rounded-full animate-ping shadow-info/50" />
                        <span className="text-[9px] font-black text-info font-mono uppercase tracking-widest">LIVE_STATUS</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-2xl md:text-4xl font-black tracking-tighter mb-3 italic text-white uppercase font-mono leading-none">{s.sector}</h4>
                  <p className="text-white/40 font-bold uppercase tracking-widest font-mono text-xs flex items-center justify-center md:justify-start gap-3">
                    <UserIcon className="w-5 h-5 text-info/50" /> OFFICER {s.tanodName.toUpperCase()}
                  </p>
                </div>
                <div className={cn(
                  "w-full md:w-auto px-10 py-5 rounded-2xl text-[10px] font-black tracking-[0.3em] border border-white/5 text-center font-mono italic",
                  isActive ? "bg-info text-white shadow-lg" : "bg-brand-card text-white/20"
                )}>
                  {isActive ? 'PATROL_OPERATIONAL' : s.status.toUpperCase()}
                </div>
              </div>
            );
          })}

          {shifts.length === 0 && (
            <div className="py-24 text-center text-white/10 italic font-mono font-bold tracking-[0.2em] bg-white/5 rounded-[40px] border border-dashed border-white/10 uppercase">
              No tactical shifts scheduled for current cycle.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportsView() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Incidents Reports listener error:", error);
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-8">
      <div className="glass-panel p-8 md:p-12 rounded-[48px] border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-command">
        <div className="min-w-0">
          <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-white font-mono leading-none">Incident Vault</h2>
          <p className="text-white/30 font-bold text-xs md:text-sm uppercase tracking-[0.3em] font-mono mt-3">Archived Tactical Response Intelligence</p>
        </div>
        <button 
          onClick={() => {
            const csv = "id,type,date,status,citizen,location\n" + (reports.map(r => `${r.id},${r.type},${r.date},${r.status},${r.citizen},"${r.location}"`).join('\n'));
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `incident_audit_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
          }}
          className="w-full md:w-auto justify-center px-10 py-5 glass-panel border-white/10 text-white font-black italic rounded-2xl hover:bg-white/5 transition-all flex items-center gap-3 text-xs font-mono tracking-widest uppercase"
        >
          <FileText className="w-5 h-5 text-info" /> DL_DATA_TRANSCRIPT
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {reports.map((report) => (
          <div key={report.id} className="glass-panel border-white/5 rounded-[40px] p-8 md:p-10 space-y-8 shadow-command relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl group-hover:bg-white/10 transition-colors" />
            
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-brand-card rounded-2xl flex items-center justify-center border border-white/5 shadow-lg">
                  <Shield className="w-8 h-8 text-emergency/50" />
                </div>
                <div>
                  <h4 className="font-black text-[9px] text-emergency uppercase tracking-[0.4em] mb-2 font-mono">FILE_RECORD</h4>
                  <p className="text-2xl font-black text-white italic tracking-tighter uppercase font-mono leading-none">{report.type}</p>
                </div>
              </div>
              <span className="px-4 py-1.5 bg-success/10 border border-success/30 text-success text-[10px] font-black rounded-full uppercase font-mono italic tracking-widest">{report.status}</span>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="p-6 bg-brand-bg/50 rounded-3xl border border-white/5">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3 font-mono">Mission Narrative</p>
                <p className="font-bold text-[15px] leading-relaxed text-caution font-mono italic">"{report.description}"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {report.adminOnDuty && (
                  <div className="col-span-2 p-5 bg-brand-bg/50 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 font-mono">Command Admin</p>
                    <p className="text-xs font-black text-white uppercase font-mono italic tracking-tight">{report.adminOnDuty}</p>
                  </div>
                )}
                <div className="p-5 bg-brand-bg/50 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 font-mono">Field Operator</p>
                  <p className="text-xs font-black text-white uppercase font-mono italic tracking-tight">{report.tanodName}</p>
                </div>
                <div className="p-5 bg-brand-bg/50 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 font-mono">Time Index</p>
                  <p className="text-xs font-black text-white uppercase font-mono italic tracking-tight">{report.date} • {report.time}</p>
                </div>
                {report.respondedAt && report.resolvedAt && (
                  <div className="col-span-2 p-6 bg-info/5 border border-info/20 rounded-3xl flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                       <p className="text-[9px] font-black text-info uppercase tracking-[0.3em] font-mono">Response Duration</p>
                       <p className="text-base font-black text-white uppercase font-mono italic">
                         {(() => {
                           const start = new Date(report.respondedAt).getTime();
                           const end = new Date(report.resolvedAt).getTime();
                           const mins = Math.round((end - start) / 60000);
                           if (mins < 1) return '< 1M';
                           if (mins < 60) return `${mins}M`;
                           const hrs = Math.floor(mins / 60);
                           const hMins = mins % 60;
                           return `${hrs}H ${hMins}M`;
                         })()}
                       </p>
                     </div>
                     <div className="flex justify-between items-center text-[9px] text-info/50 font-black uppercase tracking-widest font-mono">
                       <span>IN: {new Date(report.respondedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <span>OUT: {new Date(report.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex flex-col gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-white/20" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] font-mono italic truncate">{report.location}</p>
              </div>
              {report.gpsLocation && (
                <div className="h-24 rounded-2xl overflow-hidden border border-white/10 opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all">
                  <ReportMap lat={report.gpsLocation.lat} lng={report.gpsLocation.lng} />
                </div>
              )}
            </div>
          </div>
        ))}

        {reports.length === 0 && !loading && (
          <div className="col-span-full py-40 text-center glass-panel border-dashed border-white/10 rounded-[48px]">
            <FileText className="w-20 h-20 text-white/5 mx-auto mb-8" />
            <p className="text-white/20 font-black uppercase tracking-[0.4em] font-mono text-xs italic">Secure vault is empty. No files detected.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView() {
  const [brgyName, setBrgyName] = useState('Brgy. San Jose');
  const [phone, setPhone] = useState('0912-345-6789');

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="glass-panel border-white/5 rounded-[48px] p-8 md:p-14 shadow-command relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-info/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <h3 className="text-3xl font-black mb-12 italic tracking-tighter uppercase text-white font-mono leading-none">System Core Config</h3>
        
        <div className="space-y-8 relative z-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] font-mono ml-2">Barangay Identification</label>
            <input 
              type="text" 
              value={brgyName}
              onChange={(e) => setBrgyName(e.target.value)}
              className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 text-white focus:border-emergency/50 outline-none font-mono font-bold" 
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] font-mono ml-2">Emergency Hotline Terminal</label>
            <input 
              type="text" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 text-white focus:border-emergency/50 outline-none font-mono font-bold" 
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] font-mono ml-2">SMS Gateway Encryption Key</label>
            <input 
              type="password" 
              placeholder="••••••••••••••••"
              className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 text-white focus:border-emergency/50 outline-none font-mono" 
            />
            <p className="text-[9px] text-white/20 italic font-mono uppercase tracking-widest mt-2 ml-2">System uses AES-256 for automated resident notifications.</p>
          </div>

          <div className="pt-8">
            <button 
              onClick={(e) => {
                const btn = e.currentTarget;
                const orig = btn.innerText;
                btn.innerText = "CONFIG_SYNCED";
                btn.classList.add('bg-success');
                btn.classList.remove('bg-emergency');
                setTimeout(() => {
                  btn.innerText = orig;
                  btn.classList.remove('bg-success');
                  btn.classList.add('bg-emergency');
                }, 2000);
              }}
              className="w-full py-6 bg-emergency text-white font-black italic rounded-2xl hover:scale-[1.02] transition-all shadow-glow-red font-mono tracking-[0.3em] uppercase"
            >
              COMMIT CHANGES
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel border-white/5 rounded-[40px] p-8 md:p-10 space-y-8 shadow-command">
        <div>
          <h4 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] font-mono mb-2 leading-none">Force Multiplier Controls</h4>
          <p className="text-[9px] text-white/20 font-bold font-mono italic uppercase tracking-wider">System-wide tactical overrides</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <button 
              onClick={() => alert("SILENT SOS BROADCAST INITIATED. Units alerted.")}
              className="flex-1 p-6 glass-panel border-white/10 text-[10px] font-black hover:bg-white/5 transition-all font-mono uppercase tracking-[0.2em] italic text-white/60 hover:text-white">
              BROADCAST_SOS_SILENT
           </button>
           <button 
              onClick={() => alert("PATROL LOGISTICS RESET. Recalibrating sectors.")}
              className="flex-1 p-6 glass-panel border-white/10 text-[10px] font-black hover:bg-white/5 transition-all font-mono uppercase tracking-[0.2em] italic text-white/60 hover:text-white">
              FLUSH_SECTOR_DATA
           </button>
        </div>
      </div>
    </div>
  );
}
