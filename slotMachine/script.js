
const symbols = ['🍒', '7️⃣', '💎'];
const spinBtn = document.getElementById('spinBtn');
const message = document.getElementById('message');
const reelStrips = [
	document.getElementById('reel1-strip'),
	document.getElementById('reel2-strip'),
	document.getElementById('reel3-strip')
];

function getRandomSymbol() {
	return symbols[Math.floor(Math.random() * symbols.length)];
}

function fillInitialReels() {
	reelStrips.forEach(strip => {
		strip.innerHTML = '';
		for (let i = 0; i < 3; i++) {
			const symbolDiv = document.createElement('div');
			symbolDiv.className = 'reel-symbol';
			symbolDiv.textContent = symbols[i % symbols.length];
			strip.appendChild(symbolDiv);
		}
	});
}




function animateReelDown(strip, finalSymbol, duration = 4000) {
	// Create a long strip of random symbols ending with finalSymbol
	const totalSymbols = 60;
	strip.innerHTML = '';
	let symbolList = [];
	for (let i = 0; i < totalSymbols - 1; i++) {
		symbolList.push(getRandomSymbol());
	}
	symbolList.push(finalSymbol);
	symbolList.forEach(sym => {
		const symbolDiv = document.createElement('div');
		symbolDiv.className = 'reel-symbol';
		symbolDiv.textContent = sym;
		strip.appendChild(symbolDiv);
	});
	// Animate downward
	strip.classList.add('spinning');
	strip.style.transition = 'none';
	strip.style.transform = 'translateY(0)';
	setTimeout(() => {
		strip.style.transition = `transform ${duration}ms cubic-bezier(.17,.67,.83,.67)`;
		strip.style.transform = `translateY(-${(totalSymbols-3)*60}px)`;
	}, 30);
}





function spin() {
	spinBtn.disabled = true;
	message.textContent = '';
	// Animate lever
	const lever = document.getElementById('slot-lever');
	lever.classList.add('pulled');
	setTimeout(() => lever.classList.remove('pulled'), 600);

	const finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
	reelStrips.forEach((strip, idx) => {
		animateReelDown(strip, finalSymbols[idx], 4000 + idx*500);
	});
	setTimeout(() => {
		// Wait for the animation to finish, then smoothly fade to the final result
		reelStrips.forEach((strip, idx) => {
			// Fade out spinning strip
			strip.style.transition = 'opacity 0.2s';
			strip.style.opacity = '0';
			setTimeout(() => {
				strip.classList.remove('spinning');
				// Show four symbols: one above, the final, one below, and one more below
				strip.innerHTML = '';
				const above = getRandomSymbol();
				const final = finalSymbols[idx];
				const below = getRandomSymbol();
				const below2 = getRandomSymbol();
				[above, final, below, below2].forEach(sym => {
					const symbolDiv = document.createElement('div');
					symbolDiv.className = 'reel-symbol';
					symbolDiv.textContent = sym;
					strip.appendChild(symbolDiv);
				});
				strip.style.transition = 'none';
				strip.style.transform = 'translateY(-60px)';
				strip.style.opacity = '1';
			}, 200);
		});
		setTimeout(() => {
			checkWin(finalSymbols);
			spinBtn.disabled = false;
		}, 250);
	}, 4000 + 2*500 + 100); // Wait for last reel to finish
}

function checkWin(finalSymbols) {
	if (finalSymbols[0] === finalSymbols[1] && finalSymbols[1] === finalSymbols[2]) {
		message.textContent = `🎉 Jackpot! Three ${finalSymbols[0]}! You win!`;
		message.style.color = '#FFD700';
		showSparkles();
	} else if (finalSymbols[0] === finalSymbols[1] || finalSymbols[1] === finalSymbols[2] || finalSymbols[0] === finalSymbols[2]) {
		message.textContent = `Nice! Two matching symbols!`;
		message.style.color = '#FFA500';
	} else {
		message.textContent = 'Try again!';
		message.style.color = '#fff';
	}
}

function showSparkles() {
	const sparkles = document.getElementById('sparkles');
	sparkles.innerHTML = '';
	for (let i = 0; i < 12; i++) {
		const sparkle = document.createElement('div');
		sparkle.className = 'sparkle';
		sparkle.style.left = `${Math.random()*80+10}px`;
		sparkle.style.top = `${Math.random()*60+10}px`;
		sparkles.appendChild(sparkle);
	}
	setTimeout(() => { sparkles.innerHTML = ''; }, 1200);
}

spinBtn.addEventListener('click', spin);
window.addEventListener('DOMContentLoaded', fillInitialReels);
