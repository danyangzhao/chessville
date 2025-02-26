// Entry point for Chess Farmer client-side code

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, starting game initialization...');
  
  // Initialize UI first
  UIManager.initialize();
  
  // Load Chess.js and then set up the game
  loadChessLibrary(() => {
    console.log('Chess.js library loaded successfully');
    
    // Initialize game state
    GameState.initialize();
    
    // Set up connection to server
    SocketManager.initialize();
    
    console.log('Game initialization complete');
  });
});

// Load the Chess.js library dynamically
function loadChessLibrary(callback) {
  if (typeof Chess !== 'undefined') {
    console.log('Chess library already loaded');
    callback();
    return;
  }
  
  console.log('Loading Chess.js library...');
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';
  script.onload = callback;
  script.onerror = () => {
    console.error('Failed to load Chess.js library');
    showMessage('Failed to load game resources. Please refresh the page.', 5000);
  };
  document.head.appendChild(script);
}

// Global utility function to show messages to user
function showMessage(message, duration = 3000) {
  const messageEl = document.getElementById('message');
  if (!messageEl) {
    console.warn('Message element not found');
    return;
  }
  
  messageEl.textContent = message;
  messageEl.classList.add('visible');
  
  setTimeout(() => {
    messageEl.classList.remove('visible');
  }, duration);
} 