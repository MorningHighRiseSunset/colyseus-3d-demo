# Vegas Metropoly Server Deployment Guide

## 🚨 Current Issue
The server at `metropoly.onrender.com` is not responding, causing CORS and WebSocket connection failures.

## 🔧 Quick Fixes

### Option 1: Deploy to Render (Recommended)

1. **Create a new Render account** (if you don't have one)
   - Go to https://render.com
   - Sign up with GitHub

2. **Deploy the server**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Set the following:
     - **Name**: `metropoly-server`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. **Environment Variables** (if needed):
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render's default)

4. **Deploy and get your URL**:
   - Render will give you a URL like: `https://your-app-name.onrender.com`
   - Update the client code with this new URL

### Option 2: Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Test the server**:
   ```bash
   node test-server.js
   ```

4. **Update client URLs** to use `localhost:3000`

### Option 3: Use a Different Hosting Service

- **Railway**: https://railway.app
- **Heroku**: https://heroku.com
- **Vercel**: https://vercel.com

## 🔄 Update Client Code

After deploying, update these files with your new server URL:

### In `lobby.js`:
```javascript
getServerUrl() {
    const servers = [
        'wss://your-new-server.onrender.com', // Update this
        'ws://localhost:3000',
        'wss://metropoly.onrender.com' // Fallback
    ];
    return servers[0];
}
```

### In `multiplayer.js`:
```javascript
getServerUrl() {
    const servers = [
        'wss://your-new-server.onrender.com', // Update this
        'ws://localhost:3000',
        'wss://metropoly.onrender.com' // Fallback
    ];
    return servers[0];
}
```

## 🧪 Test Your Deployment

1. **Health Check**: Visit `https://your-server.onrender.com/health`
2. **API Test**: Visit `https://your-server.onrender.com/api/rooms`
3. **WebSocket Test**: Run `node test-server.js`

## 📋 Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - ✅ Fixed in server.js with enhanced CORS config
   - ✅ Added multiple allowed origins

2. **WebSocket Connection Failed**:
   - ✅ Added error handling and reconnection logic
   - ✅ Added fallback server URLs

3. **Server Not Responding**:
   - ✅ Added health check endpoint
   - ✅ Added better error logging
   - ✅ Added graceful shutdown

### Debug Steps:

1. **Check server logs** in Render dashboard
2. **Test endpoints** manually in browser
3. **Check network tab** in browser dev tools
4. **Run test script**: `node test-server.js`

## 🎯 Expected Results

After successful deployment:
- ✅ No CORS errors
- ✅ WebSocket connections work
- ✅ Room creation/joining works
- ✅ Multiplayer game functions properly

## 📞 Need Help?

If you're still having issues:
1. Check Render deployment logs
2. Test with the provided test script
3. Verify all environment variables are set
4. Ensure the server is actually running and accessible 