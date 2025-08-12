// Lobby management for Metropoly multiplayer game
class LobbyManager {
    updatePlayerStatusUI(players) {
        // Find the container for player list (adjust selector as needed)
        const playersList = document.getElementById('playersList');
        if (!playersList) return;
        // Remove previous status dots
        Array.from(playersList.getElementsByClassName('player-status-dot')).forEach(dot => dot.remove());
        // Add/Update status dots for each player
        players.forEach(player => {
            // Find the player item by name (or id if available)
            const playerItems = Array.from(playersList.getElementsByClassName('player-item'));
            const playerItem = playerItems.find(item => item.textContent.includes(player.name));
            if (playerItem) {
                let dot = playerItem.querySelector('.player-status-dot');
                if (!dot) {
                    dot = document.createElement('span');
                    dot.className = 'player-status-dot';
                    dot.style.display = 'inline-block';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.borderRadius = '50%';
                    dot.style.marginLeft = '8px';
                    playerItem.querySelector('.player-info').appendChild(dot);
                }
                dot.style.background = player.connected ? 'limegreen' : 'gray';
            }
        });
    }
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.currentRoom = null;
        this.currentRoomInfo = null; // Store full room info
        this.playerName = null;
        this.selectedToken = null;
        this.isReady = false;
        this.isHost = false;

        // Recover playerId and room from sessionStorage if available
        try {
            const storedState = sessionStorage.getItem('metropoly_game_state');
            if (storedState) {
                const stored = JSON.parse(storedState);
                if (stored.playerId) {
                    this.playerId = stored.playerId;
                    console.log('[INIT] Recovered playerId from session:', this.playerId);
                }
                if (stored.roomId) {
                    this.currentRoom = stored.roomId;
                    console.log('[INIT] Recovered roomId from session:', this.currentRoom);
                }
                if (stored.playerName) {
                    this.playerName = stored.playerName;
                }
                if (stored.selectedToken) {
                    this.selectedToken = stored.selectedToken;
                }
                if (stored.isHost !== undefined) {
                    this.isHost = stored.isHost;
                }
            }
        } catch (error) {
            console.error('[INIT] Failed to recover state from sessionStorage:', error);
        }

        this.serverUrl = this.getServerUrl();
        this.connectSocketIO();
        this.setupEventListeners();
        this.loadRooms();

        // Auto-refresh available rooms every 5 seconds
        this.roomsRefreshInterval = setInterval(() => {
            // Only refresh if not in a room
            if (!this.currentRoom) {
                this.loadRooms();
            }
        }, 5000);
    }

    getServerUrl() {
        // Try multiple server URLs with fallback
        const servers = [
            'wss://metropoly.onrender.com',
            'ws://localhost:3000',
            'wss://metropoly-server.onrender.com'
        ];
        
        // For now, return the primary server
        return servers[0];
    }

    connectSocketIO() {
        const serverUrl = this.getServerUrl().replace('wss://', 'https://').replace('ws://', 'http://');
        console.log('🔌 Connecting to Socket.IO server:', serverUrl);
        try {
            this.socket = io(serverUrl);
            this.socket.on('connect', () => {
                console.log('✅ Connected to multiplayer server');
                this.updateConnectionStatus(true);
                // On reconnect, always try to rejoin if we have playerId and room
                if (this.currentRoom && this.playerId) {
                    console.log('[SOCKET] Attempting robust rejoin with playerId:', this.playerId, 'room:', this.currentRoom);
                    this.sendMessage({
                        type: 'rejoin_game',
                        roomId: this.currentRoom,
                        playerId: this.playerId,
                        playerName: this.playerName,
                        selectedToken: this.selectedToken
                    });
                } else {
                    // Try to recover from sessionStorage
                    try {
                        const storedState = sessionStorage.getItem('metropoly_game_state');
                        if (storedState) {
                            const stored = JSON.parse(storedState);
                            if (stored.roomId && stored.playerId) {
                                console.log('[SOCKET] Recovered state for rejoin:', stored);
                                this.sendMessage({
                                    type: 'rejoin_game',
                                    roomId: stored.roomId,
                                    playerId: stored.playerId,
                                    playerName: stored.playerName,
                                    selectedToken: stored.selectedToken
                                });
                            }
                        }
                    } catch (error) {
                        console.error('[SOCKET] Failed to recover state for rejoin:', error);
                    }
                }
            });
            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.updateConnectionStatus(false);
                setTimeout(() => {
                    if (!this.socket.connected) {
                        console.log('🔄 Attempting to reconnect...');
                        this.connectSocketIO();
                    }
                }, 3000);
            });
            this.socket.on('lobby_data', (data) => {
                this.handleServerMessage(data);
            });
            this.socket.on('player_status', (status) => {
                this.updatePlayerStatusUI(status.players);
            });
            this.socket.on('error', (error) => {
                console.error('❌ Socket.IO error:', error);
                this.updateConnectionStatus(false);
                this.showMessage('Connection failed. Please check your internet connection and try again.', 'error');
            });
        } catch (error) {
            console.error('❌ Failed to create Socket.IO connection:', error);
            this.showMessage('Unable to connect to server. Please try again later.', 'error');
        }
    }

    setupEventListeners() {
        // Create room form
        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoom();
        });

        // Join room form
        document.getElementById('joinRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinRoom();
        });

        // Modal close events
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Page unload handler for proper cleanup
        window.addEventListener('beforeunload', (e) => {
            if (this.currentRoom && this.playerId) {
                console.log('Page unloading, preserving game state');
                // Don't show confirmation dialog, just ensure state is preserved
                // Remove the preventDefault and returnValue to avoid popup
            }
        });

        // Page visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this.currentRoom) {
                console.log('Page becoming hidden, ensuring state preservation');
                // Ensure game state is stored
                if (this.currentRoom && this.playerId) {
                    const gameState = {
                        roomId: this.currentRoom,
                        playerId: this.playerId,
                        playerName: this.playerName,
                        selectedToken: this.selectedToken,
                        isHost: this.isHost,
                        timestamp: Date.now()
                    };
                    try {
                        sessionStorage.setItem('metropoly_game_state', JSON.stringify(gameState));
                    } catch (error) {
                        console.error('Failed to store game state on page hide:', error);
                    }
                }
            }
        });
    }

    handleServerMessage(data) {
        console.log('=== SERVER MESSAGE DEBUG ===');
        console.log('Message type:', data.type);
        console.log('Full message data:', data);
        console.log('Current room before handling:', this.currentRoom);
        console.log('Current playerId before handling:', this.playerId);
        console.log('============================');
        
        switch (data.type) {
            case 'room_created':
                this.handleRoomCreated(data);
                break;
            case 'joined_room':
                this.handleJoinedRoom(data);
                break;
            case 'player_joined':
                this.handlePlayerJoined(data);
                break;
            case 'player_left':
                this.handlePlayerLeft(data);
                break;
            case 'token_selected':
                this.handleTokenSelected(data);
                break;
            case 'player_ready_changed':
                this.handlePlayerReadyChanged(data);
                break;
            case 'game_started':
                this.handleGameStarted(data);
                break;
            case 'error':
                this.showMessage(data.message, 'error');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
        
        console.log('=== AFTER MESSAGE HANDLING ===');
        console.log('Current room after handling:', this.currentRoom);
        console.log('Current playerId after handling:', this.playerId);
        console.log('=============================');
    }

    handleRoomCreated(data) {
        this.playerId = data.playerId;
        this.currentRoom = data.roomId;
        this.isHost = true;
        // Persist to sessionStorage
        try {
            sessionStorage.setItem('metropoly_game_state', JSON.stringify({
                roomId: this.currentRoom,
                playerId: this.playerId,
                playerName: this.playerName,
                selectedToken: this.selectedToken,
                isHost: this.isHost,
                timestamp: Date.now()
            }));
            console.log('[ROOM CREATED] Stored playerId and roomId in session:', this.playerId, this.currentRoom);
        } catch (error) {
            console.error('[ROOM CREATED] Failed to store state:', error);
        }
        this.closeModal('createRoomModal');
        this.showRoomModal(data.roomInfo);
        this.showMessage(`Room created! Room ID: ${data.roomId}`, 'success');
    }

    handleJoinedRoom(data) {
        console.log('Joined room:', data);
        console.log('=== JOINED ROOM DEBUG ===');
        console.log('Previous currentRoom:', this.currentRoom);
        console.log('New roomId from data:', data.roomId);
        console.log('New playerId from data:', data.playerId);
        
    this.playerId = data.playerId;
    this.currentRoom = data.roomId; // Keep the room ID for reference
    this.currentRoomInfo = data.roomInfo; // Store full room info for UI updates

    console.log('Updated currentRoom:', this.currentRoom);
    console.log('Updated playerId:', this.playerId);
    console.log('========================');

    this.closeModal('joinRoomModal');
    this.updateRoomDisplay(data.roomInfo); // Ensure UI updates immediately
    this.showRoomModal(data.roomInfo);
    this.showMessage('Successfully joined room!', 'success');
    }

    handlePlayerJoined(data) {
        this.updateRoomDisplay(data.roomInfo);
        this.showMessage(`${data.playerName} joined the room`, 'success');
    }

    handlePlayerLeft(data) {
        this.updateRoomDisplay(data.roomInfo);
        this.showMessage('A player left the room', 'error');
    }

    handleTokenSelected(data) {
        console.log('Token selected by server:', data);
        if (data.playerId === this.playerId) {
            this.selectedToken = data.tokenName;
        }
        // Always update the room display to show the latest state
        if (data.roomInfo) {
            this.updateRoomDisplay(data.roomInfo);
        } else {
            // If no room info provided, at least update token selection
            this.updateTokenSelection();
        }
    }

    handlePlayerReadyChanged(data) {
        console.log('Player ready changed:', data);
        
        if (data.playerId === this.playerId) {
            this.isReady = data.ready;
            this.updateReadyButton();
            console.log('Updated my ready status to:', this.isReady);
        }
        
        // Always update the room display to show the latest state
        if (data.roomInfo) {
            console.log('Updating room display with:', data.roomInfo);
            this.updateRoomDisplay(data.roomInfo);
        } else {
            console.warn('No room info provided in player_ready_changed message');
        }
        
        // Show a notification for the ready status change
        const playerName = data.playerId === this.playerId ? 'You' : this.getPlayerName(data.playerId);
        const status = data.ready ? 'ready' : 'not ready';
        this.showMessage(`${playerName} are now ${status}`, 'info');
    }

    handleGameStarted(data) {
        this.showMessage('Game is starting!', 'success');
        
        // Debug logging to track the issue
        console.log('=== GAME STARTED DEBUG ===');
        console.log('this.currentRoom:', this.currentRoom);
        console.log('this.playerId:', this.playerId);
        console.log('this.playerName:', this.playerName);
        console.log('this.selectedToken:', this.selectedToken);
        console.log('this.isHost:', this.isHost);
        console.log('data received:', data);
        console.log('========================');
        
        // Safeguard: If currentRoom is undefined, try to get it from various sources
        let roomId = this.currentRoom;
        if (!roomId) {
            console.warn('currentRoom is undefined, trying to recover room ID...');
            
            // Try to get from data parameter
            if (data && data.roomId) {
                roomId = data.roomId;
                console.log('Recovered roomId from data:', roomId);
            }
            // Try to get from currentRoomInfo
            else if (this.currentRoomInfo && this.currentRoomInfo.roomId) {
                roomId = this.currentRoomInfo.roomId;
                console.log('Recovered roomId from currentRoomInfo:', roomId);
            }
            // Try to get from session storage
            else {
                try {
                    const storedState = sessionStorage.getItem('metropoly_game_state');
                    if (storedState) {
                        const stored = JSON.parse(storedState);
                        if (stored.roomId) {
                            roomId = stored.roomId;
                            console.log('Recovered roomId from session storage:', roomId);
                        }
                    }
                } catch (error) {
                    console.error('Error reading session storage for room recovery:', error);
                }
            }
            
            if (roomId) {
                this.currentRoom = roomId;
                console.log('Updated currentRoom to:', roomId);
            } else {
                console.error('Could not recover room ID from any source!');
                this.showMessage('Error: Could not determine room ID. Please return to lobby.', 'error');
                return;
            }
        }
        
        // Store critical game state in session storage before redirect
        const gameState = {
            roomId: roomId,
            playerId: this.playerId,
            playerName: this.playerName,
            selectedToken: this.selectedToken,
            isHost: this.isHost,
            timestamp: Date.now()
        };
        try {
            sessionStorage.setItem('metropoly_game_state', JSON.stringify(gameState));
            console.log('Game state stored in session storage:', gameState);
        } catch (error) {
            console.error('Failed to store game state:', error);
        }
        // Send a final message to ensure server has all data
        this.sendMessage({
            type: 'game_transition_ready',
            roomId: roomId,
            playerId: this.playerId
        });
        // Grace period: keep lobby socket alive for 10 seconds after game page loads
        window.lobbySocketGraceTimeout = setTimeout(() => {
            if (this.socket && this.socket.connected) {
                console.log('Grace period over, disconnecting lobby socket');
                this.socket.disconnect();
            }
        }, 10000);
        // Listen for game socket confirmation from game.html
        window.addEventListener('message', (event) => {
            if (event.data === 'game_socket_connected') {
                if (this.socket && this.socket.connected) {
                    console.log('Game socket confirmed, disconnecting lobby socket immediately');
                    clearTimeout(window.lobbySocketGraceTimeout);
                    this.socket.disconnect();
                }
            }
        });
        // Redirect to the game page with room information
        setTimeout(() => {
            console.log('Redirecting to game with room:', roomId, 'player:', this.playerId);
            // Always include both room and player in URL
            const gameUrl = `game.html?room=${roomId}&player=${this.playerId}`;
            console.log('Game URL:', gameUrl);
            window.location.href = gameUrl;
        }, 3000); // Increased delay to ensure data transfer
    }

    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showMessage('Please enter your name', 'error');
            return;
        }

        this.playerName = playerName;
        this.sendMessage({
            type: 'create_room',
            playerName: playerName
        });
    }

    joinRoom() {
        const playerName = document.getElementById('joinPlayerName').value.trim();
        const roomId = document.getElementById('roomId').value.trim().toUpperCase();
        
        if (!playerName || !roomId) {
            this.showMessage('Please enter both name and room ID', 'error');
            return;
        }

        this.playerName = playerName;
        this.sendMessage({
            type: 'join_room',
            roomId: roomId,
            playerName: playerName
        });
    }

    selectToken(tokenName) {
        console.log('Selecting token:', tokenName);
        if (this.selectedToken === tokenName) {
            // Deselect if already selected
            this.selectedToken = null;
        } else {
            this.selectedToken = tokenName;
        }

        // Update the visual selection immediately
        this.updateTokenSelection();

        console.log('Sending token selection to server:', this.selectedToken);
        this.sendMessage({
            type: 'select_token',
            tokenName: this.selectedToken,
            playerId: this.playerId
        });
    }

    toggleReady() {
        console.log('Toggle ready called, current state:', this.isReady);
        this.isReady = !this.isReady;
        console.log('New ready state:', this.isReady);
        this.updateReadyButton(); // Update the button immediately for visual feedback
        console.log('Sending ready status to server:', this.isReady);
        this.sendMessage({
            type: 'set_ready',
            ready: this.isReady,
            playerId: this.playerId
        });
    }

    getPlayerName(playerId) {
        // Try to find the player name from the current room info
        if (this.currentRoomInfo && this.currentRoomInfo.players) {
            const player = this.currentRoomInfo.players.find(p => p.id === playerId);
            return player ? player.name : 'Unknown Player';
        }
        return 'Unknown Player';
    }

    startGame() {
        if (!this.isHost) return;
        this.sendMessage({
            type: 'start_game',
            playerId: this.playerId
        });
    }

    leaveRoom() {
        this.sendMessage({
            type: 'leave_room'
        });
        
        this.closeModal('roomModal');
        this.currentRoom = null;
        this.playerId = null;
        this.selectedToken = null;
        this.isReady = false;
        this.isHost = false;
    }

    sendMessage(message) {
        // Always include correct playerId from memory or sessionStorage
        if (!message.playerId && this.playerId) {
            message.playerId = this.playerId;
        }
        // Debug log for every outgoing message
        console.log('[SEND MESSAGE] playerId:', message.playerId, 'type:', message.type);
        if (this.socket && this.socket.connected) {
            this.socket.emit('lobby_data', message);
        } else {
            console.error('Socket.IO not connected.');
            this.showMessage('Not connected to server', 'error');
        }
    }

    showRoomModal(roomInfo) {
        document.getElementById('roomIdDisplay').textContent = roomInfo.roomId;
        this.updateRoomDisplay(roomInfo);
        this.showModal('roomModal');
    }

    updateRoomDisplay(roomInfo) {
        console.log('Updating room display with:', roomInfo);
        console.log('=== UPDATE ROOM DISPLAY DEBUG ===');
        console.log('Current roomId before update:', this.currentRoom);
        console.log('New roomInfo.roomId:', roomInfo.roomId);
        
        // Store the current room info for reference (but keep room ID separate)
        this.currentRoomInfo = roomInfo;
        
        // Ensure currentRoom is always set to the correct room ID
        if (roomInfo.roomId && roomInfo.roomId !== this.currentRoom) {
            console.log('Updating currentRoom from', this.currentRoom, 'to', roomInfo.roomId);
            this.currentRoom = roomInfo.roomId;
        }
        
        this.updatePlayersList(roomInfo.players);
        this.updateTokenSelection(roomInfo.players);
        this.updateStartButton(roomInfo.canStart);
        
        console.log('Final currentRoom after update:', this.currentRoom);
        console.log('Room display updated successfully');
        console.log('==================================');
    }

    updatePlayersList(players) {
        console.log('Updating players list with:', players);
        const playersList = document.getElementById('playersList');
        if (!playersList) {
            console.error('Players list element not found');
            return;
        }
        
        playersList.innerHTML = '';

        // Add player count header
        const countHeader = document.createElement('div');
        countHeader.className = 'player-count-header';
        countHeader.innerHTML = `<div class="player-count">${players.length}/4 Players</div>`;
        playersList.appendChild(countHeader);

        players.forEach(player => {
            console.log(`Creating player item for: ${player.name}, ready: ${player.ready}, token: ${player.token}`);
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            const isCurrentPlayer = player.id === this.playerId;
            const statusClass = player.ready ? 'status-ready' : 'status-not-ready';
            const statusText = player.ready ? 'Ready' : 'Not Ready';
            
            playerItem.innerHTML = `
                <div class="player-info">
                    <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div>${player.name}${isCurrentPlayer ? ' (You)' : ''}${player.isHost ? ' (Host)' : ''}</div>
                        <div>${player.token ? `Token: ${player.token}` : 'No token selected'}</div>
                    </div>
                </div>
                <div class="player-status ${statusClass}">${statusText}</div>
            `;
            
            playersList.appendChild(playerItem);
        });
        
        console.log('Players list updated successfully');
    }

    updateTokenSelection(players = null) {
        console.log('Updating token selection, current selected:', this.selectedToken);
        const tokenSelection = document.getElementById('tokenSelection');
        if (!tokenSelection) {
            console.error('Token selection element not found');
            return;
        }
        
        tokenSelection.innerHTML = '';

        const availableTokens = [
            { name: 'rolls royce', image: 'Images/image-removebg-preview.png' },
            { name: 'helicopter', image: 'Images/image-removebg-preview (1).png' },
            { name: 'hat', image: 'Images/image-removebg-preview (6).png' },
            { name: 'football', image: 'Images/image-removebg-preview (7).png' },
            { name: 'burger', image: 'Images/image-removebg-preview (9).png' },
            { name: 'nike', image: 'Images/image-removebg-preview (10).png' },
            { name: 'woman', image: 'Images/image-removebg-preview (8).png' }
        ];

        // Get taken tokens from current players
        const takenTokens = players ? players.map(p => p.token).filter(t => t) : [];
        console.log('Taken tokens:', takenTokens);

        availableTokens.forEach(token => {
            const tokenOption = document.createElement('div');
            tokenOption.className = 'token-option';
            
            const isSelected = this.selectedToken === token.name;
            const isTaken = takenTokens.includes(token.name);
            
            if (isSelected) tokenOption.classList.add('selected');
            if (isTaken && !isSelected) tokenOption.classList.add('taken');
            
            tokenOption.innerHTML = `
                <div class="token-image" style="background-image: url('${token.image}')"></div>
                <div class="token-name">${token.name}</div>
            `;
            
            if (!isTaken || isSelected) {
                tokenOption.addEventListener('click', () => {
                    console.log('Token clicked:', token.name);
                    this.selectToken(token.name);
                });
            }
            
            tokenSelection.appendChild(tokenOption);
        });
    }

    updateReadyButton() {
        const readyBtn = document.getElementById('readyBtn');
        if (!readyBtn) {
            console.error('Ready button not found');
            return;
        }
        console.log('Updating ready button, isReady:', this.isReady);
        readyBtn.textContent = this.isReady ? 'Not Ready' : 'Ready';
        readyBtn.className = this.isReady ? 'btn btn-primary btn-large' : 'btn btn-secondary btn-large';
    }

    updateStartButton(canStart) {
        const startBtn = document.getElementById('startBtn');
        if (!startBtn) return;
        
        startBtn.disabled = !canStart || !this.isHost;
        
        // Update button text to show requirements
        if (!this.isHost) {
            startBtn.textContent = 'Only Host Can Start';
        } else if (!canStart) {
            startBtn.textContent = 'Need 2+ Ready Players';
        } else {
            startBtn.textContent = 'Start Game';
        }
    }

    async loadRooms() {
        try {
            console.log('📋 Loading rooms from server...');
            
            // Try multiple server URLs
            const servers = [
                'https://metropoly.onrender.com',
                'http://localhost:3000',
                'https://metropoly-server.onrender.com'
            ];
            
            let rooms = [];
            let serverUsed = null;
            
            for (const serverUrl of servers) {
                try {
                    console.log(`🔄 Trying server: ${serverUrl}`);
                    const response = await fetch(`${serverUrl}/api/rooms`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        rooms = await response.json();
                        serverUsed = serverUrl;
                        console.log(`✅ Successfully loaded ${rooms.length} rooms from ${serverUrl}`);
                        break;
                    } else {
                        console.log(`❌ Server ${serverUrl} returned status: ${response.status}`);
                    }
                } catch (error) {
                    console.log(`❌ Failed to connect to ${serverUrl}:`, error.message);
                }
            }
            
            // If we got a response from any server, we're connected
            if (serverUsed) {
                this.displayRooms(rooms);
                this.showMessage(`Connected to ${serverUsed}`, 'success');
            } else {
                console.log('❌ All servers failed, showing offline mode');
                this.showOfflineMode();
            }
            
        } catch (error) {
            console.error('❌ Failed to load rooms:', error);
            this.showOfflineMode();
        }
    }

    displayRooms(rooms) {
        const roomsList = document.getElementById('rooms-list');
        
        if (rooms.length === 0) {
            roomsList.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No rooms available</p>';
            return;
        }

        roomsList.innerHTML = '';
        
        rooms.forEach(room => {
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            
            const statusClass = room.status === 'lobby' ? 'status-lobby' : 'status-playing';
            const statusText = room.status === 'lobby' ? 'Lobby' : 'Playing';
            
            roomCard.innerHTML = `
                <div class="room-header">
                    <div class="room-id">${room.roomId}</div>
                    <div class="room-status ${statusClass}">${statusText}</div>
                </div>
                <div class="room-players">
                    <div class="player-count">${room.playerCount}/${room.maxPlayers} players</div>
                </div>
                <div class="room-actions-card">
                    <button class="btn btn-small btn-primary" onclick="lobbyManager.joinSpecificRoom('${room.roomId}')">Join</button>
                </div>
            `;
            
            roomsList.appendChild(roomCard);
        });
    }

    joinSpecificRoom(roomId) {
        document.getElementById('roomId').value = roomId;
        this.showModal('joinRoomModal');
    }

    refreshRooms() {
        this.loadRooms();
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        messageDiv.textContent = message;

        // Insert at the top of the container
        const container = document.querySelector('.container');
        container.insertBefore(messageDiv, container.firstChild);

        // Remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    showOfflineMode() {
        // Show offline mode message
        this.showMessage('Server is currently offline. You can still create a local game.', 'warning');
        
        // Update UI to show offline status
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            connectionStatus.textContent = 'Offline Mode';
            connectionStatus.className = 'status-disconnected';
        }
        
        // Disable online features
        const createRoomBtn = document.getElementById('createRoomBtn');
        if (createRoomBtn) {
            createRoomBtn.disabled = true;
            createRoomBtn.textContent = 'Server Offline';
        }
    }

    updateConnectionStatus(isConnected) {
        // Create connection status element if it doesn't exist
        let statusElement = document.getElementById('connection-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connection-status';
            statusElement.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(statusElement);
        }

        if (isConnected) {
            statusElement.textContent = '🟢 Connected';
            statusElement.style.backgroundColor = '#4CAF50';
            statusElement.style.color = 'white';
        } else {
            statusElement.textContent = '🔴 Disconnected';
            statusElement.style.backgroundColor = '#f44336';
            statusElement.style.color = 'white';
        }
    }
}

// Global functions for HTML onclick handlers
function showCreateRoomModal() {
    lobbyManager.showModal('createRoomModal');
}

function showJoinRoomModal() {
    lobbyManager.showModal('joinRoomModal');
}

function closeModal(modalId) {
    lobbyManager.closeModal(modalId);
}

function toggleReady() {
    console.log('Global toggleReady function called');
    if (lobbyManager) {
        lobbyManager.toggleReady();
    } else {
        console.error('LobbyManager not initialized');
    }
}

function startGame() {
    lobbyManager.startGame();
}

// Initialize lobby manager when page loads
let lobbyManager;
document.addEventListener('DOMContentLoaded', () => {
    lobbyManager = new LobbyManager();
});