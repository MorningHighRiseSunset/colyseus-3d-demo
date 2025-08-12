document.addEventListener('DOMContentLoaded', function() {
  var startBtn = document.getElementById('startGameBtn');
  var onlineStatus = document.getElementById('onlineStatus');
  const socket = io('https://colyseus-3d-demo.onrender.com');

  // Show online indicator
  socket.on('connect', function() {
    onlineStatus.innerHTML = '<span class="player-dot"></span> You are online!';
  });
  socket.on('disconnect', function() {
    onlineStatus.innerHTML = '<span class="player-dot offline"></span> Offline';
  });

  if (startBtn) {
    startBtn.onclick = function() {
      window.location.href = 'lobby.html';
    };
  }
});
