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
      console.log('Received chess move:', move);
      ChessManager.processChessMove(move);
      UIManager.updateTurnIndicator();
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
        
        // Reset game phase to farming at the beginning of a turn
        if (turnHasChanged && GameState.isPlayerTurn()) {
          console.log('It is now this player\'s turn (from gameStateUpdate)');
          GameState.setCurrentGamePhase('farming');
          GameState.resetFarmActionTaken(); // Reset farm action flag for new turn
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
      
      // Show prominent notification to player
      showMessage('YOUR TURN - Farming Phase!', 5000);
      
      // Play a sound or other notification if implemented
      // playTurnSound();
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
    
    socket.emit('chess-move', {
      roomId: roomId,
      move: move
    });
    
    // End turn after making a chess move
    socket.emit('end-turn', {
      roomId: roomId
    });
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
   * @param {string} reason - The reason for game over
   */
  function sendGameOver(reason) {
    if (!socket || !roomId) {
      console.error('Socket or room ID not initialized');
      return;
    }
    
    console.log('Sending game over:', reason);
    
    socket.emit('game-over', {
      roomId: roomId,
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