#!/bin/bash

# Metropoly Multiplayer Deployment Script
# This script helps set up the multiplayer game

echo "🎰 Metropoly Multiplayer Setup 🎰"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if all required files exist
echo "🔍 Checking required files..."

required_files=(
    "server.js"
    "lobby.html"
    "lobby.js"
    "game.html"
    "multiplayer.js"
    "package.json"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        exit 1
    fi
done

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy the backend to Render:"
echo "   - Go to https://dashboard.render.com/"
echo "   - Create a new Web Service"
echo "   - Connect your GitHub repository"
echo "   - Set Build Command: npm install"
echo "   - Set Start Command: npm start"
echo ""
echo "2. Deploy the frontend to Netlify:"
echo "   - Go to https://app.netlify.com/"
echo "   - Create a new site from Git"
echo "   - Connect your GitHub repository"
echo "   - Deploy (no build command needed)"
echo ""
echo "3. Update WebSocket URLs:"
echo "   - Edit lobby.js and multiplayer.js"
echo "   - Replace 'your-render-app-name' with your actual Render service name"
echo ""
echo "4. Test locally:"
echo "   - Run: npm start (for backend)"
echo "   - Open lobby.html in your browser"
echo ""
echo "📖 For detailed instructions, see MULTIPLAYER_README.md" 