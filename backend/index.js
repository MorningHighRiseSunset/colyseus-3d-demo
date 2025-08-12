const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('colyseus');

const app = express();
app.use(cors({
  origin: ['https://colyseusdemo3d.netlify.app'], // Netlify frontend URL
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);
const colyseusServer = new Server({ server });

// Room definition
const { GameRoom } = require('./GameRoom');
colyseusServer.define('game', GameRoom);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Colyseus server running on port ${PORT}`);
});
