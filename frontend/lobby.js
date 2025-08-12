const socket = io('https://colyseus-3d-demo.onrender.com');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomId = document.getElementById('joinRoomId');
const roomList = document.getElementById('roomList');
const playerNameInput = document.getElementById('playerName');

createRoomBtn.onclick = () => {
  socket.emit('createRoom');
};

joinRoomBtn.onclick = () => {
  const roomId = joinRoomId.value.trim();
  const playerName = playerNameInput.value.trim() || 'Player';
  if (roomId) {
    window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
  }
};

socket.on('roomCreated', (roomId) => {
  const playerName = playerNameInput.value.trim() || 'Player';
  alert(`Room created! Room ID: ${roomId}\nShare this ID with your friend to join.`);
  window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
});

socket.on('roomList', (rooms) => {
  roomList.innerHTML = '';
  rooms.forEach(roomId => {
    const div = document.createElement('div');
    div.innerHTML = `<span class="player-dot"></span>Room: ${roomId}`;
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Join';
    joinBtn.className = 'btn';
    joinBtn.onclick = () => {
      const playerName = playerNameInput.value.trim() || 'Player';
      window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
    };
    div.appendChild(joinBtn);
    roomList.appendChild(div);
  });
});

// Request room list every 5 seconds
setInterval(() => {
  socket.emit('getRooms');
}, 5000);
