const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const client = new Colyseus.Client('http://localhost:3001'); // Change to your backend URL when deployed
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
