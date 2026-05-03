// =========================================
// GPS + SOCKET SYSTEM (WEB-ADAPTED)
// =========================================

/**
 * Note: Adapted from mobile (React Native) to Web Standard
 * to support the TanodNet Intelligence environment.
 */

let socket: WebSocket | null = null;
let watchId: number | null = null;

// Replace with your production Railway/Deployment URL
const SERVER = "ws://localhost:8000/ws/gps"; 

export const startGPS = (
  userId: string,
  role: "citizen" | "tanod",
  onUpdate: (data: any) => void
) => {
  // Attempt socket connection for live streaming
  try {
    socket = new WebSocket(SERVER);

    socket.onopen = () => {
      console.log("Connected to GPS server");
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "location_update") {
        onUpdate(msg.data);
      }
    };
    
    socket.onerror = () => {
      console.warn("GPS Socket server not reachable. Ensure backend is running.");
    };
  } catch (e) {
    console.error("Socket error", e);
  }

  // Start tracking using Browser Geolocation API
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const payload = {
          user_id: userId,
          role,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        };

        // Send to WebSocket if connected
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
        }

        // Also update local listeners
        onUpdate({ [userId]: payload });
      },
      (err) => console.error("Geolocation Error:", err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  return () => {
    if (socket) socket.close();
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  };
};
