const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');


const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Health check endpoint for Render and status
app.get('/health', (req, res) => {
  res.json({ status: 'online', time: new Date().toISOString() });
});

// Root endpoint for status
app.get('/', (req, res) => {
  res.send(`<h2>Metropoly Socket.IO Server is <span style='color:green'>ONLINE</span></h2><p>Time: ${new Date().toLocaleString()}</p>`);
});


const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  }
});

// Log when server wakes up (first request)
let firstRequestLogged = false;
app.use((req, res, next) => {
  if (!firstRequestLogged) {
    console.log(`[RENDER STATUS] Server received first request at ${new Date().toLocaleString()}`);
    firstRequestLogged = true;
  }
  next();
});


const rooms = {};

io.on('connection', (socket) => {
  console.log(`[RENDER STATUS] New socket connection: ${socket.id} at ${new Date().toLocaleString()}`);
  // Send player number to each client when they join
  socket.on('joinRoom', ({ roomId, playerId, playerName }) => {
    console.log(`[RENDER STATUS] Player ${playerName} (${playerId}) joined room ${roomId}`);
    if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {}, currentTurnIndex: 0 };
    // Preserve token if already chosen
    const prevToken = rooms[roomId].tokens[playerId] || (rooms[roomId].players[playerId] && rooms[roomId].players[playerId].token) || null;
    rooms[roomId].players[playerId] = { name: playerName || 'Player', token: prevToken };
    if (prevToken) rooms[roomId].tokens[playerId] = prevToken;
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    // Player number is order in Object.keys
    const playerIds = Object.keys(rooms[roomId].players);
    const playerNum = playerIds.indexOf(playerId) + 1;
    socket.emit('playerNumber', playerNum);
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({ 
      id, 
      ...info,
      token: rooms[roomId].tokens[id] || info.token || null
    })));
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
    
    // Notify current token-pick turn if tokens are being selected
    const pickOrder = Object.keys(rooms[roomId].players);
    const chosenCount = Object.keys(rooms[roomId].tokens).length;
    if (chosenCount < pickOrder.length) {
      const nextId = pickOrder[chosenCount];
      io.to(roomId).emit('nextTurnToPick', { playerId: nextId });
    } else if (chosenCount === 0 && pickOrder.length > 0) {
      // If no one has picked tokens yet, let the first player pick
      const firstId = pickOrder[0];
      io.to(roomId).emit('nextTurnToPick', { playerId: firstId });
    }
  });
  // --- Metropoly Multiplayer Logic ---
  socket.on('joinMetropoly', ({ roomId, playerId, playerName }) => {
    console.log(`[RENDER STATUS] Player ${playerName} (${playerId}) joined Metropoly room ${roomId}`);
    console.log('[BACKEND] joinMetropoly received:', { roomId, playerId, playerName });
    if (!rooms[roomId]) rooms[roomId] = { players: {}, positions: {}, tokens: {}, ready: {}, currentTurnIndex: 0 };
    // Preserve token if already chosen
    const prevToken = rooms[roomId].tokens[playerId] || (rooms[roomId].players[playerId] && rooms[roomId].players[playerId].token) || null;
    rooms[roomId].players[playerId] = { name: playerName || 'Player', token: prevToken };
    if (prevToken) rooms[roomId].tokens[playerId] = prevToken;
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    // PATCH: Log all player IDs in the room after join
    console.log('[BACKEND] Room', roomId, 'players:', Object.keys(rooms[roomId].players));
    io.to(roomId).emit('playerList', Object.entries(rooms[roomId].players).map(([id, info]) => ({
      id,
      ...info,
      token: rooms[roomId].tokens[id] || info.token || null
    })));
    io.to(roomId).emit('tokenPositions', rooms[roomId].positions);
    // Notify current token-pick turn
    const pickOrder = Object.keys(rooms[roomId].players);
    const chosenCount = Object.keys(rooms[roomId].tokens).length;
    if (chosenCount < pickOrder.length) {
      const nextId = pickOrder[chosenCount];
      console.log('[BACKEND] Emitting nextTurnToPick for next player:', { playerId: nextId });
      io.to(roomId).emit('nextTurnToPick', { playerId: nextId });
    } else if (chosenCount === 0 && pickOrder.length > 0) {
      // If no one has picked tokens yet, let the first player pick
      const firstId = pickOrder[0];
      console.log('[BACKEND] Emitting nextTurnToPick for first player:', { playerId: firstId });
      io.to(roomId).emit('nextTurnToPick', { playerId: firstId });
    }
  });

  socket.on('moveToken', ({ roomId, playerId, from, to }) => {
  if (!rooms[roomId]) return;
  // Only allow token movement for the current turn player
  const currentTurnPlayerId = Object.keys(rooms[roomId].players)[rooms[roomId].currentTurnIndex];
  if (playerId !== currentTurnPlayerId) {
    console.log('[BACKEND PATCH] Ignoring moveToken for non-current player:', playerId);
    return;
  }
  rooms[roomId].positions[playerId] = to;
  io.to(roomId).emit('moveToken', { playerId, from, to });
  // Emit only the current player's token position
  io.to(roomId).emit('tokenPositions', { [playerId]: to });
  // DO NOT ADVANCE TURN HERE!
  });

  // New: Only advance turn when client explicitly ends their turn
  socket.on('endTurn', ({ roomId, playerId, nextPlayerIndex }) => {
    if (!rooms[roomId]) return;
    const playerIds = Object.keys(rooms[roomId].players);
    // Only advance turn if all players are ready
    const allReady = playerIds.every(pid => rooms[roomId].ready[pid]);
    if (!allReady) {
      console.log('[BACKEND PATCH] Not all players are ready. Not advancing turn.');
      return;
    }
    // Use the nextPlayerIndex from the frontend if provided, otherwise increment
    if (nextPlayerIndex !== undefined && nextPlayerIndex >= 0 && nextPlayerIndex < playerIds.length) {
      rooms[roomId].currentTurnIndex = nextPlayerIndex;
    } else {
      if (!rooms[roomId].currentTurnIndex) rooms[roomId].currentTurnIndex = 0;
      // Advance to next player (wrap around)
      rooms[roomId].currentTurnIndex = (rooms[roomId].currentTurnIndex + 1) % playerIds.length;
    }
    const currentTurnPlayerId = playerIds[rooms[roomId].currentTurnIndex];
    io.to(roomId).emit('turnUpdate', { currentTurnPlayerId });
  });

  // Player action notifications
  socket.on('playerAction', ({ roomId, playerId, action, details }) => {
    console.log('[BACKEND] playerAction received:', { roomId, playerId, action, details });
    if (!rooms[roomId]) return;
    io.to(roomId).emit('playerAction', { playerId, action, details });
  });

  socket.on('disconnecting', () => {
    console.log(`[RENDER STATUS] Socket disconnecting: ${socket.id}`);
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
    console.log(`[RENDER STATUS] Player ready: ${playerId} in room ${roomId}`);
    console.log('[BACKEND] playerReady received:', { roomId, playerId });
    if (!rooms[roomId]) return;
    rooms[roomId].ready[playerId] = true;
    // Broadcast all ready states by playerId
    const readyStates = {};
    Object.keys(rooms[roomId].players).forEach(pid => {
      readyStates[pid] = !!rooms[roomId].ready[pid];
    });
    console.log('[BACKEND] Broadcasting readyStates:', readyStates);
    io.to(roomId).emit('playerReadyStates', readyStates);
  });

  socket.on('startGame', ({ roomId, playerId, playerName }) => {
    console.log(`[RENDER STATUS] Game started by ${playerName} (${playerId}) in room ${roomId}`);
    if (!rooms[roomId]) return;
    // Only host can start
    const hostId = Object.keys(rooms[roomId].players)[0];
    if (playerId === hostId) {
      io.to(roomId).emit('gameStarted', { hostName: playerName, roomId });

      // PATCH: Emit turnUpdate for the first player after game starts
      const playerIds = Object.keys(rooms[roomId].players);
      rooms[roomId].currentTurnIndex = 0;
      const currentTurnPlayerId = playerIds[0];
      io.to(roomId).emit('turnUpdate', { currentTurnPlayerId });
    }
  });

  // Token selection logic
  socket.on('selectToken', ({ roomId, playerId, token }) => {
    console.log(`[RENDER STATUS] Player ${playerId} selected token ${token} in room ${roomId}`);
    console.log('[BACKEND] selectToken received:', { roomId, playerId, token });
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
      console.log('[BACKEND] Emitting nextTurnToPick:', { playerId: nextId });
      io.to(roomId).emit('nextTurnToPick', { playerId: nextId });
    }
  });

  // --- Room creation logic ---
  socket.on('createRoom', () => {
    console.log(`[RENDER STATUS] Room created at ${new Date().toLocaleString()}`);
    const roomId = Math.random().toString(36).substr(2, 8);
    rooms[roomId] = { positions: {}, players: {}, tokens: {}, ready: {} };
    socket.emit('roomCreated', roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
