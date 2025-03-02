// Entry point for Chess Farmer client-side code

// Wait for the DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Chessville initializing...');
  
  try {
    // Check if critical modules are loaded
    if (typeof GameConfig === 'undefined') {
      console.error('GameConfig module is not loaded. Check script loading order.');
      return;
    }
    
    if (typeof GameState === 'undefined') {
      console.error('GameState module is not loaded. Check script loading order.');
      return;
    }
    
    // UPDATED: Phased initialization sequence
    // Phase 1: Initialize UI and GameState first
    console.log('Phase 1: Initializing UI and GameState');
    
    // Initialize the UI Manager
    if (!UIManager.initialize()) {
      console.error('Failed to initialize UI Manager');
      return;
    }
    
    // Initialize the Game State
    if (!GameState.initialize()) {
      console.error('Failed to initialize Game State');
      return;
    }
    
    // Phase 2: Check for saved game state
    console.log('Phase 2: Checking for saved game state');
    try {
      const savedState = localStorage.getItem('chessFarm_gameState');
      if (savedState) {
        const gameState = JSON.parse(savedState);
        console.log('Found saved game state:', gameState);
        
        // If joining the same room, pre-initialize game state with saved info
        if (gameState.roomId && gameState.color) {
          console.log('Pre-initializing game state with saved data');
          // This will help ensure player color is set before chess board initialization
          GameState.setupGame(gameState.roomId, gameState.color);
        }
      }
    } catch (e) {
      console.error('Error checking for saved game state:', e);
    }
    
    // Phase 3: Initialize other managers
    console.log('Phase 3: Initializing remaining managers');
    
    // Initialize the Farm Manager
    if (!FarmManager.initialize()) {
      console.error('Failed to initialize Farm Manager');
      return;
    }
    
    // Initialize the Chess Manager
    if (!ChessManager.initialize()) {
      console.error('Failed to initialize Chess Manager');
      return;
    }
    
    // Initialize the Socket Manager
    if (!SocketManager.initialize()) {
      console.error('Failed to initialize Socket Manager');
      return;
    }
    
    // Phase 4: Final setup
    console.log('Phase 4: Final initialization steps');
    
    // Set up debug panel functionality
    setupDebugPanel();
    
    console.log('Chessville initialization complete');
    
    // Show the login screen
    UIManager.showScreen('login-screen');
    
    // Remove this line - we'll let the actual game start set up the board properly
    // ChessManager.showMoveCosts();
    
    // Phase 5: Check for auto-reconnect functionality
    console.log('Phase 5: Checking for auto-reconnect');
    
    // Add event listener for manual game restoration
    const restoreButton = document.getElementById('restore-game-button');
    if (restoreButton) {
      restoreButton.addEventListener('click', function() {
        console.log('Manual game state restoration requested');
        if (typeof ChessManager !== 'undefined' && typeof ChessManager.manuallyRestoreSavedState === 'function') {
          const success = ChessManager.manuallyRestoreSavedState();
          if (success) {
            UIManager.showMessage('Game state successfully restored!', 'success');
            // Show the game screen if it's not already visible
            if (document.getElementById('game-screen').classList.contains('hidden')) {
              UIManager.showScreen('game-screen');
            }
          } else {
            UIManager.showMessage('Could not restore game state.', 'error');
          }
        } else {
          console.error('ChessManager.manuallyRestoreSavedState is not available');
          UIManager.showMessage('Game restoration function not available.', 'error');
        }
      });
    }
    
    // Check if we have a saved game state in localStorage
    try {
      const hasValidState = (typeof GameState !== 'undefined' && typeof GameState.getSavedStateForReconnection === 'function' && 
        GameState.getSavedStateForReconnection() !== null);
      
      if (hasValidState) {
        console.log('Valid recent game state found, showing restore option');
        
        // Create a restore button if it doesn't exist
        if (!restoreButton) {
          const loginScreen = document.getElementById('login-screen');
          if (loginScreen) {
            const restoreDiv = document.createElement('div');
            restoreDiv.className = 'restore-game-container';
            restoreDiv.innerHTML = `
              <p class="notice">You have a recent game that can be restored.</p>
              <button id="restore-game-button" class="btn btn-primary">Restore Previous Game</button>
            `;
            
            // Insert before the login form
            const loginForm = document.querySelector('.login-form');
            if (loginForm) {
              loginScreen.insertBefore(restoreDiv, loginForm);
              
              // Add event listener to the newly created button
              document.getElementById('restore-game-button').addEventListener('click', function() {
                console.log('Manual game state restoration requested');
                if (typeof ChessManager !== 'undefined' && typeof ChessManager.manuallyRestoreSavedState === 'function') {
                  const success = ChessManager.manuallyRestoreSavedState();
                  if (success) {
                    UIManager.showMessage('Game state successfully restored!', 'success');
                    // Show the game screen
                    UIManager.showScreen('game-screen');
                  } else {
                    UIManager.showMessage('Could not restore game state.', 'error');
                  }
                } else {
                  console.error('ChessManager.manuallyRestoreSavedState is not available');
                  UIManager.showMessage('Game restoration function not available.', 'error');
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error checking for saved game state:', e);
    }
    
    // Check if saved state is valid for auto-reconnect
    try {
      const savedState = localStorage.getItem('chessFarm_gameState');
      if (savedState) {
        const gameState = JSON.parse(savedState);
        const now = Date.now();
        const reconnectTimeout = 5 * 60 * 1000; // 5 minutes
        
        if (gameState.roomId && 
            gameState.timestamp && 
            (now - gameState.timestamp <= reconnectTimeout)) {
          
          console.log('Valid recent game state found, attempting auto-reconnect');
          
          // Show a message about reconnecting
          showMessage('Reconnecting to previous game...', 3000);
          
          // Attempt to reconnect with saved state
          setTimeout(() => {
            SocketManager.reconnect({
              username: gameState.username || 'Player',
              roomId: gameState.roomId,
              previousColor: gameState.color,
              savedFEN: gameState.fen,
              savedFarmState: gameState.farmState
            });
          }, 1000);
        }
      }
    } catch (e) {
      console.error('Error during auto-reconnect check:', e);
    }
    
  } catch (error) {
    console.error('Critical initialization error:', error);
  }
});

// Set up debug panel functionality
function setupDebugPanel() {
  // Debug panel elements
  const debugPanel = document.getElementById('debug-panel');
  const debugInfo = document.getElementById('debug-info');
  const closeDebugBtn = document.getElementById('debug-close-btn');
  
  if (!debugPanel || !debugInfo || !closeDebugBtn) {
    console.warn('Debug panel elements not found');
    return;
  }
  
  // Update debug info function
  window.updateDebugInfo = function() {
    if (debugPanel.classList.contains('hidden')) return;
    
    // Get current game state
    const state = {
      playerColor: GameState.getPlayerColor(),
      currentTurn: GameState.getCurrentTurn(),
      currentPhase: GameState.getCurrentGamePhase(),
      isPlayerTurn: GameState.isPlayerTurn(),
      roomId: GameState.getRoomId(),
      wheat: {
        white: GameState.getWheat('white'),
        black: GameState.getWheat('black')
      }
    };
    
    // Format and display debug info
    debugInfo.innerHTML = `
      <div><b>Player Color:</b> ${state.playerColor || 'Not assigned'}</div>
      <div><b>Room ID:</b> ${state.roomId || 'Not in a room'}</div>
      <div><b>Current Turn:</b> ${state.currentTurn}</div>
      <div><b>Is Player's Turn:</b> ${state.isPlayerTurn}</div>
      <div><b>Current Phase:</b> ${state.currentPhase}</div>
      <div><b>White Wheat:</b> ${state.wheat.white}</div>
      <div><b>Black Wheat:</b> ${state.wheat.black}</div>
    `;
  };
  
  // Toggle debug panel with Alt+D
  document.addEventListener('keydown', function(event) {
    if (event.altKey && event.key === 'd') {
      debugPanel.classList.toggle('hidden');
      if (!debugPanel.classList.contains('hidden')) {
        updateDebugInfo();
        // Start updating debug info every second
        window.debugInterval = setInterval(updateDebugInfo, 1000);
      } else {
        // Stop updating when panel is hidden
        clearInterval(window.debugInterval);
      }
    }
  });
  
  // Close button
  closeDebugBtn.addEventListener('click', function() {
    debugPanel.classList.add('hidden');
    clearInterval(window.debugInterval);
  });
}

// Global utility function for showing messages
function showMessage(message, duration = 3000) {
  const messageElement = document.getElementById('message');
  if (!messageElement) {
    console.warn('Message element not found');
    return;
  }
  
  messageElement.textContent = message;
  messageElement.classList.add('visible');
  
  setTimeout(() => {
    messageElement.classList.remove('visible');
  }, duration);
}

// Chessboard.js configuration
var config = {
  pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
}; 