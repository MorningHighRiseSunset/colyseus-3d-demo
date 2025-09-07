// Add missing showDice function
function showDice(d1, d2, animate = true) {
    dice1Img.src = `assets/dice${d1}.svg`;
    dice2Img.src = `assets/dice${d2}.svg`;
    if (animate) {
        dice1Img.classList.add('dice-rolling');
        dice2Img.classList.add('dice-rolling');
        setTimeout(() => {
            dice1Img.classList.remove('dice-rolling');
            dice2Img.classList.remove('dice-rolling');
        }, 500);
    }
}
// Add missing aiBet and updateUI functions
function aiBet() {
    // Simple AI: bets 10% of its money, minimum $1
    return Math.max(1, Math.floor(aiMoney * 0.1));
}

function updateChips(div, money) {
    div.innerHTML = '';
    let chips = [];
    let remain = money;
    while (remain >= 50) { chips.push('gold'); remain -= 50; }
    while (remain >= 10) { chips.push('green'); remain -= 10; }
    while (remain >= 1) { chips.push('blue'); remain -= 1; }
    chips.slice(0, 12).forEach(color => {
        const chip = document.createElement('div');
        chip.className = `chip ${color}`;
        div.appendChild(chip);
    });
    if (chips.length > 12) {
        const more = document.createElement('span');
        more.textContent = `+${chips.length-12}`;
        more.style.fontSize = '0.9em';
        more.style.color = '#ffd700';
        more.style.marginLeft = '4px';
        div.appendChild(more);
    }
}

function updateUI(msg = '') {
    playerMoneySpan.textContent = playerMoney;
    aiMoneySpan.textContent = aiMoney;
    updateChips(playerChipsDiv, playerMoney);
    updateChips(aiChipsDiv, aiMoney);
    if (msg) statusDiv.textContent = msg;
}
// Craps: Singleplayer vs AI (Enhanced UI)
let playerMoney = 100;
let aiMoney = 100;
let point = null;
let gameActive = true;


const statusDiv = document.getElementById('status');
const aiStatusDiv = document.getElementById('ai-status');
const playerMoneySpan = document.getElementById('player-money');
const aiMoneySpan = document.getElementById('ai-money');
const rollBtn = document.getElementById('roll-btn');
const playerBetInput = document.getElementById('player-bet');
const dice1Img = document.getElementById('dice1');
const dice2Img = document.getElementById('dice2');
const pointValue = document.getElementById('point-value');

const playerChipsDiv = document.getElementById('player-chips');
const aiChipsDiv = document.getElementById('ai-chips');

const playerBetArea = document.getElementById('player-bet-area');
const aiBetArea = document.getElementById('ai-bet-area');
const passLineArea = document.getElementById('pass-line-area');
const dontPassArea = document.getElementById('dont-pass-area');

let playerBetType = null; // 'pass' or 'dontpass'

function clearAllBetHighlights() {
    passLineArea.classList.remove('selected');
    dontPassArea.classList.remove('selected');
}

passLineArea.addEventListener('click', () => {
    playerBetType = 'pass';
    clearAllBetHighlights();
    passLineArea.classList.add('selected');
});
dontPassArea.addEventListener('click', () => {
    playerBetType = 'dontpass';
    clearAllBetHighlights();
    dontPassArea.classList.add('selected');
});

function animateBetChips(areaDiv, amount) {
    areaDiv.innerHTML = '';
    let chips = [];
    let remain = amount;
    while (remain >= 50) { chips.push('gold'); remain -= 50; }
    while (remain >= 10) { chips.push('green'); remain -= 10; }
    while (remain >= 1) { chips.push('blue'); remain -= 1; }
    chips.forEach((color, i) => {
        const chip = document.createElement('div');
        chip.className = `bet-chip ${color}`;
        chip.style.bottom = '-40px';
        chip.style.opacity = '0';
        areaDiv.appendChild(chip);
        setTimeout(() => {
            chip.style.bottom = (i * 4) + 'px';
            chip.style.opacity = '1';
        }, 50 + i * 60);
    });
}

function clearBetChips(areaDiv, outcome) {
    const chips = areaDiv.querySelectorAll('.bet-chip');
    chips.forEach((chip, i) => {
        setTimeout(() => {
            if (outcome === 'win') {
                chip.classList.add('return');
            } else {
                chip.classList.add('hide');
            }
            setTimeout(() => chip.remove(), 700);
        }, i * 40);
    });
}

function rollDice() {
    return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}


rollBtn.addEventListener('click', () => {
    if (!gameActive) return;
    let playerBet = parseInt(playerBetInput.value, 10);
    if (isNaN(playerBet) || playerBet < 1 || playerBet > playerMoney) {
        statusDiv.textContent = 'Invalid bet!';
        return;
    }
    if (!playerBetType) {
        statusDiv.textContent = 'Select Pass Line or Don\'t Pass to place your bet!';
        return;
    }
    let aiBetAmount = aiBet();
    if (aiBetAmount > aiMoney) aiBetAmount = aiMoney;
    aiStatusDiv.textContent = `AI bets $${aiBetAmount}`;

    // Animate chips to selected bet area
    if (playerBetType === 'pass') {
        animateBetChips(passLineArea, playerBet);
    } else {
        animateBetChips(dontPassArea, playerBet);
    }
    animateBetChips(aiBetArea, aiBetAmount);

    // Animate dice roll
    let d1 = 1 + Math.floor(Math.random() * 6);
    let d2 = 1 + Math.floor(Math.random() * 6);
    showDice(d1, d2, true);

    setTimeout(() => {
        let sum = d1 + d2;
        let playerOutcome = null, aiOutcome = null;
        // Remove highlights
        passLineArea.classList.remove('win', 'lose');
        dontPassArea.classList.remove('win', 'lose');
        aiBetArea.classList.remove('win', 'lose');
        let playerArea = playerBetType === 'pass' ? passLineArea : dontPassArea;
        if (point === null) {
            // Come-out roll
            if (playerBetType === 'pass') {
                if (sum === 7 || sum === 11) {
                    playerMoney += playerBet;
                    updateUI('You win the round!');
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'win';
                } else if (sum === 2 || sum === 3 || sum === 12) {
                    playerMoney -= playerBet;
                    updateUI('You lose the round!');
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'lose';
                } else {
                    point = sum;
                    pointValue.textContent = point;
                    pointValue.classList.add('point-glow-anim');
                    updateUI(`Point is set to ${point}. Roll again!`);
                    return;
                }
            } else {
                // Don't Pass
                if (sum === 2 || sum === 3) {
                    playerMoney += playerBet;
                    updateUI('You win the round!');
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'win';
                } else if (sum === 7 || sum === 11) {
                    playerMoney -= playerBet;
                    updateUI('You lose the round!');
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'lose';
                } else if (sum === 12) {
                    updateUI('Push! (No win/loss on 12)');
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = null;
                } else {
                    point = sum;
                    pointValue.textContent = point;
                    pointValue.classList.add('point-glow-anim');
                    updateUI(`Point is set to ${point}. Roll again!`);
                    return;
                }
            }
        } else {
            // Point phase
            if (playerBetType === 'pass') {
                if (sum === point) {
                    playerMoney += playerBet;
                    updateUI('You hit the point! You win!');
                    point = null;
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'win';
                } else if (sum === 7) {
                    playerMoney -= playerBet;
                    updateUI('Rolled a 7! You lose!');
                    point = null;
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'lose';
                } else {
                    updateUI(`Rolled ${sum}. Keep rolling for point ${point}.`);
                    return;
                }
            } else {
                // Don't Pass
                if (sum === 7) {
                    playerMoney += playerBet;
                    updateUI('You win! 7 out!');
                    point = null;
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'win';
                } else if (sum === point) {
                    playerMoney -= playerBet;
                    updateUI('Point hit! You lose!');
                    point = null;
                    pointValue.textContent = '-';
                    pointValue.classList.remove('point-glow-anim');
                    playerOutcome = 'lose';
                } else {
                    updateUI(`Rolled ${sum}. Keep rolling for point ${point}.`);
                    return;
                }
            }
        }
        // Highlight bet area
        if (playerOutcome) playerArea.classList.add(playerOutcome);
        // Animate chips leaving bet area
        setTimeout(() => {
            clearBetChips(playerArea, playerOutcome);
            // Remove highlight after animation
            setTimeout(() => {
                playerArea.classList.remove('win', 'lose');
            }, 800);
        }, 600);
        if (playerMoney <= 0) {
            endGame('You are out of money! AI wins!');
        }
    }, 700);
});

// TODO: Add more casino features:
// - Allow player to choose Pass/Don't Pass bets
// - Add field bets, come/don't come, etc.
// - Add marker for current point on the table
// - Add more advanced AI betting

// Initial UI
pointValue.textContent = '-';
updateUI('Place your bet and roll the dice!');
