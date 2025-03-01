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
      
      // Keep showing the waiting screen
      UIManager.showScreen('waiting-screen');
      
      // Update room code display
      const roomCodeDisplay = document.getElementById('room-code-display');
      if (roomCodeDisplay) {
        roomCodeDisplay.textContent = data.roomId;
      }
      
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
      // Use our enhanced processChessMove function
      processChessMove(move);
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
          console.log('Turn has changed - PROCESSING FARM PLOTS - Third call point');
          
          // Enhanced error checking and detailed logging
          if (typeof FarmManager === 'undefined') {
            console.error('FarmManager is undefined, cannot process farm plots');
          } else if (typeof FarmManager.processTurn !== 'function') {
            console.error('FarmManager.processTurn is not a function, cannot process farm plots');
          } else {
            try {
              // Log farm state before processing
              console.log('Farm state BEFORE processing turn in gameStateUpdate:', 
                typeof FarmManager.getState === 'function' ? 
                JSON.stringify(FarmManager.getState()) : 'getState not available');
              
              // Process farm turn
              FarmManager.processTurn();
              console.log('Successfully processed farm turn in gameStateUpdate');
              
              // Log farm state after processing
              console.log('Farm state AFTER processing turn in gameStateUpdate:', 
                typeof FarmManager.getState === 'function' ? 
                JSON.stringify(FarmManager.getState()) : 'getState not available');
            } catch (error) {
              console.error('Error processing farm turn in gameStateUpdate:', error);
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
      // Call our enhanced processYourTurn function
      processYourTurn(data);
      
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
      console.error('Socket not initialized, attempting to re-initialize');
      
      // Try to re-initialize the socket manager
      if (!initialize()) {
        console.error('Failed to re-initialize Socket Manager, cannot join room');
        UIManager.updateGameStatus('Connection error. Please refresh the page.');
        showMessage('Cannot connect to the server. Please try refreshing the page.', 5000);
        return;
      }
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
    
    // Show the waiting screen while waiting for server response
    UIManager.showScreen('waiting-screen');
    
    // Update room code display if it exists
    const roomCodeDisplay = document.getElementById('room-code-display');
    if (roomCodeDisplay && roomId) {
      roomCodeDisplay.textContent = roomId;
    }
    
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
   * @param {string} action - The action type (plant, harvest, auto-unlock)
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
   * Send an auto-unlock plot action to the server
   * @param {string} plotId - The ID of the plot to auto-unlock
   */
  function sendAutoUnlock(plotId) {
    sendFarmUpdate('auto-unlock', {
      plotId: plotId
    });
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
  
  /**
   * Processes a turn change notification
   * @param {Object} data - The turn change data
   */
  function processYourTurn(data) {
    console.log('Received direct turn notification:', data);
    
    if (data.color) {
      console.log(`Setting current turn to ${data.color} based on your-turn event`);
      GameState.setCurrentTurn(data.color);
      
      // Only process farm plots when it's actually the player's turn (not the opponent's)
      if (data.color === GameState.getPlayerColor()) {
        console.log('It is YOUR turn - Processing farm plots');
        
        // Enhanced error checking and logging
        if (typeof FarmManager === 'undefined') {
          console.error('FarmManager is undefined, cannot process farm plots');
        } else if (typeof FarmManager.processTurn !== 'function') {
          console.error('FarmManager.processTurn is not a function, cannot process farm plots');
        } else {
          // Log farm state before processing
          console.log('Farm state BEFORE processing turn:', 
            typeof FarmManager.getState === 'function' ? 
            JSON.stringify(FarmManager.getState()) : 'getState not available');
          
          // Process the turn and catch any errors
          try {
            FarmManager.processTurn();
            console.log('Successfully processed farm turn');
          } catch (error) {
            console.error('Error processing farm turn:', error);
          }
          
          // Log farm state after processing
          console.log('Farm state AFTER processing turn:', 
            typeof FarmManager.getState === 'function' ? 
            JSON.stringify(FarmManager.getState()) : 'getState not available');
        }
      } else {
        console.log('It is the OPPONENT\'s turn - Not processing your farm plots');
      }
      
      // Refresh the chess board when the turn changes
      console.log('Refreshing chess board on turn change');
      ChessManager.refreshBoard();
    }
  }
  
  /**
   * Processes a chess move from the opponent
   * @param {Object} data - The chess move data
   */
  function processChessMove(data) {
    console.log('Received chess move from opponent:', data);
    
    try {
      ChessManager.processOpponentMove(data);
      
      // After processing opponent's move, refresh the board and set the current turn
      console.log('Refreshing board after receiving opponent move');
      
      // Update turn after opponent's move to the player's color
      const playerColor = GameState.getPlayerColor();
      console.log('Setting current turn to ' + playerColor + ' after opponent\'s move');
      GameState.setCurrentTurn(playerColor);
      
      // Log the farm state for debugging but do not process farm plots
      if (typeof FarmManager !== 'undefined' && typeof FarmManager.getState === 'function') {
        console.log('Farm state after opponent move (not processing):', 
          JSON.stringify(FarmManager.getState()));
      }
      
      // Now refresh the board with the corrected game state
      ChessManager.refreshBoard();
      
      // Update UI
      UIManager.updateTurnIndicator();
    } catch (error) {
      console.error('Error processing opponent chess move:', error);
    }
  }
  
  /**
   * Check if the socket is connected
   * @returns {boolean} True if the socket is initialized and connected
   */
  function isConnected() {
    return socket !== null && socket.connected;
  }
  
  /**
   * Get the socket instance
   * @returns {Object|null} The socket instance or null if not initialized
   */
  function getSocket() {
    return socket;
  }
  
  /**
   * Get the room ID
   * @returns {string|null} The room ID or null if not in a room
   */
  function getRoomId() {
    return roomId;
  }
  
  /**
   * Get the player's color
   * @returns {string|null} The player's color or null if not assigned
   */
  function getPlayerColor() {
    return GameState ? GameState.getPlayerColor() : null;
  }
  
  // Public API
  return {
    initialize: initialize,
    joinRoom: joinRoom,
    sendChessMove: sendChessMove,
    sendFarmAction: sendFarmAction,
    sendFarmUpdate: sendFarmUpdate,
    sendPlantCrop: sendPlantCrop,
    sendAutoUnlock: sendAutoUnlock,
    sendPhaseChange: sendPhaseChange,
    sendEndTurn: sendEndTurn,
    sendGameOver: sendGameOver,
    isConnected: isConnected,
    getSocket: getSocket,
    getRoomId: getRoomId,
    getPlayerColor: getPlayerColor,
  };
})(); 