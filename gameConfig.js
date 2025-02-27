// Game configuration file for Chessville
// This file contains all the configurable game parameters that can be adjusted for balance

const gameConfig = {
  // Starting resources
  startingWheat: 25,
  
  // Chess piece move costs
  moveCosts: {
    p: 5,  // pawn
    n: 10, // knight
    b: 8,  // bishop
    r: 12, // rook
    q: 15, // queen
    k: 7   // king
  },
  
  // Farming configuration
  farming: {
    // Default plant settings
    defaultGrowthStages: 3,
    
    // Plant types
    plants: {
      wheat: { 
        seedCost: 2,
        harvestYield: 6,
        growthTime: 2,
        emoji: "🌾" 
      },
      corn: { 
        seedCost: 3,
        harvestYield: 10,
        growthTime: 3,
        emoji: "🌽" 
      },
      carrot: { 
        seedCost: 4,
        harvestYield: 12,
        growthTime: 3,
        emoji: "🥕" 
      },
      potato: { 
        seedCost: 5,
        harvestYield: 15,
        growthTime: 4,
        emoji: "🥔" 
      }
    },
    
    // Farm plot configuration
    totalFarmPlots: 6,
    startingUnlockedPlots: 2,
    
    // Capture requirements for unlocking plots
    captureRequirements: [
      { plot: 2, capturesNeeded: 1 },  // Third plot (index 2) requires 1 capture
      { plot: 3, capturesNeeded: 3 },  // Fourth plot (index 3) requires 3 captures
      { plot: 4, capturesNeeded: 6 },  // Fifth plot (index 4) requires 6 captures
      { plot: 5, capturesNeeded: 10 }  // Sixth plot (index 5) requires 10 captures
    ]
  },
  
  // Victory conditions
  wheatVictoryAmount: 200,
  
  // Game progression
  turnsPerGrowthStage: 1,
  
  // UI settings
  notificationDuration: 3000, // milliseconds
};

// This will be updated when config changes and tracked for change detection
let configVersion = 1;

// Function to get the current config
function getConfig() {
  return {
    config: gameConfig,
    version: configVersion
  };
}

// Function to update config values
function updateConfig(updates) {
  // Apply updates to the config
  applyUpdates(gameConfig, updates);
  
  // Increment version to track changes
  configVersion++;
  
  return {
    config: gameConfig,
    version: configVersion
  };
}

// Helper function to recursively apply updates to the config object
function applyUpdates(target, updates) {
  for (const key in updates) {
    // If the update value is an object and the target has that key as an object too
    if (typeof updates[key] === 'object' && 
        updates[key] !== null && 
        typeof target[key] === 'object' &&
        target[key] !== null) {
      // Recursively update nested object
      applyUpdates(target[key], updates[key]);
    } else {
      // Directly update value
      target[key] = updates[key];
    }
  }
}

module.exports = {
  getConfig,
  updateConfig
}; 