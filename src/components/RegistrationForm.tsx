import React, { useState, useRef, useEffect } from 'react';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { MapContainer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Shield, MapPin, Upload, User, Phone, IdCard, Home, Users, CheckCircle, Navigation } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { OfflineTileLayer } from './OfflineTileLayer';
import { TanodLogo, BackgroundPattern } from './Branding';

// Fix for default marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 18);
    }
  }, [center, map]);
  
  useEffect(() => {
    let isMounted = true;
    
    const safeInvalidate = () => {
      if (isMounted && map && (map as any)._mapPane) {
        try {
          map.invalidateSize({ animate: false });
        } catch (e) {
          // Ignore leaflet errors if container is detached
        }
      }
    };

    const observer = new window.ResizeObserver(() => {
      safeInvalidate();
    });
    
    const container = map.getContainer();
    observer.observe(container);
    
    // Multiple fallbacks for React render cycles
    const timers = [
      setTimeout(safeInvalidate, 10),
      setTimeout(safeInvalidate, 100),
      setTimeout(safeInvalidate, 500),
      setTimeout(safeInvalidate, 1000)
    ];

    map.whenReady(() => {
      setTimeout(safeInvalidate, 0);
    });

    return () => {
      isMounted = false;
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [map]);

  return null;
}

function LocationPicker({ onLocationSelect, initialPos }: { onLocationSelect: (lat: number, lng: number) => void, initialPos: [number, number] }) {
  const [position, setPosition] = useState<[number, number] | null>(initialPos);
  
  // Update internal marker if initialPos changes from outside (e.g. detectLocation)
  useEffect(() => {
    setPosition(initialPos);
  }, [initialPos]);

  useMapEvents({
    click(e) {
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPosition(newPos);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={DefaultIcon} />
  );
}

export default function RegistrationForm({ onCancel, onComplete }: { onCancel: () => void, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const currentUser = auth.currentUser;
  
  const [formData, setFormData] = useState({
// ... (rest of form state remains)
    fullName: currentUser?.displayName || '',
    age: '',
    gender: 'Male',
    dob: '',
    civilStatus: 'Single',
    idType: 'PhilSys',
    idNumber: '',
    mobileNumber: '',
    altContactName: '',
    altContactNumber: '',
    email: currentUser?.email || '',
    houseNumber: '',
    street: '',
    householdCount: '1',
    specialNeeds: 'No',
    specialNeedsInfo: '',
    gpsLat: 13.0641,
    gpsLng: 120.7303,
    address: '',
    username: currentUser?.email?.split('@')[0] || '',
    password: '',
    confirmPassword: ''
  });

  const fillDemoData = () => {
    setFormData({
      ...formData,
      fullName: 'Juan Dela Cruz',
      age: '28',
      gender: 'Male',
      dob: '1996-05-20',
      civilStatus: 'Single',
      idType: 'PhilSys',
      idNumber: '1234-5678-9012',
      mobileNumber: '09123456789',
      altContactName: 'Maria Dela Cruz',
      altContactNumber: '09987654321',
      houseNumber: 'Blk 12 Lot 5',
      street: 'Sampaguita St.',
      householdCount: '4',
      specialNeeds: 'No',
      specialNeedsInfo: '',
      gpsLat: 13.0641, // Occidental Mindoro center
      gpsLng: 120.7303,
      username: 'juandemo123',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });
    alert('Form populated with demo data!');
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await resp.json();
      if (data.display_name) {
        setFormData(prev => ({
          ...prev,
          address: data.display_name,
          street: data.address.road || data.address.suburb || prev.street
        }));
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    }
  };

  const detectLocation = () => {
    if (navigator.geolocation) {
      setDetecting(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setFormData(prev => ({
            ...prev,
            gpsLat: lat,
            gpsLng: lng
          }));
          reverseGeocode(lat, lng);
          setDetecting(false);
          // Feedback that high-precision lock was acquired
          if (pos.coords.accuracy > 100) {
            console.warn("GPS lock is weak: " + pos.coords.accuracy + "m");
          }
        },
        (err) => {
          setDetecting(false);
          let msg = 'Could not get your location.';
          if (err.code === 1) msg = 'Location permission denied. Please enable it in settings.';
          if (err.code === 2) msg = 'Location unavailable or weak GPS signal.';
          if (err.code === 3) msg = 'Location request timed out.';
          alert(msg);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 15000, 
          maximumAge: 0 
        }
      );
    } else {
      alert('Your browser does not support geolocation.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // In a real app, we would upload images to Firebase Storage here
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You must be logged in with Google to complete registration.');
        setLoading(false);
        return;
      }

      // For this demo, we'll use placeholder URLs
      const residentData = {
        ...formData,
        age: parseInt(formData.age) || 0,
        householdCount: parseInt(formData.householdCount) || 1,
        uid: currentUser.uid,
        idPhotoUrl: 'https://placehold.co/600x400?text=ID+SKIP',
        selfieUrl: 'https://placehold.co/400x400?text=SELFIE+SKIP',
        status: 'pending',
        registeredAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'residents', currentUser.uid), residentData);
      
      // Also create a basic user entry so they are recognized by auth flow
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        name: formData.fullName,
        email: currentUser.email || '',
        role: 'resident',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      setSuccessId(currentUser.uid);
      setStep(5); // Success step
    } catch (error) {
      console.error(error);
      alert('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 5) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center p-6 text-center text-white relative h-screen overflow-hidden">
        <BackgroundPattern />
        <div className="max-w-md w-full animate-in fade-in zoom-in duration-500 relative z-10">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black mb-4 font-mono uppercase italic tracking-tighter">Registration Submitted!</h2>
          <p className="text-gray-400 mb-8 leading-relaxed font-medium">
            Your account is under review by the Barangay Admin. You will receive an SMS once approved.
          </p>
          <div className="bg-[#16191F] p-6 rounded-2xl mb-8 border border-[#2D3139]">
            <p className="text-xs uppercase tracking-widest text-[#8E9299] mb-1 font-bold">Reference Number</p>
            <p className="text-2xl font-mono font-black text-white">{successId}</p>
          </div>
          <button 
            onClick={onComplete}
            className="w-full py-4 bg-[#FF4B4B] text-white font-black italic rounded-xl hover:scale-105 transition-all uppercase shadow-xl"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-white p-6 md:p-12 font-sans overflow-x-hidden relative">
      <BackgroundPattern />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-12">
          <TanodLogo size={48} />
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase font-mono italic">Brgy. Tanod S.O.S</h1>
            <p className="text-[#8E9299] font-black uppercase text-[10px] tracking-widest">Resident Registration Portal</p>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="flex justify-between mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#1e293b] -translate-y-1/2 z-0"></div>
          {[1, 2, 3, 4].map(i => (
            <div 
              key={i}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center z-10 font-bold transition-all duration-300",
                step >= i ? "bg-[#dc2626] text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-[#1e293b] text-gray-500"
              )}
            >
              {i}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-[#16191F]/80 backdrop-blur-md rounded-[40px] p-8 md:p-12 shadow-2xl border border-[#2D3139] animate-in slide-in-from-bottom-4 duration-500">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase font-mono flex items-center gap-3">
                  <User className="w-6 h-6 text-[#FF4B4B]" />
                  Personal Information
                </h2>
                <button 
                  type="button" 
                  onClick={fillDemoData}
                  className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-full border border-white/5 transition-all"
                >
                  ✨ Fill Demo Data
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8E9299] ml-1">Full Name</label>
                  <input required placeholder="Juan Dela Cruz" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-[#0F1115] border border-[#2D3139] rounded-xl p-4 focus:border-[#FF4B4B] outline-none text-white font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8E9299] ml-1">Age</label>
                  <input type="number" required placeholder="25" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-[#0F1115] border border-[#2D3139] rounded-xl p-4 focus:border-[#FF4B4B] outline-none text-white font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8E9299] ml-1">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-[#0F1115] border border-[#2D3139] rounded-xl p-4 focus:border-[#FF4B4B] outline-none appearance-none text-white font-medium">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8E9299] ml-1">Date of Birth</label>
                  <input type="date" required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-[#0F1115] border border-[#2D3139] rounded-xl p-4 focus:border-[#FF4B4B] outline-none text-white font-medium" />
                </div>
              </div>
              <button type="button" onClick={() => setStep(2)} className="w-full md:w-auto px-12 py-4 bg-[#FF4B4B] text-white font-black italic rounded-xl hover:scale-105 transition-all text-xs tracking-widest shadow-xl shadow-red-500/20 uppercase">NEXT STEP</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <IdCard className="w-6 h-6 text-[#dc2626]" />
                Identification & Contacts
              </h2>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 flex gap-4 items-center">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-blue-400 uppercase tracking-widest mb-1 leading-none">Storage Bypass Active</p>
                  <p className="text-gray-400 leading-relaxed">Government ID and Selfie uploads are skipped to save storage costs. Details are optional but recommended.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">ID Type (Optional)</label>
                  <select value={formData.idType} onChange={e => setFormData({...formData, idType: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none">
                    <option value="">No ID / Skip for now</option>
                    <option>PhilSys</option>
                    <option>Voter's ID</option>
                    <option>Driver's License</option>
                    <option>Postal ID</option>
                    <option>Senior Citizen ID</option>
                    <option>PWD ID</option>
                    <option>Barangay ID</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">ID Number (Optional)</label>
                  <input placeholder="XXXX-XXXX-XXXX" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Mobile Number</label>
                  <input required placeholder="09123456789" value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Email Address</label>
                  <input type="email" placeholder="example@mail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 border border-white/10 font-bold rounded-xl hover:bg-white/5 transition-all">BACK</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-4 bg-[#dc2626] font-black rounded-xl hover:scale-105 transition-all">NEXT STEP</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <MapPin className="w-6 h-6 text-[#dc2626]" />
                Home Location
              </h2>
              <div className="space-y-4">
                <div className="h-72 rounded-3xl overflow-hidden border border-white/10 shadow-inner relative group">
                  <MapContainer 
                    center={[formData.gpsLat, formData.gpsLng]} 
                    zoom={18} 
                    className="w-full h-full"
                    scrollWheelZoom={false}
                  >
                    <OfflineTileLayer 
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> contributors"
                    />
                    <MapUpdater center={[formData.gpsLat, formData.gpsLng]} />
                    <LocationPicker 
                      initialPos={[formData.gpsLat, formData.gpsLng]} 
                      onLocationSelect={(lat, lng) => {
                        setFormData({...formData, gpsLat: lat, gpsLng: lng});
                        reverseGeocode(lat, lng);
                      }} 
                    />
                  </MapContainer>
                  
                  <div className="absolute top-4 right-4 z-[1000] bg-[#0a1628]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-bold text-gray-400">
                    TAP MAP TO DRAG PIN
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    type="button" 
                    onClick={detectLocation} 
                    disabled={detecting}
                    className={cn(
                      "w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black italic uppercase tracking-widest transition-all shadow-lg",
                      detecting 
                        ? "bg-blue-600/50 cursor-wait animate-pulse" 
                        : "bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] shadow-blue-500/20"
                    )}
                  >
                    {detecting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        GETTING ACCURATE GPS...
                      </>
                    ) : (
                      <>
                        <Navigation className="w-5 h-5" /> 📍 PIN MY CURRENT LOCATION
                      </>
                    )}
                  </button>

                  {formData.address && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-3"
                    >
                      <MapPin className="w-5 h-5 text-red-500 shrink-0" />
                      <p className="text-xs text-gray-300 font-medium leading-relaxed">{formData.address}</p>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase ml-1">Latitude</p>
                     <input readOnly value={formData.gpsLat.toFixed(6)} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-3 text-sm text-gray-400 font-mono" />
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase ml-1">Longitude</p>
                     <input readOnly value={formData.gpsLng.toFixed(6)} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-3 text-sm text-gray-400 font-mono" />
                   </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-4 border border-white/10 font-bold rounded-xl hover:bg-white/5 transition-all">BACK</button>
                <button type="button" onClick={() => setStep(4)} className="flex-1 py-4 bg-[#dc2626] font-black rounded-xl hover:scale-105 transition-all">NEXT STEP</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Users className="w-6 h-6 text-[#dc2626]" />
                Household Info & Account
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">House Number / Street</label>
                  <input required placeholder="Blk 1 Lot 2" value={formData.houseNumber} onChange={e => setFormData({...formData, houseNumber: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Household Members</label>
                  <input type="number" value={formData.householdCount} onChange={e => setFormData({...formData, householdCount: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Username</label>
                  <input required placeholder="juan2024" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Password</label>
                  <input type="password" required placeholder="********" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-[#0a1628] border border-white/10 rounded-xl p-4 focus:border-[#dc2626] outline-none" />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-4 border border-white/10 font-bold rounded-xl hover:bg-white/5 transition-all">BACK</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-[#dc2626] font-black rounded-xl hover:scale-105 transition-all disabled:opacity-50">
                  {loading ? 'SUBMITTING...' : 'COMPLETE REGISTRATION'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
