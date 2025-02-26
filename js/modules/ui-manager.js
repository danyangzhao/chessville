// UI management module

const UIManager = (() => {
  // Private variables
  
  // Initialize UI event listeners
  function setupUIEventListeners() {
    console.log('Setting up UI event listeners');
    
    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const roomIdInput = document.getElementById('room-id');
        const roomId = roomIdInput ? roomIdInput.value.trim() : '';
        
        console.log(`Attempting to join room: ${roomId}`);
        showMessage(`Connecting to game ${roomId}...`, 3000);
        SocketManager.joinRoom(roomId);
      });
    } else {
      console.error('Login form not found');
    }
    
    // Join game button
    const joinGameButton = document.getElementById('join-game-button');
    if (joinGameButton) {
      joinGameButton.addEventListener('click', () => {
        const roomIdInput = document.getElementById('room-id-input');
        const roomId = roomIdInput ? roomIdInput.value.trim() : '';
        
        if (roomId) {
          console.log(`Attempting to join room: ${roomId}`);
          showMessage(`Connecting to game ${roomId}...`, 3000);
          SocketManager.joinRoom(roomId);
        } else {
          showMessage('Please enter a valid room ID', 3000);
        }
      });
    }
    
    // Plant selector buttons
    document.querySelectorAll('.plant-type-btn').forEach(button => {
      button.addEventListener('click', function() {
        const plantType = this.getAttribute('data-plant-type');
        if (plantType) {
          GameState.getPlayerState().selectedPlantType = plantType;
          
          // Update the selected button visually
          document.querySelectorAll('.plant-type-btn').forEach(btn => {
            btn.classList.remove('selected');
          });
          this.classList.add('selected');
          
          console.log(`Selected plant type: ${plantType}`);
        }
      });
    });
    
    // Unlock plot buttons
    document.querySelectorAll('.unlock-plot-button').forEach(button => {
      button.addEventListener('click', function() {
        const plotIndex = parseInt(this.getAttribute('data-plot-index'));
        if (!isNaN(plotIndex)) {
          FarmManager.unlockPlot(plotIndex);
        }
      });
    });
  }
  
  // Public methods
  return {
    initialize() {
      console.log('Initializing UI manager');
      
      // Initialize screens
      this.initializeScreens();
      
      // Set up event listeners
      setupUIEventListeners();
    },
    
    initializeScreens() {
      console.log('Initializing screens');
      
      // Hide all screens initially
      const screens = document.querySelectorAll('.screen');
      screens.forEach(screen => {
        screen.style.display = 'none';
      });
      
      // Show login screen by default
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) {
        loginScreen.style.display = 'block';
      } else {
        console.error('Login screen not found');
      }
    },
    
    showScreen(screenId) {
      console.log(`Showing screen: ${screenId}`);
      
      // Hide all screens
      const screens = document.querySelectorAll('.screen');
      screens.forEach(screen => {
        screen.style.display = 'none';
        screen.classList.add('hidden');
      });
      
      // Show the requested screen
      const screenToShow = document.getElementById(screenId);
      if (screenToShow) {
        screenToShow.style.display = 'block';
        screenToShow.classList.remove('hidden');
        
        // If showing the waiting screen, make sure it has a message element
        if (screenId === 'waiting-screen') {
          let waitingMessage = document.getElementById('waiting-message');
          if (!waitingMessage) {
            console.log('Creating waiting-message element');
            waitingMessage = document.createElement('div');
            waitingMessage.id = 'waiting-message';
            waitingMessage.className = 'waiting-text';
            waitingMessage.textContent = 'Waiting for opponent...';
            screenToShow.appendChild(waitingMessage);
          }
        }
        
        // If showing the game screen, update room info and refresh game elements
        if (screenId === 'game-screen') {
          this.updateRoomInfo();
          
          // Add small delay to ensure DOM is ready
          setTimeout(() => {
            ChessManager.refreshBoard();
            FarmManager.refreshFarms();
          }, 100);
        }
      } else {
        console.error(`Screen with ID "${screenId}" not found`);
      }
    },
    
    updateRoomInfo() {
      const playerState = GameState.getPlayerState();
      
      // Update room ID display
      const roomIdElement = document.getElementById('room-id-display');
      if (roomIdElement) {
        roomIdElement.textContent = playerState.roomId || 'None';
      }
      
      // Update player color display
      const playerColorElement = document.getElementById('player-color-display');
      if (playerColorElement) {
        const colorText = playerState.playerColor || 'Not assigned';
        playerColorElement.textContent = colorText;
        
        // Add color indicator
        if (playerState.playerColor === 'white') {
          playerColorElement.classList.add('white-player');
          playerColorElement.classList.remove('black-player');
        } else if (playerState.playerColor === 'black') {
          playerColorElement.classList.add('black-player');
          playerColorElement.classList.remove('white-player');
        }
      }
      
      // Highlight the player's farm
      const player1Header = document.getElementById('player1-header');
      const player2Header = document.getElementById('player2-header');
      
      if (player1Header && player2Header) {
        if (playerState.playerColor === 'white') {
          player1Header.classList.add('my-farm');
          player2Header.classList.remove('my-farm');
        } else if (playerState.playerColor === 'black') {
          player1Header.classList.remove('my-farm');
          player2Header.classList.add('my-farm');
        }
      }
    },
    
    updateTurnIndicator() {
      const currentTurn = GameState.getCurrentTurn();
      const playerState = GameState.getPlayerState();
      
      try {
        const turnElement = document.getElementById('current-turn');
        if (turnElement) {
          turnElement.textContent = `Current Turn: ${currentTurn === 'white' ? 'White' : 'Black'}`;
          turnElement.className = currentTurn === 'white' ? 'white-turn' : 'black-turn';
        }
        
        // Highlight whose turn it is
        const player1Header = document.getElementById('player1-header');
        const player2Header = document.getElementById('player2-header');
        
        if (player1Header && player2Header) {
          player1Header.classList.toggle('active-turn', currentTurn === 'white');
          player2Header.classList.toggle('active-turn', currentTurn === 'black');
        }
        
        console.log(`Turn indicator updated: ${currentTurn}, Is my turn: ${playerState.isMyTurn}`);
      } catch (error) {
        console.error('Error updating turn indicator:', error);
      }
    },
    
    showWaitingMessage(message) {
      const waitingMessage = document.getElementById('waiting-message');
      if (waitingMessage) {
        waitingMessage.textContent = message;
      } else {
        console.warn('Waiting message element not found');
      }
    },
    
    showVictoryBanner(isWinner, message) {
      const gameOverBanner = document.getElementById('game-over-banner');
      const gameOverMessage = document.getElementById('game-over-message');
      
      if (gameOverBanner && gameOverMessage) {
        gameOverMessage.textContent = message;
        gameOverBanner.className = isWinner ? 'victory' : 'defeat';
        gameOverBanner.style.display = 'flex';
        
        // Add play again button functionality
        const playAgainButton = document.getElementById('play-again-button');
        if (playAgainButton) {
          playAgainButton.onclick = () => {
            gameOverBanner.style.display = 'none';
            UIManager.showScreen('login-screen');
          };
        }
      }
    }
  };
})(); 