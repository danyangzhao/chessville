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
    
    console.log(`Showing screen: ${screenId}`, 'Current screen:', currentScreen);
    
    // Debug log the current state of all screens to diagnose issues
    ['login-screen', 'waiting-screen', 'game-screen'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        console.log(`Screen ${id} is currently ${element.classList.contains('hidden') ? 'hidden' : 'visible'}`);
      } else {
        console.warn(`Debug: Screen element ${id} not found in DOM`);
      }
    });
    
    // Hide current screen
    if (currentScreen) {
      const currentScreenElement = document.getElementById(currentScreen);
      if (currentScreenElement) {
        currentScreenElement.classList.add('hidden');
        console.log(`Hidden previous screen: ${currentScreen}`);
      }
    }
    
    // Show new screen
    screen.classList.remove('hidden');
    currentScreen = screenId;
    console.log(`Screen changed to: ${screenId}`);
    
    // Debug check after change
    console.log(`After change: is ${screenId} hidden?`, screen.classList.contains('hidden'));
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
   * @param {string} phase - The current game phase (optional)
   */
  function updateGamePhaseIndicator(phase) {
    // Get the current phase if not provided
    if (!phase) {
      phase = GameState.getCurrentGamePhase();
    }
    
    // Update the phase display
    const phaseDisplay = document.getElementById('game-phase');
    if (phaseDisplay) {
      phaseDisplay.textContent = phase === 'farming' ? 'Farming Phase' : 'Chess Phase';
      phaseDisplay.className = phase;
    }
    
    // Show/hide appropriate buttons
    const skipFarmingButton = document.getElementById('skip-farming-button');
    const endTurnButton = document.getElementById('end-turn-button');
    
    if (skipFarmingButton) {
      skipFarmingButton.style.display = (GameState.isPlayerTurn() && phase === 'farming') ? 'block' : 'none';
    }
    
    if (endTurnButton) {
      // Always hide the end turn button - chess moves are mandatory
      endTurnButton.style.display = 'none';
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
   * Show the plant selector overlay for a plot
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
          
          // Use FarmManager's prepareCropForPlanting function to get standardized crop data
          const cropDataForPlanting = FarmManager.prepareCropForPlanting(cropType);
          
          if (!cropDataForPlanting) {
            console.error(`Failed to prepare crop data for ${cropType}`);
            showMessage(`Error preparing crop data. Please try again.`);
            return;
          }
          
          console.log('Prepared standardized crop data for planting:', cropDataForPlanting);
          
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
    
    // Add each crop option with standardized property names
    Object.entries(GameConfig.crops).forEach(([cropType, cropConfig]) => {
      // Use FarmManager's standardizeCropData to get consistent properties
      const cropData = FarmManager.standardizeCropData({
        type: cropType,
        ...cropConfig
      });
      
      const canAfford = currentWheat >= cropData.cost;
      const disabledClass = canAfford ? '' : 'disabled';
      
      html += `
        <button class="plant-type-btn ${disabledClass}" data-crop-type="${cropType}" data-crop-cost="${cropData.cost}" ${!canAfford ? 'disabled' : ''}>
          <div class="plant-emoji">${cropData.emoji}</div>
          <div class="plant-details">
            <div class="plant-name">${cropData.name}</div>
            <div class="plant-info">Cost: ${cropData.cost} wheat | Harvest: ${cropData.yield} wheat | Growth: ${cropData.growthTime} turns</div>
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
      } else if (victoryType === 'resource-starvation') {
        message = 'You Win! Opponent ran out of resources!';
      } else if (victoryType === 'white' || victoryType === 'black') {
        // Handle cases where the victoryType is actually the winner color
        message = 'You Win!';
      } else {
        message = 'You Win!';
      }
    } else {
      gameOverBanner.classList.add('defeat');
      
      if (victoryType === 'checkmate') {
        message = 'You Lose by Checkmate!';
      } else if (victoryType === 'economic') {
        message = 'You Lose! Opponent reached 200 wheat!';
      } else if (victoryType === 'resource-starvation') {
        message = 'You Lose! You ran out of resources!';
      } else if (victoryType === 'white' || victoryType === 'black') {
        // Handle cases where the victoryType is actually the winner color
        if (victoryType !== playerColor) {
          message = 'You Win!';
          // Fix the display to show victory instead of defeat
          gameOverBanner.classList.remove('defeat');
          gameOverBanner.classList.add('victory');
        } else {
          message = 'You Lose!';
        }
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