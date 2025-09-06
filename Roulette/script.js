// --- Roulette Game Logic & Animation ---

const canvasWheel = document.getElementById('wheel');
const ctxWheel = canvasWheel.getContext('2d');

// American roulette numbers in order for American roulette
const numbers = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
const slotCount = numbers.length;

// Colors: Green for 0 and 00, Red for others as per standard
const colors = {};
const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
numbers.forEach(num => {
	if (num === 0 || num === '00') colors[num] = 'green';
	else if (redNumbers.includes(num)) colors[num] = 'red';
	else colors[num] = 'black';
});

// --- Game State ---
let bets = {}; // {number: amount}
let spinning = false;
let spinAngle = 0;
let spinSpeed = 0;
let ballAngle = 0;
let ballSpeed = 0;
let ballRadius = 0;
let resultIndex = null;
let animationFrame = null;

// --- Draw Wheel, Ball, and Pointer ---
function drawWheel(angle = 0, ballA = null) {
	const centerX = canvasWheel.width / 2;
	const centerY = canvasWheel.height / 2;
	const radius = 160;
	const borderOuter = 195;
	const borderInner = 180;
	const slotAngle = 360 / slotCount;

	ctxWheel.clearRect(0, 0, canvasWheel.width, canvasWheel.height);

	// 3D wooden border (outer ring)
	ctxWheel.beginPath();
	ctxWheel.arc(centerX, centerY, borderOuter, 0, 2 * Math.PI);
	ctxWheel.fillStyle = '#5a2d0c';
	ctxWheel.shadowColor = '#2d1404';
	ctxWheel.shadowBlur = 18;
	ctxWheel.fill();
	ctxWheel.shadowBlur = 0;

	// Main wood ring
	ctxWheel.beginPath();
	ctxWheel.arc(centerX, centerY, borderInner, 0, 2 * Math.PI);
	ctxWheel.arc(centerX, centerY, borderOuter, 0, 2 * Math.PI, true);
	ctxWheel.closePath();
	let grad = ctxWheel.createRadialGradient(centerX, centerY, borderInner, centerX, centerY, borderOuter);
	grad.addColorStop(0, '#a86b2e');
	grad.addColorStop(0.5, '#e2b07a');
	grad.addColorStop(1, '#5a2d0c');
		ctxWheel.save();
		ctxWheel.translate(centerX, centerY);
		ctxWheel.rotate(angle * Math.PI / 180);

		// Draw main wheel (inner circle) with 3D gradient
		ctxWheel.beginPath();
		ctxWheel.arc(0, 0, radius, 0, 2 * Math.PI);
		let wheelGrad = ctxWheel.createRadialGradient(0, 0, 30, 0, 0, radius);
		wheelGrad.addColorStop(0, '#fffbe6');
		wheelGrad.addColorStop(0.15, '#e2b07a');
		wheelGrad.addColorStop(0.5, '#222');
		wheelGrad.addColorStop(1, '#111');
		ctxWheel.fillStyle = wheelGrad;
		ctxWheel.fill();
		ctxWheel.strokeStyle = '#000';
		ctxWheel.lineWidth = 2;
		ctxWheel.stroke();

		// Draw slots with 3D effect
		for (let i = 0; i < numbers.length; i++) {
			const num = numbers[i];
			const startAngle = (i * slotAngle) * (Math.PI / 180);
			const endAngle = ((i + 1) * slotAngle) * (Math.PI / 180);
			ctxWheel.save();
			ctxWheel.beginPath();
			ctxWheel.arc(0, 0, radius - 20, startAngle, endAngle);
			ctxWheel.arc(0, 0, 30, endAngle, startAngle, true);
			ctxWheel.closePath();
			let slotGrad = ctxWheel.createLinearGradient(
				Math.cos(startAngle) * (radius - 25),
				Math.sin(startAngle) * (radius - 25),
				Math.cos(endAngle) * (radius - 25),
				Math.sin(endAngle) * (radius - 25)
			);
			if (colors[num] === 'red') {
				slotGrad.addColorStop(0, '#e53935');
				slotGrad.addColorStop(0.5, '#a31515');
				slotGrad.addColorStop(1, '#e53935');
			} else if (colors[num] === 'black') {
				slotGrad.addColorStop(0, '#444');
				slotGrad.addColorStop(0.5, '#111');
				slotGrad.addColorStop(1, '#444');
			} else {
				slotGrad.addColorStop(0, '#3fa34d');
				slotGrad.addColorStop(0.5, '#0a4a23');
				slotGrad.addColorStop(1, '#3fa34d');
			}
			ctxWheel.fillStyle = slotGrad;
			ctxWheel.shadowColor = '#0008';
			ctxWheel.shadowBlur = 4;
			ctxWheel.fill();
			ctxWheel.shadowBlur = 0;
			ctxWheel.strokeStyle = '#fffbe6';
			ctxWheel.lineWidth = 1.5;
			ctxWheel.stroke();

			// Draw number (rotated to center of slot)
			ctxWheel.save();
			ctxWheel.rotate(startAngle + (endAngle - startAngle) / 2);
			ctxWheel.fillStyle = '#fffbe6';
			ctxWheel.font = 'bold 17px Arial';
			ctxWheel.textAlign = 'center';
			ctxWheel.shadowColor = '#000a';
			ctxWheel.shadowBlur = 4;
			ctxWheel.fillText(num.toString(), radius - 50, 5);
			ctxWheel.shadowBlur = 0;
			ctxWheel.restore();
			ctxWheel.restore();
		}

		// Metallic spindle in the center
		ctxWheel.beginPath();
		ctxWheel.arc(0, 0, 22, 0, 2 * Math.PI);
		let spindleGrad = ctxWheel.createRadialGradient(0, 0, 2, 0, 0, 22);
		spindleGrad.addColorStop(0, '#fffbe6');
		spindleGrad.addColorStop(0.4, '#bfae7c');
		spindleGrad.addColorStop(1, '#888');
		ctxWheel.fillStyle = spindleGrad;
		ctxWheel.shadowColor = '#fffbe6';
		ctxWheel.shadowBlur = 8;
		ctxWheel.fill();
		ctxWheel.shadowBlur = 0;
		ctxWheel.restore();

		ctxWheel.restore();

		// Draw 3D ball if spinning
		if (ballA !== null) {
		// Ball spirals inward as it slows
		let t = Math.max(0, Math.min(1, (ballSpeed - 0.07) / 0.25)); // 1 at fast, 0 at slow
		const minR = radius - 50, maxR = radius - 32;
		const ballR = minR + (maxR - minR) * t;
		// Add a subtle bounce effect
		let bounce = Math.sin(performance.now() / 120) * 2.5 * t;
		const bx = centerX + Math.cos(ballA) * ballR;
		const by = centerY + Math.sin(ballA) * ballR + bounce;
		// Ball shadow (improved)
		ctxWheel.save();
		ctxWheel.beginPath();
		ctxWheel.ellipse(bx + 3, by + 12, 11, 6, 0, 0, 2 * Math.PI);
		ctxWheel.fillStyle = 'rgba(0,0,0,0.22)';
		ctxWheel.filter = 'blur(3px)';
		ctxWheel.fill();
		ctxWheel.filter = 'none';
		ctxWheel.restore();
		// Ball (improved 3D effect)
		ctxWheel.save();
		ctxWheel.beginPath();
		ctxWheel.arc(bx, by, 11, 0, 2 * Math.PI);
		let ballGrad = ctxWheel.createRadialGradient(bx - 5, by - 7, 2, bx, by, 11);
		ballGrad.addColorStop(0, '#fffefc');
		ballGrad.addColorStop(0.18, '#f7f7e6');
		ballGrad.addColorStop(0.45, '#e2e2e2');
		ballGrad.addColorStop(0.7, '#b0b0b0');
		ballGrad.addColorStop(1, '#888');
		ctxWheel.fillStyle = ballGrad;
		ctxWheel.shadowColor = '#fffbe6';
		ctxWheel.shadowBlur = 10;
		ctxWheel.fill();
		ctxWheel.shadowBlur = 0;
		// Ball highlight (improved rolling effect)
		let highlightAngle = (performance.now() / 180) % (2 * Math.PI);
		let hx = bx + Math.cos(highlightAngle + ballA) * 6.5;
		let hy = by + Math.sin(highlightAngle + ballA) * 6.5 - 3;
		ctxWheel.save();
		ctxWheel.beginPath();
		ctxWheel.arc(hx, hy, 4.2, 0, 2 * Math.PI);
		ctxWheel.fillStyle = 'rgba(255,255,220,0.92)';
		ctxWheel.shadowColor = '#fffbe6';
		ctxWheel.shadowBlur = 12;
		ctxWheel.fill();
		ctxWheel.shadowBlur = 0;
		ctxWheel.restore();
		// Ball rim subtle shadow
		ctxWheel.beginPath();
		ctxWheel.arc(bx, by, 11, 0, 2 * Math.PI);
		ctxWheel.strokeStyle = 'rgba(80,80,80,0.18)';
		ctxWheel.lineWidth = 2.2;
		ctxWheel.stroke();
		ctxWheel.restore();
		}
		ctxWheel.shadowBlur = 6;
		ctxWheel.fill();
		ctxWheel.shadowBlur = 0;
		ctxWheel.restore();
	}
// end drawWheel

// --- Animation Loop ---
function animate() {
	if (!spinning) return;
	spinAngle += spinSpeed;
	spinSpeed *= 0.998; // much slower friction for much longer spin
	if (spinSpeed < 0.07) spinSpeed = 0.07;
	ballAngle -= ballSpeed;
	ballSpeed *= 0.998;
	if (ballSpeed < 0.09) ballSpeed = 0.09;

	// Ball slows and falls into slot
	if (spinSpeed < 0.2 && ballSpeed < 0.13 && resultIndex !== null) {
		// Snap ball to result
		const slotAngleRad = 2 * Math.PI / slotCount;
		ballAngle = ((resultIndex + 0.5) * slotAngleRad - spinAngle * Math.PI / 180) % (2 * Math.PI);
		drawWheel(spinAngle, ballAngle);
		spinning = false;
		setTimeout(() => showResult(), 1200);
		return;
	}
	drawWheel(spinAngle, ballAngle);
	animationFrame = requestAnimationFrame(animate);
}

// --- Betting and UI ---
function placeBet(num) {
	if (spinning) return;
	bets[num] = (bets[num] || 0) + 1;
	highlightBet(num);
}

// Enable betting on bottom table options
document.querySelectorAll('.bet-box').forEach(box => {
	box.addEventListener('click', () => {
		let label = box.textContent.trim();
		let betType = label;
		if (box.classList.contains('red')) betType = 'Red';
		if (box.classList.contains('black')) betType = 'Black';
		bets[betType] = (bets[betType] || 0) + 1;
		box.style.boxShadow = '0 0 16px 4px #ffe066, 0 2px 8px #0005 inset';
		setTimeout(() => box.style.boxShadow = '', 500);
	});
});

// Enable betting on column bets
document.querySelectorAll('.column-bet').forEach((col, i) => {
	col.addEventListener('click', () => {
		let betType = `Column ${i+1}`;
		bets[betType] = (bets[betType] || 0) + 1;
		col.style.boxShadow = '0 0 16px 4px #ffe066, 0 2px 8px #0005 inset';
		setTimeout(() => col.style.boxShadow = '', 500);
	});
});

function highlightBet(num) {
	// Highlight the cell for a moment
	const cells = document.querySelectorAll(`[aria-label="${num}"]`);
	cells.forEach(cell => {
		cell.style.boxShadow = '0 0 16px 4px #ffe066, 0 2px 8px #0005 inset';
		setTimeout(() => cell.style.boxShadow = '', 500);
	});
}

function clearBets() {
	bets = {};
}

// --- Spin Logic ---
function spinWheel() {
	if (spinning) return;
	if (Object.keys(bets).length === 0) {
		alert('Place a bet first!');
		return;
	}
	spinning = true;
	spinAngle = Math.random() * 360;
	spinSpeed = 8 + Math.random() * 2;
	ballAngle = Math.random() * 2 * Math.PI;
	ballSpeed = 0.32 + Math.random() * 0.04;
	// Pick a random winning slot from bets for demo, or random
	const betNums = Object.keys(bets);
	let winNum;
	if (betNums.length > 0 && Math.random() < 0.7) {
		winNum = betNums[Math.floor(Math.random() * betNums.length)];
	} else {
		winNum = numbers[Math.floor(Math.random() * numbers.length)];
	}
	resultIndex = numbers.findIndex(n => n == winNum);
	animationFrame && cancelAnimationFrame(animationFrame);
	drawWheel(spinAngle, ballAngle); // Draw initial ball position
	animate();
}

function showResult() {
	const winNum = numbers[resultIndex];
	let msg = `Winning number: ${winNum}`;
	let win = false;
	if (bets[winNum]) win = true;
	// Dozens
	if (winNum >= 1 && winNum <= 12 && bets['1st 12']) win = true;
	if (winNum >= 13 && winNum <= 24 && bets['2nd 12']) win = true;
	if (winNum >= 25 && winNum <= 36 && bets['3rd 12']) win = true;
	// Low/High
	if (winNum >= 1 && winNum <= 18 && bets['1 to 18']) win = true;
	if (winNum >= 19 && winNum <= 36 && bets['19 to 36']) win = true;
	// Even/Odd
	if (winNum !== 0 && winNum !== '00' && winNum % 2 === 0 && bets['EVEN']) win = true;
	if (winNum % 2 === 1 && bets['ODD']) win = true;
	// Red/Black
	if (redNumbers.includes(winNum) && bets['Red']) win = true;
	if (blackNumbers.includes(winNum) && bets['Black']) win = true;
	// Columns
	for (let i = 0; i < 12; i++) {
		let colNums = [3-i*3, 2-i*3, 1-i*3].map(n => n + i*3);
		if (colNums.includes(winNum) && bets[`Column ${i+1}`]) win = true;
	}
	if (win) {
		msg += `\nYou win!`;
	} else {
		msg += `\nNo win this time.`;
	}
	alert(msg);
	clearBets();
	drawWheel();
}

// --- Table Interactivity ---
document.querySelectorAll('.number-cell').forEach(cell => {
	cell.addEventListener('click', () => {
		const num = cell.getAttribute('aria-label');
		placeBet(num);
		updatePlayerInfo();
	});
});

// Add a spin button


// --- Player Info Logic ---
window.playerBalance = 5000;
window.betAmount = 100;
function updatePlayerInfo() {
	let totalBets = Object.values(bets || {}).reduce((a,b) => a+b, 0);
	let betsList = Object.keys(bets || {}).length ? Object.entries(bets).map(([k,v]) => `${k} ($${v*window.betAmount})`).join(', ') : 'No bets placed yet';
	let remaining = window.playerBalance - totalBets * window.betAmount;
	const balElem = document.getElementById('player-balance');
	const betsElem = document.getElementById('player-bets');
	const remElem = document.getElementById('player-remaining');
	if (balElem) balElem.textContent = `$${window.playerBalance}`;
	if (betsElem) betsElem.textContent = betsList;
	if (remElem) remElem.textContent = `$${remaining}`;
}
window.updatePlayerInfo = updatePlayerInfo;

// Update info on bet for bottom table bets
document.querySelectorAll('.bet-box').forEach(box => {
	box.addEventListener('click', updatePlayerInfo);
});
document.querySelectorAll('.column-bet').forEach(box => {
	box.addEventListener('click', updatePlayerInfo);
});

// Update info on spin
const origSpinWheel = spinWheel;
window.spinWheel = function() {
	origSpinWheel();
	updatePlayerInfo();
};

// Remove alert, show result in info bar
const origShowResult = showResult;
window.showResult = function() {
	const winNum = numbers[resultIndex];
	let win = false;
	if (bets[winNum]) win = true;
	// Dozens
	if (winNum >= 1 && winNum <= 12 && bets['1st 12']) win = true;
	if (winNum >= 13 && winNum <= 24 && bets['2nd 12']) win = true;
	if (winNum >= 25 && winNum <= 36 && bets['3rd 12']) win = true;
	// Low/High
	if (winNum >= 1 && winNum <= 18 && bets['1 to 18']) win = true;
	if (winNum >= 19 && winNum <= 36 && bets['19 to 36']) win = true;
	// Even/Odd
	if (winNum !== 0 && winNum !== '00' && winNum % 2 === 0 && bets['EVEN']) win = true;
	if (winNum % 2 === 1 && bets['ODD']) win = true;
	// Red/Black
	if (redNumbers.includes(winNum) && bets['Red']) win = true;
	if (blackNumbers.includes(winNum) && bets['Black']) win = true;
	// Columns
	for (let i = 0; i < 12; i++) {
		let colNums = [3-i*3, 2-i*3, 1-i*3].map(n => n + i*3);
		if (colNums.includes(winNum) && bets[`Column ${i+1}`]) win = true;
	}
	let msg = `Winning number: ${winNum}`;
	if (win) {
		window.playerBalance += Object.values(bets || {}).reduce((a,b) => a+b, 0) * window.betAmount * 2; // Simple payout: 2x
		msg += ' | You win!';
	} else {
		window.playerBalance -= Object.values(bets || {}).reduce((a,b) => a+b, 0) * window.betAmount;
		msg += ' | No win.';
	}
	updatePlayerInfo();
	// Show popup/modal for result
	let resultModal = document.getElementById('result-modal');
	if (!resultModal) {
		resultModal = document.createElement('div');
		resultModal.id = 'result-modal';
		resultModal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:center;justify-content:center;';
		let inner = document.createElement('div');
		inner.style = 'background:#fffbe6;color:#222;padding:32px 28px 24px 28px;border-radius:18px;max-width:420px;box-shadow:0 8px 32px #0008;position:relative;text-align:center;';
		inner.id = 'result-modal-inner';
		resultModal.appendChild(inner);
		document.body.appendChild(resultModal);
	}
	let inner = document.getElementById('result-modal-inner');
	inner.innerHTML = `<h2>${win ? 'You Win!' : 'No Win'}</h2><p>${msg}</p><div style='margin:12px 0;font-weight:bold;'>Money Available: <span id='modal-player-balance'>$${window.playerBalance}</span></div><button id=\"close-result-modal\" style=\"margin-top:18px;padding:8px 22px;font-size:1em;background:#e2b07a;color:#222;border-radius:10px;border:none;box-shadow:0 2px 8px #0005;cursor:pointer;font-weight:bold;\">OK</button>`;
	resultModal.style.display = 'flex';
	document.getElementById('close-result-modal').onclick = function() {
		resultModal.style.display = 'none';
	};
	// Also update the main money counter in the info bar
	updatePlayerInfo();
	clearBets();
	drawWheel();
};

// Initial draw and info update
// Draw the ball in a resting position before spinning
let restingBallAngle = Math.PI * 1.5; // Top center
drawWheel(0, restingBallAngle);
updatePlayerInfo();
