import React, { useEffect, useState } from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import L from 'leaflet';
import { startGPS } from "./gpsSystem";
import { OfflineTileLayer } from './components/OfflineTileLayer';

/**
 * Custom Icons for Web Leaflet
 */
const TanodIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 24px; text-align: center; text-shadow: 0 0 10px rgba(74, 175, 80, 0.5);">🟢</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const CitizenIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 24px; text-align: center; text-shadow: 0 0 10px rgba(255, 75, 75, 0.5);">🔴</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const CENTER: [number, number] = [13.2236, 120.5960]; // Mamburao

import { useMap } from "react-leaflet";

function MyLocationButton() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

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

  const locateMe = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 17);
        const icon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
        L.marker([latitude, longitude], { icon })
          .addTo(map)
          .bindPopup("<div class='text-black font-bold'>You are here 📍</div>")
          .openPopup();
        setLocating(false);
      },
      (err) => {
        console.error("GPS error", err);
        setLocating(false);
        alert("Unable to fetch location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <button 
      onClick={(e) => { e.preventDefault(); locateMe(); }}
      className={`absolute bottom-4 right-4 z-[400] w-12 h-12 bg-[#252932] text-xl rounded-full shadow-lg border border-[#2D3139] flex items-center justify-center hover:bg-[#FF4B4B] hover:scale-110 transition-all ${locating ? "animate-pulse" : ""}`}
      title="Pinpoint My Location"
    >
      {locating ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "📍"}
    </button>
  );
}

import { useIncidentStore } from './store/useIncidentStore';
import { useTanodStore } from './store/useTanodStore';

export default function LiveMap() {
  const { alerts } = useIncidentStore();
  const { patrols } = useTanodStore();

  return (
    <div className="w-full h-full min-h-[400px] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative bg-[#0F1115]">
      <MapContainer 
        center={CENTER} 
        zoom={14} 
        style={{ height: "100%", width: "100%" }}
        className="z-10"
      >
        <OfflineTileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MyLocationButton />
        
        {/* Active Patrols (Tanods) */}
        {patrols.map((p) => (
          p.location?.lat && p.location?.lng && (
            <Marker
              key={p.tanodId}
              position={[p.location.lat, p.location.lng]}
              icon={TanodIcon}
            >
              <Popup>
                <div className="text-[#0F1115] p-2">
                  <p className="font-black italic uppercase tracking-tighter text-sm mb-1"> OFFICER 👮</p>
                  <p className="font-bold text-xs">{p.tanodName}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Last seen: {new Date(p.lastUpdate).toLocaleTimeString()}</p>
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {/* SOS Alerts */}
        {alerts.map((a) => (
          a.location?.lat && a.location?.lng && (
            <Marker
              key={a.id}
              position={[a.location.lat, a.location.lng]}
              icon={CitizenIcon}
            >
              <Popup>
                <div className="text-[#0F1115] p-2">
                  <p className="font-black italic uppercase tracking-tighter text-red-600 text-sm mb-1"> EMERGENCY 🆘</p>
                  <p className="font-bold text-xs">{a.type.toUpperCase()}</p>
                  <p className="text-xs">{a.residentName}</p>
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}
