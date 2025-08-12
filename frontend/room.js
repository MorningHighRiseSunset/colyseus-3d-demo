const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const client = new Colyseus.Client('https://colyseus-3d-demo.onrender.com');
const roomInfo = document.getElementById('roomInfo');
const startGameBtn = document.getElementById('startGameBtn');

async function joinRoom() {
  const room = await client.joinById(roomId);
  roomInfo.innerHTML = `<strong>Room ID:</strong> ${roomId}<br><div id="players"></div>`;
  const playersDiv = document.getElementById('players');
  let ready = false;

  // Add ready button
  const readyBtn = document.createElement('button');
  readyBtn.textContent = 'Ready';
  readyBtn.className = 'btn';
  readyBtn.onclick = () => {
    ready = !ready;
    readyBtn.textContent = ready ? 'Ready ✔' : 'Ready';
    room.send('playerReady', { ready });
  };
  roomInfo.appendChild(readyBtn);

  // Track players
  function updatePlayers(state) {
    if (!state.players) return;
    playersDiv.innerHTML = '<strong>Players:</strong><br>' + Object.keys(state.players).map(id => {
      const p = state.players[id];
      return `${p.name || id} ${p.ready ? '✔' : ''}`;
    }).join('<br>');
  }

  room.onStateChange(updatePlayers);

  // Initial state
  updatePlayers(room.state);

  startGameBtn.onclick = () => {
    window.location.href = `game.html?roomId=${roomId}`;
  };
}

joinRoom();
