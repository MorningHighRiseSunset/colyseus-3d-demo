const colyseus = require('colyseus');

class LobbyRoom extends colyseus.Room {
  onCreate(options) {
    this.setMetadata({ type: 'lobby' });
    this.onMessage('createRoom', (client, message) => {
      // Forward request to create a game room
      this.broadcast('roomCreated', { roomId: message.roomId });
    });
  }

  onJoin(client, options) {
    this.broadcast('playerJoined', { sessionId: client.sessionId });
  }

  onLeave(client, consented) {
    this.broadcast('playerLeft', { sessionId: client.sessionId });
  }

  onDispose() {
    // Cleanup if needed
  }
}

module.exports = { LobbyRoom };
