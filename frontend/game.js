// --- Multiplayer 3D block demo logic with ready-up and host start ---
const socket = io('https://colyseus-3d-demo.onrender.com');

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const playerName = urlParams.get('playerName') || 'Player';
// Generate a unique playerId for this session
const playerId = Math.random().toString(36).substr(2, 9);

gameInfo.innerHTML = `<strong>Room ID:</strong> 
  <span style="color:#00c6ff;">${roomId}</span>
  <br><small>Share this ID with your friend to join!</small>
  <br><strong>Name:</strong> ${playerName}`;

const readyBtn = document.getElementById('readyBtn');
const startBtn = document.getElementById('startBtn');

socket.emit('joinRoom', { roomId, playerId, playerName });

canvas.addEventListener('pointerup', () => {
  isDragging = false;
  blockColor = '#00c6ff';
  cube.material.color.set(blockColor);
  socket.emit('releaseBlock', { roomId, playerId });
});

canvas.addEventListener('pointermove', (event) => {
  if (isDragging) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / 400) * 4 - 2;
    const y = -(((event.clientY - rect.top) / 300) * 4 - 2);
    cube.position.x = x;
    cube.position.y = y;
    socket.emit('moveBlock', { roomId, playerId, x, y, color: blockColor });
  }
});