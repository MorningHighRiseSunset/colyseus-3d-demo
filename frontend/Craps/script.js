
// Craps: Singleplayer vs AI (Modular)
window.initCrapsMinigame = function(container) {
    // --- DOM helpers ---
    function q(sel) { return container.querySelector(sel); }

    // --- State ---
    let playerMoney = 100;
    let aiMoney = 100;
    let point = null;
    let gameActive = true;
    let playerBetType = null; // 'pass' or 'dontpass'

    // --- DOM Elements (scoped) ---
    const statusDiv = q('#status');
    const aiStatusDiv = q('#ai-status');
    const playerMoneySpan = q('#player-money');
    const aiMoneySpan = q('#ai-money');
    const rollBtn = q('#roll-btn');
    const playerBetInput = q('#player-bet');
    const dice1Img = q('#dice1');
    const dice2Img = q('#dice2');
    const pointValue = q('#point-value');
    const playerChipsDiv = q('#player-chips');
    const aiChipsDiv = q('#ai-chips');
    const playerBetArea = q('#player-bet-area');
    const aiBetArea = q('#ai-bet-area');
    const passLineArea = q('#pass-line-area');
    const dontPassArea = q('#dont-pass-area');

    // --- UI helpers ---
    function showDice(d1, d2, animate = true) {
        dice1Img.src = `Craps/assets/dice${d1}.svg`;
        dice2Img.src = `Craps/assets/dice${d2}.svg`;
        if (animate) {
            dice1Img.classList.add('dice-rolling');
            dice2Img.classList.add('dice-rolling');
            setTimeout(() => {
                dice1Img.classList.remove('dice-rolling');
                dice2Img.classList.remove('dice-rolling');
            }, 500);
        }
    }
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
    function clearAllBetHighlights() {
        passLineArea.classList.remove('selected');
        dontPassArea.classList.remove('selected');
    }
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
    function endGame(msg) {
        gameActive = false;
        statusDiv.textContent = msg;
        rollBtn.disabled = true;
    }

    // --- Event Listeners (scoped) ---
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
            let playerOutcome = null;
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

    // Initial UI
    pointValue.textContent = '-';
    updateUI('Place your bet and roll the dice!');
};
