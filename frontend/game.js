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

let playerNum = null;
let isDragging = false;
let blockColor = '#00c6ff';
let isHost = false;

socket.on('playerNumber', num => {
  playerNum = num;
  gameInfo.innerHTML += `<br><strong>You are Player ${playerNum}</strong>`;
  isHost = (playerNum === 1); // First player is host
  if (isHost) startBtn.style.display = '';
  else startBtn.style.display = 'none';
  console.log(`Player ${playerNum} = "${playerId}" Name: ${playerName}`);
});

socket.on('playerReadyStates', (states) => {
  readyStates = states;
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML = Object.entries(readyStates).map(([name, ready]) => {
      return `<span class="player-dot" style="background:${ready ? '#00ff00' : '#ccc'}"></span> ${name}: ${ready ? 'Ready' : 'Not Ready'}`;
    }).join('<br>');
  }
});

readyBtn.onclick = () => {
  socket.emit('playerReady', { roomId, playerId, playerName });
};

startBtn.onclick = () => {
  socket.emit('startGame', { roomId, playerId, playerName });
};

// Setup Three.js scene
const container = document.querySelector('.container');
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;
container.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(400, 300);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 400 / 300, 0.1, 1000);
camera.position.z = 5;

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: blockColor });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Drag logic
canvas.addEventListener('pointerdown', () => {
  isDragging = true;
  blockColor = playerNum === 1 ? '#0072ff' : '#00ff00';
  cube.material.color.set(blockColor);
  socket.emit('grabBlock', { roomId, playerId, color: blockColor });
});

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

// Listen for server updates
socket.on('blockUpdate', ({ x, y, color, playerId: pid, playerName: pname }) => {
  cube.position.x = x;
  cube.position.y = y;
  cube.material.color.set(color);
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="player-dot"></span> Block moved by ${pname || pid}`;
  }
});

socket.on('playerReadyNotification', ({ playerName }) => {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="player-dot"></span> ${playerName} is ready!`;
  }
});

socket.on('gameStarted', ({ hostName }) => {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="player-dot"></span> Game started by ${hostName}!`;
  }
});
// --- End of 3D block demo logic ---

// Animate
function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
