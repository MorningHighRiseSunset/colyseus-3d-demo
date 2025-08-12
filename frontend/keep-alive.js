#!/usr/bin/env node

/**
 * Keep-Alive Service for Metropoly Server
 * This script pings the server every 10 minutes to prevent it from sleeping
 * 
 * Usage:
 * 1. Run locally: node keep-alive.js
 * 2. Deploy to a free service like Render, Railway, or GitHub Actions
 * 3. Set environment variables for SERVER_URL
 */

const https = require('https');
const http = require('http');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'https://colyseus-3d-demo.onrender.com';
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
const ENDPOINTS = ['/ping', '/keep-alive', '/health'];

console.log('🚀 Metropoly Keep-Alive Service Starting...');
console.log(`📡 Target Server: ${SERVER_URL}`);
console.log(`⏰ Ping Interval: ${PING_INTERVAL / 1000 / 60} minutes`);
console.log(`🔗 Endpoints: ${ENDPOINTS.join(', ')}`);

function pingServer(endpoint) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SERVER_URL);
        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const timestamp = new Date().toISOString();
                if (res.statusCode === 200) {
                    console.log(`✅ ${timestamp} - ${endpoint} - Status: ${res.statusCode}`);
                    resolve({ success: true, statusCode: res.statusCode, data });
                } else {
                    console.log(`⚠️  ${timestamp} - ${endpoint} - Status: ${res.statusCode}`);
                    resolve({ success: false, statusCode: res.statusCode, data });
                }
            });
        });
        
        req.on('error', (error) => {
            const timestamp = new Date().toISOString();
            console.error(`❌ ${timestamp} - ${endpoint} - Error:`, error.message);
            reject(error);
        });
        
        req.setTimeout(30000, () => {
            req.destroy();
            const timestamp = new Date().toISOString();
            console.error(`⏰ ${timestamp} - ${endpoint} - Request timeout`);
            reject(new Error('Request timeout'));
        });
    });
}

async function performHealthCheck() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 ${timestamp} - Starting health check...`);
    
    const results = [];
    
    for (const endpoint of ENDPOINTS) {
        try {
            const result = await pingServer(endpoint);
            results.push({ endpoint, ...result });
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            results.push({ endpoint, success: false, error: error.message });
        }
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`📊 Health Check Summary: ${successful}/${total} endpoints successful`);
    
    if (successful === 0) {
        console.error('🚨 All endpoints failed! Server might be down or sleeping.');
    } else if (successful < total) {
        console.warn('⚠️  Some endpoints failed. Server might be having issues.');
    } else {
        console.log('✅ All endpoints successful! Server is awake and healthy.');
    }
    
    return results;
}

// Start the keep-alive service
async function startKeepAlive() {
    console.log('🔄 Starting keep-alive service...');
    
    // Perform initial health check
    await performHealthCheck();
    
    // Set up periodic health checks
    setInterval(async () => {
        await performHealthCheck();
    }, PING_INTERVAL);
    
    console.log('✅ Keep-alive service is running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down keep-alive service...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down keep-alive service...');
    process.exit(0);
});

// Start the service
startKeepAlive().catch(error => {
    console.error('❌ Failed to start keep-alive service:', error);
    process.exit(1);
});
