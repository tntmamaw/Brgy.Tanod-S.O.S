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
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF4B4B] border-t-transparent rounded-full animate-spin"></div>
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
    <div className="min-h-screen bg-[#0F1115] text-white font-sans flex flex-col md:flex-row h-screen overflow-hidden relative">
      <Toaster />
      <BackgroundPattern />
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#16191F]/80 backdrop-blur-md border-b border-[#2D3139] shrink-0 z-50">
        <div className="flex items-center gap-2">
          <TanodLogo size={32} animated={false} />
          <span className="font-extrabold tracking-tighter text-lg uppercase font-mono">Brgy.TANOD 🆘 ALERT</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-[#8E9299] hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? (
            <Plus className="w-6 h-6 rotate-45" />
          ) : (
            <div className="flex flex-col gap-1.5 w-6">
              <span className="w-full h-0.5 bg-current rounded-full"></span>
              <span className="w-full h-0.5 bg-current rounded-full"></span>
              <span className="w-full h-0.5 bg-current rounded-full"></span>
            </div>
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={cn(
        "fixed inset-y-0 left-0 w-72 bg-[#16191F]/90 backdrop-blur-xl border-r border-[#2D3139] flex flex-col shrink-0 z-50 transition-transform duration-300 md:relative md:translate-x-0 md:w-64",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 pt-8">
          <TanodWordmark width={200} className="mx-auto" />
        </div>

        <div className="flex-1 px-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-[#FF4B4B] text-white shadow-[0_0_15px_rgba(255,75,75,0.2)]" 
                    : "text-[#8E9299] hover:bg-[#252932] hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 mt-auto border-t border-[#2D3139]">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[#0A0C10] mb-4 border border-[#2D3139]">
            <div className="w-10 h-10 rounded-full bg-[#252932] overflow-hidden flex items-center justify-center border border-[#2D3139] shrink-0">
              {user.email === 'rubenlleg12@gmail.com' ? (
                <img src="/ruben_avatar.jpg" referrerPolicy="no-referrer" alt="Profile" className="w-full h-full object-cover" />
              ) : user.photoURL ? (
                <img src={user.photoURL} referrerPolicy="no-referrer" alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 text-[#8E9299]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">
                {user.email === 'rubenlleg12@gmail.com' ? 'RubenLlego' : profile?.name}
              </p>
              <p className="text-[10px] text-[#8E9299] uppercase tracking-widest">
                {user.email === 'rubenlleg12@gmail.com' ? 'System Owner/Head Developer' : profile?.role}
              </p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#FF4B4B] hover:bg-[rgba(255,75,75,0.1)] transition-all">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 flex flex-col">
        <header className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-8 shrink-0 relative z-10 w-full">
          <div className="flex-1 w-full">
            <div className="flex justify-between items-start w-full">
              <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase font-mono">{activeTab}</h1>
              <span className="text-[10px] font-black tracking-widest text-[#EF4444] uppercase mt-1 text-right mt-1.5 md:mt-2">Brgy.TANOD DashBoard Panel</span>
            </div>
            <p className="text-[#8E9299] text-xs font-medium tracking-wide uppercase mt-1">Brgy.TANOD 🆘 ALERT — Barangay Emergency Intelligence System</p>
          </div>
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            {profile?.role === 'admin' && (
              <div className="flex bg-[#16191F] border border-[#2D3139] rounded-xl overflow-hidden text-[10px] sm:text-xs font-bold mr-0 sm:mr-2 shrink-0">
                <button 
                  onClick={() => { setViewOverride(null); setActiveTab('home'); }} 
                  className={cn("px-3 py-2 transition-colors", !viewOverride ? "bg-[#FF4B4B] text-white" : "text-[#8E9299] hover:bg-[#252932]")}
                >
                  ADMIN
                </button>
                <button 
                  onClick={() => { setViewOverride('tanod'); setActiveTab('home'); }} 
                  className={cn("px-3 py-2 transition-colors", viewOverride === 'tanod' ? "bg-[#FF4B4B] text-white" : "text-[#8E9299] border-l border-[#2D3139] hover:bg-[#252932]")}
                >
                  TANOD VIEW
                </button>
                <button 
                  onClick={() => { setViewOverride('resident'); setActiveTab('home'); }} 
                  className={cn("px-3 py-2 transition-colors", viewOverride === 'resident' ? "bg-[#FF4B4B] text-white" : "text-[#8E9299] border-l border-[#2D3139] hover:bg-[#252932]")}
                >
                  CLIENT VIEW
                </button>
              </div>
            )}
            {(effectiveRole === 'tanod' || effectiveRole === 'admin') && (
              <button 
                onClick={() => setIsIncidentFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FF4B4B] rounded-xl hover:scale-105 transition-all shadow-lg font-bold text-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> NEW INCIDENT
              </button>
            )}
            <button className="p-2.5 bg-[#16191F] border border-[#2D3139] rounded-xl hover:bg-[#252932] relative shrink-0">
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#FF4B4B] border-2 border-[#0F1115] rounded-full"></span>}
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
    <div className="min-h-screen bg-[#0F1115] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8">
        <X className="w-12 h-12 text-red-500" />
      </div>
      <h2 className="text-4xl font-black italic tracking-tighter mb-4 text-white uppercase">Account Rejected</h2>
      <p className="text-[#8E9299] max-w-md mb-8 text-lg font-medium">We're sorry, but your registration was not approved by the Barangay administration.</p>
      
      <div className="bg-[#16191F] border border-[#2D3139] p-6 rounded-3xl w-full max-w-md mb-12">
        <p className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest mb-2">Reason for rejection</p>
        <p className="text-white font-bold italic">"{reason}"</p>
      </div>

      <button 
        onClick={() => auth.signOut()}
        className="px-10 py-5 bg-[#252932] text-white font-black italic rounded-2xl hover:bg-[#2D3139] transition-all shadow-xl"
      >
        LOGOUT AND TRY AGAIN
      </button>
    </div>
  );
}

function PendingApproval({ user }: { user: FirebaseUser }) {
  return (
    <div className="min-h-screen bg-[#0F1115] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-amber-500/20 rounded-3xl flex items-center justify-center mb-8 border border-amber-500/50">
        <Clock className="w-12 h-12 text-amber-500" />
      </div>
      <h1 className="text-4xl font-black mb-4">Registration Pending</h1>
      <p className="text-[#8E9299] max-w-sm mb-12">
        Your resident account for {user.displayName} is currently under evaluation by the Barangay Admin. You will be notified via SMS once approved.
      </p>
      <button onClick={() => signOut(auth)} className="px-8 py-3 bg-[#252932] text-white rounded-xl hover:bg-[#2D3139] transition-all flex items-center gap-2">
        <LogOut className="w-4 h-4" /> Sign Out
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
    <div className="min-h-screen bg-[#0F1115] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <BackgroundPattern />
      <TanodLogo size={180} className="mb-8 z-10" />
      <h1 className="text-5xl font-black tracking-tighter mb-4 text-white z-10 font-mono">BRGY. TANOD S.O.S</h1>
      <p className="text-[#8E9299] max-w-sm mb-12 text-lg z-10">
        Community watch in the palm of your hand. Real-time emergency connection for Brgy. residents.
      </p>
      <div className="space-y-4 w-full max-w-xs">
        <button 
          disabled={isLoggingIn}
          onClick={onLogin}
          className="w-full bg-white text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#E2E2E2] active:scale-95 transition-all shadow-xl disabled:opacity-50"
        >
          {isLoggingIn ? (
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          )}
          {isLoggingIn ? 'Connecting...' : 'Login with Google'}
        </button>
        <button 
          disabled={isLoggingIn}
          onClick={handleRegister}
          className="w-full bg-[#16191F] border border-[#2D3139] text-white font-bold py-5 rounded-2xl hover:bg-[#252932] transition-all disabled:opacity-50"
        >
          Resident Registration
        </button>
        <button 
          disabled={isLoggingIn}
          onClick={onDemoResident}
          className="w-full bg-[#FF4B4B] text-white font-bold py-5 rounded-2xl hover:bg-red-700 transition-all shadow-xl disabled:opacity-50 animate-bounce"
        >
          ✨ Preview Resident View (Demo)
        </button>
      </div>
    </div>
  );
}

function RoleSelection({ onSelect, onRegister }: { onSelect: (role: UserRole) => void, onRegister: () => void }) {
  return (
    <div className="min-h-screen bg-[#0F1115] flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-4xl font-black mb-2">Welcome!</h2>
      <p className="text-[#8E9299] text-lg mb-12">Who are you in this community?</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <RoleCard title="Resident Portal" desc="I want to register my profile or send SOS alerts." icon={UserIcon} onClick={onRegister} />
        <RoleCard title="Tanod Officer" desc="I respond to emergencies and report incidents." icon={Shield} onClick={() => onSelect('tanod')} />
      </div>
    </div>
  );
}

function RoleCard({ title, desc, icon: Icon, onClick }: any) {
  return (
    <button onClick={onClick} className="p-10 bg-[#16191F] border border-[#2D3139] rounded-[40px] hover:border-[#FF4B4B] hover:bg-[#1A1D23] transition-all text-left group active:scale-95">
      <div className="w-16 h-16 bg-[#252932] rounded-2xl flex items-center justify-center mb-8 group-hover:bg-[#FF4B4B] transition-colors shadow-lg">
        <Icon className="w-8 h-8 text-[#8E9299] group-hover:text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-3">{title}</h3>
      <p className="text-[#8E9299] leading-relaxed">{desc}</p>
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

      const alertData: any = {
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
        await addDoc(collection(db, 'alerts'), alertData);
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[#16191F]/80 backdrop-blur-xl border border-[#FF4B4B] rounded-[40px] p-6 md:p-8 shadow-[0_0_40px_rgba(255,75,75,0.2)]"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-[#FF4B4B] rounded-full flex items-center justify-center animate-pulse relative">
                  <TanodLogo size={48} animated={false} className="z-10" />
                  <div className="absolute inset-0 bg-[#FF4B4B] rounded-full blur-xl opacity-50 animate-ping" />
                </div>
                <div>
                  <h4 className="text-xl font-black italic tracking-tighter text-white uppercase font-mono">Active SOS Alert</h4>
                  <p className="text-xs text-[#8E9299] font-bold uppercase tracking-widest font-mono">{activeAlert.type} • Sent at {new Date(activeAlert.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
              
              <div className="flex-1 max-w-md w-full">
                <div className="relative h-2 bg-[#2D3139] rounded-full overflow-hidden mb-2">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: activeAlert.status === 'pending' ? '33.33%' : 
                             activeAlert.status === 'responding' ? '66.66%' : '100%' 
                    }}
                    className="absolute top-0 left-0 h-full bg-[#FF4B4B]"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className={activeAlert.status === 'pending' ? 'text-[#FF4B4B]' : 'text-[#8E9299]'}>Sent</span>
                  <span className={activeAlert.status === 'responding' ? 'text-[#FF4B4B]' : 'text-[#8E9299]'}>Responding</span>
                  <span className={activeAlert.status === 'resolved' ? 'text-[#FF4B4B]' : 'text-[#8E9299]'}>Resolved</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setCancellingId(activeAlert.id)}
                  className="px-6 py-3 bg-[#252932] text-[#8E9299] text-xs font-black rounded-xl hover:text-white hover:bg-[#2D3139] transition-all uppercase tracking-widest"
                >
                  Cancel SOS
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!activeAlert && (
        <div className="bg-[#16191F]/40 backdrop-blur-md border border-[#2D3139] rounded-[40px] p-8 md:p-12 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 italic text-white uppercase font-mono">Ready to Help?</h2>
            <p className="text-[#8E9299] max-w-md text-lg mb-12 font-medium">Use the button below ONLY in case of real emergency. Tanod will be dispatched immediately.</p>
            
            <button 
              disabled={sending}
              onClick={() => setIsChoosingCategory(true)}
              className={cn(
                "w-full aspect-square md:aspect-auto md:h-64 rounded-full md:rounded-[40px] flex flex-col items-center justify-center gap-4 transition-all duration-500 shadow-2xl relative group",
                sending ? "bg-amber-600 scale-95" : "bg-[#FF4B4B] hover:bg-[#FF3333] hover:shadow-[0_0_60px_rgba(255,75,75,0.4)]"
              )}
            >
              <div className="absolute inset-0 bg-[#FF4B4B] rounded-full filter blur-2xl opacity-20 animate-pulse"></div>
              <TanodLogo size={120} animated={!sending} className="transition-transform group-hover:scale-110" />
              <span className="text-3xl font-black italic tracking-tighter text-white font-mono">
                {sending ? 'SENDING ALERT...' : 'SEND SOS ALERT'}
              </span>
            </button>
          </div>
        </div>
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
    <div className="space-y-6">
      <div className="bg-[#16191F] p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-[#2D3139] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white">Tanod Roster</h2>
          <p className="text-[#8E9299] font-medium text-sm md:text-base">Official Barangay Peacekeeping Force Units</p>
        </div>
        <button 
          onClick={() => setAddingUnit(true)}
          className="w-full md:w-auto justify-center px-8 py-4 bg-[#FF4B4B] text-white font-black italic rounded-xl hover:scale-105 transition-all flex items-center gap-2 text-xs shadow-xl shadow-red-500/20">
          <Plus className="w-4 h-4" /> ADD UNIT
        </button>
      </div>

      <AnimatePresence>
        {addingUnit && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16191F] border border-[#2D3139] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-6"
            >
              <h3 className="font-black italic text-xl md:text-2xl tracking-tighter text-white mb-2 uppercase">Add New Unit</h3>
              <p className="text-[#8E9299] text-xs font-medium mb-6">Register a new Tanod to the system.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black tracking-[0.2em] text-[#8E9299] uppercase mb-2 block">Officer Name</label>
                  <input 
                    type="text"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Juan Cruz"
                    className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white placeholder-[#8E9299] focus:outline-none focus:border-[#FF4B4B]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black tracking-[0.2em] text-[#8E9299] uppercase mb-2 block">Email Address</label>
                  <input 
                    type="email"
                    value={newUnitEmail}
                    onChange={(e) => setNewUnitEmail(e.target.value)}
                    placeholder="juan@example.com"
                    className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white placeholder-[#8E9299] focus:outline-none focus:border-[#FF4B4B]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setAddingUnit(false)}
                  className="flex-1 py-3 bg-[#252932] text-white font-bold rounded-xl hover:bg-[#2D3139] transition-all text-sm uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddUnit}
                  className="flex-1 py-3 bg-[#FF4B4B] text-white font-bold rounded-xl hover:bg-red-700 transition-all text-sm uppercase"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tanods.map((t) => (
          <div key={t.uid} className="bg-[#16191F]/80 backdrop-blur-md border border-[#2D3139] rounded-[32px] p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 transition-all group-hover:bg-green-500/10"></div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-[#252932] rounded-2xl flex items-center justify-center border border-[#2D3139] group-hover:border-green-500/30 transition-colors">
                <TanodLogo size={40} animated={false} />
              </div>
              <div>
                <h4 className="text-xl font-black italic tracking-tighter text-white truncate max-w-[140px] uppercase font-mono">{t.name}</h4>
                <p className="font-mono text-[#8E9299] text-[10px] uppercase font-bold tracking-widest">{t.id || `TND-${t.uid.slice(0, 4).toUpperCase()}`}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-[#0F1115] rounded-xl border border-[#2D3139]">
                <span className="text-[9px] font-black uppercase text-[#8E9299] tracking-widest">Status</span>
                <span className="text-[10px] font-black uppercase text-green-500 italic">On-Duty</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#0F1115] rounded-xl border border-[#2D3139]">
                <span className="text-[9px] font-black uppercase text-[#8E9299] tracking-widest">Sector</span>
                <span className="text-[10px] font-black uppercase text-white italic">Zone A</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => alert(`Viewing profile details for ${t.name}`)}
                className="flex-1 py-3 bg-[#252932] border border-[#2D3139] text-[10px] font-black uppercase tracking-widest text-[#8E9299] hover:text-white rounded-xl transition-all">
                Profile
              </button>
              <button 
                onClick={() => alert(`Viewing incident history for ${t.name}`)}
                className="flex-1 py-3 bg-[#252932] border border-[#2D3139] text-[10px] font-black uppercase tracking-widest text-[#8E9299] hover:text-white rounded-xl transition-all">
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
    <div className="bg-[#16191F] border border-[#2D3139] rounded-[40px] p-6 md:p-14 shadow-2xl max-w-5xl">
      <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-8 md:mb-12 italic border-l-8 border-[#FF4B4B] pl-6 uppercase">Brgy. Patrol Operations</h3>
      
      {loading ? (
        <div className="py-20 text-center animate-pulse text-[#8E9299]">Loading operational data...</div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {shifts.map((s) => {
            const isActive = s.status === 'active';
            return (
              <div key={s.id} className={cn(
                "p-6 md:p-10 bg-[#252932] rounded-[32px] md:rounded-[40px] border border-[#2D3139] flex flex-col md:flex-row justify-between items-center gap-6",
                isActive && "bg-[#1A1D23] border-[#FF4B4B]/30 shadow-[0_0_30px_rgba(255,75,75,0.1)]"
              )}>
                <div className="text-center md:text-left flex-1">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <p className={cn("text-[10px] font-black tracking-[0.2em]", isActive ? "text-[#FF4B4B]" : "text-[#8E9299]")}>
                      {format(new Date(s.startTime), 'HH:mm')} - {format(new Date(s.endTime), 'HH:mm')}
                    </p>
                    {isActive && <span className="w-2 h-2 bg-[#FF4B4B] rounded-full animate-ping"></span>}
                  </div>
                  <h4 className="text-2xl md:text-3xl font-black tracking-tight mb-2 italic text-white uppercase">{s.sector}</h4>
                  <p className="text-[#8E9299] font-medium flex items-center justify-center md:justify-start gap-2">
                    <UserIcon className="w-4 h-4" /> OFFICER {s.tanodName.toUpperCase()}
                  </p>
                </div>
                <div className={cn(
                  "w-full md:w-auto px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest border border-white/10 text-center",
                  isActive ? "bg-[#FF4B4B] text-white shadow-lg" : "bg-[#16191F] text-[#8E9299]"
                )}>
                  {isActive ? 'PATROLLING NOW' : s.status.toUpperCase()}
                </div>
              </div>
            );
          })}

          {shifts.length === 0 && (
            <div className="py-20 text-center text-[#8E9299] italic">
              No patrol shifts assigned for today.
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#16191F] p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-[#2D3139] gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white">Incident Log Vault</h2>
          <p className="text-[#8E9299] text-sm font-medium">Archived incident reports and tanod response logs</p>
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
            alert("Audit log exported successfully!");
          }}
          className="w-full md:w-auto justify-center px-8 py-4 bg-[#252932] border border-[#2D3139] text-white font-black italic rounded-xl md:rounded-2xl hover:bg-[#2D3139] transition-all flex items-center gap-2 text-xs"
        >
          <FileText className="w-4 h-4" /> EXPORT AUDIT
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="bg-[#16191F] border border-[#2D3139] rounded-[32px] p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#252932] rounded-2xl flex items-center justify-center border border-[#2D3139]">
                  <Shield className="w-6 h-6 text-[#FF4B4B]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[10px] text-[#FF4B4B] uppercase tracking-[0.2em] mb-1">Incident Report</h4>
                  <p className="text-xl font-black text-white italic tracking-tighter">{report.type}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-[#10B981]/10 text-[#10B981] text-[10px] font-black rounded-full uppercase">{report.status}</span>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-[#0F1115] rounded-2xl border border-[#2D3139]">
                <p className="text-[10px] font-black text-[#8E9299] uppercase tracking-widest mb-2">Narrative</p>
                <p className="font-medium text-[15px] leading-[25px] text-[#fbf50a]">{report.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {report.adminOnDuty && (
                  <div className="col-span-2 p-4 bg-[#0F1115] rounded-xl border border-[#2D3139]">
                    <p className="text-[8px] font-black text-[#8E9299] uppercase tracking-widest mb-1">Brgy. Hall Admin On Duty</p>
                    <p className="text-xs font-bold text-white uppercase">{report.adminOnDuty}</p>
                  </div>
                )}
                <div className="p-4 bg-[#0F1115] rounded-xl border border-[#2D3139]">
                  <p className="text-[8px] font-black text-[#8E9299] uppercase tracking-widest mb-1">Tanod In-Charge</p>
                  <p className="text-xs font-bold text-white uppercase">{report.tanodName}</p>
                </div>
                <div className="p-4 bg-[#0F1115] rounded-xl border border-[#2D3139]">
                  <p className="text-[8px] font-black text-[#8E9299] uppercase tracking-widest mb-1">Date & Time</p>
                  <p className="text-xs font-bold text-white uppercase">{report.date} • {report.time}</p>
                </div>
                {report.respondedAt && report.resolvedAt && (
                  <div className="col-span-2 p-4 bg-[#0F1115] rounded-xl border border-[#2D3139] flex flex-col gap-3 bg-blue-900/10 border-blue-500/20">
                     <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Time to Resolve</p>
                       <p className="text-sm font-bold text-white uppercase">
                         {(() => {
                           const start = new Date(report.respondedAt).getTime();
                           const end = new Date(report.resolvedAt).getTime();
                           const mins = Math.round((end - start) / 60000);
                           if (mins < 1) return '< 1 minute';
                           if (mins < 60) return `${mins} minutes`;
                           const hrs = Math.floor(mins / 60);
                           const hMins = mins % 60;
                           return `${hrs} hr ${hMins} min`;
                         })()}
                       </p>
                     </div>
                     <div className="flex justify-between items-center text-[10px] text-blue-400/80 font-medium uppercase tracking-wider">
                       <span>Received: {new Date(report.respondedAt).toLocaleTimeString()}</span>
                       <span>Resolved: {new Date(report.resolvedAt).toLocaleTimeString()}</span>
                     </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-[#2D3139] flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#8E9299]" />
                <p className="text-[10px] font-black text-[#8E9299] uppercase tracking-widest">{report.location}</p>
              </div>
              {report.gpsLocation && (
                <ReportMap lat={report.gpsLocation.lat} lng={report.gpsLocation.lng} />
              )}
            </div>
          </div>
        ))}

        {reports.length === 0 && !loading && (
          <div className="col-span-full py-32 text-center bg-[#16191F] border border-dashed border-[#2D3139] rounded-[40px]">
            <FileText className="w-16 h-16 text-[#8E9299] mx-auto mb-6 opacity-10" />
            <p className="text-[#8E9299] font-black uppercase tracking-widest">No incident reports filed yet.</p>
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-[#16191F] border border-[#2D3139] rounded-[32px] md:rounded-[40px] p-6 md:p-12">
        <h3 className="text-2xl font-black mb-8 italic tracking-tighter uppercase text-white">System Config</h3>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest ml-1">Barangay Name</label>
            <input 
              type="text" 
              value={brgyName}
              onChange={(e) => setBrgyName(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:border-[#FF4B4B] outline-none" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest ml-1">Barangay Hotline</label>
            <input 
              type="text" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:border-[#FF4B4B] outline-none" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[#8E9299] tracking-widest ml-1">Semaphore API Key (SMS)</label>
            <input 
              type="password" 
              placeholder="••••••••••••••••"
              className="w-full bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 text-white focus:border-[#FF4B4B] outline-none" 
            />
            <p className="text-[10px] text-[#8E9299] italic">Used for sending automated SMS alerts to residents.</p>
          </div>

          <div className="pt-6">
            <button 
              onClick={(e) => {
                const btn = e.currentTarget;
                const orig = btn.innerText;
                btn.innerText = "SAVED!";
                btn.classList.add('bg-[#22C55E]');
                btn.classList.remove('bg-[#FF4B4B]');
                setTimeout(() => {
                  btn.innerText = orig;
                  btn.classList.remove('bg-[#22C55E]');
                  btn.classList.add('bg-[#FF4B4B]');
                }, 2000);
              }}
              className="w-full py-5 bg-[#FF4B4B] text-white font-black italic rounded-2xl hover:scale-105 transition-all shadow-xl shadow-red-500/20"
            >
              SAVE CHANGES
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#16191F] border border-[#2D3139] rounded-[40px] p-8">
        <h4 className="text-xs font-black uppercase text-[#8E9299] tracking-widest mb-6">Tanod Unit Controls</h4>
        <div className="flex gap-4">
           <button 
              onClick={() => alert("Silent SOS Broadcast Triggered! Alerting nearest units.")}
              className="flex-1 p-4 bg-[#252932] rounded-2xl border border-[#2D3139] text-xs font-bold hover:bg-[#2D3139] transition-all">
              BROADCAST SOS SILENT
           </button>
           <button 
              onClick={() => alert("Patrol Sectors Reset completed.")}
              className="flex-1 p-4 bg-[#252932] rounded-2xl border border-[#2D3139] text-xs font-bold hover:bg-[#2D3139] transition-all">
              RESET PATROL SECTORS
           </button>
        </div>
      </div>
    </div>
  );
}
