# =========================================
# BRGY TANOD SOS - FULL GPS BACKEND
# =========================================

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import math

app = FastAPI()

# Allow all (for mobile apps)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: List[WebSocket] = []
locations: Dict[str, dict] = {}

# -----------------------------
# Distance (simple)
# -----------------------------
def distance(a, b):
    return math.sqrt((a["lat"]-b["lat"])**2 + (a["lng"]-b["lng"])**2)

# -----------------------------
# Find nearest tanod
# -----------------------------
def find_nearest_tanod(citizen):
    nearest = None
    min_d = 999999

    for uid, loc in locations.items():
        if loc.get("role") == "tanod":
            d = distance(citizen, loc)
            if d < min_d:
                min_d = d
                nearest = loc

    return nearest

# -----------------------------
# WebSocket GPS stream
# -----------------------------
@app.websocket("/ws/gps")
async def gps_ws(ws: WebSocket):
    await ws.accept()
    clients.append(ws)

    try:
        while True:
            data = await ws.receive_json()
            locations[data["user_id"]] = data

            for c in clients:
                await c.send_json({
                    "type": "location_update",
                    "data": locations
                })

    except WebSocketDisconnect:
        clients.remove(ws)

# -----------------------------
# SOS endpoint
# -----------------------------
@app.post("/sos")
async def sos(data: dict):
    nearest = find_nearest_tanod(data)
    return {
        "status": "SOS_RECEIVED",
        "nearest_tanod": nearest
    }

# -----------------------------
# Health check
# -----------------------------
@app.get("/")
def root():
    return {
        "status": "RUNNING",
        "message": "Brgy Tanod GPS Live"
    }
