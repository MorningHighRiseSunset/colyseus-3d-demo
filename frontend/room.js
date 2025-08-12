const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const client = new Colyseus.Client('https://colyseus-3d-demo.onrender.com');
const roomInfo = document.getElementById('roomInfo');
const startGameBtn = document.getElementById('startGameBtn');

async function joinRoom() {
  const room = await client.joinById(roomId);
  roomInfo.innerText = `Room ID: ${roomId}`;
  startGameBtn.onclick = () => {
    window.location.href = `game.html?roomId=${roomId}`;
  };
}

joinRoom();
