/**
 * Chess Manager Module
 * Handles all chess-related functionality for the game
 */
const ChessManager = (function() {
  // Private variables
  let initialized = false;
  let chessEngine = null;
  let chessboard = null;
  let debugMode = true; // Enable debug mode to help diagnose issues
  
  /**
   * Log debug information if debug mode is enabled
   * @param {...any} args - Arguments to log
   */
  function debugLog(...args) {
    if (debugMode) {
      console.log('[ChessManager Debug]', ...args);
    }
  }
  
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
      debugLog('Setting up touch event fixes for mobile');
      const boardElement = document.getElementById('chess-board');
      if (boardElement) {
        // Prevent touchmove events on the board from scrolling the page
        boardElement.addEventListener('touchmove', function(e) {
          // Only prevent default during piece dragging
          if (GameState.getCurrentGamePhase() === 'chess' && GameState.isPlayerTurn()) {
            e.preventDefault();
          }
        }, { passive: false });
        
        debugLog('Touch event fixes applied to chess board');
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
            debugLog('Touch event fixes applied to chess board after delay');
          } else {
            console.error('Chess board element still not found for touch event fix after delay');
          }
        }, 1000);
      }
    });
  }
  
  /**
   * Set up the chess board
   */
  function setupBoard() {
    try {
      debugLog('Setting up chess board');
      
      // Make sure the container exists
      const boardContainer = document.getElementById('chess-board');
      if (!boardContainer) {
        console.error('Chess board container not found');
        return;
      }
      
      // Clear any existing board
      boardContainer.innerHTML = '';
      
      // Ensure chess engine is initialized properly
      if (!chessEngine) {
        debugLog('Creating new chess engine instance');
        chessEngine = new Chess();
      } else {
        debugLog('Resetting existing chess engine to starting position');
        chessEngine.reset();
      }
      
      // Get player color directly from GameState
      const playerColor = GameState.getPlayerColor();
      const orientation = playerColor === 'white' ? 'white' : 'black';
      
      debugLog(`Player color: ${playerColor}`);
      debugLog(`Board orientation: ${orientation}`);
      
      // Debug chess engine state
      debugLog(`Chess engine current position: ${chessEngine.fen()}`);
      debugLog(`Chess engine current turn: ${chessEngine.turn()}`);
      debugLog('Available legal moves:', chessEngine.moves({ verbose: true }));
      
      // Configure the board
      const config = {
        draggable: true,
        position: chessEngine.fen(),
        orientation: orientation,
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
      };
      
      // Initialize the board
      debugLog('Initializing chessboard.js with config:', config);
      chessboard = Chessboard('chess-board', config);
      
      // Setup resize handler
      window.addEventListener('resize', () => {
        if (chessboard) {
          chessboard.resize();
        }
      });
      
      debugLog('Chess board setup complete');
    } catch (error) {
      console.error('Error setting up chess board:', error);
    }
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
   * Handle piece drop - this is the core function that manages chess piece movement
   * @param {string} source - Source square
   * @param {string} target - Target square
   * @param {string} piece - Piece being moved
   * @param {Object} newPos - New position
   * @param {Object} oldPos - Old position
   * @param {string} orientation - Board orientation
   * @returns {string|undefined} 'snapback' to cancel the move, or undefined to allow it
   */
  function onDrop(source, target, piece, newPos, oldPos, orientation) {
    debugLog(`onDrop called - Source: ${source}, Target: ${target}, Piece: ${piece}, Orientation: ${orientation}`);
    debugLog(`Current turn: ${chessEngine.turn()}, FEN: ${chessEngine.fen()}`);
    
    // Log current piece positions for debugging
    debugLog('Current position:', oldPos);
    
    // Do not allow moves if not in chess phase
    if (GameState.getCurrentGamePhase() !== 'chess') {
      debugLog('Move rejected: Not in chess phase');
      showMessage('You can only move pieces during the chess phase');
      return 'snapback';
    }
    
    // Check if it's the player's turn
    const pieceColor = piece.charAt(0);
    const playerColor = GameState.getPlayerColor();
    // Convert player color (white/black) to chess piece color (w/b)
    const chessPieceColor = playerColor === 'white' ? 'w' : 'b';
    
    debugLog(`Piece color: ${pieceColor}, Player color: ${playerColor}, Chess color: ${chessPieceColor}`);
    
    if (pieceColor !== chessPieceColor) {
      debugLog(`Not your piece to move. Piece color: ${pieceColor}, Player chess color: ${chessPieceColor}`);
      return 'snapback';
    }
    
    // Verify it's the player's turn
    if (chessEngine.turn() !== chessPieceColor) {
      debugLog(`Not your turn. Engine turn: ${chessEngine.turn()}, Player chess color: ${chessPieceColor}`);
      return 'snapback';
    }
    
    // Log legal moves for debugging
    const legalMoves = chessEngine.moves({ verbose: true });
    debugLog('Legal moves:', legalMoves);
    
    // Check if the move is valid
    try {
      const moveConfig = {
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
      };
      
      debugLog('Attempting move with config:', moveConfig);
      
      // Debug current board position
      debugLog('Current FEN before move:', chessEngine.fen());
      
      // Attempt the move
      const move = chessEngine.move(moveConfig);
      
      // If the move is invalid, it will return null
      if (move === null) {
        debugLog(`Move rejected: Invalid move from ${source} to ${target}`);
        
        // Check if any legal move exists for this piece
        const movesForPiece = legalMoves.filter(m => m.from === source);
        debugLog(`Legal moves for piece at ${source}:`, movesForPiece);
        
        return 'snapback';
      }
      
      // Log the successful move
      debugLog('Move successful:', move);
      
      // Get the piece type
      const pieceType = move.piece;
      
      // Calculate the move cost
      const moveCost = GameConfig.pieceCosts[pieceType] || 0;
      
      // Check if player has enough wheat
      const gamePlayerColor = GameState.getPlayerColor();
      if (!GameState.updateWheat(gamePlayerColor, -moveCost)) {
        // Undo the move
        chessEngine.undo();
        showMessage(`Not enough wheat to move this piece (cost: ${moveCost})`);
        return 'snapback';
      }
      
      // Check if a piece was captured
      if (move.captured) {
        debugLog(`Captured a ${move.captured} piece!`);
        GameState.recordCapture(gamePlayerColor);
        showMessage(`Captured ${getPieceName(move.captured)}!`);
      }
      
      // Update the server
      SocketManager.sendChessMove(move);
      
      // Mark chess phase as completed
      GameState.completeCurrentGamePhase();
      
      // Check for checkmate
      if (chessEngine.in_checkmate()) {
        GameState.declareWinner(gamePlayerColor, 'checkmate');
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
    } catch (error) {
      console.error('Error processing move:', error);
      return 'snapback';
    }
  }
  
  /**
   * Handle the end of a piece move
   */
  function onSnapEnd() {
    // Update the board position
    if (chessboard) {
      chessboard.position(chessEngine.fen());
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
    
    debugLog(`Processing opponent's move from server:`, move);
    
    // Log the chess engine state before applying the move
    debugLog(`Before move - Current FEN: ${chessEngine.fen()}`);
    debugLog(`Before move - Current turn: ${chessEngine.turn()}`);
    
    // Make the move
    const result = chessEngine.move(move);
    if (result === null) {
      console.error('Invalid move received from server:', move);
      
      // Try to recover by using the provided FEN if available
      if (move.fen) {
        debugLog(`Attempting to recover using received FEN: ${move.fen}`);
        try {
          // Validate the FEN first
          if (chessEngine.validate_fen(move.fen).valid) {
            chessEngine.load(move.fen);
            debugLog('Successfully recovered using received FEN');
          } else {
            debugLog('Received invalid FEN, cannot recover');
          }
        } catch (error) {
          console.error('Error loading FEN from server:', error);
        }
      }
      return;
    }
    
    // Log the successful move and the new state
    debugLog('Processed move from server successfully:', result);
    debugLog(`After move - Current FEN: ${chessEngine.fen()}`);
    debugLog(`After move - Current turn: ${chessEngine.turn()}`);
    
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
   * Refresh the chess board with the current game state
   * This function should be called when switching games or turns
   */
  function refreshBoard() {
    try {
      debugLog('Refreshing chess board with current game state');
      
      // Check key game state information
      const currentTurn = GameState.getCurrentTurn();
      const playerColor = GameState.getPlayerColor();
      const isPlayerTurn = GameState.isPlayerTurn();
      
      debugLog(`Game state: currentTurn=${currentTurn}, playerColor=${playerColor}, isPlayerTurn=${isPlayerTurn}`);
      
      // Ensure the chess engine exists
      if (!chessEngine) {
        debugLog('Chess engine not initialized, creating new instance');
        chessEngine = new Chess();
      }
      
      // Log current state for debugging
      debugLog(`Current FEN: ${chessEngine.fen()}`);
      debugLog(`Chess engine turn: ${chessEngine.turn()}`);
      
      // Check if chess engine turn matches game state turn
      const chessTurn = chessEngine.turn() === 'w' ? 'white' : 'black';
      if (chessTurn !== currentTurn) {
        debugLog(`Chess engine turn (${chessTurn}) doesn't match game state turn (${currentTurn}), fixing...`);
        
        // Get the current FEN
        let currentFEN = chessEngine.fen();
        
        // Split the FEN string to get its components
        const fenParts = currentFEN.split(' ');
        
        // Update the turn component (fenParts[1]) based on the game state turn
        fenParts[1] = currentTurn === 'white' ? 'w' : 'b';
        
        // Reconstruct the FEN string
        const newFEN = fenParts.join(' ');
        
        debugLog(`Setting new FEN with corrected turn: ${newFEN}`);
        
        // Try to validate and load the new FEN
        if (chessEngine.validate_fen(newFEN).valid) {
          chessEngine.load(newFEN);
          debugLog('Successfully corrected chess engine turn');
        } else {
          debugLog('Could not fix turn mismatch - FEN validation failed, resetting board');
          chessEngine.reset();
        }
      }
      
      // Validate FEN string - if it's invalid, reset the board
      if (!chessEngine.validate_fen(chessEngine.fen()).valid) {
        debugLog('Invalid FEN detected, resetting to starting position');
        chessEngine.reset();
      }
      
      // Log available legal moves for debugging
      debugLog('Available legal moves:', chessEngine.moves({ verbose: true }));
      
      // Check if the board container exists
      const boardContainer = document.getElementById('chess-board');
      if (!boardContainer) {
        debugLog('Chess board container not found during refresh');
        return;
      }
      
      // If the chessboard exists, update its position
      if (chessboard) {
        debugLog('Updating chessboard position');
        
        // Get the current position from the chess engine
        const currentPosition = chessEngine.fen();
        
        // Update the position on the board
        chessboard.position(currentPosition, false); // false means no animation
      } else {
        debugLog('Chessboard not initialized, setting up a new board');
        setupBoard();
      }
      
      // If it's the player's turn, check if they can make any moves with their current resources
      if (isPlayerTurn && GameState.getCurrentGamePhase() === 'chess') {
        checkIfPlayerCanMakeAnyMoves();
      }
      
      debugLog('Chess board refresh complete');
    } catch (error) {
      console.error('Error refreshing chess board:', error);
    }
  }
  
  /**
   * Check if the current player can make any legal moves with their available resources
   * If not, they lose the game
   */
  function checkIfPlayerCanMakeAnyMoves() {
    debugLog('Checking if player can make any legal moves with current resources');
    
    // Get the player's color and wheat
    const playerColor = GameState.getPlayerColor();
    const playerWheat = GameState.getWheat(playerColor);
    
    debugLog(`Player ${playerColor} has ${playerWheat} wheat`);
    
    // Get all legal moves
    const legalMoves = chessEngine.moves({ verbose: true });
    debugLog(`Total legal moves available: ${legalMoves.length}`);
    
    // Check if any moves are affordable
    let canMakeAnyMove = false;
    
    for (const move of legalMoves) {
      const pieceType = move.piece;
      const moveCost = GameConfig.pieceCosts[pieceType] || 0;
      
      debugLog(`Move ${move.from}-${move.to} costs ${moveCost} wheat`);
      
      if (playerWheat >= moveCost) {
        canMakeAnyMove = true;
        debugLog(`Player can afford move ${move.from}-${move.to}`);
        break;
      }
    }
    
    // If player can't make any moves, they lose
    if (!canMakeAnyMove && legalMoves.length > 0) {
      debugLog('Player cannot make any moves due to insufficient resources');
      
      // Declare the opponent as winner
      const opponentColor = playerColor === 'white' ? 'black' : 'white';
      GameState.declareWinner(opponentColor, 'resource-starvation');
      
      // Show message to the player
      showMessage('You have no legal moves you can afford! You lose due to resource starvation.', 'error');
    } else if (legalMoves.length === 0) {
      debugLog('Player has no legal moves available (stalemate or checkmate)');
      // This case is already handled by chess.js through in_checkmate() or in_stalemate()
    } else {
      debugLog('Player can make at least one move with current resources');
    }
  }
  
  /**
   * Helper function to rotate chess pieces for black player
   * @param {HTMLElement} boardElement - The board container element 
   */
  function rotatePiecesForBlackPlayer(boardElement) {
    debugLog('Piece rotation disabled - using standard orientation');
  }
  
  // Public API
  return {
    initialize,
    setupBoard,
    updateBoard,
    processChessMove,
    showMoveCosts,
    refreshBoard,
    checkIfPlayerCanMakeAnyMoves,
    getCurrentFEN: function() {
      if (!chessEngine) {
        console.error('Chess engine not initialized when getting FEN');
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Default starting position
      }
      
      const fen = chessEngine.fen();
      debugLog(`Retrieving current FEN: ${fen}`);
      
      // Validate FEN string
      const validation = chessEngine.validate_fen(fen);
      if (!validation.valid) {
        console.error('Invalid FEN detected in getCurrentFEN:', validation.error);
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Return valid starting position
      }
      
      return fen;
    }
  };
})(); 