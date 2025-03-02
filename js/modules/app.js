/**
 * App Module
 * Main application entry point and initialization
 */
const App = (function() {
  // Initialize all modules
  function initializeApp() {
    console.log('Initializing Chess Farm Game...');
    
    // Initialize the modules in the correct order
    if (typeof UIManager !== 'undefined') {
      UIManager.initialize();
    } else {
      console.error('UIManager module not loaded');
    }
    
    if (typeof GameState !== 'undefined') {
      GameState.initialize();
    } else {
      console.error('GameState module not loaded');
    }
    
    if (typeof SocketManager !== 'undefined') {
      SocketManager.initialize();
    } else {
      console.error('SocketManager module not loaded');
    }
    
    if (typeof ChessManager !== 'undefined') {
      ChessManager.initialize();
    } else {
      console.error('ChessManager module not loaded');
    }
    
    if (typeof FarmManager !== 'undefined') {
      FarmManager.initialize();
    } else {
      console.error('FarmManager module not loaded');
    }
    
    // Set up event listeners for the login form
    setupLoginForm();
    
    // Critical: Try to reconnect if we have saved game state
    // This must happen after all modules are initialized
    setTimeout(tryReconnect, 500);
    
    console.log('Chess Farm Game initialized');
  }
  
  // Set up the login form event listeners
  function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
      console.error('Login form not found');
      return;
    }
    
    const joinButton = document.getElementById('join-game-btn');
    if (joinButton) {
      joinButton.addEventListener('click', handleJoinGame);
    }
    
    // Also handle Enter key on the form
    loginForm.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleJoinGame();
      }
    });
    
    console.log('Login form event listeners set up');
  }
  
  // Handle join game button click
  function handleJoinGame() {
    const usernameInput = document.getElementById('username');
    const roomIdInput = document.getElementById('room-id');
    
    if (!usernameInput || !roomIdInput) {
      console.error('Username or room ID input not found');
      return;
    }
    
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    
    if (!username) {
      UIManager.showMessage('Please enter your name', 'error');
      return;
    }
    
    console.log('Joining game as:', username, 'Room:', roomId);
    
    // Clear any previous game state when manually joining
    localStorage.removeItem('chessFarm_gameState');
    
    // Join the game
    SocketManager.joinRoom(username, roomId);
  }
  
  /**
   * Try to reconnect to an existing game using saved state
   */
  function tryReconnect() {
    console.log('🔴 Checking for saved game state to reconnect...');
    
    // Constants for localStorage
    const GAME_STATE_KEY = 'chessFarm_gameState';
    const RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    try {
      // Check if we have saved game state
      const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
      if (!savedStateJSON) {
        console.log('🔴 No saved game state found');
        return;
      }
      
      // Parse the saved state
      const savedState = JSON.parse(savedStateJSON);
      console.log('🔴 Found saved game state:', savedState);
      
      // Verify we have the minimum required data
      if (!savedState.roomId || !savedState.username) {
        console.log('🔴 Saved game state missing required fields');
        return;
      }
      
      // Check if the saved state is too old
      const now = Date.now();
      if (savedState.timestamp && (now - savedState.timestamp > RECONNECT_TIMEOUT)) {
        console.log('🔴 Saved game state is too old (>5 minutes), not reconnecting');
        localStorage.removeItem(GAME_STATE_KEY);
        return;
      }
      
      // Update UI to show we're attempting to reconnect
      if (typeof UIManager !== 'undefined') {
        UIManager.updateGameStatus('Attempting to reconnect...');
        UIManager.showMessage('Trying to reconnect to your previous game...', 'info');
      }
      
      // CRITICAL: Set up game state with saved player color to prevent null values during reconnection
      if (typeof GameState !== 'undefined' && savedState.color) {
        console.log('🔴 Pre-initializing game state with saved color:', savedState.color);
        GameState.setupGame(savedState.roomId, savedState.color);
      }
      
      // Attempt to reconnect
      if (typeof SocketManager !== 'undefined') {
        console.log('🔴 Emitting reconnect attempt with saved state');
        SocketManager.reconnect({
          username: savedState.username,
          roomId: savedState.roomId,
          previousColor: savedState.color // Send the saved color
        });
      }
      
    } catch (error) {
      console.error('🔴 Error during reconnection attempt:', error);
      // Clear potentially corrupted data
      localStorage.removeItem(GAME_STATE_KEY);
    }
  }
  
  // Initialize the app when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', initializeApp);
  
  // Public API
  return {
    initialize: initializeApp
  };
})(); 