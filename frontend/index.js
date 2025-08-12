document.addEventListener('DOMContentLoaded', function() {
  var startBtn = document.getElementById('startGameBtn');
  if (startBtn) {
    startBtn.onclick = function() {
      window.location.href = 'lobby.html';
    };
  }
});
