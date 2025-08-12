const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors({
  origin: ['https://colyseusdemo3d.netlify.app'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://colyseusdemo3d.netlify.app'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  }
});


const rooms = {};

io.on('connection', (socket) => {
  // --- Ready-up and game start logic ---
  socket.on('playerReady', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) return;
    if (!rooms[roomId].ready) rooms[roomId].ready = {};
    rooms[roomId].ready[playerId] = true;
    // Broadcast all ready states
    const readyStates = {};
    Object.entries(rooms[roomId].players).forEach(([pid, info]) => {
      readyStates[info.name] = !!rooms[roomId].ready[pid];
    });
    io.to(roomId).emit('playerReadyStates', readyStates);
  });

  socket.on('startGame', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) return;
    // Only host can start
    const hostId = Object.keys(rooms[roomId].players)[0];
    if (playerId === hostId) {
      io.to(roomId).emit('gameStarted', { hostName: playerName, roomId });
    }
  });
  // --- Room creation/join logic (can be replaced for Monopoly) ---
  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substr(2, 8);
    rooms[roomId] = { positions: {}, block: { x: 0, y: 0, color: '#00c6ff', grabbedBy: null } };
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) return;
    // Store player info (for Monopoly, use a player object)
    if (!rooms[roomId].players) rooms[roomId].players = {};
    rooms[roomId].players[playerId] = { name: playerName || 'Player' };
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    // Assign player number (for demo, just order of join)
    const playerNum = Object.keys(rooms[roomId].positions).length;
    socket.emit('playerNumber', playerNum);
    io.to(roomId).emit('update', { positions: rooms[roomId].positions });
    // Send current block state with name
    socket.emit('blockUpdate', { ...rooms[roomId].block, playerId, playerName });
  });

  // --- 3D block movement demo (delete for Monopoly) ---
  socket.on('grabBlock', ({ roomId, playerId, color }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].block.grabbedBy = playerId;
    rooms[roomId].block.color = color;
    // Broadcast with player name
    const playerName = rooms[roomId].players?.[playerId]?.name || 'Player';
    io.to(roomId).emit('blockUpdate', { ...rooms[roomId].block, playerId, playerName });
  });

  socket.on('releaseBlock', ({ roomId, playerId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].block.grabbedBy === playerId) {
      rooms[roomId].block.grabbedBy = null;
      rooms[roomId].block.color = '#00c6ff';
      const playerName = rooms[roomId].players?.[playerId]?.name || 'Player';
      io.to(roomId).emit('blockUpdate', { ...rooms[roomId].block, playerId, playerName });
    }
  });

  socket.on('moveBlock', ({ roomId, playerId, x, y, color }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].block.grabbedBy === playerId) {
      rooms[roomId].block.x = x;
      rooms[roomId].block.y = y;
      rooms[roomId].block.color = color;
      const playerName = rooms[roomId].players?.[playerId]?.name || 'Player';
      io.to(roomId).emit('blockUpdate', { x, y, color, playerId, playerName });
    }
  });

  // --- End of 3D block demo logic ---

  // --- Move action (can be deleted for Monopoly) ---
  socket.on('move', ({ roomId, playerId, position }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].positions[playerId] = position;
    io.to(roomId).emit('update', { positions: rooms[roomId].positions });
  });

  // --- Room list (can be replaced for Monopoly) ---
  socket.on('getRooms', () => {
    socket.emit('roomList', Object.keys(rooms));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
