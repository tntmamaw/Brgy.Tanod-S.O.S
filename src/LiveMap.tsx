import React, { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { startGPS } from "./gpsSystem";
import { OfflineTileLayer } from "./components/OfflineTileLayer";
import { useIncidentStore } from "./store/useIncidentStore";
import { useTanodStore } from "./store/useTanodStore";

// ─── Map center ───────────────────────────────────────────────────────────────
const CENTER: [number, number] = [13.2236, 120.596]; // Mamburao

// ─── Injected CSS (animations + popup skin) ───────────────────────────────────
const MAP_STYLES = `
  @keyframes officer-ping {
    0%   { transform: scale(0.85); opacity: 0.9; }
    70%  { transform: scale(2.4);  opacity: 0;   }
    100% { transform: scale(2.4);  opacity: 0;   }
  }
  @keyframes sos-pulse {
    0%   { transform: scale(0.9); opacity: 1; }
    65%  { transform: scale(2.8); opacity: 0; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes sos-blink {
    0%, 100% { transform: scale(1);    }
    50%       { transform: scale(1.14); }
  }

  /* ── Officer marker ── */
  .officer-wrap {
    position: relative; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
  }
  .officer-ring {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid #4AEF80;
    animation: officer-ping 2.2s ease-out infinite;
  }
  .officer-dot {
    width: 32px; height: 32px; border-radius: 50%;
    background: #0E1F0F; border: 2px solid #4AEF80;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; position: relative; z-index: 2;
    box-shadow: 0 0 14px rgba(74,239,128,0.55);
  }

  /* ── SOS marker ── */
  .sos-wrap {
    position: relative; width: 42px; height: 42px;
    display: flex; align-items: center; justify-content: center;
  }
  .sos-ring-1 {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid var(--sc, #FF4B4B);
    animation: sos-pulse 1.7s ease-out infinite;
  }
  .sos-ring-2 {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid var(--sc, #FF4B4B);
    animation: sos-pulse 1.7s ease-out infinite 0.55s;
  }
  .sos-dot {
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--sb, #2A1A1A); border: 2px solid var(--sc, #FF4B4B);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; position: relative; z-index: 2;
    box-shadow: 0 0 18px var(--sg, rgba(255,75,75,0.6));
    animation: sos-blink 1.3s ease-in-out infinite;
  }

  /* ── Popup skin ── */
  .leaflet-popup-content-wrapper {
    background: rgba(10,12,16,0.94) !important;
    border: 1px solid rgba(255,255,255,0.07) !important;
    border-radius: 14px !important;
    box-shadow: 0 10px 36px rgba(0,0,0,0.7) !important;
    backdrop-filter: blur(14px) !important;
  }
  .leaflet-popup-tip { background: rgba(10,12,16,0.94) !important; }
  .leaflet-popup-content { margin: 0 !important; }
  .pp { padding: 12px 15px; min-width: 164px; }
  .pp-lbl  { font-family:'Courier New',monospace; font-size:9px; letter-spacing:.14em; text-transform:uppercase; opacity:.45; margin-bottom:4px; }
  .pp-name { font-size:13px; font-weight:700; color:#F0F0F0; margin-bottom:3px; }
  .pp-sub  { font-size:11px; font-weight:600; color:rgba(255,255,255,0.65); }
  .pp-meta { font-size:10px; font-family:monospace; opacity:.4; margin-top:7px; }
  .pp-badge {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 8px; border-radius:999px; margin-top:6px;
    font-size:10px; font-weight:700; letter-spacing:.07em;
  }
`;

// ─── Severity palette ─────────────────────────────────────────────────────────
interface SevConfig { color: string; bg: string; glow: string; emoji: string; label: string }
const SEV: Record<string, SevConfig> = {
  fire:    { color:"#FF8C00", bg:"#1F1000", glow:"rgba(255,140,0,0.6)",   emoji:"🔥", label:"FIRE"    },
  medical: { color:"#00D4FF", bg:"#001422", glow:"rgba(0,212,255,0.5)",   emoji:"🚑", label:"MEDICAL" },
  crime:   { color:"#FF4B4B", bg:"#1E0808", glow:"rgba(255,75,75,0.6)",   emoji:"🚨", label:"CRIME"   },
  sos:     { color:"#FF4B4B", bg:"#1E1010", glow:"rgba(255,75,75,0.5)",   emoji:"🆘", label:"SOS"     },
};

function getSev(type: string): SevConfig {
  const t = (type || "").toLowerCase();
  if (t.includes("fire"))                                           return SEV.fire;
  if (t.includes("medical")||t.includes("health")||t.includes("ambulance")) return SEV.medical;
  if (t.includes("crime")||t.includes("theft")||t.includes("assault")||t.includes("robbery")) return SEV.crime;
  return SEV.sos;
}

// ─── Icon factories ───────────────────────────────────────────────────────────
const makeOfficerIcon = () => L.divIcon({
  className: "",
  html: `<div class="officer-wrap"><div class="officer-ring"></div><div class="officer-dot">👮</div></div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
});

const makeSosIcon = (type: string) => {
  const s = getSev(type);
  return L.divIcon({
    className: "",
    html: `<div class="sos-wrap" style="--sc:${s.color};--sb:${s.bg};--sg:${s.glow}">
             <div class="sos-ring-1"></div><div class="sos-ring-2"></div>
             <div class="sos-dot">${s.emoji}</div>
           </div>`,
    iconSize: [42, 42], iconAnchor: [21, 21],
  });
};

const YouHereIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 16px rgba(59,130,246,0.9);"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

// ─── Haversine ────────────────────────────────────────────────────────────────
function dist(lat1:number, lng1:number, lat2:number, lng2:number): number {
  const R=6371, dLat=((lat2-lat1)*Math.PI)/180, dLng=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ─── MapController: resize fix + auto-fit bounds ──────────────────────────────
function MapController({ patrols, alerts, showP, showS }: any) {
  const map = useMap();

  useEffect(() => {
    let alive = true;
    const inv = () => { if(alive&&map&&(map as any)._mapPane) try{map.invalidateSize({animate:false})}catch{} };
    const ro = new window.ResizeObserver(inv);
    ro.observe(map.getContainer());
    const ts = [10,100,500,1000].map(t=>setTimeout(inv,t));
    map.whenReady(()=>setTimeout(inv,0));
    return ()=>{ alive=false; ro.disconnect(); ts.forEach(clearTimeout); };
  }, [map]);

  useEffect(() => {
    const pts: [number, number][] = [];
    if (showP) patrols.forEach((p:any)=>{ if(p.location?.lat&&p.location?.lng) pts.push([p.location.lat,p.location.lng]); });
    if (showS) alerts.forEach((a:any) =>{ if(a.location?.lat&&a.location?.lng) pts.push([a.location.lat,a.location.lng]); });
    if (pts.length >= 2) try{ map.fitBounds(L.latLngBounds(pts),{padding:[52,52],maxZoom:16}); }catch{}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ─── RoutingLines: dashed line from each SOS → nearest patrol ────────────────
function RoutingLines({ patrols, alerts, show }: any) {
  if (!show) return null;
  return (
    <>
      {alerts.map((a: any) => {
        if (!a.location?.lat||!a.location?.lng) return null;
        let nearest: any = null, best = Infinity;
        patrols.forEach((p:any)=>{
          if(!p.location?.lat||!p.location?.lng) return;
          const d=dist(a.location.lat,a.location.lng,p.location.lat,p.location.lng);
          if(d<best){ best=d; nearest=p; }
        });
        if (!nearest) return null;
        const s = getSev(a.type);
        return (
          <Polyline
            key={`rt-${a.id}`}
            positions={[[a.location.lat,a.location.lng],[nearest.location.lat,nearest.location.lng]]}
            pathOptions={{ color:s.color, weight:2, opacity:0.65, dashArray:"7 6" }}
          />
        );
      })}
    </>
  );
}

// ─── Locate button ────────────────────────────────────────────────────────────
interface UserPos { lat:number; lng:number; accuracy:number }

function LocateBtn({ onLocated }: { onLocated:(p:UserPos)=>void }) {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const go = () => {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords:{ latitude:lat, longitude:lng, accuracy }}) => {
        map.flyTo([lat,lng],17);
        onLocated({ lat, lng, accuracy });
        setBusy(false); setDone(true);
      },
      (err) => { console.error("GPS",err); setBusy(false); alert("Unable to fetch location"); },
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    );
  };

  return (
    <button
      onClick={(e)=>{ e.preventDefault(); go(); }}
      title="Pinpoint My Location"
      className={[
        "absolute bottom-4 right-4 z-[400] w-12 h-12 text-xl rounded-full shadow-lg",
        "flex items-center justify-center transition-all",
        done  ? "bg-blue-500/80 border border-blue-400 hover:bg-blue-400"
              : "bg-[#252932] border border-[#2D3139] hover:bg-[#FF4B4B] hover:scale-110",
        busy ? "animate-pulse" : "",
      ].join(" ")}
    >
      {busy
        ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        : done ? "🔵" : "📍"}
    </button>
  );
}

// ─── LiveMap ──────────────────────────────────────────────────────────────────
export default function LiveMap() {
  const { alerts }  = useIncidentStore();
  const { patrols } = useTanodStore();

  const [showPatrols, setShowPatrols] = useState(true);
  const [showSOS,     setShowSOS]     = useState(true);
  const [showRoutes,  setShowRoutes]  = useState(true);
  const [showLegend,  setShowLegend]  = useState(false);
  const [userPos,     setUserPos]     = useState<UserPos | null>(null);

  const activePatrols = patrols.filter(p=>p.location?.lat&&p.location?.lng).length;
  const activeSOS     = alerts.filter(a=>a.location?.lat&&a.location?.lng).length;

  // Inject global CSS once
  useEffect(() => {
    const ID = "livemap-css";
    if (!document.getElementById(ID)) {
      const s = document.createElement("style");
      s.id = ID; s.textContent = MAP_STYLES;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative bg-[#0F1115]">

      {/* ── Status badges ── */}
      <div className="absolute top-3 left-3 z-[401] flex flex-wrap gap-2 items-center">
        {/* Patrols count */}
        <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-md border border-white/[0.07] rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
          <span className="text-[11px] font-bold font-mono text-emerald-300">
            {activePatrols} PATROL{activePatrols !== 1 ? "S" : ""}
          </span>
        </div>
        {/* SOS count */}
        <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-md border border-white/[0.07] rounded-full px-3 py-1.5">
          <span className={`w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)] ${activeSOS > 0 ? "animate-ping" : ""}`} />
          <span className="text-[11px] font-bold font-mono text-red-300">{activeSOS} SOS</span>
        </div>
        {/* User location */}
        {userPos && (
          <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-md border border-blue-500/25 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-bold font-mono text-blue-300">
              YOU ±{Math.round(userPos.accuracy)}m
            </span>
          </div>
        )}
      </div>

      {/* ── Filter toolbar (left-bottom) ── */}
      <div className="absolute bottom-4 left-4 z-[401] flex flex-col gap-2">
        {/* Legend toggle */}
        <button
          onClick={() => setShowLegend(v=>!v)}
          title="Legend"
          className={`w-10 h-10 rounded-full backdrop-blur-md border text-sm flex items-center justify-center transition-all
            ${showLegend ? "bg-white/10 border-white/20" : "bg-black/60 border-white/10 hover:bg-white/10"}`}
        >ℹ️</button>

        {/* Patrols toggle */}
        <button
          onClick={() => setShowPatrols(v=>!v)}
          title="Toggle Patrols"
          className={`w-10 h-10 rounded-full backdrop-blur-md border text-sm flex items-center justify-center transition-all
            ${showPatrols
              ? "bg-emerald-500/20 border-emerald-400/40 shadow-[0_0_10px_rgba(52,211,153,0.25)]"
              : "bg-black/50 border-white/10 opacity-40 hover:opacity-70"}`}
        >👮</button>

        {/* SOS toggle */}
        <button
          onClick={() => setShowSOS(v=>!v)}
          title="Toggle SOS"
          className={`w-10 h-10 rounded-full backdrop-blur-md border text-sm flex items-center justify-center transition-all
            ${showSOS
              ? "bg-red-500/20 border-red-400/40 shadow-[0_0_10px_rgba(248,113,113,0.25)]"
              : "bg-black/50 border-white/10 opacity-40 hover:opacity-70"}`}
        >🆘</button>

        {/* Routes toggle */}
        <button
          onClick={() => setShowRoutes(v=>!v)}
          title="Toggle Routing Lines"
          className={`w-10 h-10 rounded-full backdrop-blur-md border text-sm flex items-center justify-center transition-all
            ${showRoutes
              ? "bg-amber-500/20 border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.25)]"
              : "bg-black/50 border-white/10 opacity-40 hover:opacity-70"}`}
        >🔗</button>
      </div>

      {/* ── Legend panel ── */}
      {showLegend && (
        <div className="absolute bottom-4 left-[3.75rem] z-[401] bg-black/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3 min-w-[168px]">
          <p className="text-[9px] font-mono uppercase tracking-widest text-white/35 mb-2.5">LEGEND</p>
          {([
            { emoji:"👮", color:"#4AEF80", label:"Officer / Patrol" },
            { emoji:"🔥", color:"#FF8C00", label:"Fire SOS"         },
            { emoji:"🚑", color:"#00D4FF", label:"Medical SOS"      },
            { emoji:"🚨", color:"#FF4B4B", label:"Crime SOS"        },
            { emoji:"🆘", color:"#FF6060", label:"General SOS"      },
            { emoji:"🔵", color:"#3B82F6", label:"Your Location"    },
          ] as const).map(it=>(
            <div key={it.label} className="flex items-center gap-2.5 py-[4px]">
              <span className="text-sm leading-none">{it.emoji}</span>
              <span className="text-[11px] font-semibold" style={{ color:it.color }}>{it.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Leaflet map ── */}
      <MapContainer
        center={CENTER}
        zoom={14}
        style={{ height:"100%", width:"100%" }}
        className="z-10"
      >
        <OfflineTileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController patrols={patrols} alerts={alerts} showP={showPatrols} showS={showSOS} />

        {/* Routing lines: SOS → nearest patrol */}
        {showSOS && showPatrols && (
          <RoutingLines patrols={patrols} alerts={alerts} show={showRoutes} />
        )}

        {/* "You are here" marker + accuracy circle */}
        {userPos && (
          <>
            <Circle
              center={[userPos.lat, userPos.lng]}
              radius={userPos.accuracy}
              pathOptions={{ color:"#3B82F6", fillColor:"#3B82F6", fillOpacity:0.07, weight:1, opacity:0.35 }}
            />
            <Marker position={[userPos.lat, userPos.lng]} icon={YouHereIcon} zIndexOffset={900}>
              <Popup>
                <div className="pp">
                  <p className="pp-lbl" style={{ color:"#3B82F680" }}>GPS Position</p>
                  <p className="pp-name">📍 You are here</p>
                  <p className="pp-meta">±{Math.round(userPos.accuracy)} m accuracy</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Active patrols */}
        {showPatrols && patrols.map((p) =>
          p.location?.lat && p.location?.lng ? (
            <Marker key={p.tanodId} position={[p.location.lat, p.location.lng]} icon={makeOfficerIcon()} zIndexOffset={100}>
              <Popup>
                <div className="pp">
                  <p className="pp-lbl" style={{ color:"#4AEF8080" }}>Active Patrol</p>
                  <p className="pp-name">{p.tanodName}</p>
                  <span className="pp-badge" style={{ background:"rgba(74,239,128,0.12)", color:"#4AEF80", border:"1px solid rgba(74,239,128,0.25)" }}>
                    🟢 ON DUTY
                  </span>
                  <p className="pp-meta">Last ping: {new Date(p.lastUpdate).toLocaleTimeString()}</p>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}

        {/* SOS alerts */}
        {showSOS && alerts.map((a) => {
          if (!a.location?.lat || !a.location?.lng) return null;
          const s = getSev(a.type);
          return (
            <Marker key={a.id} position={[a.location.lat, a.location.lng]} icon={makeSosIcon(a.type)} zIndexOffset={200}>
              <Popup>
                <div className="pp">
                  <p className="pp-lbl" style={{ color:`${s.color}80` }}>Emergency Alert</p>
                  <p className="pp-name" style={{ color:s.color }}>{s.emoji} {s.label}</p>
                  <p className="pp-sub">{a.residentName}</p>
                  <span className="pp-badge" style={{ background:s.bg, color:s.color, border:`1px solid ${s.color}35` }}>
                    ⚠ {a.type.toUpperCase()}
                  </span>
                  <p className="pp-meta">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <LocateBtn onLocated={setUserPos} />
      </MapContainer>
    </div>
  );
}
