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
    slotMachineOverlay.style.top = '60%';
    slotMachineOverlay.style.right = '0';
    slotMachineOverlay.style.transform = 'translateY(-50%)';
    slotMachineOverlay.style.width = '220px';
    slotMachineOverlay.style.height = '320px';
    slotMachineOverlay.style.background = 'rgba(30,34,44,0.95)';
    slotMachineOverlay.style.zIndex = '10050';
    slotMachineOverlay.style.display = 'flex';
    slotMachineOverlay.style.flexDirection = 'column';
    slotMachineOverlay.style.justifyContent = 'flex-start';
    slotMachineOverlay.style.alignItems = 'center';
    slotMachineOverlay.style.borderRadius = '18px 0 0 18px';
    slotMachineOverlay.style.boxShadow = '0 0 24px #222';
    slotMachineOverlay.style.border = '2px solid #ffd700';
    document.body.appendChild(slotMachineOverlay);

    // Slot machine header
    const header = document.createElement('div');
    header.textContent = '🎰 SLOT MACHINE';
    header.style.color = '#ffd700';
    header.style.fontWeight = 'bold';
    header.style.fontSize = '1.2em';
    header.style.margin = '12px 0 8px 0';
    slotMachineOverlay.appendChild(header);

    // Slot window (reel area)
    const slotWindow = document.createElement('div');
    slotWindow.id = 'slot-window';
    slotWindow.style.width = '180px';
    slotWindow.style.height = '70px';
    slotWindow.style.background = '#222a38';
    slotWindow.style.border = '2px solid #ffd700';
    slotWindow.style.borderRadius = '10px';
    slotWindow.style.display = 'flex';
    slotWindow.style.justifyContent = 'space-between';
    slotWindow.style.alignItems = 'center';
    slotWindow.style.overflow = 'hidden';
    slotWindow.style.position = 'relative';
    slotWindow.style.margin = '0 0 10px 0';
    slotMachineOverlay.appendChild(slotWindow);

    // Create 3 reels as columns
    reels = [];
    for (let i = 0; i < 3; i++) {
        const reelDiv = document.createElement('div');
        reelDiv.className = 'reel';
        reelDiv.style.width = '54px';
        reelDiv.style.height = '100%';
        reelDiv.style.display = 'flex';
        reelDiv.style.flexDirection = 'column';
        reelDiv.style.alignItems = 'center';
        reelDiv.style.justifyContent = 'flex-start';
        reelDiv.style.position = 'relative';
        slotWindow.appendChild(reelDiv);
        reels.push(reelDiv);
    }

    // Lever
    const lever = document.createElement('div');
    lever.id = 'slot-lever';
    lever.style.width = '22px';
    lever.style.height = '80px';
    lever.style.background = 'linear-gradient(180deg,#ffd700 60%,#fffbe6 100%)';
    lever.style.borderRadius = '12px';
    lever.style.position = 'absolute';
    lever.style.right = '-30px';
    lever.style.top = '40px';
    lever.style.cursor = 'pointer';
    lever.style.boxShadow = '0 0 8px #222';
    lever.style.display = 'flex';
    lever.style.alignItems = 'flex-end';
    lever.style.justifyContent = 'center';
    // Knob
    const knob = document.createElement('div');
    knob.style.width = '28px';
    knob.style.height = '28px';
    knob.style.background = '#ff2222';
    knob.style.borderRadius = '50%';
    knob.style.position = 'absolute';
    knob.style.bottom = '-14px';
    knob.style.left = '-3px';
    knob.style.boxShadow = '0 0 8px #222';
    lever.appendChild(knob);
    slotMachineOverlay.appendChild(lever);

    // Reward display
    const rewardDiv = document.createElement('div');
    rewardDiv.id = 'slot-machine-reward';
    rewardDiv.style.position = 'absolute';
    rewardDiv.style.bottom = '18px';
    rewardDiv.style.left = '50%';
    rewardDiv.style.transform = 'translateX(-50%)';
    rewardDiv.style.color = '#fff';
    rewardDiv.style.fontSize = '1.5em';
    rewardDiv.style.fontWeight = 'bold';
    rewardDiv.style.textShadow = '0 0 10px #000';
    slotMachineOverlay.appendChild(rewardDiv);

    // Lever interaction (desktop & mobile)
    lever.addEventListener('click', onLeverClick);
    lever.addEventListener('touchstart', onLeverClick);
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
    let symbols = ['🍒', '🍋', '🔔', '💎', '7'];
    reelValues = [0, 0, 0];
    let spinning = [true, true, true];
    let spinStart = performance.now();
    let spinDuration = [1800, 2400, 3000];
    let reelSymbolLists = [];
    // Fill each reel with a shuffled list of symbols
    for (let i = 0; i < 3; i++) {
        let list = [];
        for (let j = 0; j < 20; j++) {
            list.push(symbols[Math.floor(Math.random() * symbols.length)]);
        }
        reelSymbolLists.push(list);
    }
    // Animate vertical scroll
    function spinAnim() {
        let now = performance.now();
        for (let i = 0; i < 3; i++) {
            if (spinning[i]) {
                let progress = Math.min(1, (now - spinStart) / spinDuration[i]);
                let offset = Math.floor(progress * (reelSymbolLists[i].length - 3));
                // Clear reel
                reels[i].innerHTML = '';
                // Show 3 symbols per reel
                for (let k = 0; k < 3; k++) {
                    let symbol = reelSymbolLists[i][offset + k];
                    let symbolDiv = document.createElement('div');
                    symbolDiv.className = 'slot-symbol';
                    symbolDiv.style.height = '22px';
                    symbolDiv.style.display = 'flex';
                    symbolDiv.style.alignItems = 'center';
                    symbolDiv.style.justifyContent = 'center';
                    symbolDiv.style.fontSize = '1.7em';
                    symbolDiv.style.fontWeight = 'bold';
                    symbolDiv.style.color = '#ffd700';
                    symbolDiv.style.textShadow = '0 0 8px #222';
                    symbolDiv.textContent = symbol;
                    reels[i].appendChild(symbolDiv);
                }
                if (progress >= 1) {
                    spinning[i] = false;
                    // Pick final symbol for result
                    reelValues[i] = symbols.indexOf(reelSymbolLists[i][offset + 1]);
                }
            }
        }
        if (spinning.some(s => s)) {
            requestAnimationFrame(spinAnim);
        } else {
            leverIsAnimating = false;
            setTimeout(() => {
                // Keep final symbols visible for a moment
            }, 1800);
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