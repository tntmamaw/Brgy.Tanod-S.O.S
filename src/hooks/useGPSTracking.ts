import { useState, useEffect, useCallback, useRef } from 'react';

interface GPSCoordinates {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  timestamp: number;
}

interface UseGPSTrackingOptions {
  userId: string;
  userName: string;
  userRole: 'resident' | 'tanod' | 'admin';
  autoStart?: boolean;
  updateInterval?: number;
  onLocationUpdate?: (coords: GPSCoordinates) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseGPSTrackingReturn {
  isTracking: boolean;
  isConnected: boolean;
  currentLocation: GPSCoordinates | null;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

export const useGPSTracking = (options: UseGPSTrackingOptions): UseGPSTrackingReturn => {
  const {
    userId,
    userName,
    userRole,
    autoStart = false,
    updateInterval = 5000,
    onLocationUpdate,
    onError,
    onConnectionChange,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/gps';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        onConnectionChange?.(true);
        reconnectAttemptsRef.current = 0;
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'location_received') {
            console.log('📍 Location received by server');
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        const errorMsg = 'WebSocket error occurred';
        console.error(errorMsg, event);
        setError(errorMsg);
        onError?.(errorMsg);
      };

      ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        onConnectionChange?.(false);

        // Attempt reconnect with exponential backoff
        if (isTracking && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Attempting reconnect in ${backoffTime}ms...`);
          setTimeout(() => connectWebSocket(), backoffTime);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const errorMsg = `WebSocket connection failed: ${err}`;
      console.error(errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [isTracking, onConnectionChange, onError]);

  // Send location to WebSocket
  const sendLocation = useCallback((coords: GPSCoordinates) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send location');
      return;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          user_id: userId,
          name: userName,
          role: userRole,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          speed: coords.speed,
          timestamp: coords.timestamp,
        })
      );
    } catch (err) {
      console.error('Failed to send location:', err);
    }
  }, [userId, userName, userRole]);

  // Handle geolocation
  const handleGeoLocation = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed } = position.coords;

      // Validate coordinates
      if (!(-90 <= latitude <= 90) || !(-180 <= longitude <= 180)) {
        const errorMsg = 'Invalid GPS coordinates received';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      const coords: GPSCoordinates = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || 0,
        speed: speed || 0,
        timestamp: Date.now(),
      };

      setCurrentLocation(coords);
      onLocationUpdate?.(coords);
      sendLocation(coords);
    },
    [onLocationUpdate, onError, sendLocation]
  );

  // Handle geolocation error
  const handleGeoError = useCallback(
    (error: GeolocationPositionError) => {
      let errorMsg = 'Geolocation error';

      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = 'Location permission denied. Please enable GPS in settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMsg = 'GPS position unavailable. Try again in open area.';
      } else if (error.code === error.TIMEOUT) {
        errorMsg = 'GPS location request timed out.';
      }

      console.error(errorMsg, error);
      setError(errorMsg);
      onError?.(errorMsg);
    },
    [onError]
  );

  // Start tracking
  const startTracking = useCallback(async () => {
    if (isTracking) return;

    // Check geolocation support
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation not supported by this browser';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      setIsTracking(true);
      connectWebSocket();

      // Start watching position
      geoWatchRef.current = navigator.geolocation.watchPosition(
        handleGeoLocation,
        handleGeoError,
        {
          enableHighAccuracy: true,
          maximumAge: updateInterval,
          timeout: 10000,
        }
      );

      console.log('🚀 GPS tracking started');
    } catch (err) {
      const errorMsg = `Failed to start tracking: ${err}`;
      console.error(errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
      setIsTracking(false);
    }
  }, [isTracking, connectWebSocket, handleGeoLocation, handleGeoError, updateInterval, onError]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);

    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log('⏹️ GPS tracking stopped');
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [autoStart, startTracking, stopTracking]);

  return {
    isTracking,
    isConnected,
    currentLocation,
    error,
    startTracking,
    stopTracking,
  };
};
