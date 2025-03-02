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
  let selectedSquare = null; // Track the currently selected square
  let highlightedSquares = []; // Track currently highlighted squares
  
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
      
      // UPDATED: Don't immediately call setupBoard, instead wait for player info
      // We'll check for GameState readiness before setting up the board
      // Instead of using setTimeout, we'll use a more robust approach
      document.addEventListener('DOMContentLoaded', function() {
        // Only set up the board when explicitly requested by GameState or SocketManager
        console.log('ChessManager initialized and waiting for explicit board setup');
      });
      
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
   * @param {string} [savedFEN] - Optional saved FEN string to restore board position
   */
  function setupBoard(savedFEN) {
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
      
      // IMPROVED: More robust game state checking
      // Check for saved game state in localStorage if no savedFEN is provided
      if (!savedFEN) {
        try {
          // First check if we have a valid room ID from GameState
          const currentRoomId = GameState.getRoomId();
          
          if (!currentRoomId) {
            debugLog('No current room ID available yet, deferring board setup');
            // If we're still in the login screen, don't set up a real board yet
            const isLoginVisible = document.getElementById('login-screen')?.classList.contains('hidden') === false;
            if (isLoginVisible) {
              debugLog('Still on login screen, skipping full board setup');
              return;
            }
          }
          
          // During reconnection, try to get the saved FEN from GameState directly
          // This is often more up-to-date than what's in localStorage
          const gameStateData = GameState.getSavedStateForReconnection && 
                                GameState.getSavedStateForReconnection();
          
          if (gameStateData && gameStateData.fen) {
            debugLog('Found FEN in GameState for reconnection:', gameStateData.fen);
            savedFEN = gameStateData.fen;
          } else {
            // Fall back to localStorage
            const savedState = localStorage.getItem('chessFarm_gameState');
            if (savedState) {
              const gameState = JSON.parse(savedState);
              
              // Check if saved state is recent enough (within 5 minutes)
              const now = Date.now();
              const reconnectTimeout = 5 * 60 * 1000; // 5 minutes
              
              // ENHANCED: Better validation of saved state
              if (gameState.fen && gameState.timestamp && 
                  (now - gameState.timestamp <= reconnectTimeout) &&
                  (currentRoomId === null || gameState.roomId === currentRoomId)) {
                debugLog('Found valid saved game state in localStorage, using saved FEN:', gameState.fen);
                savedFEN = gameState.fen;
              } else {
                debugLog('Found saved game state but it is invalid or for a different room', {
                  currentRoomId,
                  savedRoomId: gameState.roomId,
                  timeDifference: now - gameState.timestamp
                });
              }
            }
          }
        } catch (e) {
          console.error('Error checking for saved game state:', e);
        }
      } else {
        debugLog('Using provided FEN position:', savedFEN);
      }
      
      // Ensure chess engine is initialized properly
      if (!chessEngine) {
        debugLog('Creating new chess engine instance');
        chessEngine = new Chess();
      }
      
      // If we have a saved FEN, try to load it
      if (savedFEN) {
        try {
          debugLog('Attempting to load saved FEN position:', savedFEN);
          // Validate FEN before loading
          const isValidFEN = validateFEN(savedFEN);
          
          if (isValidFEN) {
            const loadSuccess = chessEngine.load(savedFEN);
            if (!loadSuccess) {
              console.error('Failed to load saved FEN position, resetting to starting position');
              chessEngine.reset();
            } else {
              debugLog('Successfully loaded saved FEN position');
            }
          } else {
            console.error('Invalid FEN format, resetting to starting position');
            chessEngine.reset();
          }
        } catch (e) {
          console.error('Error loading saved FEN position:', e);
          chessEngine.reset();
        }
      } else {
        debugLog('No saved FEN found, resetting chess engine to starting position');
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
        position: chessEngine.fen(),
        orientation: orientation,
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
        draggable: false, // Disable dragging for click-to-move implementation
        onClick: handleSquareClick // Add click handler for squares
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
      
      // Setup click handler for board squares
      setupBoardClickHandler();
      
      debugLog('Chess board setup complete');
    } catch (error) {
      console.error('Error setting up chess board:', error);
    }
  }
  
  /**
   * Validate FEN string
   * @param {string} fen - The FEN string to validate
   * @returns {boolean} True if the FEN string is valid
   */
  function validateFEN(fen) {
    if (!fen || typeof fen !== 'string') {
      return false;
    }
    
    try {
      // Create a temporary chess engine to validate FEN
      const tempEngine = new Chess();
      return tempEngine.load(fen);
    } catch (e) {
      console.error('FEN validation error:', e);
      return false;
    }
  }
  
  /**
   * Set up click handlers for chess board squares
   */
  function setupBoardClickHandler() {
    const boardElement = document.getElementById('chess-board');
    if (!boardElement) {
      console.error('Chess board container not found when setting up click handler');
      return;
    }
    
    boardElement.addEventListener('click', function(event) {
      const target = event.target;
      const square = findSquareFromElement(target);
      
      if (square) {
        handleSquareClick(square);
      }
    });
    
    debugLog('Board click handler set up');
  }
  
  /**
   * Find the chess square associated with a clicked element
   * @param {HTMLElement} element - The clicked element
   * @returns {string|null} The square notation (e.g., 'e4') or null if not found
   */
  function findSquareFromElement(element) {
    // Check if we clicked directly on a square
    if (element.classList && element.classList.contains('square-55d63')) {
      return element.getAttribute('data-square');
    }
    
    // Check if we clicked on a piece
    if (element.classList && (element.classList.contains('piece-417db') || 
                            element.tagName.toLowerCase() === 'img')) {
      // Look for the parent square
      const parent = element.closest('.square-55d63');
      if (parent) {
        return parent.getAttribute('data-square');
      }
    }
    
    return null;
  }
  
  /**
   * Handle click on a chess square
   * @param {string} square - The clicked square in notation (e.g., 'e4')
   */
  function handleSquareClick(square) {
    debugLog(`Square clicked: ${square}`);
    
    // Don't allow clicks if it's not the player's turn or not in chess phase
    if (!GameState.isPlayerTurn()) {
      debugLog('Not your turn, ignoring click');
      return;
    }
    
    if (GameState.getCurrentGamePhase() !== 'chess') {
      debugLog('Not in chess phase, ignoring click');
      showMessage('You can only move pieces during the chess phase');
      return;
    }
    
    const position = chessboard.position();
    const piece = position[square];
    
    // If no piece is selected yet
    if (selectedSquare === null) {
      // Make sure there's a piece on the clicked square
      if (!piece) {
        debugLog('Clicked on empty square, no action needed');
        return;
      }
      
      // Make sure it's the player's piece
      const playerColor = GameState.getPlayerColor();
      const pieceColor = piece.charAt(0);
      const playerPiecePrefix = playerColor === 'white' ? 'w' : 'b';
      
      if (pieceColor !== playerPiecePrefix) {
        debugLog(`Clicked opponent's piece (${piece}), cannot select`);
        return;
      }
      
      // Select the square and highlight legal moves
      selectSquare(square);
    } else {
      // A piece is already selected, try to move it
      const moveResult = tryMovePiece(selectedSquare, square);
      
      // If move was unsuccessful, check if player clicked on another of their pieces
      if (!moveResult && piece) {
        const playerColor = GameState.getPlayerColor();
        const pieceColor = piece.charAt(0);
        const playerPiecePrefix = playerColor === 'white' ? 'w' : 'b';
        
        if (pieceColor === playerPiecePrefix) {
          // Clicked on another of their pieces, select this one instead
          clearSelection();
          selectSquare(square);
          return;
        }
      }
      
      // Clear selection regardless of move result
      clearSelection();
    }
  }
  
  /**
   * Select a square and highlight legal moves
   * @param {string} square - The square to select
   */
  function selectSquare(square) {
    debugLog(`Selecting square: ${square}`);
    selectedSquare = square;
    
    // Add highlight to selected square
    highlightSquare(square, 'selected-square');
    
    // Highlight legal moves
    highlightLegalMoves(square);
  }
  
  /**
   * Clear current selection and highlights
   */
  function clearSelection() {
    debugLog('Clearing selection');
    selectedSquare = null;
    
    // Remove all highlighted squares
    clearHighlightedSquares();
  }
  
  /**
   * Highlight a square with a specific class
   * @param {string} square - The square to highlight
   * @param {string} className - The CSS class to add
   */
  function highlightSquare(square, className) {
    const squareElement = document.querySelector(`.square-55d63[data-square="${square}"]`);
    if (squareElement) {
      squareElement.classList.add(className);
      highlightedSquares.push({ square, className });
    }
  }
  
  /**
   * Clear all highlighted squares
   */
  function clearHighlightedSquares() {
    highlightedSquares.forEach(({ square, className }) => {
      const squareElement = document.querySelector(`.square-55d63[data-square="${square}"]`);
      if (squareElement) {
        squareElement.classList.remove(className);
      }
    });
    
    highlightedSquares = [];
  }
  
  /**
   * Highlight all legal moves from a source square
   * @param {string} sourceSquare - The source square
   */
  function highlightLegalMoves(sourceSquare) {
    const legalMoves = chessEngine.moves({ 
      square: sourceSquare,
      verbose: true 
    });
    
    debugLog(`Legal moves from ${sourceSquare}:`, legalMoves);
    
    // Check which moves are affordable
    const pieceType = chessEngine.get(sourceSquare).type;
    const moveCost = GameConfig.pieceCosts[pieceType] || 0;
    const playerColor = GameState.getPlayerColor();
    const playerWheat = GameState.getWheat(playerColor);
    
    legalMoves.forEach(move => {
      const canAfford = playerWheat >= moveCost;
      const highlightClass = canAfford ? 'legal-move-square' : 'unaffordable-move-square';
      
      highlightSquare(move.to, highlightClass);
    });
    
    // Add CSS to head if not already present
    addHighlightStyles();
  }
  
  /**
   * Add CSS styles for highlighted squares if not already present
   */
  function addHighlightStyles() {
    if (!document.getElementById('chess-highlight-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'chess-highlight-styles';
      styleElement.textContent = `
        .selected-square {
          background-color: rgba(20, 85, 30, 0.5) !important;
        }
        .legal-move-square {
          background-color: rgba(0, 128, 0, 0.3) !important;
        }
        .unaffordable-move-square {
          background-color: rgba(255, 0, 0, 0.3) !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
  }
  
  /**
   * Try to move a piece from source to target
   * @param {string} source - The source square
   * @param {string} target - The target square
   * @returns {boolean} True if the move was successful
   */
  function tryMovePiece(source, target) {
    debugLog(`Attempting to move from ${source} to ${target}`);
    
    // Check if source and target are the same
    if (source === target) {
      debugLog('Source and target are the same, not a valid move');
      return false;
    }
    
    const pieceColor = chessboard.position()[source].charAt(0);
    const playerColor = GameState.getPlayerColor();
    const chessPieceColor = playerColor === 'white' ? 'w' : 'b';
    
    // Check if it's the player's piece
    if (pieceColor !== chessPieceColor) {
      debugLog(`Not your piece to move. Piece color: ${pieceColor}, Player chess color: ${chessPieceColor}`);
      return false;
    }
    
    // Check if it's the player's turn
    if (chessEngine.turn() !== chessPieceColor) {
      debugLog(`Not your turn. Engine turn: ${chessEngine.turn()}, Player chess color: ${chessPieceColor}`);
      return false;
    }
    
    // Try to make the move
    try {
      const moveConfig = {
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
      };
      
      // Attempt the move
      const move = chessEngine.move(moveConfig);
      
      // If the move is invalid, it will return null
      if (move === null) {
        debugLog(`Move rejected: Invalid move from ${source} to ${target}`);
        return false;
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
        return false;
      }
      
      // Update the board display
      updateBoard();
      
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
      
      return true;
    } catch (error) {
      console.error('Error processing move:', error);
      return false;
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
    
    // Clear any selections when the board updates
    clearSelection();
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
   * Process a chess move from the opponent (alias for processChessMove)
   * @param {Object} data - The move data from the server
   */
  function processOpponentMove(data) {
    // Check if we're receiving the move object or a wrapper with move and fen
    const moveData = data.move ? data.move : data;
    const fen = data.fen || null;
    
    if (fen) {
      // If we got a FEN string, attach it to the move data for potential recovery
      moveData.fen = fen;
    }
    
    // Call the existing processChessMove function
    processChessMove(moveData);
    
    // Update the board to show the move
    updateBoard();
    
    // Check for game end conditions
    checkGameEndConditions();
  }
  
  /**
   * Check for game end conditions like checkmate and stalemate
   */
  function checkGameEndConditions() {
    if (!chessEngine) return;
    
    if (chessEngine.in_checkmate()) {
      const winner = chessEngine.turn() === 'w' ? 'black' : 'white';
      GameState.declareWinner(winner, 'checkmate');
    } else if (chessEngine.in_stalemate() || 
               chessEngine.in_draw() || 
               chessEngine.in_threefold_repetition() || 
               chessEngine.insufficient_material()) {
      GameState.declareWinner(null, 'draw');
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
        try {
          if (chessEngine.validate_fen(newFEN).valid) {
            chessEngine.load(newFEN);
            debugLog('Successfully updated FEN with correct turn');
          } else {
            // Don't reset the board, just log the error
            debugLog('Generated FEN is invalid, keeping current state');
          }
        } catch (error) {
          debugLog('Error validating FEN, keeping current state:', error);
        }
      }
      
      // Get legal moves
      const legalMoves = chessEngine.moves({ verbose: true });
      debugLog('Available legal moves:', legalMoves);
      
      // Update the chessboard display
      debugLog('Updating chessboard position');
      if (chessboard) {
        chessboard.position(chessEngine.fen());
      }
      
      // If it's the player's turn during the chess phase, check if they can make any moves
      if (isPlayerTurn && GameState.getCurrentGamePhase() === 'chess') {
        debugLog('Checking if player can make any legal moves with current resources');
        checkIfPlayerCanMakeAnyMoves();
      }
      
      debugLog('Chess board refresh complete');
      
      // Clear any previous selections
      clearSelection();
      
      return true;
    } catch (error) {
      console.error('Error refreshing chess board:', error);
      return false;
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
    processOpponentMove,
    showMoveCosts,
    refreshBoard,
    checkIfPlayerCanMakeAnyMoves,
    checkGameEndConditions,
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