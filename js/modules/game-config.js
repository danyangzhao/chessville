/**
 * Game Configuration for Chessville
 * Contains all game parameters, costs, and victory conditions
 */
const GameConfig = {
  // Resource starting values
  startingWheat: 25,
  
  // Farm configuration
  farmConfig: {
    totalPlots: 6,            // Total plots available in the farm
    startingUnlockedPlots: 2, // Players start with 2 plots unlocked
    
    // Capture requirements to unlock plots
    plotUnlockRequirements: [
      1,  // Plot 3 requires 1 capture
      3,  // Plot 4 requires 3 captures
      5,  // Plot 5 requires 5 captures
      7   // Plot 6 requires 7 captures
    ]
  },
  
  // Crop types and their properties
  crops: {
    wheat: {
      name: "Wheat",
      emoji: "🌾",
      cost: 5,
      turnsTillHarvest: 2,
      yield: 15
    },
    corn: {
      name: "Corn", // This is still named corn but it produces wheat resource
      emoji: "🌽",
      cost: 10,
      turnsTillHarvest: 3,
      yield: 25
    },
    carrot: {
      name: "Carrot",
      emoji: "🥕",
      cost: 15,
      turnsTillHarvest: 3,
      yield: 35
    },
    potato: {
      name: "Potato",
      emoji: "🥔",
      cost: 20,
      turnsTillHarvest: 4,
      yield: 50
    }
  },
  
  // Chess piece move costs (in wheat)
  pieceCosts: {
    p: 1, // Pawn
    r: 5, // Rook
    n: 3, // Knight
    b: 3, // Bishop
    q: 9, // Queen
    k: 0  // King (free to move)
  },
  
  // Victory conditions
  victoryConditions: {
    checkmate: true,           // Victory by checkmate
    economicThreshold: 200,    // Economic victory at 200 wheat
    opponentBankruptcy: true   // Victory when opponent can't afford any moves
  },
  
  // Turn structure
  turnStructure: {
    phases: ["farming", "chess"],  // Each turn has farming phase then chess phase
    maxFarmActionsPerTurn: 1       // Players can perform at most 1 farm action per turn
  }
};

// Make the configuration available globally for browser
// And also export for Node.js environments
if (typeof window !== 'undefined') {
  // Browser environment - make it a global variable
  window.GameConfig = GameConfig;
} 

// Export the configuration for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameConfig;
} 