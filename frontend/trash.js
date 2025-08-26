// --- Slot Machine Overlay for Hard Rock ---

let slotMachineOverlay = null;
let slotMachineScene = null;
let slotMachineCamera = null;
let slotMachineRenderer = null;
let leverMesh = null;
let leverIsAnimating = false;
let reels = [];
let reelValues = [0, 0, 0];
let playerReward = 0;

function showSlotMachine() {
    if (slotMachineOverlay) return;
    slotMachineOverlay = document.createElement('div');
    slotMachineOverlay.id = 'slot-machine-overlay';
    slotMachineOverlay.style.position = 'fixed';
    slotMachineOverlay.style.top = '50%';
    slotMachineOverlay.style.right = '0';
    slotMachineOverlay.style.transform = 'translateY(-50%)';
    slotMachineOverlay.style.width = '350px';
    slotMachineOverlay.style.height = '500px';
    slotMachineOverlay.style.background = 'rgba(0,0,0,0.8)';
    slotMachineOverlay.style.zIndex = '10050';
    slotMachineOverlay.style.display = 'flex';
    slotMachineOverlay.style.justifyContent = 'center';
    slotMachineOverlay.style.alignItems = 'center';
    slotMachineOverlay.style.borderRadius = '20px 0 0 20px';
    slotMachineOverlay.style.boxShadow = '0 0 20px #222';
    document.body.appendChild(slotMachineOverlay);

    // Three.js setup
    slotMachineScene = new THREE.Scene();
    slotMachineCamera = new THREE.PerspectiveCamera(75, 350/500, 0.1, 1000);
    slotMachineRenderer = new THREE.WebGLRenderer({ alpha: true });
    slotMachineRenderer.setSize(350, 500);
    slotMachineOverlay.appendChild(slotMachineRenderer.domElement);

    // Basic slot machine body
    const geometry = new THREE.BoxGeometry(2, 3, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x8888ff });
    const body = new THREE.Mesh(geometry, material);
    slotMachineScene.add(body);

    // Lever
    const leverGeometry = new THREE.CylinderGeometry(0.07, 0.07, 1, 32);
    const leverMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
    leverMesh = new THREE.Mesh(leverGeometry, leverMaterial);
    leverMesh.position.set(1.1, 1.2, 0.5);
    leverMesh.rotation.z = Math.PI / 2;
    slotMachineScene.add(leverMesh);

    // Reels (3 cylinders)
    reels = [];
    for (let i = 0; i < 3; i++) {
        const reelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 32, 1, false);
        const reelMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const reel = new THREE.Mesh(reelGeom, reelMat);
        reel.position.set(-0.6 + i * 0.6, 0.5, 0.6);
        slotMachineScene.add(reel);
        reels.push(reel);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    slotMachineScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(5, 10, 7.5);
    slotMachineScene.add(directionalLight);

    slotMachineCamera.position.z = 6;

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        slotMachineRenderer.render(slotMachineScene, slotMachineCamera);
    }
    animate();

    // Lever interaction (desktop & mobile)
    slotMachineRenderer.domElement.addEventListener('click', onLeverClick);
    slotMachineRenderer.domElement.addEventListener('touchstart', onLeverClick);

    // Reward display
    const rewardDiv = document.createElement('div');
    rewardDiv.id = 'slot-machine-reward';
    rewardDiv.style.position = 'absolute';
    rewardDiv.style.bottom = '30px';
    rewardDiv.style.left = '50%';
    rewardDiv.style.transform = 'translateX(-50%)';
    rewardDiv.style.color = '#fff';
    rewardDiv.style.fontSize = '2em';
    rewardDiv.style.fontWeight = 'bold';
    rewardDiv.style.textShadow = '0 0 10px #000';
    slotMachineOverlay.appendChild(rewardDiv);
}

function hideSlotMachine() {
    if (slotMachineOverlay) {
        slotMachineOverlay.remove();
        slotMachineOverlay = null;
        slotMachineScene = null;
        slotMachineCamera = null;
        slotMachineRenderer = null;
        leverMesh = null;
        reels = [];
    }
}

function onLeverClick(e) {
    if (leverIsAnimating) return;
    leverIsAnimating = true;
    // Animate lever
    let t = 0;
    function leverAnim() {
        t += 0.05;
        leverMesh.rotation.y = Math.sin(t) * 0.7;
        if (t < Math.PI) {
            requestAnimationFrame(leverAnim);
        } else {
            leverMesh.rotation.y = 0;
            // Start reel spin
            spinReels();
        }
    }
    leverAnim();
}

function spinReels() {
    let spinTime = [0, 0, 0];
    let spinning = [true, true, true];
    let start = performance.now();
    let symbols = ['🍒', '🍋', '🔔', '💎', '7'];
    reelValues = [0, 0, 0];
    function spinAnim() {
        let now = performance.now();
        for (let i = 0; i < 3; i++) {
            if (spinning[i]) {
                reels[i].rotation.x += 0.3 + i * 0.1;
                if (now - start > 800 + i * 400) {
                    spinning[i] = false;
                    // Pick a random symbol
                    reelValues[i] = Math.floor(Math.random() * symbols.length);
                    reels[i].rotation.x = reelValues[i] * (2 * Math.PI / symbols.length);
                }
            }
        }
        if (spinning.some(s => s)) {
            requestAnimationFrame(spinAnim);
        } else {
            leverIsAnimating = false;
            showReward();
        }
    }
    spinAnim();
}

function showReward() {
    // Simple reward logic: 3 matching = jackpot, 2 matching = small win, else lose
    let rewardDiv = document.getElementById('slot-machine-reward');
    let reward = 0;
    if (reelValues[0] === reelValues[1] && reelValues[1] === reelValues[2]) {
        reward = 1000;
        rewardDiv.textContent = 'JACKPOT! +$1000';
        rewardDiv.style.color = '#ffd700';
    } else if (reelValues[0] === reelValues[1] || reelValues[1] === reelValues[2] || reelValues[0] === reelValues[2]) {
        reward = 250;
        rewardDiv.textContent = 'WIN! +$250';
        rewardDiv.style.color = '#00ff00';
    } else {
        reward = 0;
        rewardDiv.textContent = 'Try Again!';
        rewardDiv.style.color = '#fff';
    }
    playerReward = reward;
    // Add reward to player's money
    if (typeof currentPlayerId !== 'undefined' && Array.isArray(players)) {
        const player = players.find(p => p.id === currentPlayerId);
        if (player) {
            player.money = (player.money || 0) + reward;
            // Optionally update money UI here
            if (typeof updatePlayerMoneyUI === 'function') {
                updatePlayerMoneyUI(player.id, player.money);
            }
        }
    }
    setTimeout(() => {
        rewardDiv.textContent = '';
    }, 2000);
}

// Example: Call showSlotMachine() when Hard Rock property UI is opened
function onPropertyUIOpen(propertyName) {
    if (propertyName === 'Hard Rock') {
        showSlotMachine();
    } else {
        hideSlotMachine();
    }
}
// --- End Slot Machine Overlay ---