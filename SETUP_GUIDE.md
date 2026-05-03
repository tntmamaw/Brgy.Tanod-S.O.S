# 🚀 Complete Setup Guide - Brgy.Tanod-S.O.S

## Prerequisites

- Node.js 16+ 
- Python 3.8+
- Git
- Modern web browser with geolocation support

---

## Backend Setup

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start FastAPI Server

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 3. Test Backend

```bash
# Health check
curl http://localhost:8000/

# Expected response:
# {"status":"RUNNING","message":"Brgy Tanod GPS Live","active_users":0,"tracked_locations":0}
```

---

## Frontend Setup

### 1. Install Node Dependencies

```bash
npm install
npm install leaflet react-leaflet
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Update `.env.local` with your Firebase credentials:
```
VITE_WS_URL=ws://localhost:8000/ws/gps
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

### 3. Start Frontend Dev Server

```bash
npm run dev
```

**Expected Output:**
```
  VITE v6.2.0  ready in 345 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 4. Open in Browser

Navigate to `http://localhost:3000` (or the URL shown in terminal)

---

## Testing Workflow

### Multi-User GPS Tracking Test

**Step 1: Open Multiple Browser Windows**
- Window 1: `http://localhost:3000`
- Window 2: `http://localhost:3000` (new private window)
- Window 3: `http://localhost:3000` (new private window)

**Step 2: Set Different Roles**
- Window 1: Role = "Resident" → Click "Start Tracking"
- Window 2: Role = "Tanod Officer" → Click "Start Tracking"
- Window 3: Role = "Administrator" → Click "Start Tracking"

**Step 3: Verify Live Updates**
- ✅ All locations appear on the map
- ✅ Markers update in real-time (every 5 seconds)
- ✅ Connection status shows "Connected"
- ✅ Statistics grid updates user counts

### Command Line Testing

```bash
# Get all active locations
curl http://localhost:8000/locations

# Find nearest tanod to coordinates
curl "http://localhost:8000/nearest-tanod/14.5995/120.9842"

# Test SOS endpoint
curl -X POST http://localhost:8000/sos \
  -H "Content-Type: application/json" \
  -d '{"user_id":"resident-123","lat":14.5995,"lng":120.9842}'
```

---

## Troubleshooting

### Issue: "WebSocket connection failed"

**Solution:**
- Ensure backend is running: `uvicorn main:app --reload`
- Check firewall settings
- Verify `VITE_WS_URL` in `.env.local`

### Issue: "GPS not working"

**Solution:**
- App must run on `localhost` or `https://` (browser security)
- Check browser geolocation permission
- Enable location services on OS

### Issue: "Map not displaying"

**Solution:**
- Verify Leaflet CSS is loaded: `leaflet/dist/leaflet.css`
- Check browser console for errors
- Clear cache: `Ctrl+Shift+Delete`

### Issue: "Firebase connection failed"

**Solution:**
- Verify Firebase credentials in `.env.local`
- Check Firestore database rules allow reads/writes
- Test with: `firebase projects list`

---

## Performance Optimization

### Reduce GPS Update Frequency

Edit `src/hooks/useGPSTracking.ts`:
```typescript
navigator.geolocation.watchPosition(
  // ...
  {
    maximumAge: 10000, // Increase to 10 seconds
  }
);
```

### Reduce Map Marker Updates

Edit `src/components/MapView.tsx`:
```typescript
const [updateInterval] = useState(5000); // Adjust interval
```

### Enable Production Build

```bash
npm run build
npm run preview
```

---

## Deployment

### Deploy Backend to Railway.app

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd backend
railway up
```

### Deploy Frontend to Vercel

```bash
npm i -g vercel
vercel
```

### Using Docker

```bash
docker build -t brgy-tanod .
docker run -p 8000:8000 -p 3000:3000 brgy-tanod
```

---

## Next Steps

1. ✅ **Test multi-user tracking** - Verify real-time updates
2. ✅ **Configure Firebase** - Set up Firestore for persistence
3. ⬜ **Implement SOS System** - Connect emergency dispatch
4. ⬜ **Add Authentication** - Firebase Auth integration
5. ⬜ **Deploy to Production** - Use Railway or Vercel

---

## Support

For issues or questions, create an issue on GitHub or check the [main README](./README_GPS_SYSTEM.md)
