import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Alert, PatrolLocation } from '../types';
import { useEffect, useState, useCallback } from 'react';
import { downloadRegion } from '../lib/mapDownloader';
import { getCachedTile, cacheTile } from '../lib/mapDb';
import { HardDrive, Download, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Fix for default marker icons in Leaflet with React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const SosIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #FF4B4B; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px #FF4B4B; border: 2px solid white; animation: pulse 1s infinite;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const TanodIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4CAF50; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 8px #4CAF50; border: 2px solid white;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function ChangeView({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

interface MapProps {
  alerts: Alert[];
  patrols: PatrolLocation[];
  center?: [number, number];
  showHeatmap?: boolean;
}

function OfflineTileLayer(props: any) {
  const map = useMap();
  
  useEffect(() => {
    const tileLayer = L.tileLayer(props.url, {
      ...props,
      // Custom tile creation logic
    });

    // Override the tile creation to check cache first
    (tileLayer as any).createTile = function(coords: any, done: L.DoneCallback) {
      const tile = document.createElement('img');
      L.DomEvent.on(tile, 'load', L.Util.bind((tileLayer as any)._tileOnLoad, tileLayer, done, tile));
      L.DomEvent.on(tile, 'error', L.Util.bind((tileLayer as any)._tileOnError, tileLayer, done, tile));

      const url = tileLayer.getTileUrl(coords);
      
      getCachedTile(url).then(cachedUrl => {
        if (cachedUrl) {
          tile.src = cachedUrl;
        } else {
          tile.src = url;
          // Cache on the fly
          fetch(url).then(res => res.blob()).then(blob => {
            cacheTile(url, blob);
          });
        }
      });

      return tile;
    };

    tileLayer.addTo(map);
    return () => {
      map.removeLayer(tileLayer);
    };
  }, [map, props.url]);

  return null;
}

export default function ActiveMap({ alerts, patrols, center: propCenter, showHeatmap = true }: MapProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Determine final center: 
  // 1. First active alert
  // 2. Provided prop center
  // 3. Default center
  const [mapCenter, setMapCenter] = useState<[number, number]>(propCenter || [13.0641, 120.7303]);
  const [zoom, setZoom] = useState(15);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadRegion((current, total) => {
        setProgress({ current, total });
      });
      setIsDownloaded(true);
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

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative border border-[#2D3139]">
      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
      >
        <OfflineTileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="grayscale invert brightness-90 contrast-90" 
        />
        <ChangeView center={mapCenter} zoom={zoom} />
        
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
              <Popup>
                <div className="p-1 text-xs">
                  <p className="font-bold text-[#4CAF50]">Tanod: {patrol.tanodName}</p>
                  <p>Status: {patrol.isActive ? 'Active Patrol' : 'Inactive'}</p>
                  {patrol.location.accuracy && (
                    <p className="text-[10px] text-gray-400 mt-1">Accuracy: ±{Math.round(patrol.location.accuracy)}m</p>
                  )}
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
