/**
 * UI Manager Module
 * Handles all UI-related functionality for the game
 */
const UIManager = (function() {
  // Private variables
  let initialized = false;
  let currentScreen = null;
  let selectedPlotId = null;
  
  /**
   * Initialize the UI Manager
   * @returns {boolean} True if initialization was successful
   */
  function initialize() {
    if (initialized) {
      console.warn('UI Manager already initialized');
      return true;
    }
    
    try {
      console.log('Initializing UI Manager');
      
      // Set up event listeners
      setupUIEventListeners();
      
      // Initialize the screens
      initializeScreens();
      
      console.log('UI Manager initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize UI Manager:', error);
      return false;
    }
  }
  
  /**
   * Set up all UI event listeners
   */
  function setupUIEventListeners() {
    console.log('Setting up UI event listeners');
    
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const roomId = document.getElementById('room-id').value.trim();
        console.log(`Attempting to join room: ${roomId}`);
        showMessage(`Connecting to game...`);
        SocketManager.joinRoom(roomId);
      });
    } else {
      console.warn('Login form not found');
    }
    
    // Skip farming button
    const skipFarmingButton = document.getElementById('skip-farming-button');
    if (skipFarmingButton) {
      skipFarmingButton.addEventListener('click', function() {
        if (GameState.isPlayerTurn() && GameState.getCurrentGamePhase() === 'farming') {
          console.log('Skipping farming phase');
          GameState.skipCurrentGamePhase();
          updateGamePhaseIndicator();
        } else {
          console.warn('Cannot skip farming - not your turn or not in farming phase');
          showMessage('Cannot skip farming phase right now');
        }
      });
    } else {
      console.warn('Skip farming button not found');
    }
    
    // End turn button
    const endTurnButton = document.getElementById('end-turn-button');
    if (endTurnButton) {
      endTurnButton.addEventListener('click', function() {
        if (GameState.isPlayerTurn() && GameState.getCurrentGamePhase() === 'chess') {
          console.log('Ending turn');
          GameState.completeCurrentGamePhase();
        } else {
          console.warn('Cannot end turn - not your turn or not in chess phase');
          showMessage('Cannot end turn right now');
        }
      });
    } else {
      console.warn('End turn button not found');
    }
    
    // Play again button
    const playAgainButton = document.getElementById('play-again-button');
    if (playAgainButton) {
      playAgainButton.addEventListener('click', function() {
        window.location.reload();
      });
    }
  }
  
  /**
   * Initialize the screens
   */
  function initializeScreens() {
    console.log('Initializing screens');
    
    // Show the login screen by default
    showScreen('login-screen');
    
    // Hide other screens
    hideScreen('waiting-screen');
    hideScreen('game-screen');
  }
  
  /**
   * Show a specific screen
   * @param {string} screenId - The ID of the screen to show
   */
  function showScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (!screen) {
      console.error(`Screen not found: ${screenId}`);
      return;
    }
    
    // Hide current screen
    if (currentScreen) {
      const currentScreenElement = document.getElementById(currentScreen);
      if (currentScreenElement) {
        currentScreenElement.classList.add('hidden');
      }
    }
    
    // Show new screen
    screen.classList.remove('hidden');
    currentScreen = screenId;
    console.log(`Screen changed to: ${screenId}`);
  }
  
  /**
   * Hide a specific screen
   * @param {string} screenId - The ID of the screen to hide
   */
  function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (!screen) {
      console.error(`Screen not found: ${screenId}`);
      return;
    }
    
    screen.classList.add('hidden');
  }
  
  /**
   * Update the game status display
   */
  function updateGameStatus() {
    const gameStatus = document.getElementById('game-status');
    if (!gameStatus) {
      console.warn('Game status element not found');
      return;
    }
    
    let statusText = '';
    let statusClass = '';
    
    if (!GameState.isOpponentConnected()) {
      statusText = 'Waiting for opponent...';
      statusClass = '';
    } else if (GameState.isPlayerTurn()) {
      statusText = 'Your Turn';
      statusClass = 'my-turn';
    } else {
      statusText = 'Opponent\'s Turn';
      statusClass = 'opponent-turn';
    }
    
    gameStatus.textContent = statusText;
    
    // Reset classes
    gameStatus.classList.remove('my-turn', 'opponent-turn');
    if (statusClass) {
      gameStatus.classList.add(statusClass);
    }
  }
  
  /**
   * Update the turn indicator based on the current game state
   */
  function updateTurnIndicator() {
    console.log(`Updating turn indicator. Current turn: ${GameState.getCurrentTurn()}, Player color: ${GameState.getPlayerColor()}`);
    
    // Update game status text
    updateGameStatus();
    
    // Update game phase indicator
    updateGamePhaseIndicator();
    
    // Highlight the active player's farm
    const player1Header = document.getElementById('player1-header');
    const player2Header = document.getElementById('player2-header');
    
    if (player1Header && player2Header) {
      // Remove active class from both headers
      player1Header.classList.remove('active-turn');
      player2Header.classList.remove('active-turn');
      
      // Add active class to the current player's header
      if (GameState.getCurrentTurn() === 'white') {
        player1Header.classList.add('active-turn');
      } else {
        player2Header.classList.add('active-turn');
      }
    }
    
    // Update action buttons visibility based on whose turn it is
    const skipFarmingButton = document.getElementById('skip-farming-button');
    const endTurnButton = document.getElementById('end-turn-button');
    
    if (skipFarmingButton && endTurnButton) {
      // Hide both buttons initially
      skipFarmingButton.style.display = 'none';
      endTurnButton.style.display = 'none';
      
      // If it's player's turn, show the farming skip button only in farming phase
      // Removed the end turn button display condition to enforce chess moves
      if (GameState.isPlayerTurn()) {
        if (GameState.getCurrentGamePhase() === 'farming') {
          skipFarmingButton.style.display = 'block';
        }
        // We no longer show the end turn button, to enforce chess moves
      }
    }
  }
  
  /**
   * Update the game phase indicator
   */
  function updateGamePhaseIndicator() {
    const phaseIndicator = document.getElementById('game-phase-indicator');
    const skipFarmingButton = document.getElementById('skip-farming-button');
    const endTurnButton = document.getElementById('end-turn-button');
    
    if (!phaseIndicator) {
      console.warn('Game phase indicator element not found');
      return;
    }
    
    const currentPhase = GameState.getCurrentGamePhase();
    const isPlayerTurn = GameState.isPlayerTurn();
    
    console.log(`Updating phase indicator. Current phase: ${currentPhase}, Is player's turn: ${isPlayerTurn}`);
    
    // Always show the phase indicator regardless of whose turn it is
    phaseIndicator.style.display = 'block';
    
    // Update phase indicator text and class
    phaseIndicator.textContent = currentPhase === 'farming' ? 'Farming Phase' : 'Chess Phase';
    phaseIndicator.classList.remove('farming-phase', 'chess-phase');
    phaseIndicator.classList.add(currentPhase === 'farming' ? 'farming-phase' : 'chess-phase');
    
    // Only show action buttons if it's the player's turn
    if (skipFarmingButton && endTurnButton) {
      if (isPlayerTurn) {
        // Show the appropriate button based on the current phase
        if (currentPhase === 'farming') {
          skipFarmingButton.style.display = 'block';
          endTurnButton.style.display = 'none';
        } else {
          skipFarmingButton.style.display = 'none';
          endTurnButton.style.display = 'block';
        }
      } else {
        // Hide both buttons if it's not the player's turn
        skipFarmingButton.style.display = 'none';
        endTurnButton.style.display = 'none';
      }
    }
  }
  
  /**
   * Update the resource display (wheat, captures)
   */
  function updateResourceDisplay() {
    const player1WheatElement = document.getElementById('player1-wheat');
    const player2WheatElement = document.getElementById('player2-wheat');
    
    if (player1WheatElement) {
      player1WheatElement.textContent = GameState.getWheat('white');
    }
    
    if (player2WheatElement) {
      player2WheatElement.textContent = GameState.getWheat('black');
    }
    
    // Update farm plots if captures have changed
    FarmManager.updateFarmDisplay();
  }
  
  /**
   * Set up the game UI with player-specific information
   * @param {string} roomId - The room ID
   * @param {string} playerColor - The player's color
   */
  function setupGameUI(roomId, playerColor) {
    // Update room ID and player color display
    const roomIdDisplay = document.getElementById('room-id-display');
    const playerColorDisplay = document.getElementById('player-color');
    
    if (roomIdDisplay) {
      roomIdDisplay.textContent = roomId;
    }
    
    if (playerColorDisplay) {
      playerColorDisplay.textContent = playerColor.charAt(0).toUpperCase() + playerColor.slice(1);
    }
    
    // Add the player's color as a class to the body
    document.body.classList.add(`player-${playerColor}`);
    
    // Initialize the board
    FarmManager.initializeFarmDisplay();
    
    // Set up event listeners
    const skipFarmingButton = document.getElementById('skip-farming-button');
    const endTurnButton = document.getElementById('end-turn-button');
    
    // Update UI based on player's turn
    updateTurnIndicator();
  }
  
  /**
   * Show the plant selector overlay for the selected plot
   * @param {string} plotId - The ID of the plot to plant in
   */
  function showPlantSelector(plotId) {
    selectedPlotId = plotId;
    
    const overlay = document.getElementById('plant-selector-overlay');
    if (!overlay) {
      console.error('Plant selector overlay not found');
      return;
    }
    
    // Generate the plant selector content
    overlay.innerHTML = generatePlantSelectorHTML();
    
    // Show the overlay
    overlay.style.display = 'flex';
    
    // Add event listeners to the plant options
    const plantButtons = overlay.querySelectorAll('.plant-type-btn');
    plantButtons.forEach(button => {
      button.addEventListener('click', function() {
        const cropType = this.getAttribute('data-crop-type');
        const cropCost = parseInt(this.getAttribute('data-crop-cost'));
        
        // Check if player has enough wheat
        const playerColor = GameState.getPlayerColor();
        const currentWheat = GameState.getWheat(playerColor);
        
        if (currentWheat >= cropCost) {
          // Close the overlay
          overlay.style.display = 'none';
          
          // Extract plot index from plot ID
          const plotIndex = parseInt(selectedPlotId.split('-').pop());
          
          // Get crop data from GameConfig
          const cropData = GameConfig.crops[cropType];
          
          // Create a proper crop data object with all required properties
          const cropDataForPlanting = {
            type: cropType,
            cost: cropData.cost,
            growthTime: cropData.turnsTillHarvest,
            yield: cropData.yield,
            name: cropData.name,
            emoji: cropData.emoji
          };
          
          console.log('Prepared crop data for planting:', cropDataForPlanting);
          
          // Plant the crop
          FarmManager.plantCrop(playerColor, plotIndex, cropDataForPlanting);
        } else {
          showMessage(`Not enough wheat to plant ${cropType}!`);
        }
      });
    });
    
    // Add event listener to cancel button
    const cancelButton = overlay.querySelector('.cancel-btn');
    if (cancelButton) {
      cancelButton.addEventListener('click', function() {
        overlay.style.display = 'none';
      });
    }
  }
  
  /**
   * Generate the HTML for the plant selector
   * @returns {string} The HTML for the plant selector
   */
  function generatePlantSelectorHTML() {
    const playerColor = GameState.getPlayerColor();
    const currentWheat = GameState.getWheat(playerColor);
    
    let html = `
      <div class="plant-selector-container">
        <h3>Select a Crop to Plant</h3>
    `;
    
    // Add each crop option
    Object.entries(GameConfig.crops).forEach(([cropType, cropData]) => {
      const canAfford = currentWheat >= cropData.cost;
      const disabledClass = canAfford ? '' : 'disabled';
      
      html += `
        <button class="plant-type-btn ${disabledClass}" data-crop-type="${cropType}" data-crop-cost="${cropData.cost}" ${!canAfford ? 'disabled' : ''}>
          <div class="plant-emoji">${cropData.emoji}</div>
          <div class="plant-details">
            <div class="plant-name">${cropData.name}</div>
            <div class="plant-info">Cost: ${cropData.cost} wheat | Harvest: ${cropData.yield} wheat | Growth: ${cropData.turnsTillHarvest} turns</div>
          </div>
        </button>
      `;
    });
    
    html += `
        <button class="cancel-btn">Cancel</button>
      </div>
    `;
    
    return html;
  }
  
  /**
   * Show the game over screen
   * @param {string} winner - The color of the winning player
   * @param {string} victoryType - The type of victory
   */
  function showGameOver(winner, victoryType) {
    const gameOverBanner = document.getElementById('game-over-banner');
    const gameOverMessage = document.getElementById('game-over-message');
    
    if (!gameOverBanner || !gameOverMessage) {
      console.error('Game over elements not found');
      return;
    }
    
    const playerColor = GameState.getPlayerColor();
    const playerWon = winner === playerColor;
    
    // Set message based on victory type
    let message = '';
    if (playerWon) {
      gameOverBanner.classList.add('victory');
      
      if (victoryType === 'checkmate') {
        message = 'You Win by Checkmate!';
      } else if (victoryType === 'economic') {
        message = 'You Win by Economic Victory!';
      } else {
        message = 'You Win!';
      }
    } else {
      gameOverBanner.classList.add('defeat');
      
      if (victoryType === 'checkmate') {
        message = 'You Lose by Checkmate!';
      } else if (victoryType === 'economic') {
        message = 'You Lose! Opponent reached 200 wheat!';
      } else {
        message = 'You Lose!';
      }
    }
    
    gameOverMessage.textContent = message;
    
    // Show the game over banner
    gameOverBanner.style.display = 'flex';
  }
  
  // Public API
  return {
    initialize,
    showScreen,
    hideScreen,
    updateGameStatus,
    updateTurnIndicator,
    updateGamePhaseIndicator,
    updateResourceDisplay,
    setupGameUI,
    showPlantSelector,
    showGameOver
  };
})(); 