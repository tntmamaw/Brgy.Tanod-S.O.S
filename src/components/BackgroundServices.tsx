import { useEffect } from 'react';
import { doc, setDoc, collection, onSnapshot, query, where, orderBy, addDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useIncidentStore } from '../store/useIncidentStore';
import { useTanodStore } from '../store/useTanodStore';
import { useLogStore } from '../store/useLogStore';
import { watchLocation } from '../lib/gps';
import { flushSOSQueue } from '../lib/offlineQueue';
import { Alert, PatrolLocation, Shift } from '../types';
import { scheduleDailyLogReset } from '../lib/scheduler.mock';
import toast from 'react-hot-toast';

export default function BackgroundServices() {
  const { profile } = useAuthStore();
  const { setAlerts, addAlert, removeAlert, updateAlertStatus } = useIncidentStore();
  const { setPatrols, setShifts } = useTanodStore();
  const { clearActiveLogs } = useLogStore();

    // 2. Supabase Real-time Listener (The "Tactical Command" Feed)
    useEffect(() => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        console.warn('⚡ Tactical Link: Delayed - Supabase credentials not set in environment.');
        return;
      }

      console.log('📡 Initializing Tactical Live Link...');
      let isMounted = true;
      let tacticalChannel: any = null;

      // Connection Test: Try a simple REST fetch to see if URL/Key are valid BEFORE connecting Websocket
      supabase.from('report_logs').select('id').limit(1).then(({ error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('❌ Supabase Connection Test Failed:', error.message);
          if (error.message.includes('Invalid API key') || error.code === '401') {
            console.warn('👉 FIX: Your VITE_SUPABASE_ANON_KEY is invalid.');
            console.warn('👉 SOLUTION: Go to Supabase > Settings > API. Copy the "Publishable key" (anon/public).');
            console.warn('👉 IMPORTANT: Ensure you pasted it into AI Studio Settings without quotes.');
            toast.error('❌ Supabase Configuration Error: Invalid API Key. Check AI Studio Settings (Gear Icon).', { duration: 10000 });
          }
          if (error.message.includes('FetchError') || error.message.includes('failed to fetch')) {
            console.warn('HINT: This usually means VITE_SUPABASE_URL is unreachable. Check for typos or leading/trailing spaces.');
            toast.error('❌ Supabase Error: Could not connect to Supabase URL. Check your settings.', { duration: 10000 });
          }
          return; // STOP: Do not connect Realtime if REST fails
        }
        
        console.log('✅ Supabase Connection Test: SUCCESS (API Key is Valid)');

        tacticalChannel = supabase
          .channel(`tactical-command-${Math.random().toString(36).substring(2)}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'report_logs' },
            (payload) => {
              console.log('📡 Tactical Update (Logs):', payload.eventType, payload.new || payload.old);
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const data = payload.new as any;
                addAlert({
                  id: data.id || data.incident_id,
                  type: data.type,
                  status: data.status,
                  location: { lat: data.location_lat || data.lat, lng: data.location_lng || data.lng },
                  timestamp: data.created_at || new Date().toISOString(),
                  residentName: 'Field Unit',
                  residentId: data.uid || 'unknown'
                });
              } else if (payload.eventType === 'DELETE') {
                removeAlert(payload.old.id);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tanods' },
            (payload) => {
              console.log('📡 Tactical Update (Tanods):', payload.eventType, payload.new || payload.old);
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const data = payload.new as any;
                const mappedPatrol: PatrolLocation = {
                  id: data.id,
                  tanodId: data.id,
                  tanodName: data.name,
                  location: {
                    lat: data.location_lat || data.lat,
                    lng: data.location_lng || data.lng,
                  },
                  isActive: true,
                  lastUpdate: data.updated_at
                };
                const currentPatrols = (useTanodStore.getState() as any).patrols;
                const others = currentPatrols.filter((p: any) => p.tanodId !== data.id);
                setPatrols([...others, mappedPatrol]);
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Tactical Live Link: ACTIVE');
            } else if (status === 'CHANNEL_ERROR') {
              const transportError = err?.message?.includes('transport failure') || !err;
              console.error(`❌ Tactical Link Error (CHANNEL_ERROR):`, err);
              
              if (transportError) {
                console.warn('💡 TROUBLESHOOTING "transport failure":');
                console.warn('1. API KEY: Ensure you are using the "Publishable/anon" key, NOT the "service_role" key.');
                console.warn('2. URL: Ensure VITE_SUPABASE_URL starts with https:// and has NO trailing slash.');
                console.warn('3. REALTIME: Ensure Realtime is enabled for the tables in Supabase Dashboard (Database > Replication).');
                console.warn('👉 Use the Publishable key from Supabase Dashboard > Settings > API.');
              } else {
                console.warn('HINT: Check if "report_logs" and "tanods" tables are in the "supabase_realtime" publication.');
              }
            } else if (status === 'TIMED_OUT') {
              console.warn('⏳ Tactical Link: TIMED_OUT. Retrying in background...');
            }
          });
      });

      return () => {
        isMounted = false;
        if (tacticalChannel) {
          supabase.removeChannel(tacticalChannel);
        }
      };
    }, [addAlert, removeAlert, setPatrols]);

  // 2. Tanod Location heartbeat (Sync to Supabase maps)
  useEffect(() => {
    if (profile?.role !== 'tanod' || !auth.currentUser) return;

    const pushLocation = async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 })
        );

        await supabase.from('tanods').upsert([{
          id: auth.currentUser?.uid,
          name: profile.name,
          location_lat: pos.coords.latitude,
          location_lng: pos.coords.longitude,
          lat: pos.coords.latitude, // Support both naming styles
          lng: pos.coords.longitude,
          status: 'On-Duty',
          updated_at: new Date().toISOString()
        }]);
      } catch (err) {
        console.warn('Supabase heartbeat failed:', err);
      }
    };

    pushLocation();
    const interval = setInterval(pushLocation, 30000);
    return () => clearInterval(interval);
  }, [profile, auth.currentUser]);

  // 3. Daily Log Reset Listener (Supabase Broadcast + Mock Scheduler Fallback)
  useEffect(() => {
    let mockCleanup = () => {};

    // Check if Supabase URL is present before trying connection
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    let channel: any = null;

    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      channel = supabase
        .channel(`system-events-${Math.random().toString(36).substring(2)}`)
        .on('broadcast', { event: 'logs_reset' }, (payload) => {
          console.log('Daily Log Reset Signal Received:', payload);
          clearActiveLogs();
          toast('📋 Daily Log Archived & Reset — 07:00 AM Cycle Complete', {
            duration: 8000,
            icon: '📋'
          });
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Real-time: Connected (System Events)');
          } else if (status === 'CHANNEL_ERROR') {
            const is1006 = err?.message?.includes('1006') || err?.code === 1006;
            if (!is1006) {
              console.error('❌ Supabase Real-time Error (System Events):', err);
            }
          }
        });
    }

    // 2.2 Local Mock Scheduler (Fallback for local dev if Edge Function isn't running)
    mockCleanup = scheduleDailyLogReset((date) => {
      console.log(`[LOCAL_RESET] Mock Daily Reset triggered for ${date}`);
      clearActiveLogs();
      toast.success(`📋 Local Audit Cycle Logged — 07:00 AM (${date})`, {
        icon: '📊'
      });
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      mockCleanup();
    };
  }, [clearActiveLogs]);

  // 3. Real-time Listeners (Firestore)
  useEffect(() => {
    if (!profile) return;

    // A. Alerts Listener
    const alertsQ = profile.role === 'admin' || profile.role === 'tanod'
      ? query(collection(db, 'alerts'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'alerts'), where('residentId', '==', profile.uid), orderBy('timestamp', 'desc'));

    const unsubAlerts = onSnapshot(alertsQ, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Alert));
      setAlerts(list);
    }, (error) => console.error('Alerts listener error:', error));

    // B. Patrols Listener (Admin/Tanod only)
    let unsubPatrols = () => {};
    if (profile.role === 'admin' || profile.role === 'tanod') {
      const patrolsQ = query(collection(db, 'patrols'), where('isActive', '==', true));
      unsubPatrols = onSnapshot(patrolsQ, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PatrolLocation));
        setPatrols(list);
      }, (error) => console.error('Patrols listener error:', error));
    }

    // C. Shifts Listener (Relevant to profile)
    const shiftsQ = query(collection(db, 'shifts'), orderBy('startTime', 'asc'));
    const unsubShifts = onSnapshot(shiftsQ, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
      setShifts(list);
    }, (error) => console.error('Shifts listener error:', error));

    return () => {
      unsubAlerts();
      unsubPatrols();
      unsubShifts();
    };
  }, [profile]);

  // 2. Continuous GPS Tracking for Tanods
  useEffect(() => {
    if (!profile || profile.role !== 'tanod' || !auth.currentUser) return;

    const stopWatching = watchLocation(async (loc) => {
      try {
        await setDoc(doc(db, 'patrols', profile.uid), {
          tanodId: profile.uid,
          tanodName: profile.name,
          location: {
            lat: loc.lat,
            lng: loc.lng,
            accuracy: loc.accuracy
          },
          isActive: true,
          lastUpdate: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update patrol location:', err);
      }
    }, (err) => {
      console.warn('GPS tracking error:', err.message);
    });

    return () => {
      stopWatching();
      // Optionally mark as inactive on unmount
      if (auth.currentUser) {
        setDoc(doc(db, 'patrols', profile.uid), { isActive: false }, { merge: true });
      }
    };
  }, [profile]);

  // 3. Offline Sync (Flush Queue)
  useEffect(() => {
    const handleOnline = () => {
      flushSOSQueue(async (data) => {
        await addDoc(collection(db, 'alerts'), data);
      });
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null;
}
