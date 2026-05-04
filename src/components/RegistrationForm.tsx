import React, { useState, useRef, useEffect } from 'react';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { MapContainer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Shield, MapPin, Upload, User, Phone, IdCard, Home, Users, CheckCircle, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
      
      // Sync to Supabase for Tactical Command link
      try {
        const { error: supaErr } = await supabase.from('residents').upsert([{
          id: currentUser.uid,
          name: formData.fullName,
          age: parseInt(formData.age) || 0,
          gender: formData.gender,
          mobile: formData.mobileNumber,
          address: formData.address,
          house_number: formData.houseNumber,
          street: formData.street,
          location_lat: formData.gpsLat,
          location_lng: formData.gpsLng,
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
        if (supaErr) throw supaErr;
      } catch (err) {
        console.error('Supabase resident sync failed:', err);
      }
      
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
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center text-white relative h-screen overflow-hidden">
        <BackgroundPattern />
        <div className="max-w-md w-full animate-in fade-in zoom-in duration-500 relative z-10">
          <div className="w-24 h-24 bg-success rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black mb-4 font-mono uppercase italic tracking-tighter shadow-glow-red">REGISTRATION COMPLETE</h2>
          <p className="text-white/40 mb-8 leading-relaxed font-bold uppercase tracking-widest font-mono text-sm px-4">
            PHASE 1 SECURED. ACCOUNT UNDER EVALUATION BY BARANGAY COMMAND.
          </p>
          <div className="glass-panel p-8 rounded-3xl mb-8 border border-white/5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2 font-black font-mono">ENCRYPTED REFERENCE ID</p>
            <p className="text-xl font-mono font-black text-white italic tracking-tighter">{successId?.toUpperCase()}</p>
          </div>
          <button 
            onClick={onComplete}
            className="w-full py-5 bg-emergency text-white font-black italic rounded-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase shadow-glow-red font-mono tracking-widest"
          >
            RETURN TO COMMAND
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white p-6 md:p-12 font-sans overflow-x-hidden relative pb-20">
      <BackgroundPattern />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex items-center gap-6 mb-16">
          <div className="relative">
            <div className="absolute inset-0 bg-emergency/20 blur-xl rounded-full" />
            <TanodLogo size={56} className="relative z-10 drop-shadow-[0_0_10px_rgba(255,75,75,0.5)]" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase font-mono italic leading-none">Brgy. <span className="text-emergency">Tanod</span> S.O.S</h1>
            <p className="text-white/30 font-black uppercase text-[9px] tracking-[0.4em] mt-2 font-mono">Resident Enrollment Protocol • 4.2.0</p>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="flex justify-between mb-16 relative">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 -translate-y-1/2 z-0"></div>
          {[1, 2, 3, 4].map(i => (
            <div 
              key={i}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center z-10 font-black transition-all duration-500 font-mono italic text-lg",
                step >= i 
                  ? "bg-emergency text-white shadow-glow-red border border-emergency/50 rotate-0" 
                  : "bg-brand-card text-white/20 border border-white/5 rotate-0"
              )}
            >
              {i}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="glass-panel border-white/5 rounded-[48px] p-8 md:p-14 shadow-command animate-in slide-in-from-bottom-8 duration-700">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase font-mono flex items-center gap-4 text-white">
                  <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center">
                    <User className="w-6 h-6 text-info" />
                  </div>
                  Personal Dossier
                </h2>
                <button 
                  type="button" 
                  onClick={fillDemoData}
                  className="text-[9px] font-black uppercase tracking-[0.3em] bg-white/5 hover:bg-white/10 text-white/40 hover:text-white px-5 py-3 rounded-2xl border border-white/5 transition-all font-mono"
                >
                  ⚡ Autofill Intelligence
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Legal Full Name</label>
                  <input required placeholder="Enter full name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Current Age</label>
                  <input type="number" required placeholder="00" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Biological Sex</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none appearance-none text-white font-bold font-mono transition-all">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Date of Birth</label>
                  <input type="date" required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono transition-all" />
                </div>
              </div>
              <div className="pt-6">
                <button type="button" onClick={() => setStep(2)} className="w-full md:w-auto px-16 py-5 bg-emergency text-white font-black italic rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-xs tracking-[0.3em] shadow-glow-red uppercase font-mono">PROCEED TO SEC-2</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black italic tracking-tighter uppercase font-mono flex items-center gap-4 text-white">
                <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center">
                  <IdCard className="w-6 h-6 text-info" />
                </div>
                ID & COMMUNICATIONS
              </h2>

              <div className="bg-info/5 border border-info/20 rounded-3xl p-6 flex gap-6 items-center">
                <div className="w-12 h-12 bg-info/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-info uppercase tracking-[0.2em] mb-1 font-mono text-[10px]">Transmission Bypass Active</p>
                  <p className="text-white/40 text-[11px] font-bold leading-relaxed font-mono">SECURE IMAGE STORAGE IS CURRENTLY RESTRICTED TO SYSTEM ADMINS. UPLOADS ARE OPTIONAL IN CURRENT FIRMWARE VERSION.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Government ID Type</label>
                  <select value={formData.idType} onChange={e => setFormData({...formData, idType: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono transition-all">
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
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">ID Reference Number</label>
                  <input placeholder="XXXX-XXXX-XXXX" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Primary Mobile Terminal</label>
                  <input required placeholder="09XX-XXX-XXXX" value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Emergency Alert Email</label>
                  <input type="email" placeholder="official@mail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-5 border border-white/10 font-black rounded-2xl hover:bg-white/5 transition-all uppercase tracking-widest font-mono text-xs">BACK</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-5 bg-emergency text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-glow-red uppercase tracking-widest font-mono text-xs italic">PROCEED TO SEC-3</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black italic tracking-tighter uppercase font-mono flex items-center gap-4 text-white">
                <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-info" />
                </div>
                GEOSPATIAL COORDINATES
              </h2>
              <div className="space-y-6">
                <div className="h-80 rounded-[40px] overflow-hidden border border-white/10 shadow-command relative group">
                  <MapContainer 
                    center={[formData.gpsLat, formData.gpsLng]} 
                    zoom={18} 
                    className="w-full h-full grayscale-[0.5] contrast-[1.2] brightness-[0.8]"
                    scrollWheelZoom={false}
                  >
                    <OfflineTileLayer 
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap"
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
                  
                  <div className="absolute top-6 right-6 z-[1000] glass-panel border-white/20 px-5 py-2 rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] font-mono shadow-xl">
                    ADJUST PIN MANUALLY
                  </div>
                </div>

                <div className="space-y-4">
                  <button 
                    type="button" 
                    onClick={detectLocation} 
                    disabled={detecting}
                    className={cn(
                      "w-full py-5 rounded-[24px] flex items-center justify-center gap-4 font-black italic uppercase tracking-[0.4em] transition-all shadow-2xl font-mono text-xs",
                      detecting 
                        ? "bg-info/30 cursor-wait animate-pulse" 
                        : "bg-info text-white hover:scale-[1.02] active:scale-[0.98] shadow-info/20"
                    )}
                  >
                    {detecting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        SYNCING GPS ENGINES...
                      </>
                    ) : (
                      <>
                        <Navigation className="w-5 h-5" /> PINPOINT MY POSITION
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {formData.address && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-brand-bg/50 border border-white/5 rounded-3xl p-6 flex gap-4"
                      >
                        <MapPin className="w-6 h-6 text-emergency shrink-0" />
                        <div className="min-w-0">
                           <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1 font-mono">Detected Address</p>
                           <p className="text-xs text-white/80 font-bold leading-relaxed font-mono italic">"{formData.address}"</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-6 pb-2">
                   <div className="space-y-2">
                     <p className="text-[9px] font-black tracking-[0.3em] text-white/20 uppercase ml-2 font-mono">Latitude Ref</p>
                     <div className="bg-brand-bg/50 border border-white/5 rounded-2xl p-4 text-sm text-white/40 font-mono italic">{formData.gpsLat.toFixed(8)}</div>
                   </div>
                   <div className="space-y-2">
                     <p className="text-[9px] font-black tracking-[0.3em] text-white/20 uppercase ml-2 font-mono">Longitude Ref</p>
                     <div className="bg-brand-bg/50 border border-white/5 rounded-2xl p-4 text-sm text-white/40 font-mono italic">{formData.gpsLng.toFixed(8)}</div>
                   </div>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 border border-white/10 font-black rounded-2xl hover:bg-white/5 transition-all uppercase tracking-widest font-mono text-xs text-white/60">BACK</button>
                <button type="button" onClick={() => setStep(4)} className="flex-1 py-5 bg-emergency text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-glow-red uppercase tracking-widest font-mono text-xs italic">PROCEED TO SEC-4</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black italic tracking-tighter uppercase font-mono flex items-center gap-4 text-white">
                <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center">
                  <Users className="w-6 h-6 text-info" />
                </div>
                HOUSEHOLD INTERFACE
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">House / Building No.</label>
                  <input required placeholder="Enter house number" value={formData.houseNumber} onChange={e => setFormData({...formData, houseNumber: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Total Occupants</label>
                  <input type="number" value={formData.householdCount} onChange={e => setFormData({...formData, householdCount: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono transition-all" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Network Handle</label>
                  <input required placeholder="Assign unique username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all font-mono italic" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2 font-mono">Security Access Key</label>
                  <input type="password" required placeholder="********" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl p-5 focus:border-emergency/50 outline-none text-white font-bold font-mono placeholder-white/10 transition-all" />
                </div>
              </div>
              <div className="flex gap-4 pt-8">
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-5 border border-white/10 font-black rounded-2xl hover:bg-white/5 transition-all uppercase tracking-widest font-mono text-xs text-white/60">BACK</button>
                <button type="submit" disabled={loading} className="flex-2 py-5 bg-emergency text-white font-black italic rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-glow-red uppercase tracking-[0.2em] font-mono text-sm leading-none">
                  {loading ? 'UPLOADING...' : 'AUTHORIZE ENROLLMENT'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
