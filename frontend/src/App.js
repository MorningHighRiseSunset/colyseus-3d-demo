import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Client } from '@colyseus/colyseus.js';

const SERVER_URL = "http://localhost:3001"; // Change to your Render backend URL when deployed

function App() {
  const mountRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [cubePosition, setCubePosition] = useState({ x: 0, y: 0, z: 0 });
  const dragging = useRef(false);

  useEffect(() => {
    // Colyseus client setup
    const client = new Client(SERVER_URL);
    client.joinOrCreate("game").then(room => {
      setRoom(room);
      room.onMessage("cubeMoved", (pos) => {
        setCubePosition(pos);
      });
    });
    return () => {
      if (room) room.leave();
    };
  }, []);

  useEffect(() => {
    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    camera.position.z = 5;

    // Drag logic
    function onPointerDown(event) {
      dragging.current = true;
    }
    function onPointerUp(event) {
      dragging.current = false;
    }
    function onPointerMove(event) {
      if (dragging.current && room) {
        // Convert mouse to world coordinates
        const x = (event.clientX / window.innerWidth) * 4 - 2;
        const y = -(event.clientY / window.innerHeight) * 4 + 2;
        cube.position.x = x;
        cube.position.y = y;
        room.send("cubeMoved", { x, y, z: 0 });
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // Animation loop
    function animate() {
      cube.position.set(cubePosition.x, cubePosition.y, cubePosition.z);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    return () => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, [cubePosition, room]);

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
}

export default App;
