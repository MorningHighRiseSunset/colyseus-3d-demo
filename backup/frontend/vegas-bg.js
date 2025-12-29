// Vegas 3D background loader for gameplay.html
import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';

let renderer, scene, camera, vegasModel, animationId;

export function initVegasBackground() {
  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x0a0a1a, 1); // Night sky
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '0';
  renderer.domElement.style.pointerEvents = 'none';
  document.body.prepend(renderer.domElement);

  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a); // Night

  // Add subtle ambient night light
  const ambient = new THREE.AmbientLight(0x222244, 2.2);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xccccff, 0.7);
  dir.position.set(0, 10, 10);
  scene.add(dir);

  // Camera
  camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 8, 32);

  // Load Vegas model
  const loader = new GLTFLoader();
  loader.load('Models/las_vegas/scene.gltf', (gltf) => {
    vegasModel = gltf.scene;
    vegasModel.position.set(0, 0, 0);
    vegasModel.scale.set(6, 6, 6);
    vegasModel.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
    scene.add(vegasModel);
    animate();
  });

  window.addEventListener('resize', onWindowResize);
}

function animate() {
  animationId = requestAnimationFrame(animate);
  if (vegasModel) vegasModel.rotation.y += 0.0007;
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function disposeVegasBackground() {
  cancelAnimationFrame(animationId);
  if (renderer && renderer.domElement) renderer.domElement.remove();
  window.removeEventListener('resize', onWindowResize);
}
