import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Alert, PatrolLocation } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { downloadRegion } from '../lib/mapDownloader';
import { getCachedTile, cacheTile } from '../lib/mapDb';
import { HardDrive, Download, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { OfflineTileLayer } from './OfflineTileLayer';

// Fix for default marker icons in Leaflet with React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const SosIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 24px; text-align: center; text-shadow: 0 0 10px rgba(255, 75, 75, 0.5);">🔴</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const TanodIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 24px; text-align: center; text-shadow: 0 0 10px rgba(74, 175, 80, 0.5);">🟢</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function ChangeView({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

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

interface MapProps {
  alerts: Alert[];
  patrols: PatrolLocation[];
  center?: [number, number];
  showHeatmap?: boolean;
}

export default function ActiveMap({ alerts, patrols, center: propCenter, showHeatmap = true }: MapProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Determine final center: 
  // 1. First active alert
  // 2. Provided prop center
  // 3. Default center
  const [mapCenter, setMapCenter] = useState<[number, number]>(propCenter || [13.2236, 120.5960]); // Mamburao, Occidental Mindoro
  const [zoom, setZoom] = useState(15);

  useEffect(() => {
    const hasDownloaded = localStorage.getItem('map_downloaded');
    if (hasDownloaded) {
      setIsDownloaded(true);
    } else {
      // Auto download in background
      handleDownload().then(() => {
        localStorage.setItem('map_downloaded', 'true');
      });
    }
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadRegion((current, total) => {
        setProgress({ current, total });
      });
      setIsDownloaded(true);
      localStorage.setItem('map_downloaded', 'true');
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (alerts.length > 0) {
      const activeAlert = alerts.find(a => a.status === 'pending') || alerts[0];
      setMapCenter([activeAlert.location.lat, activeAlert.location.lng]);
      setZoom(18); // Zoom in closer for emergencies
    } else if (propCenter) {
      setMapCenter(propCenter);
    }
  }, [alerts, propCenter]);

  const MyLocationButton = () => {
    const map = useMap();
    const [locating, setLocating] = useState(false);
  
    useEffect(() => {
      setTimeout(() => {
        if (map && (map as any)._mapPane) {
          map.invalidateSize();
        }
      }, 400); 
    }, [map]);

    const locateMe = () => {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.flyTo([latitude, longitude], 17);
          
          const RedIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          L.marker([latitude, longitude], { icon: RedIcon })
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
        className={cn(
          "absolute bottom-4 right-4 z-[400] w-12 h-12 bg-[#252932] text-xl rounded-full shadow-lg border border-[#2D3139] flex items-center justify-center hover:bg-[#FF4B4B] hover:scale-110 transition-all",
          locating && "animate-pulse"
        )}
        title="Pinpoint My Location"
      >
        {locating ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "📍"}
      </button>
    );
  };

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative border border-[#2D3139]">
      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
      >
        <OfflineTileLayer
          attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={mapCenter} zoom={zoom} />
        
        <MyLocationButton />
        
        {/* Tactical Overlay */}
        <div className="absolute inset-0 pointer-events-none z-[400] opacity-20 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,75,75,0.1)_90deg,rgba(255,75,75,0.3)_180deg,transparent_180deg)] animate-[radar_10s_linear_infinite]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(15,17,21,0.6)_100%)]"></div>
        </div>
        
        {alerts.map(alert => (
          <div key={alert.id}>
            {showHeatmap && alert.aiAnalysis && alert.aiAnalysis.severityScore > 6 && (
              <Circle 
                center={[alert.location.lat, alert.location.lng]}
                radius={200 * (alert.aiAnalysis.severityScore / 10)}
                pathOptions={{ 
                  color: '#FF4B4B', 
                  fillColor: '#FF4B4B', 
                  fillOpacity: 0.05,
                  weight: 0,
                  className: "animate-pulse"
                }}
              />
            )}
            <Marker 
              position={[alert.location.lat, alert.location.lng]} 
              icon={SosIcon}
            >
              <Popup className="dark-popup">
                <div className="p-1">
                  <p className="font-bold text-[#FF4B4B]">SOS: {alert.residentName}</p>
                  <p className="text-xs">{alert.type.toUpperCase()}</p>
                  {alert.location.accuracy && (
                    <p className="text-[10px] text-gray-400 mt-1">Accuracy: ±{Math.round(alert.location.accuracy)}m</p>
                  )}
                </div>
              </Popup>
            </Marker>
            {alert.location.accuracy && (
              <Circle 
                center={[alert.location.lat, alert.location.lng]}
                radius={alert.location.accuracy}
                pathOptions={{ 
                  color: '#FF4B4B', 
                  fillColor: '#FF4B4B', 
                  fillOpacity: 0.1,
                  weight: 1
                }}
              />
            )}
          </div>
        ))}

        {patrols.map(patrol => (
          <div key={patrol.id}>
            <Marker 
              position={[patrol.location.lat, patrol.location.lng]} 
              icon={TanodIcon}
            >
              <Popup className="dark-popup">
                <div className="p-2 min-w-[160px] space-y-2">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                    <div className={cn("w-2 h-2 rounded-full", patrol.isActive ? "bg-green-500 animate-pulse" : "bg-gray-500")} />
                    <p className="font-bold text-white uppercase text-sm m-0 leading-tight">{patrol.tanodName}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">ID:</span>
                      <span className="font-mono text-gray-200">{patrol.tanodId.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Status:</span>
                      <span className={cn("font-medium", patrol.isActive ? "text-green-400" : "text-gray-500")}>
                        {patrol.isActive ? 'ON DUTY' : 'OFF DUTY'}
                      </span>
                    </div>
                    {patrol.lastUpdate && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Last Seen:</span>
                        <span className="text-gray-300">
                          {new Date(patrol.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    {patrol.location.accuracy && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Accuracy:</span>
                        <span className="text-gray-300">±{Math.round(patrol.location.accuracy)}m</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
            {patrol.location.accuracy && (
              <Circle 
                center={[patrol.location.lat, patrol.location.lng]}
                radius={patrol.location.accuracy}
                pathOptions={{ 
                  color: '#4CAF50', 
                  fillColor: '#4CAF50', 
                  fillOpacity: 0.1,
                  weight: 1
                }}
              />
            )}
          </div>
        ))}
      </MapContainer>

      {/* Offline Download Controls */}
      <div className="absolute top-4 right-4 z-[400]">
        {!isDownloaded ? (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-[#16191F]/90 backdrop-blur-md border border-[#2D3139] rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:border-[#FF4B4B] transition-all",
              downloading && "cursor-not-allowed opacity-80"
            )}
          >
            {downloading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                DOWNLOADING {Math.round((progress.current / progress.total) * 100)}%
              </>
            ) : (
              <>
                <Download className="w-3 h-3 text-[#FF4B4B]" />
                OFFLINE MAP (OCC. MINDORO)
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#16191F]/90 backdrop-blur-md border border-green-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-green-500">
            <CheckCircle2 className="w-3 h-3" />
            MAP READY OFFLINE
          </div>
        )}
      </div>

      <style>{`
        .leaflet-container {
          background: #0F1115 !important;
        }
        .dark-popup .leaflet-popup-content-wrapper,
        .dark-popup .leaflet-popup-tip {
          background: #16191F !important;
          color: white !important;
          border: 1px solid #2D3139;
        }
        .dark-popup .leaflet-popup-content p {
          margin: 0 !important;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes radar {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .grayscale { filter: grayscale(100%); }
        .invert { filter: invert(100%); }
        .brightness-90 { filter: brightness(90%); }
        .contrast-90 { filter: contrast(90%); }
      `}</style>
    </div>
  );
}
