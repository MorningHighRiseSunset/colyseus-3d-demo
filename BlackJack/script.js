// Instructions modal logic
const instructionsBtn = document.getElementById('instructions-btn');
const instructionsModal = document.getElementById('instructions-modal');
const closeInstructions = document.getElementById('close-instructions');

if (instructionsBtn && instructionsModal && closeInstructions) {
	instructionsBtn.addEventListener('click', () => {
		instructionsModal.style.display = 'flex';
	});
	closeInstructions.addEventListener('click', () => {
		instructionsModal.style.display = 'none';
	});
	instructionsModal.addEventListener('click', (e) => {
		if (e.target === instructionsModal) instructionsModal.style.display = 'none';
	});
}
// Animate a chip being placed on a betting square
function animateChip(squareIdx, amount) {
	// Find center of polygon
	const poly = betSquares[squareIdx];
	const pts = poly.getAttribute('points').split(' ').map(pt => pt.split(',').map(Number));
	const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
	const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
	// Create chip SVG
	const chip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
	chip.setAttribute('cx', cx);
	chip.setAttribute('cy', cy);
	chip.setAttribute('r', 22);
	chip.setAttribute('class', 'chip animate');
	chip.setAttribute('fill', '#e53935');
	chip.setAttribute('stroke', '#fff');
	chip.setAttribute('stroke-width', '2');
	// Add text
	const chipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	chipText.setAttribute('x', cx);
	chipText.setAttribute('y', cy+7);
	chipText.setAttribute('text-anchor', 'middle');
	chipText.setAttribute('font-size', '18');
	chipText.setAttribute('fill', '#fff');
	chipText.textContent = `$${amount}`;
	chipsLayer.appendChild(chip);
	chipsLayer.appendChild(chipText);
	setTimeout(() => chip.classList.remove('animate'), 700);
}
// Remove all chips from the chips layer
function clearChips() {
	while (chipsLayer.firstChild) chipsLayer.removeChild(chipsLayer.firstChild);
}
// Mini Blackjack Game - Animated Singleplayer
// Ace value selection dialog
function showAceChoiceDialog(cardIdx, callback) {
	const dialog = document.createElement('div');
	dialog.style.position = 'absolute';
	dialog.style.left = '50%';
	dialog.style.top = '50%';
	dialog.style.transform = 'translate(-50%, -50%)';
	dialog.style.background = 'rgba(255,255,255,0.95)';
	dialog.style.border = '2px solid #222';
	dialog.style.borderRadius = '16px';
	dialog.style.padding = '24px 32px';
	dialog.style.zIndex = '200';
	dialog.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
	dialog.style.textAlign = 'center';
	dialog.innerHTML = `<div style='font-size:1.3em;margin-bottom:12px;'>You got an Ace!<br>Choose its value:</div>`;
	const btn1 = document.createElement('button');
	btn1.textContent = '1';
	btn1.style.margin = '0 12px';
	btn1.style.fontSize = '1.2em';
	btn1.onclick = () => {
		callback(1);
		dialog.remove();
	};
	const btn11 = document.createElement('button');
	btn11.textContent = '11';
	btn11.style.margin = '0 12px';
	btn11.style.fontSize = '1.2em';
	btn11.onclick = () => {
		callback(11);
		dialog.remove();
	};
	dialog.appendChild(btn1);
	dialog.appendChild(btn11);
	document.getElementById('game-ui').appendChild(dialog);
}

const betSquares = Array.from({length: 9}, (_, i) => document.getElementById(`bet${i}`));
const chipsLayer = document.getElementById('chips-layer');
const cardsLayer = document.getElementById('cards-layer');
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const balanceSpan = document.getElementById('balance');
const chipSound = document.getElementById('chip-sound');
const cardSound = document.getElementById('card-sound');

let balance = 1000;
let currentBet = 0;
let currentBetSquare = null;
let playerHand = [];
let dealerHand = [];
let gameState = 'bet'; // 'bet', 'deal', 'player', 'dealer', 'result'

// Card deck
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function createDeck() {
	const deck = [];
	for (let s of suits) {
		for (let r of ranks) {
			deck.push({suit: s, rank: r});
		}
	}
	return deck;
}

// Track ace choices for player hand
let playerAceChoices = [];

function shuffle(deck) {
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
}

let deck = [];

// Utility: get value of hand
function handValue(hand) {
	// Returns the blackjack value of a hand
	let value = 0;
	let aces = 0;
	for (let i = 0; i < hand.length; i++) {
		const card = hand[i];
		if (card.rank === 'A') {
			// Use chosen value if available (only for playerHand)
			if (playerAceChoices && playerAceChoices[i] !== undefined) {
				value += playerAceChoices[i];
			} else {
				value += 11;
				aces++;
			}
		} else if (['K', 'Q', 'J'].includes(card.rank)) {
			value += 10;
		} else {
			value += parseInt(card.rank);
		}
	}
	// Adjust for aces
	while (value > 21 && aces > 0) {
		value -= 10;
		aces--;
	}
	return value;
}

function animateCard(handType, idx, card, faceUp = true) {
  // handType: 'player' or 'dealer'
  // idx: position in hand
  // card: {suit, rank}
  // faceUp: bool

  const y = handType === 'player' ? 370 : 120;
  const x = 180 + idx * 70;

  // SVG group for card
  const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  // Card rectangle
  const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  cardRect.setAttribute('x', x);
  cardRect.setAttribute('y', y);
  cardRect.setAttribute('width', 60);
  cardRect.setAttribute('height', 90);
  cardRect.setAttribute('class', 'card animate');
  cardRect.setAttribute('rx', 12);


	// Set initial card appearance
	if (faceUp) {
		cardRect.setAttribute('fill', '#fff');
		cardRect.setAttribute('stroke', '#222');
		cardRect.setAttribute('stroke-width', '2');
	} else {
		cardRect.setAttribute('fill', '#00543a');
		cardRect.setAttribute('stroke', '#FFD700');
		cardRect.setAttribute('stroke-width', '3');
	}
	cardGroup.appendChild(cardRect);
	cardsLayer.appendChild(cardGroup);

	// --- Safe audio playback ---
	const sound1 = document.getElementById('card-sound1');
	const sound2 = document.getElementById('card-sound2');
	const sound = Math.random() < 0.5 ? sound1 : sound2;
	if (sound) {
		try {
			sound.currentTime = 0;
			sound.play().catch(err => console.warn('Sound play blocked:', err));
		} catch (e) {
			console.warn('Audio error:', e);
		}
	}

	// After animation, add card face or back
	setTimeout(() => {
		cardRect.classList.remove('animate');
		if (faceUp) {
			// Rank
			const rankText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			rankText.setAttribute('x', x + 12);
			rankText.setAttribute('y', y + 28);
			rankText.setAttribute(
				'class',
				'card-face' + (card.suit === '♥' || card.suit === '♦' ? ' red' : '')
			);
			rankText.textContent = card.rank;
			// Suit
			const suitText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			suitText.setAttribute('x', x + 48);
			suitText.setAttribute('y', y + 80);
			suitText.setAttribute(
				'class',
				'card-suit' + (card.suit === '♥' || card.suit === '♦' ? ' red' : '')
			);
			suitText.textContent = card.suit;
			cardGroup.appendChild(rankText);
			cardGroup.appendChild(suitText);
		} else {
			// Card back: tight diamond grid pattern
			const cardWidth = 60, cardHeight = 90;
			const gridSize = 12;
			for (let gx = 6; gx < cardWidth; gx += gridSize) {
				for (let gy = 6; gy < cardHeight; gy += gridSize) {
					// Only draw diamonds fully inside the card
					if (gy + 4 < cardHeight && gy - 4 > 0) {
						const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
						const points = [
							[x + gx, y + gy - 4],
							[x + gx + 4, y + gy],
							[x + gx, y + gy + 4],
							[x + gx - 4, y + gy]
						].map(p => p.join(",")).join(" ");
						diamond.setAttribute('points', points);
						diamond.setAttribute('fill', '#FFD700');
						diamond.setAttribute('opacity', '0.25');
						cardGroup.appendChild(diamond);
					}
				}
			}
		}
	}, 700);
}

function animateCard(handType, idx, card, faceUp = true) {
	// Position cards at the bet square for player, fixed for dealer
	let x, y, angle = 0;
		if (handType === 'player' && currentBetSquare !== null) {
			// Get bet square center
			const poly = betSquares[currentBetSquare];
			const pts = poly.getAttribute('points').split(' ').map(pt => pt.split(',').map(Number));
			x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
			y = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
			// Fan out cards at slight angle, and place below the bet square
			x += (idx - 0.5) * 40;
			y += 70; // move cards below the square
			angle = (idx - 0.5) * 8;
	} else {
	// Dealer cards: fixed position above center
	x = 500 + (idx - 0.5) * 70;
	y = 186; // moved down further from 150 to 186 for more clearance
	angle = (idx - 0.5) * 8;
	}

	// SVG group for card
	const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	cardGroup.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
	cardGroup.setAttribute('opacity', '0');

	// Card rectangle (realistic look)
	const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	cardRect.setAttribute('x', -30);
	cardRect.setAttribute('y', -45);
	cardRect.setAttribute('width', 60);
	cardRect.setAttribute('height', 90);
	cardRect.setAttribute('rx', 10);
	cardRect.setAttribute('class', 'card animate');
	cardRect.setAttribute('fill', faceUp ? '#fff' : '#00543a');
	cardRect.setAttribute('stroke', faceUp ? '#222' : '#FFD700');
	cardRect.setAttribute('stroke-width', faceUp ? '2' : '3');
	cardGroup.appendChild(cardRect);
	cardsLayer.appendChild(cardGroup);

	// Animate fade/slide in
	setTimeout(() => {
		cardGroup.setAttribute('opacity', '1');
	}, 10);

	// --- Safe audio playback ---
	const sound1 = document.getElementById('card-sound1');
	const sound2 = document.getElementById('card-sound2');
	const sound = Math.random() < 0.5 ? sound1 : sound2;
	if (sound) {
		try {
			sound.currentTime = 0;
			sound.play().catch(err => console.warn('Sound play blocked:', err));
		} catch (e) {
			console.warn('Audio error:', e);
		}
	}

	// After animation, add card face or back
	setTimeout(() => {
		cardRect.classList.remove('animate');
		if (faceUp) {
			// Rank (top-left, bold)
			const rankText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			rankText.setAttribute('x', -22);
			rankText.setAttribute('y', -22);
			rankText.setAttribute('class', 'card-face' + (card.suit === '♥' || card.suit === '♦' ? ' red' : ''));
			rankText.textContent = card.rank;
			// Suit (bottom-right, large)
			const suitText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			suitText.setAttribute('x', 18);
			suitText.setAttribute('y', 32);
			suitText.setAttribute('class', 'card-suit' + (card.suit === '♥' || card.suit === '♦' ? ' red' : ''));
			suitText.textContent = card.suit;
			cardGroup.appendChild(rankText);
			cardGroup.appendChild(suitText);
		} else {
			// Card back: tight diamond grid pattern
			const cardWidth = 60, cardHeight = 90;
			const gridSize = 12;
			for (let gx = -24; gx < cardWidth; gx += gridSize) {
				for (let gy = -41; gy < cardHeight; gy += gridSize) {
					// Only draw diamonds fully inside the card
					if (gy + 4 <= 45 && gy - 4 >= -45) {
						const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
						const points = [
							[gx, gy - 4],
							[gx + 4, gy],
							[gx, gy + 4],
							[gx - 4, gy]
						].map(p => p.join(",")).join(" ");
						diamond.setAttribute('points', points);
						diamond.setAttribute('fill', '#FFD700');
						diamond.setAttribute('opacity', '0.25');
						cardGroup.appendChild(diamond);
					}
				}
			}
		}
	}, 400);
}


function clearCards() {
	while (cardsLayer.firstChild) cardsLayer.removeChild(cardsLayer.firstChild);
}

function updateBalance() {
	balanceSpan.textContent = `Balance: $${balance}`;
}

// Betting interaction
betSquares.forEach((poly, idx) => {
	poly.addEventListener('click', () => {
		if (gameState !== 'bet') return;
		clearChips();
		currentBetSquare = idx;
		currentBet = 100;
		animateChip(idx, currentBet);
		dealBtn.disabled = false;
	});
});

dealBtn.addEventListener('click', () => {
	if (gameState !== 'bet' || currentBetSquare === null) return;
	if (balance < currentBet) return;
	balance -= currentBet;
	updateBalance();
	gameState = 'deal';
	dealBtn.disabled = true;
	hitBtn.disabled = false;
	standBtn.disabled = false;
	clearCards();
	deck = createDeck();
	shuffle(deck);
	playerHand = [deck.pop(), deck.pop()];
	dealerHand = [deck.pop(), deck.pop()];
	playerAceChoices = [];
	// Animate cards
	animateCard('player', 0, playerHand[0]);
	animateCard('player', 1, playerHand[1]);
	animateCard('dealer', 0, dealerHand[0]);
	animateCard('dealer', 1, dealerHand[1], false); // face down
	// Ask for ace value if player has ace(s)
	playerHand.forEach((card, idx) => {
		if (card.rank === 'A') {
			showAceChoiceDialog(idx, val => {
				playerAceChoices[idx] = val;
				updateBalance();
			});
		}
	});
	gameState = 'player';
});

hitBtn.addEventListener('click', () => {
	if (gameState !== 'player') return;
	const card = deck.pop();
	playerHand.push(card);
	playerAceChoices.push(undefined);
	animateCard('player', playerHand.length-1, card);
	if (card.rank === 'A') {
		showAceChoiceDialog(playerHand.length-1, val => {
			playerAceChoices[playerHand.length-1] = val;
			updateBalance();
		});
	}
	if (handValue(playerHand) > 21) {
		endRound();
	}
});

standBtn.addEventListener('click', () => {
	if (gameState !== 'player') return;
	gameState = 'dealer';
	playDealer();
});

function playDealer() {
	// Reveal dealer's hidden card
	clearCards();
	dealerHand.forEach((card, i) => animateCard('dealer', i, card));
	playerHand.forEach((card, i) => animateCard('player', i, card));
	setTimeout(() => {
		let dealerVal = handValue(dealerHand);
		while (dealerVal < 17) {
			const card = deck.pop();
			dealerHand.push(card);
			animateCard('dealer', dealerHand.length-1, card);
			dealerVal = handValue(dealerHand);
		}
		setTimeout(endRound, 1000);
	}, 800);
}
// Insurance logic: offer if dealer shows Ace
if (dealerHand[0] && dealerHand[0].rank === 'A') {
	offerInsurance();
}

function endRound() {
	hitBtn.disabled = true;
	standBtn.disabled = true;
	gameState = 'result';
		// Reveal all cards
		clearCards();
		dealerHand.forEach((card, i) => animateCard('dealer', i, card));
		playerHand.forEach((card, i) => animateCard('player', i, card));
		// Win/loss logic
		const playerVal = handValue(playerHand);
		const dealerVal = handValue(dealerHand);
		let result = '', win = false, push = false;
		if (playerVal > 21) {
			result = 'Bust! You lose.';
			win = false;
		} else if (dealerVal > 21) {
			result = 'Dealer busts! You win!';
			balance += currentBet * 2;
			win = true;
		} else if (playerVal > dealerVal) {
		let playerBlackjack = playerHand.length === 2 && playerVal === 21;
		let dealerBlackjack = dealerHand.length === 2 && handValue(dealerHand) === 21;

		// Insurance payout
		if (insuranceActive) {
			insuranceActive = false;
			const insuranceDiv = document.getElementById('insurance-div');
			if (insuranceDiv) insuranceDiv.remove();
			if (insuranceBet > 0) {
				if (dealerBlackjack) {
					balance += insuranceBet * 3;
					showResult('Insurance wins! Dealer has blackjack.');
				} else {
					showResult('Insurance lost. Dealer does not have blackjack.');
				}
				insuranceBet = 0;
				updateBalance();
			}
		}

		if (playerBlackjack && !dealerBlackjack) {
			result = 'Blackjack! You win 3 to 2!';
			balance += currentBet * 2.5;
			win = true;
		} else if (playerVal > 21) {
			result = 'You win!';
			balance += currentBet * 2;
			win = true;
		} else if (playerVal === dealerVal) {
			result = 'Push.';
			balance += currentBet;
			push = true;
		} else {
			result = 'You lose.';
			win = false;
		}
		updateBalance();
		showResult(result);
		// Visual feedback on bet square
		if (currentBetSquare !== null) {
			const poly = betSquares[currentBetSquare];
			poly.classList.remove('win', 'lose', 'push');
			if (push) {
				poly.classList.add('push');
			} else if (win) {
				poly.classList.add('win');
			} else {
				poly.classList.add('lose');
			}
			setTimeout(() => {
				poly.classList.remove('win', 'lose', 'push');
			}, 2200);
		}
}

function showResult(text) {
	const resultDiv = document.createElement('div');
	resultDiv.textContent = text;
	resultDiv.style.position = 'absolute';
	resultDiv.style.left = '50%';
	resultDiv.style.top = '60%';
	resultDiv.style.transform = 'translate(-50%, -50%)';
	resultDiv.style.background = 'rgba(0,0,0,0.8)';
	resultDiv.style.color = '#FFD700';
	resultDiv.style.fontSize = '2em';
	resultDiv.style.padding = '20px 40px';
	resultDiv.style.borderRadius = '20px';
	resultDiv.style.zIndex = '100';
	document.getElementById('game-ui').appendChild(resultDiv);
	setTimeout(() => {
		resultDiv.remove();
		resetRound();
	}, 2200);
}

function resetRound() {
	clearCards();
	clearChips();
	currentBet = 0;
	currentBetSquare = null;
	dealBtn.disabled = true;
	hitBtn.disabled = true;
	standBtn.disabled = true;
	gameState = 'bet';
	playerAceChoices = [];
	insuranceBet = 0;
	insuranceActive = false;
}
// Insurance state
let insuranceBet = 0;
let insuranceActive = false;

function offerInsurance() {
	insuranceActive = true;
	const insuranceDiv = document.createElement('div');
	insuranceDiv.id = 'insurance-div';
	insuranceDiv.style.position = 'absolute';
	insuranceDiv.style.left = '50%';
	insuranceDiv.style.top = '20%';
	insuranceDiv.style.transform = 'translate(-50%, -50%)';
	insuranceDiv.style.background = 'rgba(0,0,0,0.85)';
	insuranceDiv.style.color = '#FFD700';
	insuranceDiv.style.fontSize = '1.3em';
	insuranceDiv.style.padding = '18px 32px';
	insuranceDiv.style.borderRadius = '16px';
	insuranceDiv.style.zIndex = '200';
	insuranceDiv.innerHTML = `<div>Dealer shows Ace.<br>Insurance pays 2 to 1.<br>Take insurance for $${currentBet/2}?<br></div>`;
	const yesBtn = document.createElement('button');
	yesBtn.textContent = 'Yes';
	yesBtn.style.margin = '0 12px';
	yesBtn.onclick = () => {
		if (balance >= currentBet/2) {
			insuranceBet = currentBet/2;
			balance -= insuranceBet;
			updateBalance();
		}
		insuranceDiv.remove();
	};
	const noBtn = document.createElement('button');
	noBtn.textContent = 'No';
	noBtn.style.margin = '0 12px';
	noBtn.onclick = () => {
		insuranceBet = 0;
		insuranceDiv.remove();
	};
	insuranceDiv.appendChild(yesBtn);
	insuranceDiv.appendChild(noBtn);
	document.getElementById('game-ui').appendChild(insuranceDiv);
}
}

// Initial state
dealBtn.disabled = true;
hitBtn.disabled = true;
standBtn.disabled = true;
updateBalance();
