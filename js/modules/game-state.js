/**
 * Game State Module
 * Manages the overall state of the game including players, turns, and resources
 */
const GameState = (function() {
  // Private state variables
  let initialized = false;
  let gameActive = false;
  let roomId = null;
  let playerColor = null;
  let opponentConnected = false;
  let currentTurn = 'white';
  let currentGamePhase = 'farming'; // 'farming' or 'chess'
  let gamePhaseCompleted = {
    farming: false,
    chess: false
  };
  let farmActionTaken = false;
  
  // Player resources
  let resources = {
    white: {
      wheat: GameConfig.startingWheat,
      capturedPieces: 0
    },
    black: {
      wheat: GameConfig.startingWheat,
      capturedPieces: 0
    }
  };
  
  // Game winner 
  let winner = null;
  
  /**
   * Initialize the game state
   * @returns {boolean} True if initialization was successful
   */
  function initialize() {
    if (initialized) {
      console.warn('Game State already initialized');
      return true;
    }
    
    try {
      console.log('Game State initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Game State:', error);
      return false;
    }
  }
  
  /**
   * Reset the game state to its initial values
   */
  function resetGame() {
    gameActive = false;
    opponentConnected = false;
    currentTurn = 'white';
    currentGamePhase = 'farming';
    gamePhaseCompleted = {
      farming: false,
      chess: false
    };
    farmActionTaken = false;
    resources = {
      white: {
        wheat: GameConfig.startingWheat,
        capturedPieces: 0
      },
      black: {
        wheat: GameConfig.startingWheat,
        capturedPieces: 0
      }
    };
    winner = null;
  }
  
  /**
   * Set up a new game
   * @param {string} roomIdParam - The room ID for the game
   * @param {string} colorParam - The player's color ('white' or 'black')
   */
  function setupGame(roomIdParam, colorParam) {
    roomId = roomIdParam;
    playerColor = colorParam;
    resetGame();
    console.log(`Game setup complete. Room: ${roomId}, Player color: ${playerColor}`);
  }
  
  /**
   * Start the game
   */
  function startGame() {
    if (!roomId || !playerColor) {
      console.error('Cannot start game without room ID and player color');
      return false;
    }
    
    gameActive = true;
    opponentConnected = true;
    console.log('Game started');
    return true;
  }
  
  /**
   * Check if it's the player's turn
   * @returns {boolean} True if it's the player's turn
   */
  function isPlayerTurn() {
    const result = gameActive && currentTurn === playerColor;
    console.log(`isPlayerTurn check: gameActive=${gameActive}, currentTurn=${currentTurn}, playerColor=${playerColor}, result=${result}`);
    return result;
  }
  
  /**
   * Get the current game phase
   * @returns {string} The current game phase ('farming' or 'chess')
   */
  function getCurrentGamePhase() {
    return currentGamePhase;
  }
  
  /**
   * Set the current game phase
   * @param {string} phase - The new game phase ('farming' or 'chess')
   */
  function setCurrentGamePhase(phase) {
    // Validate the phase
    if (phase !== 'farming' && phase !== 'chess') {
      console.error(`Invalid game phase: ${phase}`);
      return;
    }
    
    // Set the phase
    currentGamePhase = phase;
    
    // Reset the completed status for the new phase
    gamePhaseCompleted[phase] = false;
    
    // If switching to farming phase, reset the farm action flag
    if (phase === 'farming') {
      farmActionTaken = false;
    }
    
    console.log(`Game phase changed to: ${phase}`);
    
    // Update the UI to reflect the new phase
    UIManager.updateGamePhaseIndicator();
    
    // If switching to chess phase, refresh the board to ensure sync
    if (phase === 'chess') {
      // Use setTimeout to ensure this runs after the phase change is complete
      setTimeout(() => {
        if (typeof ChessManager !== 'undefined' && ChessManager.refreshBoard) {
          console.log('Refreshing chess board on phase change to chess');
          ChessManager.refreshBoard();
        }
      }, 100);
    }
  }
  
  /**
   * Mark the current game phase as completed
   */
  function completeCurrentGamePhase() {
    gamePhaseCompleted[currentGamePhase] = true;
    console.log(`${currentGamePhase} phase completed`);
    
    // If both phases are completed, end the turn
    if (gamePhaseCompleted.farming && gamePhaseCompleted.chess) {
      endTurn();
    } else if (currentGamePhase === 'farming') {
      // Move to chess phase
      setCurrentGamePhase('chess');
    }
  }
  
  /**
   * Skip the current game phase
   */
  function skipCurrentGamePhase() {
    if (currentGamePhase === 'farming') {
      // Mark farming phase as completed
      gamePhaseCompleted.farming = true;
      
      // Move to chess phase
      setCurrentGamePhase('chess');
      
      // Notify the server about the phase change
      SocketManager.sendPhaseChange('chess');
      
      console.log('Farming phase skipped, now in chess phase');
      
      // Update UI
      UIManager.updateGamePhaseIndicator('chess');
    }
  }
  
  /**
   * End the current turn and switch to the next player
   */
  function endTurn() {
    // If it's not player's turn, do nothing
    if (!isPlayerTurn()) {
      console.warn('Cannot end turn - not your turn');
      return false;
    }
    
    // Check if the player has made a chess move this turn
    if (!gamePhaseCompleted.chess) {
      console.warn('Cannot end turn - you must make a chess move first');
      UIManager.showMessage('You must make a chess move before ending your turn.', 'warning');
      
      // Force switch to chess phase if not already there
      if (currentGamePhase !== 'chess') {
        setCurrentGamePhase('chess');
      }
      
      return false;
    }
    
    // Reset phase completion status
    gamePhaseCompleted = {
      farming: false,
      chess: false
    };
    
    // Switch turns
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    
    // Reset to farming phase for next turn
    setCurrentGamePhase('farming');
    
    console.log(`Turn ended. Current turn: ${currentTurn}`);
    
    // Notify the server about the turn change
    SocketManager.sendEndTurn();
    
    // Update the UI
    UIManager.updateTurnIndicator();
    
    return true;
  }
  
  /**
   * Process the turn change from the server
   */
  function processTurnChange() {
    // Reset phase completion status
    gamePhaseCompleted = {
      farming: false,
      chess: false
    };
    
    // Check if it's the player's turn after the turn change
    const isPlayersTurn = isPlayerTurn();
    
    // Process farm plots only if it's the player's turn
    if (isPlayersTurn && typeof FarmManager !== 'undefined' && FarmManager.processTurn) {
      console.log('Processing farm plots during turn change - it is the player\'s turn');
      FarmManager.processTurn();
    } else {
      console.log('Not processing farm plots during turn change - it is the opponent\'s turn');
    }
    
    // Reset to farming phase
    setCurrentGamePhase('farming');
    
    // Reset farm action flag for new turn
    farmActionTaken = false;
    
    console.log(`Turn changed. Current turn: ${currentTurn}`);
    
    // Update the UI
    UIManager.updateTurnIndicator();
    
    // If it's now my turn, show a notification
    if (isPlayersTurn) {
      showMessage('YOUR TURN - Farming Phase!', 5000);
    }
  }
  
  /**
   * Handle farm action taken by the player
   */
  function registerFarmAction() {
    if (!isPlayerTurn() || currentGamePhase !== 'farming') {
      console.warn('Cannot perform farm action - not in farming phase or not your turn');
      return false;
    }
    
    if (farmActionTaken) {
      console.warn('Farm action already taken this turn');
      return false;
    }
    
    farmActionTaken = true;
    return true;
  }
  
  /**
   * Reset the farm action taken flag
   */
  function resetFarmActionTaken() {
    farmActionTaken = false;
    console.log('Farm action flag reset for new turn');
    return true;
  }
  
  /**
   * Check if a farm action has been taken this turn
   * @returns {boolean} True if a farm action has been taken
   */
  function hasFarmActionBeenTaken() {
    return farmActionTaken;
  }
  
  /**
   * Update player wheat resources
   * @param {string} color - The player color ('white' or 'black')
   * @param {number} amount - The amount to add (positive) or subtract (negative)
   * @returns {boolean} True if the update was successful
   */
  function updateWheat(color, amount) {
    if (!resources[color]) {
      console.error(`Invalid player color: ${color}`);
      return false;
    }
    
    // Check if player has enough wheat for deduction
    if (amount < 0 && resources[color].wheat + amount < 0) {
      console.warn(`${color} player does not have enough wheat`);
      return false;
    }
    
    resources[color].wheat += amount;
    console.log(`${color} player wheat updated: ${resources[color].wheat} (${amount > 0 ? '+' : ''}${amount})`);
    
    // Update UI
    UIManager.updateResourceDisplay();
    
    // Check for economic victory
    checkEconomicVictory();
    
    return true;
  }
  
  /**
   * Get the current wheat amount for a player
   * @param {string} color - The player color ('white' or 'black')
   * @returns {number} The wheat amount
   */
  function getWheat(color) {
    if (!resources[color]) {
      console.error(`Invalid player color: ${color}`);
      return 0;
    }
    return resources[color].wheat;
  }
  
  /**
   * Get all resources for debugging and emergency fixes
   * @returns {Object} The resources object
   */
  function getResources() {
    return resources;
  }
  
  /**
   * Record a piece capture
   * @param {string} color - The player color who made the capture ('white' or 'black')
   */
  function recordCapture(color) {
    if (!resources[color]) {
      console.error(`Invalid player color: ${color}`);
      return;
    }
    
    resources[color].capturedPieces++;
    console.log(`${color} player captured a piece. Total captures: ${resources[color].capturedPieces}`);
    
    // Update the UI
    UIManager.updateResourceDisplay();
    
    // Check if capturing unlocks a new farm plot
    FarmManager.checkUnlockPlot(color);
  }
  
  /**
   * Get the number of pieces captured by a player
   * @param {string} color - The player color ('white' or 'black')
   * @returns {number} The number of pieces captured
   */
  function getCapturedPieces(color) {
    if (!resources[color]) {
      console.error(`Invalid player color: ${color}`);
      return 0;
    }
    
    return resources[color].capturedPieces;
  }
  
  /**
   * Check for economic victory (200 wheat)
   */
  function checkEconomicVictory() {
    if (!gameActive) return;
    
    // Check if any player has reached the economic victory threshold
    if (resources.white.wheat >= GameConfig.victoryConditions.economicThreshold) {
      declareWinner('white', 'economic');
    } else if (resources.black.wheat >= GameConfig.victoryConditions.economicThreshold) {
      declareWinner('black', 'economic');
    }
  }
  
  /**
   * Declare a winner and end the game
   * @param {string} winnerColor - The color of the winning player
   * @param {string} victoryType - The type of victory (checkmate, economic, etc.)
   */
  function declareWinner(winnerColor, victoryType) {
    if (!gameActive) return;
    
    gameActive = false;
    winner = winnerColor;
    
    console.log(`Game over! ${winnerColor} wins by ${victoryType}`);
    
    // Update UI to show game over
    UIManager.showGameOver(winnerColor, victoryType);
    
    // Notify the server - pass both winner and reason parameters
    SocketManager.sendGameOver(winnerColor, victoryType);
  }
  
  // Public API
  return {
    initialize,
    resetGame,
    setupGame,
    startGame,
    isPlayerTurn,
    getCurrentGamePhase,
    setCurrentGamePhase,
    completeCurrentGamePhase,
    skipCurrentGamePhase,
    endTurn,
    processTurnChange,
    registerFarmAction,
    hasFarmActionBeenTaken,
    resetFarmActionTaken,
    updateWheat,
    getWheat,
    getResources,
    recordCapture,
    getCapturedPieces,
    declareWinner,
    
    // Sync with server
    updateFromServer: (serverGameState) => {
      console.log('Updating game state from server:', serverGameState);
      
      // Update resources if they exist in the server state
      if (serverGameState.farms) {
        // Get the wheat from each player's farm
        if (serverGameState.farms.white && typeof serverGameState.farms.white.wheat === 'number') {
          resources.white.wheat = serverGameState.farms.white.wheat;
        }
        
        if (serverGameState.farms.black && typeof serverGameState.farms.black.wheat === 'number') {
          resources.black.wheat = serverGameState.farms.black.wheat;
        }
        
        // Update the farm data in FarmManager if available
        if (typeof FarmManager.updateFarmsFromServer === 'function') {
          FarmManager.updateFarmsFromServer(serverGameState.farms);
        }
      }
      
      // Update UI elements
      UIManager.updateResourceDisplay();
    },
    
    // Getters
    getRoomId: () => roomId,
    getPlayerColor: () => playerColor,
    getCurrentTurn: () => currentTurn,
    isGameActive: () => gameActive,
    isOpponentConnected: () => opponentConnected,
    setOpponentConnected: (status) => {
      opponentConnected = status;
      if (status) UIManager.updateGameStatus();
    },
    getWinner: () => winner,
    
    // Additional setters
    setCurrentTurn: (turn) => {
      if (turn === 'white' || turn === 'black') {
        currentTurn = turn;
        console.log(`Current turn set to: ${turn}`);
      } else {
        console.error(`Invalid turn value: ${turn}`);
      }
    },
    
    // Reset farm action taken flag
    resetFarmActionTaken: () => {
      farmActionTaken = false;
      console.log('Farm action flag reset');
    }
  };
})(); 