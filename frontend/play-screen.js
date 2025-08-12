const client = new Colyseus.Client('http://localhost:3001'); // Change to your backend URL when deployed
let room = null;

async function joinOrCreateRoom() {
  room = await client.joinOrCreate('game');
  setupGame(room);
}

function setupGame(room) {
  const canvas = document.getElementById('gameCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(800, 600);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
  camera.position.z = 5;
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  let dragging = false;
  canvas.addEventListener('pointerdown', () => dragging = true);
  canvas.addEventListener('pointerup', () => dragging = false);
  canvas.addEventListener('pointermove', (event) => {
    if (dragging && room) {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / 800) * 4 - 2;
      const y = -(((event.clientY - rect.top) / 600) * 4 - 2);
      cube.position.x = x;
      cube.position.y = y;
      room.send('cubeMoved', { x, y, z: 0 });
    }
  });

  room.onMessage('cubeMoved', (pos) => {
    cube.position.set(pos.x, pos.y, pos.z);
  });

  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

joinOrCreateRoom();
