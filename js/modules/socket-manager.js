// Socket connection and event handling module

const SocketManager = (() => {
  // Private variables
  let socket = null;
  let connectionAttempts = 0;
  let connected = false;
  
  // Game start event handler
  function handleGameStart(data) {
    console.log('Game start event received:', JSON.stringify(data));
    
    // Show a message to the user immediately
    showMessage('Game starting!', 3000);
    
    try {
      // Basic validation of the data
      if (!data) {
        console.error('Received empty data in gameStart event');
        showMessage('Error: Invalid game data received', 5000);
        return;
      }
      
      // Initialize or update the gameState
      const newGameState = data.gameState || {
        farms: {
          player1: { corn: 100, plots: [] },
          player2: { corn: 100, plots: [] }
        }
      };
      
      // Update game state
      GameState.updateGameState(newGameState, data.currentTurn);
      
      // Store the player color if provided
      if (data.playerColor) {
        GameState.setPlayerColor(data.playerColor);
      }
      
      // Show the game screen
      UIManager.showScreen('game-screen');
      
      // Initialize the chess engine with the FEN from server
      if (newGameState.chessEngineState) {
        GameState.updateChessEngine(newGameState.chessEngineState);
      }
      
      // Delayed setup to ensure DOM is ready
      setTimeout(() => {
        // Set up the chess board
        ChessManager.setupBoard();
        
        // Initialize farms
        FarmManager.initializeFarms();
        FarmManager.updateCornCounts();
        
        // Update turn indicator
        UIManager.updateTurnIndicator();
        
        console.log('Game initialization complete');
      }, 500);
    } catch (error) {
      console.error('Critical error in gameStart handler:', error);
      showMessage('Error starting game: ' + error.message, 5000);
      
      // Try a basic recovery - at least show the game screen
      UIManager.showScreen('game-screen');
    }
  }
  
  // Game state update event handler
  function handleGameStateUpdate(data) {
    try {
      console.log('Game state update received:', JSON.stringify(data));
      
      // Save the previous chess state for comparison
      const prevGameState = GameState.getGameState();
      const prevChessState = prevGameState.chessEngineState;
      
      // Update the game state and turn
      GameState.updateGameState(data.gameState, data.currentTurn);
      
      // Make sure we restore properties for crops
      GameState.restoreConfigurations();
      
      // Update chess engine if we have a valid state
      const newChessState = data.gameState?.chessEngineState;
      if (newChessState && newChessState !== '8/8/8/8/8/8/8/8 w - - 0 1') {
        try {
          GameState.updateChessEngine(newChessState);
        } catch (error) {
          console.error('Error setting chess FEN:', error);
          // If there's an error, try with the previous state or default
          if (prevChessState && prevChessState !== '8/8/8/8/8/8/8/8 w - - 0 1') {
            GameState.updateChessEngine(prevChessState);
          } else {
            GameState.updateChessEngine(null); // Initialize with default position
          }
        }
      } else {
        console.warn('Received empty or invalid board FEN. Using default position.');
        GameState.updateChessEngine(null); // Initialize with default position
      }
      
      // Update the board and displays
      ChessManager.refreshBoard();
      FarmManager.refreshFarms();
      UIManager.updateTurnIndicator();
      
      // Show the game screen if we're not already there
      UIManager.showScreen('game-screen');
    } catch (error) {
      console.error('Error in gameStateUpdate event handler:', error);
      showMessage('Error updating game: ' + error.message, 3000);
    }
  }
  
  // Game over event handler
  function handleGameOver(data) {
    console.log('Game over:', data);
    
    // Show game over message
    const playerState = GameState.getPlayerState();
    const isWinner = data.winner === playerState.playerId;
    const message = isWinner ? 
      `You won! ${data.reason === 'corn' ? 'You collected 200 corn!' : 'You checkmated your opponent!'}` :
      `You lost. ${data.reason === 'corn' ? 'Your opponent collected 200 corn.' : 'Your king was checkmated.'}`;
    
    UIManager.showVictoryBanner(isWinner, message);
  }
  
  // Public methods
  return {
    initialize() {
      console.log('Initializing socket manager');
      
      // Create socket connection
      socket = this.createSocketConnection();
      
      // Set up event listeners
      if (socket) {
        this.setupSocketListeners(socket);
      }
    },
    
    createSocketConnection() {
      try {
        console.log('Creating socket connection');
        
        const newSocket = io();
        connectionAttempts = 0;
        
        return newSocket;
      } catch (error) {
        console.error('Error creating socket connection:', error);
        showMessage('Error connecting to server. Please refresh the page.', 5000);
        return null;
      }
    },
    
    setupSocketListeners(socket) {
      console.log('Setting up socket event listeners');
      
      // Connection events
      socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
        connected = true;
        connectionAttempts = 0;
        
        // Store the player ID
        GameState.setPlayerId(socket.id);
        
        showMessage('Connected to server', 2000);
        
        // If we have a saved room ID, try to rejoin on reconnection
        const roomId = GameState.getPlayerState().roomId;
        if (roomId) {
          console.log(`Attempting to rejoin room ${roomId} after reconnect`);
          socket.emit('joinGame', { roomId: roomId });
          showMessage(`Reconnecting to game ${roomId}...`, 3000);
        }
      });
      
      // Handle connection errors
      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        connected = false;
        connectionAttempts++;
        
        if (connectionAttempts <= 3) {
          showMessage(`Connection error: ${error.message}. Retrying...`, 3000);
        } else {
          showMessage(`Unable to connect to server after ${connectionAttempts} attempts. Please check your connection.`, 5000);
        }
      });
      
      // Handle disconnections
      socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        connected = false;
        
        if (reason === 'io server disconnect') {
          // The server has forcefully disconnected the socket
          showMessage('Disconnected by server. Attempting to reconnect...', 3000);
          socket.connect();
        } else {
          // Other disconnection reasons (transport close, etc.)
          showMessage('Connection lost. Attempting to reconnect...', 3000);
        }
      });
      
      // Handle reconnection
      socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        showMessage('Reconnected to server', 2000);
        
        // If we were in a game, try to rejoin
        const roomId = GameState.getPlayerState().roomId;
        if (roomId) {
          console.log(`Attempting to rejoin room ${roomId} after reconnect`);
          socket.emit('joinGame', { roomId: roomId });
          showMessage(`Reconnecting to game ${roomId}...`, 3000);
        }
      });
      
      // Game related events
      
      // Handle player assignment
      socket.on('playerAssigned', (data) => {
        console.log('Player assigned event received:', data);
        
        // Store player information
        GameState.setPlayerColor(data.color);
        GameState.setRoomId(data.roomId);
        
        // Update the UI to show the player's color and room ID
        UIManager.updateRoomInfo();
        
        // Show the waiting screen
        UIManager.showScreen('waiting-screen');
        
        // Set waiting message
        UIManager.showWaitingMessage(`You've joined room ${data.roomId} as ${data.color}. Waiting for opponent...`);
        
        showMessage(`Joined room ${data.roomId} as ${data.color}`, 3000);
      });
      
      // Handle room full notification
      socket.on('roomFull', (data) => {
        console.log('Room full event received:', data);
        
        // Check if data exists and has roomId property
        const roomId = data && data.roomId ? data.roomId : 'the requested room';
        
        showMessage(`Room ${roomId} is full. Try another room.`, 5000);
      });
      
      // Handle game start
      socket.on('gameStart', handleGameStart);
      
      // Handle game state updates
      socket.on('gameStateUpdate', handleGameStateUpdate);
      
      // Handle game over
      socket.on('gameOver', handleGameOver);
      
      // Handle opponent leaving
      socket.on('opponentLeft', () => {
        console.log('Opponent left the game');
        showMessage('Your opponent has left the game.', 5000);
      });
      
      // Handle configuration updates
      socket.on('configUpdate', (data) => {
        console.log('Game configuration update received:', data);
        
        // Update the game config with the new values
        if (data.config) {
          GameState.getGameState().config = data.config;
          console.log('Game configuration updated to version:', data.version);
          
          // If we're in a game, update the UI to reflect any immediate changes
          if (GameState.getGameState().farms) {
            // Refresh farm displays
            FarmManager.refreshFarms();
            
            // Show notification
            showMessage('Game configuration has been updated!');
          }
        }
      });
    },
    
    joinRoom(roomId) {
      if (!socket || !connected) {
        console.error('Cannot join room: socket not connected');
        showMessage('Not connected to server. Please try again.', 3000);
        return;
      }
      
      if (!roomId) {
        console.error('Cannot join room: no room ID provided');
        showMessage('Please enter a valid room ID', 3000);
        return;
      }
      
      console.log(`Attempting to join room: ${roomId}`);
      socket.emit('joinGame', { roomId: roomId });
      GameState.setRoomId(roomId);
      
      showMessage(`Connecting to game ${roomId}...`, 3000);
    },
    
    sendMove(from, to) {
      if (!socket || !connected) {
        console.error('Cannot send move: socket not connected');
        showMessage('Not connected to server', 3000);
        return;
      }
      
      const playerState = GameState.getPlayerState();
      const roomId = playerState.roomId;
      
      if (!roomId) {
        console.error('Cannot send move: not in a room');
        return;
      }
      
      console.log(`Sending move: ${from} to ${to}`);
      socket.emit('makeMove', {
        roomId: roomId,
        from: from,
        to: to
      });
    },
    
    sendGameStateUpdate() {
      if (!socket || !connected) {
        console.error('Cannot send game state update: socket not connected');
        return;
      }
      
      const playerState = GameState.getPlayerState();
      const roomId = playerState.roomId;
      
      if (!roomId) {
        console.error('Cannot send game state update: not in a room');
        return;
      }
      
      console.log('Sending game state update to server');
      socket.emit('updateGameState', {
        roomId: roomId,
        gameState: GameState.getGameState()
      });
    },
    
    sendGameOver(reason) {
      if (!socket || !connected) {
        console.error('Cannot send game over: socket not connected');
        return;
      }
      
      const playerState = GameState.getPlayerState();
      const roomId = playerState.roomId;
      
      if (!roomId) {
        console.error('Cannot send game over: not in a room');
        return;
      }
      
      console.log(`Sending game over: ${reason}`);
      socket.emit('gameOver', {
        roomId: roomId,
        playerId: playerState.playerId,
        reason: reason
      });
    },
    
    isConnected() {
      return connected;
    },
    
    getSocket() {
      return socket;
    }
  };
})(); 