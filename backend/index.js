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
  // --- Metropoly Multiplayer Logic ---
  socket.on('joinMetropoly', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {} };
    rooms[roomId].players[playerId] = { name: playerName || 'Player' };
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({ id, ...info })));
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
  });

  // --- Queue/Room Multiplayer Logic for game.html ---
  socket.on('joinRoom', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {} };
    rooms[roomId].players[playerId] = { name: playerName || 'Player' };
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({ id, ...info })));
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
  });

  socket.on('moveToken', ({ roomId, playerId, newPosition }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].positions[playerId] = newPosition;
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
  });

  socket.on('disconnecting', () => {
    Object.keys(socket.rooms).forEach(roomId => {
      if (rooms[roomId] && rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        delete rooms[roomId].positions[socket.id];
        io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({ id, ...info })));
        io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
      }
    });
  });

  // --- Ready-up and game start logic ---
  socket.on('playerReady', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) return;
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

  // --- Room creation logic ---
  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substr(2, 8);
    rooms[roomId] = { positions: {}, players: {}, tokens: {}, ready: {} };
    socket.emit('roomCreated', roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
