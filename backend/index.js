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
  // Create room
  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substr(2, 8);
    rooms[roomId] = { positions: {} };
    socket.emit('roomCreated', roomId);
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerId }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].positions[playerId] = 0;
    socket.join(roomId);
    io.to(roomId).emit('update', { positions: rooms[roomId].positions });
  });

  // Move action
  socket.on('move', ({ roomId, playerId, position }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].positions[playerId] = position;
    io.to(roomId).emit('update', { positions: rooms[roomId].positions });
  });

  // Get room list
  socket.on('getRooms', () => {
    socket.emit('roomList', Object.keys(rooms));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
