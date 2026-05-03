import { useState, useEffect } from 'react';
import { GPSTracker } from '@/src/components/GPSTracker';
import { MapView } from '@/src/components/MapView';
import { useFirestoreSync } from '@/src/hooks/useFirestoreSync';
import { AlertCircle, MapPin, Phone, Clock } from 'lucide-react';

interface User {
  uid: string;
  name: string;
  role: 'resident' | 'tanod' | 'admin';
  email?: string;
  phone?: string;
}

export const DashboardPage = () => {
  // Mock user - replace with actual auth
  const currentUser: User = {
    uid: 'user-' + Math.random().toString(36).substr(2, 9),
    name: 'Juan dela Cruz',
    role: 'resident',
    email: 'juan@example.com',
    phone: '+63 9XX XXX XXXX',
  };

  const [trackedLocations, setTrackedLocations] = useState<Record<string, any>>({});
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const { locations, isSynced } = useFirestoreSync({
    userId: currentUser.uid,
    enabled: true,
    onLocationUpdate: (locs) => {
      setTrackedLocations(locs);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Brgy Tanod SOS - Live Dispatch
          </h1>
          <p className="text-gray-600">Real-time emergency response coordination</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - GPS Tracker */}
          <div className="lg:col-span-1">
            <GPSTracker
              userId={currentUser.uid}
              userName={currentUser.name}
              userRole={currentUser.role}
              autoStart={true}
            />
          </div>

          {/* Center Column - Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-red-500" />
                Live Map
              </h2>
              <MapView
                userId={currentUser.uid}
                userName={currentUser.name}
                userRole={currentUser.role}
                locations={trackedLocations}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-semibold">Total Users</p>
            <p className="text-3xl font-bold text-blue-600">{Object.keys(trackedLocations).length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-semibold">Tanod Officers</p>
            <p className="text-3xl font-bold text-red-600">
              {Object.values(trackedLocations).filter((l) => l.role === 'tanod').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-semibold">Active Residents</p>
            <p className="text-3xl font-bold text-green-600">
              {Object.values(trackedLocations).filter((l) => l.role === 'resident').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-semibold">Sync Status</p>
            <p className={`text-3xl font-bold ${isSynced ? 'text-green-600' : 'text-yellow-600'}`}>
              {isSynced ? '✅ Synced' : '⏳ Syncing'}
            </p>
          </div>
        </div>

        {/* Nearby Tanods Alert */}
        {Object.keys(trackedLocations).length === 0 ? (
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">No Tanods Nearby</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Currently, there are no tanod officers tracked in the system. Enable GPS tracking
                  to start receiving updates.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Tracked Locations</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Location</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(trackedLocations).map(([id, location]) => (
                    <tr
                      key={id}
                      className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => setSelectedLocation(location)}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-800">{location.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            location.role === 'tanod'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {location.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            location.status === 'on-duty'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {location.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {location.lastUpdate
                          ? new Date(location.lastUpdate).toLocaleTimeString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SOS Quick Action */}
        <div className="mt-6">
          <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 active:scale-95 text-lg">
            🚨 EMERGENCY SOS - CALL NEAREST TANOD 🚨
          </button>
        </div>
      </div>
    </div>
  );
};
