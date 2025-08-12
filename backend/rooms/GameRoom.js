const colyseus = require('colyseus');

class GameRoom extends colyseus.Room {
  onCreate(options) {
    this.setMetadata({ type: 'game' });
    this.state = {
      players: {},
      started: false
    };
    this.onMessage('startGame', (client, message) => {
      this.state.started = true;
      this.broadcast('gameStarted', {});
    });
    this.onMessage('playerAction', (client, message) => {
      // Handle player actions here
      this.broadcast('action', { sessionId: client.sessionId, ...message });
    });

    // Handle cube position sync
    this.state.cubePosition = { x: 0, y: 0, z: 0 };
    this.onMessage('cubeMoved', (client, pos) => {
      this.state.cubePosition = pos;
      this.broadcast('cubeMoved', pos);
    });
  }

  onJoin(client, options) {
    this.state.players[client.sessionId] = { score: 0 };
    this.broadcast('playerJoined', { sessionId: client.sessionId });
  }

  onLeave(client, consented) {
    delete this.state.players[client.sessionId];
    this.broadcast('playerLeft', { sessionId: client.sessionId });
  }

  onDispose() {
    // Cleanup if needed
  }
}

module.exports = { GameRoom };
