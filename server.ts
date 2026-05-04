import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws/gps' });

  app.use(express.json());

  // -----------------------------
  // Backend State (From Python)
  // -----------------------------
  const locations: Record<string, any> = {};

  function distance(a: any, b: any) {
    if (!a.lat || !a.lng || !b.lat || !b.lng) return 999999;
    return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
  }

  function findNearestTanod(citizen: any) {
    let nearest = null;
    let minD = 999999;

    for (const [uid, loc] of Object.entries(locations)) {
      if (loc.role === "tanod") {
        const d = distance(citizen, loc);
        if (d < minD) {
          minD = d;
          nearest = loc;
        }
      }
    }
    return nearest;
  }

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.user_id) {
          locations[data.user_id] = data;

          // Broadcast to all clients
          const payload = JSON.stringify({
            type: "location_update",
            data: locations
          });

          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
        }
      } catch (err) {
        console.error("WS Parse error", err);
      }
    });

    ws.on("close", () => {
      // Could logic here if disconnected
    });
  });

  // -----------------------------
  // HTTP Endpoints
  // -----------------------------
  app.post("/api/sos", (req, res) => {
    const data = req.body;
    const nearest = findNearestTanod(data);
    res.json({
      status: "SOS_RECEIVED",
      nearest_tanod: nearest
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "RUNNING", message: "Brgy Tanod GPS Live (Node.js)" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
