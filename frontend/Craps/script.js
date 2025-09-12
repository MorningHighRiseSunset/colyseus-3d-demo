// --- 3D Dice Animation ---
function animateDice3D(d1, d2, cb) {
	if (window.rollDice3D) {
		window.rollDice3D(d1, d2, cb);
	} else if (cb) {
		setTimeout(cb, 800);
	}
}



// --- Game State ---
let playerBalance = 5000;
let placedChips = [];
let point = null;
let phase = 'comeout'; // 'comeout' or 'point'

function updateBalance() {
	document.getElementById('player-balance').textContent = playerBalance;
}

function clearPlacedChips() {
	placedChips = [];
	document.getElementById('placed-chips').innerHTML = '';
}

// --- Area selection removed: drag-and-drop only ---
document.getElementById('bet-info').textContent = 'Drag chips onto any bet area.';

// --- 3D Dice Animation (Three.js) ---
window.addEventListener('DOMContentLoaded', () => {
	if (window.initDice3D) window.initDice3D(document.getElementById('dice-area'));
});

function animateDice3D(d1, d2, cb) {
	if (window.rollDice3D) {
		window.rollDice3D(d1, d2, cb);
	} else if (cb) {
		setTimeout(cb, 800);
	}
}

// --- Chip drag and drop ---
let draggingChip = null;
let offsetX = 0, offsetY = 0;

document.querySelectorAll('.chip-3d').forEach(chip => {
	chip.addEventListener('mousedown', function(e) {
		if (playerBalance < parseInt(chip.getAttribute('data-value'))) return;
	draggingChip = chip.cloneNode(true);
	draggingChip.style.position = 'absolute';
	draggingChip.style.zIndex = 1000;
	draggingChip.style.pointerEvents = 'none';
	draggingChip.style.background = 'radial-gradient(circle at 60% 30%, #c00 60%, #800 100%)';
	draggingChip.style.borderColor = '#c00';
	document.body.appendChild(draggingChip);
		offsetX = e.offsetX;
		offsetY = e.offsetY;
	});
});

document.addEventListener('mousemove', function(e) {
	if (draggingChip) {
		draggingChip.style.left = (e.pageX - offsetX) + 'px';
		draggingChip.style.top = (e.pageY - offsetY) + 'px';
	}
});

document.addEventListener('mouseup', function(e) {
	if (draggingChip) {
		let svg = document.querySelector('.craps-table-svg');
		let rect = svg.getBoundingClientRect();
		let x = e.clientX - rect.left;
		let y = e.clientY - rect.top;
		let dropped = false;
		svg.querySelectorAll('.bet-area').forEach(area => {
			let ax = parseFloat(area.getAttribute('x'));
			let ay = parseFloat(area.getAttribute('y'));
			let aw = parseFloat(area.getAttribute('width'));
			let ah = parseFloat(area.getAttribute('height'));
			let scaleX = svg.viewBox.baseVal.width / rect.width;
			let scaleY = svg.viewBox.baseVal.height / rect.height;
			let sx = x * scaleX;
			let sy = y * scaleY;
			if (sx >= ax && sx <= ax+aw && sy >= ay && sy <= ay+ah) {
				// Place chip visually
				let placed = draggingChip.cloneNode(true);
				placed.style.position = 'absolute';
				placed.style.left = ((ax+aw/2)/svg.viewBox.baseVal.width*100) + '%';
				placed.style.top = ((ay+ah/2)/svg.viewBox.baseVal.height*100) + '%';
				placed.style.transform = 'translate(-50%,-50%) scale(1.1)';
				placed.style.pointerEvents = 'none';
				placed.style.background = 'radial-gradient(circle at 60% 30%, #c00 60%, #800 100%)';
				placed.style.borderColor = '#c00';
				document.getElementById('placed-chips').appendChild(placed);
				placedChips.push({
					bet: area.getAttribute('data-bet'),
					value: parseInt(draggingChip.getAttribute('data-value'))
				});
				playerBalance -= parseInt(draggingChip.getAttribute('data-value'));
				updateBalance();
				dropped = true;
				placed.animate([
					{ transform: 'translate(-50%,-50%) scale(1.5)' },
					{ transform: 'translate(-50%,-50%) scale(1.1)' }
				], { duration: 200 });
			}
		});
		document.body.removeChild(draggingChip);
		draggingChip = null;
		if (!dropped) {
			// Optionally: shake chip or show error
		}
	}
});

// --- Craps Game Logic ---
function getBetsOnArea(area) {
	return placedChips.filter(c => c.bet === area);
}

function resolveBets(total) {
	let win = 0;
	let lose = 0;
	// Only Pass Line for now
	if (phase === 'comeout') {
		getBetsOnArea('pass-line').forEach(chip => {
			if (total === 7 || total === 11) {
				win += chip.value * 2;
			} else if ([2,3,12].includes(total)) {
				// lose
			} else {
				// point is set
			}
		});
		getBetsOnArea('pass-line-right').forEach(chip => {
			if (total === 7 || total === 11) {
				win += chip.value * 2;
			} else if ([2,3,12].includes(total)) {
				// lose
			} else {
				// point is set
			}
		});
	} else if (phase === 'point') {
		getBetsOnArea('pass-line').forEach(chip => {
			if (total === point) {
				win += chip.value * 2;
			} else if (total === 7) {
				// lose
			} else {
				// nothing
			}
		});
		getBetsOnArea('pass-line-right').forEach(chip => {
			if (total === point) {
				win += chip.value * 2;
			} else if (total === 7) {
				// lose
			} else {
				// nothing
			}
		});
	}
	playerBalance += win;
	updateBalance();
	// Animate chips to player if win
	if (win > 0) {
		document.getElementById('placed-chips').childNodes.forEach(chip => {
			chip.animate([
				{ filter: 'drop-shadow(0 0 0px #ffd700)' },
				{ filter: 'drop-shadow(0 0 16px #ffd700)' }
			], { duration: 400 });
		});
	}
}

function nextPhase(total) {
	if (phase === 'comeout') {
		if ([7,11].includes(total)) {
			document.getElementById('bet-info').textContent = 'Natural! Pass Line wins.';
			resolveBets(total);
			setTimeout(clearPlacedChips, 1200);
		} else if ([2,3,12].includes(total)) {
			document.getElementById('bet-info').textContent = 'Craps! Pass Line loses.';
			setTimeout(clearPlacedChips, 1200);
		} else {
			point = total;
			phase = 'point';
			document.getElementById('bet-info').textContent = 'Point is set: ' + point + '. Roll again!';
		}
	} else if (phase === 'point') {
		if (total === point) {
			document.getElementById('bet-info').textContent = 'You made your point! Pass Line wins.';
			resolveBets(total);
			setTimeout(() => {
				clearPlacedChips();
				phase = 'comeout';
				point = null;
			}, 1200);
		} else if (total === 7) {
			document.getElementById('bet-info').textContent = 'Seven out! Pass Line loses.';
			setTimeout(() => {
				clearPlacedChips();
				phase = 'comeout';
				point = null;
			}, 1200);
		} else {
			document.getElementById('bet-info').textContent = 'Rolling for point: ' + point;
		}
	}
}

// --- Roll Dice Button ---
document.getElementById('roll-btn').addEventListener('click', function() {
	if (placedChips.length === 0) {
		alert('Place at least one bet!');
		return;
	}
	const die1 = Math.floor(Math.random() * 6) + 1;
	const die2 = Math.floor(Math.random() * 6) + 1;
	const total = die1 + die2;
	animateDice3D(die1, die2, function() {
		document.getElementById('dice-result').textContent = `You rolled a ${total}`;
		nextPhase(total);
	});
});

// --- Init ---
updateBalance();
document.getElementById('die1').textContent = 1;
document.getElementById('die2').textContent = 1;
document.getElementById('bet-info').textContent = 'Place your bets and roll!';
