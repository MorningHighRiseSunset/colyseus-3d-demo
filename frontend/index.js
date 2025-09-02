// Vegas Strip 3D Background using global THREE (r128)
console.log('Three.js version:', THREE.REVISION);
const scene = new THREE.Scene();
console.log('Scene created:', scene);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 40);
console.log('Camera created:', camera);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // transparent background

// Attach renderer
var bg3d = document.getElementById('bg-3d');
if (bg3d) {
  bg3d.appendChild(renderer.domElement);
  console.log('Renderer created and attached.');
}

// Ambient and directional light
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
console.log('Lights added.');

// Load Las Vegas Strip GLB model
if (typeof THREE.DRACOLoader !== 'undefined') {
  console.log('DRACOLoader is available:', THREE.DRACOLoader);
  var loader = new THREE.GLTFLoader();
  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);
  console.log('DRACOLoader set for GLTFLoader.');
  loader.load('Models/las_vegas/scene.glb',
    function(gltf) {
      console.log('GLB loaded:', gltf);
      var model = gltf.scene;
      model.position.set(0, 0, 0);
      model.scale.set(10, 10, 10); // Adjust scale as needed
      scene.add(model);
      console.log('Model added to scene.');
    },
    function(xhr) {
      var percent = xhr.total ? (xhr.loaded / xhr.total * 100) : 0;
      console.log('GLB loading progress:', percent + '% loaded', xhr);
    },
    function(error) {
      console.error('Error loading GLB:', error);
    }
  );
} else {
  console.error('THREE.DRACOLoader is NOT available!');
}

// Responsive resize
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  console.log('Window resized.');
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
console.log('Animation started.');

document.addEventListener('DOMContentLoaded', function() {
  var startBtn = document.getElementById('startGameBtn');
  var onlineStatus = document.getElementById('onlineStatus');
  const socket = io('https://colyseus-3d-demo-9yuv.onrender.com');

  // Show online indicator
  socket.on('connect', function() {
    onlineStatus.innerHTML = '<span class="player-dot"></span> You are online!';
  });
  socket.on('disconnect', function() {
    onlineStatus.innerHTML = '<span class="player-dot offline"></span> Offline';
  });

  // Multiplayer player list UI
  let playerListUI = null;
  socket.on('playerList', function(list) {
    if (!playerListUI) {
      playerListUI = document.createElement('div');
      playerListUI.id = 'player-list-ui';
      playerListUI.style.position = 'absolute';
      playerListUI.style.top = '10px';
      playerListUI.style.right = '10px';
      playerListUI.style.background = 'rgba(0,0,0,0.7)';
      playerListUI.style.color = '#fff';
      playerListUI.style.padding = '10px';
      playerListUI.style.borderRadius = '8px';
      playerListUI.style.zIndex = '1000';
      document.body.appendChild(playerListUI);
    }
    playerListUI.innerHTML = '<b>Players:</b><br>' + list.map(p => `<span>${p.name}</span>`).join('<br>');
  });

  if (startBtn) {
    startBtn.onclick = function() {
      window.location.href = 'lobby.html';
    };
  }
});
