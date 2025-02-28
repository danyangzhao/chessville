/**
 * Socket Manager Module
 * Handles all socket communication with the server
 */
const SocketManager = (function() {
  // Private variables
  let initialized = false;
  let socket = null;
  let roomId = null;
  
  /**
   * Initialize the Socket Manager
   * @returns {boolean} True if initialization was successful
   */
  function initialize() {
    if (initialized) {
      console.warn('Socket Manager already initialized');
      return true;
    }
    
    try {
      console.log('Initializing Socket Manager');
      
      // Initialize socket connection
      if (typeof io === 'undefined') {
        console.error('Socket.io library not loaded');
        return false;
      }
      
      // Connect to the server
      socket = io();
      
      // Set up event listeners
      setupSocketListeners();
      
      console.log('Socket Manager initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Socket Manager:', error);
      return false;
    }
  }
  
  /**
   * Set up socket event listeners
   */
  function setupSocketListeners() {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }
    
    // Connection events
    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
    
    // Game events
    socket.on('playerAssigned', (data) => {
      console.log('Player assigned to room:', data);
      roomId = data.roomId;
      
      // Initialize the game with the provided data
      GameState.setupGame(data.roomId, data.color);
      UIManager.setupGameUI(data.roomId, data.color);
      
      // Waiting for opponent
      UIManager.updateGameStatus('Waiting for opponent...');
      
      // If not first player, game is already in progress
      if (!data.isFirstPlayer) {
        UIManager.updateGameStatus('Joining existing game...');
      }
    });
    
    socket.on('roomFull', (data) => {
      console.log('Room is full:', data);
      UIManager.updateGameStatus('Room is full. Please try another room.');
      showMessage('Room is full. Please try another room.');
    });
    
    socket.on('room-joined', (data) => {
      console.log('Joined room:', data);
      roomId = data.roomId;
      
      // Initialize the game with the provided data
      GameState.setupGame(data.roomId, data.playerColor);
      UIManager.setupGameUI(data.roomId, data.playerColor);
      
      if (data.gameInProgress) {
        // Game is already in progress, update UI accordingly
        UIManager.updateGameStatus('Game in progress');
      } else {
        // Waiting for opponent
        UIManager.updateGameStatus('Waiting for opponent...');
      }
    });
    
    socket.on('opponent-joined', (data) => {
      console.log('Opponent joined:', data);
      GameState.setOpponentConnected(true);
      UIManager.updateGameStatus('Opponent joined');
      
      // Show the game screen
      UIManager.showScreen('game-screen');
      
      // Start the game if both players are ready
      if (data.startGame) {
        GameState.startGame();
        
        // Setup chess board
        ChessManager.setupBoard();
        
        // Update UI based on whether it's the player's turn
        if (GameState.isPlayerTurn()) {
          GameState.setCurrentGamePhase('farming');
          UIManager.updateGamePhaseIndicator('farming');
          showMessage('Your turn! Start with the farming phase');
        } else {
          UIManager.updateTurnIndicator();
          showMessage('Opponent\'s turn');
        }
      }
    });
    
    socket.on('opponent-disconnected', () => {
      console.log('Opponent disconnected');
      GameState.setOpponentConnected(false);
      UIManager.updateGameStatus('Opponent disconnected');
      showMessage('Opponent disconnected');
    });
    
    socket.on('gameStart', (data) => {
      console.log('Game started:', data);
      GameState.startGame();
      ChessManager.setupBoard();
      
      // Update UI based on whether it's the player's turn
      if (GameState.isPlayerTurn()) {
        UIManager.updateGamePhaseIndicator('farming');
        showMessage('Your turn! Start with the farming phase');
      } else {
        UIManager.updateTurnIndicator();
        showMessage('Opponent\'s turn');
      }
      
      // Show the game screen
      UIManager.showScreen('game-screen');
    });
    
    socket.on('game-started', (data) => {
      console.log('Game started (legacy event):', data);
      GameState.startGame();
      ChessManager.setupBoard();
      
      // Update UI based on whether it's the player's turn
      if (GameState.isPlayerTurn()) {
        UIManager.updateGamePhaseIndicator('farming');
        showMessage('Your turn! Start with the farming phase');
      } else {
        UIManager.updateTurnIndicator();
        showMessage('Opponent\'s turn');
      }
    });
    
    socket.on('chess-move', (move) => {
      console.log('Received chess move from opponent:', move);
      
      // Process the move to update the engine state
      ChessManager.processChessMove(move);
      
      // Always refresh the board to ensure proper synchronization
      setTimeout(() => {
        console.log('Refreshing board after receiving opponent move');
        
        // Ensure the game state turn is correctly set before refreshing board
        // This will help synchronize the chess engine's internal state with the game state
        const currentPlayerColor = GameState.getPlayerColor();
        const opponentColor = currentPlayerColor === 'white' ? 'black' : 'white';
        
        // If we just received a move from the opponent, it should now be our turn
        console.log(`Setting current turn to ${currentPlayerColor} after opponent's move`);
        GameState.setCurrentTurn(currentPlayerColor);
        
        // Now refresh the board with the corrected game state
        ChessManager.refreshBoard();
        
        // Update UI
        UIManager.updateTurnIndicator();
      }, 200); // Small delay to ensure everything is ready
      
      // Log the board state for debugging
      if (move.fen) {
        setTimeout(() => {
          const currentFEN = ChessManager.getCurrentFEN();
          console.log(`Received FEN from opponent: ${move.fen}`);
          console.log(`Local engine FEN after move: ${currentFEN}`);
          
          // If there's a mismatch, log a warning
          if (currentFEN !== move.fen) {
            console.warn('FEN mismatch detected after applying move');
          }
        }, 300);
      }
    });
    
    socket.on('farm-action', (action) => {
      console.log('Received farm action:', action);
      FarmManager.processFarmAction(action);
      UIManager.updateResourceDisplay();
    });
    
    socket.on('phase-change', (data) => {
      console.log('Phase changed:', data);
      GameState.setCurrentGamePhase(data.phase);
      UIManager.updateGamePhaseIndicator(data.phase);
      
      if (GameState.isPlayerTurn()) {
        if (data.phase === 'farming') {
          showMessage('Your turn - Farming Phase');
        } else {
          showMessage('Chess Phase - Make your move');
        }
      }
    });
    
    socket.on('turn-change', (data) => {
      console.log('Turn changed:', data);
      console.log('Current player color:', GameState.getPlayerColor());
      
      // This is now a fallback handler, as gameStateUpdate will be the primary handler
      if (data.color === 'white' || data.color === 'black') {
        console.log(`Turn-change event: Setting current turn to: ${data.color}`);
        // Only update if gameStateUpdate hasn't already handled it
        GameState.setCurrentTurn(data.color);
        UIManager.updateTurnIndicator();
        
        // Show message only - let gameStateUpdate do the more complex handling
        if (GameState.isPlayerTurn()) {
          showMessage('YOUR TURN - Farming Phase!', 5000);
        } else {
          showMessage('Opponent\'s turn');
        }
      } else {
        console.error('Invalid turn color received:', data.color);
      }
    });
    
    socket.on('gameStateUpdate', (data) => {
      console.log('Received game state update:', data);
      
      // Update game state first
      if (data.gameState) {
        GameState.updateFromServer(data.gameState);
      }
      
      // Store previous turn to detect changes
      const previousTurn = GameState.getCurrentTurn();
      
      // Update current turn
      if (data.currentTurn) {
        console.log(`Server says current turn is: ${data.currentTurn}`);
        GameState.setCurrentTurn(data.currentTurn);
        
        // Check if turn has changed
        const turnHasChanged = previousTurn !== data.currentTurn;
        console.log(`Turn has changed: ${turnHasChanged} (from ${previousTurn} to ${data.currentTurn})`);
        
        // ENHANCED TURN CHANGE DETECTION AND PROCESSING
        if (turnHasChanged) {
          console.log('Turn has changed - PROCESSING FARM PLOTS - Explicitly calling FarmManager.processTurn()');
          
          // Make sure FarmManager exists and has the processTurn function
          if (typeof FarmManager === 'undefined') {
            console.error('FarmManager is undefined, cannot process farm plots');
          } else if (typeof FarmManager.processTurn !== 'function') {
            console.error('FarmManager.processTurn is not a function, cannot process farm plots');
          } else {
            // Log farm state before processing
            console.log('Farm state before processing turn:');
            try {
              const farmState = FarmManager.getState ? FarmManager.getState() : 'Farm state not available';
              console.log(farmState);
            } catch (error) {
              console.error('Error getting farm state:', error);
            }
            
            // Process the turn - this should advance crops and auto-harvest ready ones
            FarmManager.processTurn();
            
            // Log farm state after processing
            console.log('Farm state after processing turn:');
            try {
              const farmState = FarmManager.getState ? FarmManager.getState() : 'Farm state not available';
              console.log(farmState);
            } catch (error) {
              console.error('Error getting farm state:', error);
            }
          }
        }
        
        // Reset game phase to farming at the beginning of a turn
        if (turnHasChanged && GameState.isPlayerTurn()) {
          console.log('It is now this player\'s turn (from gameStateUpdate)');
          GameState.setCurrentGamePhase('farming');
          
          // Reset farm action flag explicitly
          if (typeof GameState.resetFarmActionTaken === 'function') {
            GameState.resetFarmActionTaken();
          } else {
            console.error('GameState.resetFarmActionTaken is not a function');
          }
          
          UIManager.updateGamePhaseIndicator('farming');
          
          // Show notification
          showMessage('YOUR TURN - Farming Phase!', 5000);
        }
      }
      
      // Always update UI elements
      UIManager.updateTurnIndicator();
      FarmManager.updateFarmDisplay();
      UIManager.updateResourceDisplay();
    });
    
    socket.on('game-over', (data) => {
      console.log('Game over:', data);
      UIManager.showGameOver(data.winner, data.reason);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      showMessage('Error: ' + error.message);
    });
    
    // Add handler for direct turn notification
    socket.on('your-turn', (data) => {
      console.log('Received direct turn notification:', data);
      
      // Set current phase
      if (data.phase) {
        GameState.setCurrentGamePhase(data.phase);
        GameState.resetFarmActionTaken(); // Reset farm action flag for new turn
        UIManager.updateGamePhaseIndicator(data.phase);
      }
      
      // Set the current turn to the player's color
      const playerColor = GameState.getPlayerColor();
      console.log(`Setting current turn to ${playerColor} based on your-turn event`);
      GameState.setCurrentTurn(playerColor);
      
      // Always refresh the chess board to ensure it's in sync when turn changes,
      // regardless of current phase
      setTimeout(() => {
        console.log('Refreshing chess board on turn change');
        ChessManager.refreshBoard();
        
        // Update UI
        UIManager.updateTurnIndicator();
      }, 200); // Small delay to ensure everything is ready
      
      // Show prominent notification to player
      if (data.phase === 'farming') {
        showMessage('YOUR TURN - Farming Phase!', 5000);
      } else if (data.phase === 'chess') {
        showMessage('YOUR TURN - Chess Phase!', 5000);
      } else {
        showMessage('YOUR TURN!', 5000);
      }
    });
  }
  
  /**
   * Join a game room
   * @param {string} username - The player's username
   * @param {string} roomId - The room ID to join (optional)
   */
  function joinRoom(username, roomId = '') {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }
    
    // If roomId is the username (which happens when user types in room code in the username field)
    // then use that as the roomId and set username to a default value
    if (roomId === '' && username !== '') {
      roomId = username;
      username = 'Player';
    }
    
    console.log('Joining room with username:', username, 'roomId:', roomId);
    
    socket.emit('joinGame', {
      username: username,
      roomId: roomId
    });
    
    UIManager.updateGameStatus('Joining game...');
  }
  
  /**
   * Send a chess move to the server
   * @param {Object} move - The move object
   */
  function sendChessMove(move) {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending chess move:', move);
    
    // Include FEN to ensure board state synchronization
    const currentFEN = ChessManager.getCurrentFEN();
    
    socket.emit('chess-move', {
      roomId: roomId,
      move: move,
      fen: currentFEN
    });
    
    // End turn after making a chess move is handled by auto end-turn in ChessManager
  }
  
  /**
   * Send a farm action to the server
   * @param {string} action - The action type (plant, harvest, unlock)
   * @param {Object} data - The action data
   */
  function sendFarmAction(action, data) {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending farm action:', action, data);
    
    socket.emit('farm-action', {
      roomId: roomId,
      action: action,
      data: data
    });
  }
  
  /**
   * Send a farm update to the server
   * @param {string} action - The action type (plant, harvest, unlock)
   * @param {Object} data - The action data
   */
  function sendFarmUpdate(action, data) {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending farm update:', action, data);
    
    socket.emit('farm-action', {
      roomId: roomId,
      action: action,
      data: data
    });
  }
  
  /**
   * Send a plant crop action to the server
   * @param {number} plotIndex - The index of the plot
   * @param {string} cropType - The type of crop
   */
  function sendPlantCrop(plotIndex, cropType) {
    sendFarmUpdate('plant', {
      plotIndex: plotIndex,
      cropType: cropType
    });
    
    console.log(`Sent plant crop action: plot ${plotIndex}, crop ${cropType}`);
  }
  
  /**
   * Send a phase change to the server
   * @param {string} phase - The new phase (farming or chess)
   */
  function sendPhaseChange(phase) {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending phase change:', phase);
    
    socket.emit('phase-change', {
      roomId: roomId,
      phase: phase
    });
  }
  
  /**
   * Send an end turn to the server
   */
  function sendEndTurn() {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending end turn');
    
    // Get the current chess state
    const chessEngineState = ChessManager ? ChessManager.getCurrentFEN() : null;
    
    socket.emit('end-turn', {
      roomId: roomId,
      chessEngineState: chessEngineState
    });
  }
  
  /**
   * Send a game over notification to the server
   * @param {string} winner - The color of the winning player
   * @param {string} reason - The reason for game over
   */
  function sendGameOver(winner, reason) {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending game over - Winner:', winner, 'Reason:', reason);
    
    socket.emit('game-over', {
      roomId: roomId,
      winner: winner,
      reason: reason
    });
  }
  
  // Public API
  return {
    initialize,
    joinRoom,
    sendChessMove,
    sendFarmAction,
    sendFarmUpdate,
    sendPlantCrop,
    sendPhaseChange,
    sendEndTurn,
    sendGameOver
  };
})(); 