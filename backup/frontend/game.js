// --- Multiplayer 3D block demo logic with ready-up and host start ---
const socket = io('https://colyseus-3d-demo-9yuv.onrender.com');
socket.on('gameStarted', ({ hostName, roomId }) => {
  // Redirect all players to gameplay.html with roomId, playerName, and playerId
    // Save session info for gameplay.html fallback
    const sessionState = {
      roomId,
      playerId,
      playerName
    };
    sessionStorage.setItem('metropoly_game_state', JSON.stringify(sessionState));
    // Redirect all players to gameplay.html with roomId, playerName, and playerId
    window.location.href = `gameplay.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}&playerId=${playerId}`;
});

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const playerName = urlParams.get('playerName') || 'Player';
// Generate a unique playerId for this session
const playerId = Math.random().toString(36).substr(2, 9);

gameInfo.innerHTML = `<strong>Room ID:</strong> 
  <span style="color:#00c6ff;">${roomId}</span>
  <br><small>Share this ID with your friend to join!</small>
  <br><strong>Name:</strong> ${playerName}`;

const readyBtn = document.getElementById('readyBtn');
const startBtn = document.getElementById('startBtn');

socket.emit('joinRoom', { roomId, playerId, playerName });

let playerNum = null;
let isHost = false;
let readyStates = {};

socket.on('playerNumber', num => {
  playerNum = num;
  gameInfo.innerHTML += `<br><strong>You are Player ${playerNum}</strong>`;
  isHost = (playerNum === 1); // First player is host
  startBtn.style.display = 'none';
  readyBtn.style.display = '';
});

readyBtn.onclick = () => {
  socket.emit('playerReady', { roomId, playerId, playerName });
};

startBtn.onclick = () => {
  socket.emit('startGame', { roomId, playerId, playerName });
};

socket.on('playerReadyStates', (states) => {
  readyStates = states;
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML = Object.entries(readyStates).map(([name, ready]) => {
      return `<span class="player-dot" style="background:${ready ? '#00ff00' : '#ccc'}"></span> ${name}: ${ready ? 'Ready' : 'Not Ready'}`;
    }).join('<br>');
  }
  // If all players are ready, show Start Game for host
  const allReady = Object.values(readyStates).every(Boolean);
  if (isHost && allReady) {
    startBtn.style.display = '';
    readyBtn.style.display = 'none';
  } else {
    startBtn.style.display = 'none';
    readyBtn.style.display = '';
  }
});