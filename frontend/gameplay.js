// --- Multiplayer 3D block demo logic for gameplay screen ---
const socket = io('https://colyseus-3d-demo.onrender.com');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const playerName = urlParams.get('playerName') || 'Player';
const playerId = Math.random().toString(36).substr(2, 9);

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
    // Use window coordinates for drag, clamp to canvas bounds if desired
    let x = ((event.clientX - rect.left) / 400) * 4 - 2;
    let y = -(((event.clientY - rect.top) / 300) * 4 - 2);
    // Optionally clamp x/y to [-2,2] range to keep block visible
    x = Math.max(-2, Math.min(2, x));
    y = Math.max(-2, Math.min(2, y));
    cube.position.x = x;
    cube.position.y = y;
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
