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

  // 1. Supabase Real-time Listener (The "Tactical Command" Feed)
  useEffect(() => {
    const channel = supabase
      .channel('incidents-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        (payload) => {
          console.log('📡 Tactical Update:', payload.eventType, payload.new || payload.old);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const data = payload.new as any;
            const mappedAlert: any = {
              id: data.id,
              type: data.type,
              status: data.status,
              location: { lat: data.lat, lng: data.lng },
              timestamp: data.created_at || new Date().toISOString(),
              residentName: 'Field Unit', 
              residentId: data.uid || 'unknown'
            };
            addAlert(mappedAlert);
          } else if (payload.eventType === 'DELETE') {
            removeAlert(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Tactical Live Link: ACTIVE');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Tactical Link Error: Please ensure Replication is enabled for "incidents" table in Supabase Dashboard -> Database -> Replication.');
          toast.error('Tactical link unstable. Verify Supabase Replication.', { id: 'supa-error' });
        }
        if (status === 'TIMED_OUT') {
          console.warn('⚠️ Tactical Link: Connection Timed Out.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addAlert, removeAlert]);

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
          lat: pos.coords.latitude,
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
    // 2.1 Supabase Realtime Reset Listener
    const channel = supabase
      .channel('system-events')
      .on('broadcast', { event: 'logs_reset' }, (payload) => {
        console.log('Daily Log Reset Signal Received:', payload);
        clearActiveLogs();
        toast('📋 Daily Log Archived & Reset — 07:00 AM Cycle Complete', {
          duration: 8000,
          icon: '📋'
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Supabase Real-time: Connected (System Events)');
        }
      });

    // 2.2 Local Mock Scheduler (Fallback for local dev if Edge Function isn't running)
    const cleanupMock = scheduleDailyLogReset((date) => {
      console.log(`[LOCAL_RESET] Mock Daily Reset triggered for ${date}`);
      clearActiveLogs();
      toast.success(`📋 Local Audit Cycle Logged — 07:00 AM (${date})`, {
        icon: '📊'
      });
    });

    return () => {
      supabase.removeChannel(channel);
      cleanupMock();
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
