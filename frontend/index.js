document.addEventListener('DOMContentLoaded', function() {
  var startBtn = document.getElementById('startGameBtn');
  var onlineStatus = document.getElementById('onlineStatus');
  const socket = io('https://colyseus-3d-demo-9yuv.onrender.com');

  // Show online indicator
  socket.on('connect', function() {
    onlineStatus.innerHTML = '<span class="player-dot"></span> You are online!';
  });
  socket.on('disconnect', function() {
    onlineStatus.innerHTML = '<span class="player-dot offline"></span> Offline';
  });

  // Multiplayer player list UI
  let playerListUI = null;
  socket.on('playerList', function(list) {
    if (!playerListUI) {
      playerListUI = document.createElement('div');
      playerListUI.id = 'player-list-ui';
      playerListUI.style.position = 'absolute';
      playerListUI.style.top = '10px';
      playerListUI.style.right = '10px';
      playerListUI.style.background = 'rgba(0,0,0,0.7)';
      playerListUI.style.color = '#fff';
      playerListUI.style.padding = '10px';
      playerListUI.style.borderRadius = '8px';
      playerListUI.style.zIndex = '1000';
      document.body.appendChild(playerListUI);
    }
    playerListUI.innerHTML = '<b>Players:</b><br>' + list.map(p => `<span>${p.name}</span>`).join('<br>');
  });

  if (startBtn) {
    startBtn.onclick = function() {
      window.location.href = 'lobby.html';
    };
  }
});
