const socket = io('https://colyseus-3d-demo.onrender.com');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const gameInfo = document.getElementById('gameInfo');
const moveBtn = document.getElementById('moveBtn');
const status = document.getElementById('status');

let playerId = Math.random().toString(36).substr(2, 6);
let position = 0;

gameInfo.innerHTML = `<strong>Room ID:</strong> <span style="color:#00c6ff;">${roomId}</span><br><small>Share this ID with your friend to join!</small>`;

socket.emit('joinRoom', { roomId, playerId });

moveBtn.onclick = () => {
  position += 1;
  socket.emit('move', { roomId, playerId, position });
};

socket.on('update', ({ positions }) => {
  status.innerHTML = '<strong>Player Positions:</strong><br>' + Object.entries(positions).map(([id, pos]) => {
    return `<span class="player-dot"></span>${id}: ${pos}`;
  }).join('<br>');
});
