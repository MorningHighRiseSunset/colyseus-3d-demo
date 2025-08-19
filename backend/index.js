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
  // Send player number to each client when they join
  socket.on('joinRoom', ({ roomId, playerId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {} };
    rooms[roomId].players[playerId] = { name: playerName || 'Player' };
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    // Player number is order in Object.keys
    const playerIds = Object.keys(rooms[roomId].players);
    const playerNum = playerIds.indexOf(playerId) + 1;
    socket.emit('playerNumber', playerNum);
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({ id, ...info })));
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
  });
  // --- Metropoly Multiplayer Logic ---
  socket.on('joinMetropoly', ({ roomId, playerId, playerName }) => {
  if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {} };
  // Preserve token if already chosen
  const prevToken = rooms[roomId].tokens[playerId] || (rooms[roomId].players[playerId] && rooms[roomId].players[playerId].token) || null;
  rooms[roomId].players[playerId] = { name: playerName || 'Player', token: prevToken };
  if (prevToken) rooms[roomId].tokens[playerId] = prevToken;
  rooms[roomId].positions[playerId] = 0;
  socket.join(roomId);
    // PATCH: Log all player IDs in the room after join
    console.log('Room', roomId, 'players:', Object.keys(rooms[roomId].players));
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({
      id,
      ...info,
      token: rooms[roomId].tokens[id] || info.token || null
    })));
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
    // Notify current token-pick turn
    const pickOrder = Object.keys(rooms[roomId].players);
    const chosenCount = Object.keys(rooms[roomId].tokens).length;
    const nextId = pickOrder[chosenCount];
    if (nextId) {
      io.to(roomId).emit('nextTurnToPick', { playerId: nextId });
    }
  });

  // --- Queue/Room Multiplayer Logic for game.html ---
  socket.on('joinRoom', ({ roomId, playerId, playerName }) => {
  if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {} };
  // Preserve token if already chosen
  const prevToken = rooms[roomId].tokens[playerId] || (rooms[roomId].players[playerId] && rooms[roomId].players[playerId].token) || null;
  rooms[roomId].players[playerId] = { name: playerName || 'Player', token: prevToken };
  if (prevToken) rooms[roomId].tokens[playerId] = prevToken;
  rooms[roomId].positions[playerId] = 0;
  socket.join(roomId);
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({
      id,
      ...info,
      token: rooms[roomId].tokens[id] || info.token || null
    })));
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
        io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({
          id,
          ...info,
          token: rooms[roomId].tokens[id] || info.token || null
        })));
        io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
      }
    });
  });

  // --- Ready-up and game start logic ---
  socket.on('playerReady', ({ roomId, playerId }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].ready[playerId] = true;
    // Broadcast all ready states by playerId
    const readyStates = {};
    Object.keys(rooms[roomId].players).forEach(pid => {
      readyStates[pid] = !!rooms[roomId].ready[pid];
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

  // Token selection logic
  socket.on('selectToken', ({ roomId, playerId, token }) => {
    if (!rooms[roomId]) return;
    // Record chosen token
    rooms[roomId].tokens[playerId] = token;
    // Also set the token property on the player object for frontend sync
    if (rooms[roomId].players[playerId]) {
      rooms[roomId].players[playerId].token = token;
    }
    // When a player changes their token, reset their ready state
    if (rooms[roomId].ready) {
      rooms[roomId].ready[playerId] = false;
    }
    // Notify all players
    io.to(roomId).emit('playerSelectedToken', { playerId, token });
    // Broadcast updated player list with tokens
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({
      id,
      ...info,
      token: rooms[roomId].tokens[id] || info.token || null
    })));
    // Broadcast updated ready states
    const readyStates = {};
    Object.keys(rooms[roomId].players).forEach(pid => {
      readyStates[pid] = !!rooms[roomId].ready[pid];
    });
    io.to(roomId).emit('playerReadyStates', readyStates);
    // Determine next turn to pick
    const pickOrder = Object.keys(rooms[roomId].players);
    const chosenCount = Object.keys(rooms[roomId].tokens).length;
    if (chosenCount < pickOrder.length) {
      const nextId = pickOrder[chosenCount];
      io.to(roomId).emit('nextTurnToPick', { playerId: nextId });
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
