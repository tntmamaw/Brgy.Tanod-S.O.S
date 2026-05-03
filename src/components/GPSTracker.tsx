import { useState } from 'react';
import { useGPSTracking } from '@/src/hooks/useGPSTracking';
import { MapPin, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

interface GPSTrackerProps {
  userId: string;
  userName: string;
  userRole: 'resident' | 'tanod' | 'admin';
  autoStart?: boolean;
}

export const GPSTracker = ({ userId, userName, userRole, autoStart = false }: GPSTrackerProps) => {
  const [role, setRole] = useState<'resident' | 'tanod' | 'admin'>(userRole);
  const { isTracking, isConnected, currentLocation, error, startTracking, stopTracking } = useGPSTracking({
    userId,
    userName,
    userRole: role,
    autoStart,
  });

  const handleToggleTracking = async () => {
    if (isTracking) {
      stopTracking();
    } else {
      await startTracking();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <MapPin className="w-6 h-6 text-blue-600" />
        GPS Tracker
      </h2>

      {/* Role Selector */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'resident' | 'tanod' | 'admin')}
          disabled={isTracking}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="resident">👤 Resident</option>
          <option value="tanod">🚨 Tanod Officer</option>
          <option value="admin">⚙️ Administrator</option>
        </select>
      </div>

      {/* Connection Status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">WebSocket Status</span>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-600" />
                <span className="text-xs font-semibold text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tracking Status */}
      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Tracking Status</span>
          <div className="flex items-center gap-2">
            {isTracking ? (
              <>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-red-600">LIVE</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-xs font-semibold text-gray-600">Idle</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Current Location */}
      {currentLocation && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Current Location
          </h3>
          <div className="text-xs text-gray-600 space-y-1 font-mono">
            <p>Latitude: {currentLocation.lat.toFixed(6)}°</p>
            <p>Longitude: {currentLocation.lng.toFixed(6)}°</p>
            <p>Accuracy: ±{Math.round(currentLocation.accuracy)}m</p>
            <p>Speed: {(currentLocation.speed || 0).toFixed(1)} m/s</p>
            <p>Updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Error</h3>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={handleToggleTracking}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition transform hover:scale-105 active:scale-95 ${
          isTracking
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isTracking ? '⏹️ Stop Tracking' : '🚀 Start Tracking'}
      </button>

      {/* Info */}
      <p className="text-xs text-gray-500 text-center mt-3">
        {isTracking
          ? 'Your location is being shared in real-time'
          : 'Enable GPS to share your location with tanod officers'}
      </p>
    </div>
  );
};
