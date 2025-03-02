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
   * Handle reconnection to an existing game
   * @param {Object} reconnectData - Data needed for reconnection
   */
  function reconnect(reconnectData) {
    if (!socket) {
      console.error('Cannot reconnect - socket not initialized');
      return;
    }
    
    console.log('🔴 Attempting to reconnect with data:', reconnectData);
    
    // Try to get saved game state from localStorage
    try {
      const savedState = localStorage.getItem('chessFarm_gameState');
      if (savedState) {
        const gameState = JSON.parse(savedState);
        console.log('🔴 Found saved game state in localStorage:', gameState);
        
        // Check if the saved state matches the reconnection attempt
        if (gameState.roomId === reconnectData.roomId) {
          // Pre-initialize game state with the player color to avoid null issues
          if (gameState.color) {
            GameState.setupGame(gameState.roomId, gameState.color);
            console.log('🔴 Pre-initialized game state with color:', gameState.color);
          }
          
          // Add saved FEN position to reconnection data if available
          if (gameState.fen) {
            reconnectData.savedFEN = gameState.fen;
            console.log('🔴 Adding saved FEN to reconnection data:', gameState.fen);
          }
          
          // Add saved farm state to reconnection data if available
          if (gameState.farmState) {
            reconnectData.savedFarmState = gameState.farmState;
            console.log('🔴 Adding saved farm state to reconnection data');
          }
        }
      }
    } catch (e) {
      console.error('Error retrieving saved game state:', e);
    }
    
    // Emit join game with reconnect flag
    socket.emit('joinGame', {
      username: reconnectData.username,
      roomId: reconnectData.roomId,
      isReconnecting: true,
      previousColor: reconnectData.previousColor,
      savedFEN: reconnectData.savedFEN,
      savedFarmState: reconnectData.savedFarmState
    });
    
    console.log('🔴 Reconnection request sent to server');
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
    
    socket.on('reconnectSuccess', (data) => {
      console.log('🔴 Reconnection successful:', data);
      roomId = data.roomId;
      
      // CRITICAL: Update game state with the reconnected player's color and game state
      // This ensures the color is properly set before other components try to use it
      GameState.setupGame(data.roomId, data.color);
      
      // Log color assignment for debugging
      console.log('🔴 Player color set to:', data.color);
      
      // Start the game immediately since we're reconnecting
      GameState.startGame();
      
      // Update resources if provided
      if (data.wheatCount !== undefined) {
        GameState.updateWheat(data.color, data.wheatCount);
      }
      
      // Update farm state if provided
      if (data.farmState) {
        if (typeof FarmManager !== 'undefined' && typeof FarmManager.restoreFarmState === 'function') {
          console.log('🔴 Restoring farm state during reconnection');
          FarmManager.restoreFarmState(data.farmState);
        } else {
          console.error('🔴 FarmManager.restoreFarmState is not available!');
        }
      }
      
      // Set current turn
      if (data.currentTurn) {
        GameState.setCurrentTurn(data.currentTurn);
      }
      
      // Setup UI with room ID and player color
      console.log('🔴 Setting up game UI after successful reconnection');
      UIManager.setupGameUI(data.roomId, data.color);
      
      // Update UI
      UIManager.showScreen('game-screen');
      UIManager.updateGameStatus('Reconnected to game');
      UIManager.updateTurnIndicator();
      
      // Get the FEN position to restore - prioritize server data but fall back to localStorage
      let fenPosition = null;
      let fenSource = "none";
      
      // ENHANCED: Improved FEN position recovery with better fallback logic and error handling
      
      // First try to use server-provided game state
      if (data.gameState && data.gameState.chessEngineState) {
        console.log('🔴 Using server-provided FEN position for reconnection');
        fenPosition = data.gameState.chessEngineState;
        fenSource = "server";
      } 
      // If no server FEN, check data.savedFEN (passed from our reconnect function)
      else if (data.savedFEN) {
        console.log('🔴 Using client-saved FEN position for reconnection:', data.savedFEN);
        fenPosition = data.savedFEN;
        fenSource = "client";
      }
      // Lastly, try localStorage directly as a fallback
      else {
        try {
          const savedState = localStorage.getItem('chessFarm_gameState');
          if (savedState) {
            const gameState = JSON.parse(savedState);
            if (gameState.fen && gameState.roomId === data.roomId) {
              console.log('🔴 Using localStorage FEN position for reconnection:', gameState.fen);
              fenPosition = gameState.fen;
              fenSource = "localStorage";
            }
          }
        } catch (e) {
          console.error('Error checking localStorage for FEN position:', e);
        }
      }
      
      console.log(`🔴 FEN position for reconnection (source: ${fenSource}):`, fenPosition);
      
      // CRITICAL: Wait until UI is completely updated before initializing chess board
      // This ensures all prerequisites are in place before the board is set up
      setTimeout(() => {
        // Initialize chess board with the appropriate FEN position
        if (typeof ChessManager !== 'undefined' && typeof ChessManager.setupBoard === 'function') {
          if (fenPosition) {
            console.log('🔴 Setting up chess board with saved position:', fenPosition);
            ChessManager.setupBoard(fenPosition);
            
            // Save game state to localStorage for persistence
            GameState.saveGameState();
          } else {
            console.log('🔴 No saved position found, setting up new chess board');
            ChessManager.setupBoard();
          }
          
          // Make sure the board reflects the current game state
          setTimeout(() => {
            if (typeof ChessManager.refreshBoard === 'function') {
              ChessManager.refreshBoard();
              console.log('🔴 Chess board refreshed after reconnection');
            }
          }, 500); // Increased delay to ensure UI is ready
        } else {
          console.error('🔴 ChessManager.setupBoard is not available!');
        }
      }, 300); // Increased delay for more reliability
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
        
        // Setup game UI elements with the current room ID and player color
        console.log('🔴 Setting up game UI after opponent joined');
        UIManager.setupGameUI(roomId, GameState.getPlayerColor());
        
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
      
      // Start the game in GameState
      GameState.startGame();
      
      // Set initial turn
      if (data.startingTurn) {
        GameState.setCurrentTurn(data.startingTurn);
      }
      
      // Check for saved game state in localStorage
      let savedFEN = null;
      try {
        const savedState = localStorage.getItem('chessFarm_gameState');
        if (savedState) {
          const gameState = JSON.parse(savedState);
          console.log('🔴 Found saved game state during gameStart:', gameState);
          
          // If we have a saved FEN, it might be a reconnection attempt
          if (gameState.fen && gameState.roomId === data.roomId) {
            console.log('🔴 Using saved FEN position for board setup:', gameState.fen);
            savedFEN = gameState.fen;
            
            // If we have saved farm state, restore it
            if (gameState.farmState && typeof FarmManager !== 'undefined' && 
                typeof FarmManager.restoreFarmState === 'function') {
              console.log('🔴 Restoring farm state from localStorage');
              FarmManager.restoreFarmState(gameState.farmState);
            }
          }
        }
      } catch (e) {
        console.error('Error checking localStorage for saved game state:', e);
      }
      
      // Save the game state for potential reconnection
      if (typeof GameState.saveGameState === 'function') {
        console.log('🔴 Saving game state after game start');
        GameState.saveGameState();
      }
      
      // Show the game screen
      UIManager.showScreen('game-screen');
      
      // Setup the chess board with saved FEN if available
      if (typeof ChessManager !== 'undefined' && typeof ChessManager.setupBoard === 'function') {
        if (savedFEN) {
          console.log('🔴 Setting up chess board with saved FEN');
          ChessManager.setupBoard(savedFEN);
        } else {
          ChessManager.setupBoard();
        }
      }
      
      // Update turn indicator
      UIManager.updateTurnIndicator();
      
      // Setup game UI elements with the correct parameters
      const currentRoomId = roomId;
      const playerColor = GameState.getPlayerColor();
      console.log('🔴 Setting up game UI with:', { roomId: currentRoomId, playerColor });
      
      // Pass the required parameters
      UIManager.setupGameUI(currentRoomId, playerColor);
      
      // Show appropriate message based on whose turn it is
      if (GameState.isPlayerTurn()) {
        UIManager.showMessage('Game started! Your turn!');
      } else {
        UIManager.showMessage('Game started! Waiting for opponent to move');
      }
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
   * @param {object} move - The move data
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
    
    // Save game state after sending a move
    if (typeof GameState.saveGameState === 'function') {
      console.log('🔴 Saving game state after player\'s move');
      GameState.saveGameState();
    }
    
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
            
          // After processing farm turn, check if we need to auto-skip farming phase
          // This works alongside the check in updateGamePhaseIndicator but ensures it happens right after processing
          if (typeof FarmManager.areAllUnlockedPlotsFull === 'function' && 
              GameState.getCurrentGamePhase() === 'farming') {
            const playerColor = GameState.getPlayerColor();
            
            // MODIFICATION: Only auto-skip if all plots are full AND there are no just-harvested plots
            const allPlotsFull = FarmManager.areAllUnlockedPlotsFull(playerColor);
            const hasJustHarvestedPlots = typeof FarmManager.hasJustHarvestedPlots === 'function' && 
                                         FarmManager.hasJustHarvestedPlots(playerColor);
            
            console.log(`Auto-skip check: allPlotsFull=${allPlotsFull}, hasJustHarvestedPlots=${hasJustHarvestedPlots}`);
            
            // Only auto-skip if all plots are full AND there are no just-harvested plots
            if (allPlotsFull && !hasJustHarvestedPlots) {
              console.log('All plots are full after turn processing - auto-skipping farming phase');
              setTimeout(() => {
                GameState.skipCurrentGamePhase();
                UIManager.showMessage('Auto-skipped farming phase - all plots are full!', 3000);
              }, 500);
            } else if (hasJustHarvestedPlots) {
              console.log('Not auto-skipping - detected plots that were just harvested and available for planting');
              UIManager.showMessage('You have plots that were just harvested! You can plant on them this turn.', 3000);
            }
          }
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
   * Process a chess move received from the server
   * @param {object} data - The move data
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
      
      // Save game state after processing opponent's move
      if (typeof GameState.saveGameState === 'function') {
        console.log('🔴 Saving game state after opponent\'s move');
        GameState.saveGameState();
      }
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
    reconnect: reconnect,
  };
})(); 