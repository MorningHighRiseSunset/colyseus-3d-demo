// TODO: Remove 3D block demo and multiplayer cursor sync code when integrating with Metropoly game.
// --- Multiplayer 3D block demo logic for gameplay screen ---
// --- Multiplayer cursor sync (delete for Metropoly) ---
let remoteCursors = {};
function createCursor(id, color) {
  let cursor = document.getElementById('cursor-' + id);
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'cursor-' + id;
    cursor.style.position = 'absolute';
    cursor.style.width = '18px';
    cursor.style.height = '18px';
    cursor.style.borderRadius = '50%';
    cursor.style.background = color || '#00c6ff';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = 10;
    document.body.appendChild(cursor);
  }
  return cursor;
}

window.addEventListener('pointermove', (event) => {
  if (isDragging) {
    // ...existing code...
    // Broadcast cursor position to others
    socket.emit('cursorMove', {
      roomId,
      playerId,
      x: event.clientX,
      y: event.clientY,
      color: blockColor
    });
  }
});

socket.on('remoteCursorMove', ({ playerId: pid, x, y, color }) => {
  if (pid === playerId) return; // Don't show own cursor
  const cursor = createCursor(pid, color);
  cursor.style.left = x + 'px';
  cursor.style.top = y + 'px';
});

// Remove remote cursor when drag ends
socket.on('remoteCursorEnd', ({ playerId: pid }) => {
  const cursor = document.getElementById('cursor-' + pid);
  if (cursor) cursor.remove();
});
// --- End multiplayer cursor sync ---
const socket = io('https://colyseus-3d-demo.onrender.com');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const playerName = urlParams.get('playerName') || 'Player';

const playerId = Math.random().toString(36).substr(2, 9);
// Request initial block state when joining
socket.emit('requestBlockState', { roomId });

document.getElementById('gameplayInfo').innerHTML = `<strong>Room ID:</strong> <span style="color:#00c6ff;">${roomId}</span><br><strong>Name:</strong> ${playerName}`;

let isDragging = false;
let blockColor = '#00c6ff';

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

canvas.addEventListener('pointerdown', (event) => {
  isDragging = true;
  blockColor = '#0072ff';
  cube.material.color.set(blockColor);
  socket.emit('grabBlock', { roomId, playerId, color: blockColor });
});

window.addEventListener('pointerup', () => {
  if (isDragging) {
    isDragging = false;
    blockColor = '#00c6ff';
    cube.material.color.set(blockColor);
    socket.emit('releaseBlock', { roomId, playerId });
  }
});

window.addEventListener('pointermove', (event) => {
  if (isDragging) {
    const rect = canvas.getBoundingClientRect();
    let x = ((event.clientX - rect.left) / 400) * 4 - 2;
    let y = -(((event.clientY - rect.top) / 300) * 4 - 2);
    // Clamp to visible bounds [-1.8, 1.8] so block never leaves canvas
    x = Math.max(-1.8, Math.min(1.8, x));
    y = Math.max(-1.8, Math.min(1.8, y));
    cube.position.x = x;
    cube.position.y = y;
    // Add a simple dangling/rotation effect while dragging
    cube.rotation.z = (x + y) * 0.2;
    cube.rotation.x = y * 0.2;
    cube.rotation.y = x * 0.2;
    socket.emit('moveBlock', { roomId, playerId, x, y, color: blockColor });
  }
});

socket.on('blockUpdate', ({ x, y, color, playerId: pid, playerName: pname }) => {
  cube.position.x = x;
  cube.position.y = y;
  cube.material.color.set(color);
  // Show who moved the block (name)
  const statusEl = document.getElementById('gameplayStatus');
  if (statusEl) {
    statusEl.innerHTML = `<span class="player-dot"></span> Block moved by ${pname || pid}`;
  }
});

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
