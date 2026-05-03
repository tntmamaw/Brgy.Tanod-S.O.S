# 🚀 Step-by-Step Deployment Guide for Beginners

Welcome! This guide will walk you through deploying **Brgy Tanod SOS** to the internet. No prior deployment experience needed!

---

## 📋 **What You Need Before Starting**

### **1. Free Accounts (Create these first)**
- ✅ [Railway.app](https://railway.app) - Hosts your backend
- ✅ [Vercel](https://vercel.com) - Hosts your frontend
- ✅ GitHub account (you already have this!)

**Time to create accounts: ~5 minutes**

---

## 🎯 **Easy Path: Using Railway + Vercel (Recommended)**

This is the **easiest** and **completely FREE** option for beginners.

---

## **PART 1: Deploy Backend to Railway**

### **Step 1: Sign Up on Railway.app**

1. Go to [railway.app](https://railway.app)
2. Click **"Sign Up"** at the top
3. Select **"Sign up with GitHub"**
4. Click **"Authorize railway-app"**
5. Done! ✅

### **Step 2: Create a New Project**

1. On Railway dashboard, click **"New Project"**
2. Click **"Deploy from GitHub repo"**
3. Click **"Configure GitHub App"**
4. Select your **tntmamaw/Brgy.Tanod-S.O.S** repository
5. Click **"Install"**

### **Step 3: Add Your Backend Service**

1. Select the **Brgy.Tanod-S.O.S** repository
2. Railway will detect the **Dockerfile**
3. Click **"Deploy"**
4. Wait for the build (takes ~3-5 minutes)

### **Step 4: Get Your Backend URL**

1. Once deployed, go to your project
2. Click the **"backend"** service
3. Click **"Settings"**
4. Copy the **"Railway Domain"** (looks like: `https://brgy-tanod-backend-production.up.railway.app`)
5. **Save this URL** - you'll need it later! 📌

---

## **PART 2: Deploy Frontend to Vercel**

### **Step 1: Sign Up on Vercel**

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Select **"Continue with GitHub"**
4. Click **"Authorize Vercel"**
5. Done! ✅

### **Step 2: Create New Project**

1. Click **"New Project"** on Vercel dashboard
2. Click **"Import"** next to your **Brgy.Tanod-S.O.S** repo
3. Click **"Import"**

### **Step 3: Configure Environment Variables**

Before deploying, add your backend URL:

1. In Vercel, scroll to **"Environment Variables"**
2. Add these variables:
   ```
   VITE_API_URL=https://your-railway-backend-url.railway.app
   VITE_WS_URL=wss://your-railway-backend-url.railway.app/ws/gps
   VITE_FIREBASE_PROJECT_ID=gen-lang-client-0433922302
   VITE_FIREBASE_API_KEY=AIzaSyBsBqnHw9d1rc6HB2kHVytr0ZXAlx6s0qY
   VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0433922302.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://gen-lang-client-0433922302.firebaseio.com
   VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0433922302.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=643968538769
   VITE_FIREBASE_APP_ID=1:643968538769:web:feae4acd4266cbe4348730
   ```

**Replace** `your-railway-backend-url.railway.app` with the URL you copied in Part 1, Step 4.

3. Click **"Deploy"**
4. Wait for the build (takes ~2-3 minutes)

### **Step 4: Get Your Frontend URL**

1. Once deployed, Vercel shows your **live URL** (like: `https://brgy-tanod-sos.vercel.app`)
2. **Click the link** - your app is now LIVE! 🎉

---

## ✅ **Your App is Now Live!**

| Component | URL |
|-----------|-----|
| **Frontend** | `https://your-vercel-url.vercel.app` |
| **Backend** | `https://your-railway-url.railway.app` |

### **Test It:**

1. Open your frontend URL in multiple browser windows
2. Set different roles (Resident, Tanod, Admin)
3. Click "Start Tracking"
4. **Watch live GPS updates!** 🗺️

---

## 🆘 **Common Issues & Fixes**

### **Issue: "WebSocket connection failed"**

**Cause:** Backend URL not set correctly in Vercel

**Fix:**
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Check that `VITE_WS_URL` matches your Railway backend URL
3. Redeploy: Click "Redeploy" button

### **Issue: "Map not showing"**

**Cause:** Missing Leaflet dependencies

**Fix:**
1. Go to your GitHub repo
2. Edit `package.json`
3. Ensure these lines exist:
   ```json
   "leaflet": "^1.9.4",
   "react-leaflet": "^5.0.0"
   ```
4. Push to GitHub - Vercel will auto-rebuild

### **Issue: "White screen on frontend"**

**Cause:** Build errors

**Fix:**
1. Go to Vercel → Your Project → Deployments
2. Click the failed deployment
3. Click **"Build Logs"**
4. Look for error messages
5. Fix the error in your code
6. Push to GitHub to auto-redeploy

---

## 🔄 **How to Update Your App**

After deployment, any changes are **automatic**:

1. Make changes locally
2. Commit and push to GitHub
   ```bash
   git add .
   git commit -m "Fix GPS tracking issue"
   git push origin main
   ```
3. Vercel + Railway automatically redeploy! ✅

---

## 📱 **Test on Mobile**

1. Get your frontend URL (from Vercel)
2. On your phone, open the URL in browser
3. Allow location permission
4. Click "Start Tracking"
5. See real-time GPS on map! 📍

---

## 🎓 **What You've Learned**

✅ Deployed backend to Railway  
✅ Deployed frontend to Vercel  
✅ Connected them together  
✅ App is now LIVE on the internet  
✅ Auto-deploys on code changes  

---

## 🎯 **Next Steps**

1. ✅ Share your URL with friends
2. ✅ Test on multiple phones
3. ✅ Implement SOS button
4. ✅ Add incident reporting
5. ✅ Monitor usage on dashboards

---

## 📞 **Need Help?**

- **Railway Issues:** Go to [railway.app docs](https://docs.railway.app)
- **Vercel Issues:** Go to [vercel.com docs](https://vercel.com/docs)
- **Your App Issues:** Check GitHub Issues or create one

---

**Congratulations! Your Brgy Tanod SOS app is now live! 🎉**

