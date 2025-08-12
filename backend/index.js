const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('colyseus');

const app = express();
app.use(cors({
  origin: '*', // Change to your Netlify frontend URL for production
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);
const colyseusServer = new Server({
  server
});

// Room definitions
const { LobbyRoom } = require('./rooms/LobbyRoom');
const { GameRoom } = require('./rooms/GameRoom');

colyseusServer.define('lobby', LobbyRoom);
colyseusServer.define('game', GameRoom);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Colyseus server running on port ${PORT}`);
});
