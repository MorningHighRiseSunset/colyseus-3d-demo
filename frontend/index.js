document.addEventListener('DOMContentLoaded', function() {
  var startBtn = document.getElementById('startGameBtn');
  if (startBtn) {
    startBtn.onclick = function() {
      window.location.href = 'lobby.html';
    };
  }

  // Simple 3D cube animation for welcome screen
  var canvas = document.getElementById('welcomeCanvas');
  if (canvas && window.THREE) {
    var renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(400, 300);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, 400/300, 0.1, 1000);
    camera.position.z = 3;
    var geometry = new THREE.BoxGeometry();
    var material = new THREE.MeshNormalMaterial();
    var cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    function animate() {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();
  }
});
