/**
 * Chess Manager Module
 * Handles all chess-related functionality for the game
 */
const ChessManager = (function() {
  // Private variables
  let initialized = false;
  let chessEngine = null;
  let chessboard = null;
  
  /**
   * Initialize the Chess Manager
   * @returns {boolean} True if initialization was successful
   */
  function initialize() {
    if (initialized) {
      console.warn('Chess Manager already initialized');
      return true;
    }
    
    try {
      console.log('Initializing Chess Manager');
      
      // Initialize chess engine
      if (typeof Chess === 'undefined') {
        console.error('Chess.js library not loaded');
        return false;
      }
      
      chessEngine = new Chess();
      
      // Set up the board when the UI is ready
      setTimeout(setupBoard, 100);
      
      // Fix touch events for mobile
      setupTouchEventFixes();
      
      console.log('Chess Manager initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Chess Manager:', error);
      return false;
    }
  }
  
  /**
   * Setup fixes for touch events on mobile devices
   */
  function setupTouchEventFixes() {
    // Add this to prevent the "passive event listener" warnings
    document.addEventListener('DOMContentLoaded', function() {
      const boardElement = document.getElementById('chess-board');
      if (boardElement) {
        // Prevent touchmove events on the board from scrolling the page
        boardElement.addEventListener('touchmove', function(e) {
          // Only prevent default during piece dragging
          if (GameState.getCurrentGamePhase() === 'chess' && GameState.isPlayerTurn()) {
            e.preventDefault();
          }
        }, { passive: false });
        
        console.log('Touch event fixed applied to chess board');
      } else {
        console.warn('Chess board element not found for touch event fix');
        
        // Try again after a short delay
        setTimeout(function() {
          const boardElement = document.getElementById('chess-board');
          if (boardElement) {
            boardElement.addEventListener('touchmove', function(e) {
              if (GameState.getCurrentGamePhase() === 'chess' && GameState.isPlayerTurn()) {
                e.preventDefault();
              }
            }, { passive: false });
            console.log('Touch event fixes applied to chess board after delay');
          }
        }, 1000);
      }
    });
  }
  
  /**
   * Set up the chessboard
   */
  function setupBoard() {
    const boardElement = document.getElementById('chess-board');
    if (!boardElement) {
      console.warn('Chessboard element not found');
      return;
    }
    
    if (!chessEngine) {
      console.error('Chess engine not initialized');
      return;
    }
    
    // Clear any existing board
    if (chessboard) {
      chessboard.clear();
    }
    
    // Configure the board
    const config = {
      draggable: true,
      position: chessEngine.fen(),
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
      onDragStart: onDragStart,
      onDrop: onDrop,
      onSnapEnd: onSnapEnd
    };
    
    // Create the chessboard
    chessboard = Chessboard(boardElement.id, config);
    
    // Flip the board if the player is black
    if (GameState.getPlayerColor() === 'black') {
      boardElement.style.transform = 'rotate(180deg)';
      
      // Flip all pieces - use a more generic selector since class names might vary
      rotatePiecesForBlackPlayer(boardElement);
      
      // Set up a mutation observer to rotate pieces that get added later
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.addedNodes.length) {
            rotatePiecesForBlackPlayer(boardElement);
          }
        });
      });
      
      // Start observing changes to the board
      observer.observe(boardElement, { childList: true, subtree: true });
    }
    
    // Update the move costs display
    showMoveCosts();
    
    console.log('Chessboard set up');
  }
  
  /**
   * Helper function to rotate all chess pieces for black player
   * @param {HTMLElement} boardElement - The chess board element
   */
  function rotatePiecesForBlackPlayer(boardElement) {
    // Try multiple possible selectors that ChessboardJS might use
    const pieceElements = boardElement.querySelectorAll('img[data-piece], .piece, [class*="piece-"]');
    console.log(`Found ${pieceElements.length} chess pieces to rotate`);
    
    pieceElements.forEach(piece => {
      // Remove any existing rotation to avoid compounding rotations
      piece.style.transform = 'rotate(180deg)';
    });
  }
  
  /**
   * Handle the start of a piece drag
   * @param {string} source - The source square
   * @param {string} piece - The piece being dragged
   * @param {Object} position - The current board position
   * @param {string} orientation - The board orientation
   * @returns {boolean} Whether the drag is allowed
   */
  function onDragStart(source, piece, position, orientation) {
    console.log(`Attempting to drag piece from ${source}: ${piece}`);
    
    // Do not allow dragging if the game is over
    if (chessEngine.game_over()) {
      console.log('Game is over, cannot move pieces');
      return false;
    }
    
    // Only allow the current player to move pieces
    if (!GameState.isPlayerTurn()) {
      console.log('Not your turn, cannot move pieces');
      return false;
    }
    
    // Only allow dragging in the chess phase
    if (GameState.getCurrentGamePhase() !== 'chess') {
      console.log('Not in chess phase, cannot move pieces');
      showMessage('You can only move pieces during the chess phase');
      return false;
    }
    
    // Only allow dragging pieces of the player's color
    const playerColor = GameState.getPlayerColor();
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
        (playerColor === 'black' && piece.search(/^w/) !== -1)) {
      console.log(`Cannot move opponent's pieces (${piece})`);
      return false;
    }
    
    console.log(`Drag allowed for ${piece} from ${source}`);
    return true;
  }
  
  /**
   * Handle a piece being dropped on the board
   * @param {string} source - The source square
   * @param {string} target - The target square
   * @returns {string} 'snapback' to cancel the move, or undefined to allow it
   */
  function onDrop(source, target) {
    console.log(`onDrop called: from ${source} to ${target}`);
    
    // Do not allow moves if not in chess phase
    if (GameState.getCurrentGamePhase() !== 'chess') {
      console.log('Move rejected: Not in chess phase');
      showMessage('You can only move pieces during the chess phase');
      return 'snapback';
    }
    
    // Check if it's a valid move
    const move = chessEngine.move({
      from: source,
      to: target,
      promotion: 'q' // Always promote to queen for simplicity
    });
    
    // Invalid move
    if (move === null) {
      console.log(`Move rejected: Invalid move from ${source} to ${target}`);
      return 'snapback';
    }
    
    console.log(`Valid move: ${JSON.stringify(move)}`);
    
    // Get the piece type
    const pieceType = move.piece;
    
    // Calculate the move cost
    const moveCost = GameConfig.pieceCosts[pieceType] || 0;
    
    // Check if player has enough wheat
    const playerColor = GameState.getPlayerColor();
    if (!GameState.updateWheat(playerColor, -moveCost)) {
      // Undo the move
      chessEngine.undo();
      showMessage(`Not enough wheat to move this piece (cost: ${moveCost})`);
      return 'snapback';
    }
    
    // Check if a piece was captured
    if (move.captured) {
      console.log(`Captured a ${move.captured} piece!`);
      GameState.recordCapture(playerColor);
      showMessage(`Captured ${getPieceName(move.captured)}!`);
    }
    
    // Update the server
    SocketManager.sendChessMove(move);
    
    // Check for checkmate
    if (chessEngine.in_checkmate()) {
      GameState.declareWinner(playerColor, 'checkmate');
      showMessage('Checkmate!');
    } else if (chessEngine.in_check()) {
      showMessage('Check!');
    }
    
    // Update the move cost display
    showMoveCosts();
    
    // Auto-end turn after chess move
    setTimeout(() => {
      GameState.endTurn();
      showMessage('Automatically ending turn after chess move');
    }, 1000); // 1 second delay to allow for visual feedback
    
    return undefined;
  }
  
  /**
   * Handle the end of a piece move
   */
  function onSnapEnd() {
    // Update the board position
    if (chessboard) {
      chessboard.position(chessEngine.fen());
      
      // If the board is flipped (black player), make sure pieces are rotated
      if (GameState.getPlayerColor() === 'black') {
        const boardElement = document.getElementById('chess-board');
        if (boardElement) {
          rotatePiecesForBlackPlayer(boardElement);
        }
      }
    }
  }
  
  /**
   * Update the chessboard display
   */
  function updateBoard() {
    if (chessboard && chessEngine) {
      chessboard.position(chessEngine.fen());
    }
  }
  
  /**
   * Process a chess move from the server
   * @param {Object} move - The move object
   */
  function processChessMove(move) {
    if (!chessEngine) {
      console.error('Chess engine not initialized');
      return;
    }
    
    // Make the move
    const result = chessEngine.move(move);
    if (result === null) {
      console.error('Invalid move received from server:', move);
      return;
    }
    
    console.log('Processed move from server:', move);
    
    // Update the board
    updateBoard();
    
    // Check for checkmate
    if (chessEngine.in_checkmate()) {
      const winner = chessEngine.turn() === 'w' ? 'black' : 'white';
      GameState.declareWinner(winner, 'checkmate');
      showMessage('Checkmate!');
    } else if (chessEngine.in_check()) {
      showMessage('Check!');
    }
    
    // If the board is flipped (black player), rotate any new pieces
    const boardElement = document.getElementById('chess-board');
    if (boardElement && GameState.getPlayerColor() === 'black') {
      rotatePiecesForBlackPlayer(boardElement);
    }
  }
  
  /**
   * Get a human-readable name for a piece
   * @param {string} pieceCode - The piece code (p, n, b, r, q, k)
   * @returns {string} The human-readable piece name
   */
  function getPieceName(pieceCode) {
    const pieceNames = {
      p: 'Pawn',
      n: 'Knight',
      b: 'Bishop',
      r: 'Rook',
      q: 'Queen',
      k: 'King'
    };
    
    return pieceNames[pieceCode.toLowerCase()] || 'Unknown Piece';
  }
  
  /**
   * Display the movement costs for all pieces
   */
  function showMoveCosts() {
    const moveCostsElement = document.getElementById('move-costs-display');
    if (!moveCostsElement) {
      console.warn('Move costs display element not found');
      return;
    }
    
    let html = `
      <div class="move-costs-info">
        <h4>Movement Costs (Wheat)</h4>
        <ul>
    `;
    
    // Add each piece cost
    Object.entries(GameConfig.pieceCosts).forEach(([piece, cost]) => {
      html += `<li>${getPieceName(piece)}: ${cost}</li>`;
    });
    
    html += `
        </ul>
      </div>
    `;
    
    moveCostsElement.innerHTML = html;
  }
  
  /**
   * Completely refresh the chess board
   * Force a refresh of the chess board and all pieces 
   */
  function refreshBoard() {
    console.log('Performing complete chess board refresh');
    
    if (!chessEngine) {
      console.error('Cannot refresh board: Chess engine not initialized');
      return;
    }
    
    const boardElement = document.getElementById('chess-board');
    if (!boardElement) {
      console.warn('Cannot refresh board: Chessboard element not found');
      return;
    }
    
    // Store current state
    const currentFEN = chessEngine.fen();
    console.log(`Current FEN: ${currentFEN}`);
    
    // Clear the board
    if (chessboard) {
      chessboard.clear(false); // Don't fire events
    }
    
    // Reconfigure and recreate the board
    const config = {
      draggable: true,
      position: currentFEN,
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
      onDragStart: onDragStart,
      onDrop: onDrop,
      onSnapEnd: onSnapEnd
    };
    
    // Create the chessboard
    chessboard = Chessboard(boardElement.id, config);
    
    // Flip the board if the player is black
    if (GameState.getPlayerColor() === 'black') {
      boardElement.style.transform = 'rotate(180deg)';
      
      // Flip all pieces
      rotatePiecesForBlackPlayer(boardElement);
    }
    
    console.log('Chess board refreshed');
  }
  
  // Public API
  return {
    initialize,
    setupBoard,
    updateBoard,
    processChessMove,
    showMoveCosts,
    refreshBoard,
    getCurrentFEN: function() {
      return chessEngine ? chessEngine.fen() : null;
    }
  };
})(); 