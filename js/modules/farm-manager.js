/**
 * Farm Manager Module
 * Handles all farm-related functionality for the game
 */
const FarmManager = (function() {
  // Private variables
  let initialized = false;
  
  // Farm state
  const farms = {
    white: {
      plots: [],
      unlockedPlots: GameConfig.farmConfig.startingUnlockedPlots
    },
    black: {
      plots: [],
      unlockedPlots: GameConfig.farmConfig.startingUnlockedPlots
    }
  };
  
  /**
   * Initialize the Farm Manager
   * @returns {boolean} True if initialization was successful
   */
  function initialize() {
    if (initialized) {
      console.warn('Farm Manager already initialized');
      return true;
    }
    
    try {
      console.log('Initializing Farm Manager');
      
      // Initialize farms
      initializeFarmState('white');
      initializeFarmState('black');
      
      console.log('Farm Manager initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Farm Manager:', error);
      return false;
    }
  }
  
  /**
   * Initialize the farm state for a player
   * @param {string} playerColor - The player color ('white' or 'black')
   */
  function initializeFarmState(playerColor) {
    if (!farms[playerColor]) {
      console.error(`Invalid player color: ${playerColor}`);
      return;
    }
    
    // Create the farm plots
    farms[playerColor].plots = [];
    
    for (let i = 0; i < GameConfig.farmConfig.totalPlots; i++) {
      // Determine if the plot is locked or empty
      const plotState = i < GameConfig.farmConfig.startingUnlockedPlots ? 'empty' : 'locked';
      
      farms[playerColor].plots.push({
        id: `${playerColor}-plot-${i}`,
        index: i,
        state: plotState,
        crop: null,
        turnsToHarvest: 0,
        unlockRequirement: i >= GameConfig.farmConfig.startingUnlockedPlots 
          ? GameConfig.farmConfig.plotUnlockRequirements[i - GameConfig.farmConfig.startingUnlockedPlots] 
          : 0
      });
    }
    
    console.log(`Farm state initialized for ${playerColor} player`);
  }
  
  /**
   * Initialize the farm display in the UI
   */
  function initializeFarmDisplay() {
    const player1FarmElement = document.getElementById('player1-farm');
    const player2FarmElement = document.getElementById('player2-farm');
    
    if (!player1FarmElement || !player2FarmElement) {
      console.error('Farm elements not found');
      return;
    }
    
    // Clear the farm displays
    player1FarmElement.innerHTML = '';
    player2FarmElement.innerHTML = '';
    
    // Create the farm plots for white player
    farms.white.plots.forEach(plot => {
      const plotElement = createPlotElement(plot);
      player1FarmElement.appendChild(plotElement);
    });
    
    // Create the farm plots for black player
    farms.black.plots.forEach(plot => {
      const plotElement = createPlotElement(plot);
      player2FarmElement.appendChild(plotElement);
    });
    
    // Add event listeners to the plots
    addPlotEventListeners();
    
    console.log('Farm display initialized');
  }
  
  /**
   * Create a farm plot element
   * @param {Object} plot - The plot data
   * @returns {HTMLElement} The created plot element
   */
  function createPlotElement(plot) {
    const plotElement = document.createElement('div');
    plotElement.id = plot.id;
    plotElement.className = `farm-plot ${plot.state}`;
    plotElement.setAttribute('data-plot-index', plot.index);
    
    // Add content based on the plot state
    if (plot.state === 'locked') {
      // Locked plot
      plotElement.innerHTML = `
        <div class="locked-info">Locked</div>
        <div class="locked-info">Need ${plot.unlockRequirement} captures</div>
      `;
    } else if (plot.state === 'unlockable') {
      // Unlockable plot
      plotElement.innerHTML = `
        <button class="unlock-plot-button" data-plot-id="${plot.id}">Unlock</button>
      `;
    } else if (plot.state === 'planted') {
      // Planted plot with crop
      const growthClass = getGrowthClass(plot.turnsToHarvest, plot.crop.turnsTillHarvest);
      plotElement.innerHTML = `
        <div class="plant ${growthClass}">${plot.crop.emoji}</div>
        <div class="growth-info">${plot.turnsToHarvest} turns</div>
      `;
    } else if (plot.state === 'ready') {
      // Ready to harvest
      plotElement.innerHTML = `
        <div class="plant mature">${plot.crop.emoji}</div>
        <button class="harvest-button" data-plot-id="${plot.id}">Harvest</button>
      `;
    } else {
      // Empty plot
      plotElement.innerHTML = `
        <button class="plant-button" data-plot-id="${plot.id}">Plant</button>
      `;
    }
    
    return plotElement;
  }
  
  /**
   * Add event listeners to the farm plots
   */
  function addPlotEventListeners() {
    // Plant buttons
    const plantButtons = document.querySelectorAll('.plant-button');
    plantButtons.forEach(button => {
      button.addEventListener('click', function() {
        const plotId = this.getAttribute('data-plot-id');
        if (canPerformFarmAction()) {
          UIManager.showPlantSelector(plotId);
        } else {
          showMessage('You cannot plant now');
        }
      });
    });
    
    // Harvest buttons
    const harvestButtons = document.querySelectorAll('.harvest-button');
    harvestButtons.forEach(button => {
      button.addEventListener('click', function() {
        const plotId = this.getAttribute('data-plot-id');
        if (canPerformFarmAction()) {
          harvestCrop(plotId);
        } else {
          showMessage('You cannot harvest now');
        }
      });
    });
    
    // Unlock plot buttons
    const unlockButtons = document.querySelectorAll('.unlock-plot-button');
    unlockButtons.forEach(button => {
      button.addEventListener('click', function() {
        const plotId = this.getAttribute('data-plot-id');
        if (canPerformFarmAction()) {
          unlockPlot(plotId);
        } else {
          showMessage('You cannot unlock plots now');
        }
      });
    });
  }
  
  /**
   * Check if the player can perform a farm action
   * @returns {boolean} True if the player can perform a farm action
   */
  function canPerformFarmAction() {
    return GameState.isPlayerTurn() && 
           GameState.getCurrentGamePhase() === 'farming' && 
           !GameState.hasFarmActionBeenTaken();
  }
  
  /**
   * Get the growth class based on turns to harvest
   * @param {number} turnsToHarvest - The turns to harvest
   * @param {number} totalTurns - The total turns for growth
   * @returns {string} The growth class
   */
  function getGrowthClass(turnsToHarvest, totalTurns) {
    if (turnsToHarvest <= 0) {
      return 'mature';
    }
    
    const growthProgress = (totalTurns - turnsToHarvest) / totalTurns;
    
    if (growthProgress < 0.33) {
      return 'seedling';
    } else if (growthProgress < 0.66) {
      return 'growing';
    } else {
      return 'mature';
    }
  }
  
  /**
   * Plant a crop in a plot
   * @param {string} playerColor - Color of the player
   * @param {number} plotIndex - Index of the plot
   * @param {Object} cropData - Data for the crop to plant
   * @returns {boolean} - Whether the planting was successful
   */
  function plantCrop(playerColor, plotIndex, cropData) {
    console.log(`Planting crop in plot ${plotIndex} for ${playerColor}`);
    console.log('Crop data:', cropData);
    
    if (!isPlayersFarm(playerColor)) {
      console.error(`Cannot plant crop: Not ${playerColor}'s farm`);
      return false;
    }
    
    if (!isPlotAvailable(playerColor, plotIndex)) {
      console.error(`Cannot plant crop: Plot ${plotIndex} is not available`);
      return false;
    }
    
    if (!cropData || !cropData.type) {
      console.error('Cannot plant crop: Invalid crop data');
      return false;
    }
    
    // Check if player has enough resources
    const seedCost = cropData.seedCost || 1;
    if (!GameState.updateSeeds(playerColor, -seedCost)) {
      console.error(`Not enough seeds to plant crop (required: ${seedCost})`);
      showMessage(`Not enough seeds to plant crop (required: ${seedCost})`);
      return false;
    }
    
    // Update farm state
    farms[playerColor].plots[plotIndex] = {
      state: 'planted',
      crop: cropData.type,
      growthStage: 0,
      maxGrowthStage: cropData.growthTime || 3,
      timeToHarvest: cropData.growthTime || 3,
      yield: cropData.yield || 1
    };
    
    // Update UI
    displayFarms();
    
    // Notify the server
    SocketManager.sendPlantCrop(plotIndex, cropData.type);
    
    showMessage(`Planted ${cropData.type} in plot ${plotIndex+1}`);
    
    // Auto-skip to chess phase after planting
    setTimeout(() => {
      GameState.skipCurrentGamePhase();
      showMessage('Automatically skipping to chess phase after planting');
    }, 500); // Small delay for better user experience
    
    return true;
  }
  
  /**
   * Harvest a crop from a plot
   * @param {string} plotId - The ID of the plot to harvest
   */
  function harvestCrop(plotId) {
    // Check if player can perform a farm action
    if (!canPerformFarmAction()) {
      showMessage('You cannot harvest now');
      return;
    }
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Check if the plot is ready for harvest
    if (plot.state !== 'ready') {
      console.warn(`Plot ${plotId} is not ready for harvest`);
      showMessage('This crop is not ready for harvest');
      return;
    }
    
    // Get the crop data
    const cropData = plot.crop;
    if (!cropData) {
      console.error(`Crop data not found for plot ${plotId}`);
      return;
    }
    
    // Update player's wheat
    const playerColor = GameState.getPlayerColor();
    GameState.updateWheat(playerColor, cropData.yield);
    
    // Clear the plot
    plot.state = 'empty';
    plot.crop = null;
    plot.turnsToHarvest = 0;
    
    console.log(`Harvested ${cropData.name} from plot ${plotId}, gained ${cropData.yield} wheat`);
    showMessage(`Harvested ${cropData.name} for ${cropData.yield} wheat`);
    
    // Register the farm action
    GameState.registerFarmAction();
    
    // Update the farm display
    updateFarmDisplay();
    
    // Send the update to the server
    SocketManager.sendFarmUpdate('harvest', {
      plotId: plotId
    });
  }
  
  /**
   * Unlock a plot
   * @param {string} plotId - The ID of the plot to unlock
   */
  function unlockPlot(plotId) {
    // Check if player can perform a farm action
    if (!canPerformFarmAction()) {
      showMessage('You cannot unlock plots now');
      return;
    }
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Check if the plot is unlockable
    if (plot.state !== 'unlockable') {
      console.warn(`Plot ${plotId} is not unlockable`);
      showMessage('This plot cannot be unlocked yet');
      return;
    }
    
    // Get the player color from the plot ID
    const playerColor = plotId.startsWith('white') ? 'white' : 'black';
    
    // Unlock the plot
    plot.state = 'empty';
    farms[playerColor].unlockedPlots++;
    
    console.log(`Unlocked plot ${plotId}`);
    showMessage('Plot unlocked');
    
    // Register the farm action
    GameState.registerFarmAction();
    
    // Update the farm display
    updateFarmDisplay();
    
    // Send the update to the server
    SocketManager.sendFarmUpdate('unlock', {
      plotId: plotId
    });
  }
  
  /**
   * Get a plot by its ID
   * @param {string} plotId - The ID of the plot
   * @returns {Object|null} The plot object, or null if not found
   */
  function getPlotById(plotId) {
    // Check white player's plots
    for (const plot of farms.white.plots) {
      if (plot.id === plotId) {
        return plot;
      }
    }
    
    // Check black player's plots
    for (const plot of farms.black.plots) {
      if (plot.id === plotId) {
        return plot;
      }
    }
    
    return null;
  }
  
  /**
   * Check if a player has unlockable plots based on the number of captures
   * @param {string} playerColor - The player color
   */
  function checkUnlockPlot(playerColor) {
    if (!farms[playerColor]) {
      console.error(`Invalid player color: ${playerColor}`);
      return;
    }
    
    const captures = GameState.getCapturedPieces(playerColor);
    const farmPlots = farms[playerColor].plots;
    
    // Check if there are any locked plots
    for (let i = 0; i < farmPlots.length; i++) {
      const plot = farmPlots[i];
      
      if (plot.state === 'locked' && plot.unlockRequirement <= captures) {
        // Update the plot to unlockable
        plot.state = 'unlockable';
        console.log(`Plot ${plot.id} is now unlockable with ${captures} captures`);
        
        // Show a message to the player
        if (playerColor === GameState.getPlayerColor()) {
          showMessage('New farm plot available!');
        }
        
        break; // Only unlock one plot at a time
      }
    }
    
    // Update the farm display
    updateFarmDisplay();
  }
  
  /**
   * Process turns for all farm plots
   * Reduces growth time for planted crops
   */
  function processTurn() {
    // Process white player's plots
    farms.white.plots.forEach(plot => {
      if (plot.state === 'planted' && plot.turnsToHarvest > 0) {
        plot.turnsToHarvest--;
        
        // Check if the crop is ready for harvest
        if (plot.turnsToHarvest <= 0) {
          plot.state = 'ready';
          console.log(`Crop in plot ${plot.id} is ready for harvest`);
        }
      }
    });
    
    // Process black player's plots
    farms.black.plots.forEach(plot => {
      if (plot.state === 'planted' && plot.turnsToHarvest > 0) {
        plot.turnsToHarvest--;
        
        // Check if the crop is ready for harvest
        if (plot.turnsToHarvest <= 0) {
          plot.state = 'ready';
          console.log(`Crop in plot ${plot.id} is ready for harvest`);
        }
      }
    });
    
    // Update the farm display
    updateFarmDisplay();
  }
  
  /**
   * Update the farm display in the UI
   */
  function updateFarmDisplay() {
    const player1FarmElement = document.getElementById('player1-farm');
    const player2FarmElement = document.getElementById('player2-farm');
    
    if (!player1FarmElement || !player2FarmElement) {
      console.error('Farm elements not found');
      return;
    }
    
    // Clear the farm displays
    player1FarmElement.innerHTML = '';
    player2FarmElement.innerHTML = '';
    
    // Create the farm plots for white player
    farms.white.plots.forEach(plot => {
      const plotElement = createPlotElement(plot);
      player1FarmElement.appendChild(plotElement);
    });
    
    // Create the farm plots for black player
    farms.black.plots.forEach(plot => {
      const plotElement = createPlotElement(plot);
      player2FarmElement.appendChild(plotElement);
    });
    
    // Add event listeners to the plots
    addPlotEventListeners();
  }
  
  /**
   * Process a farm update from the server
   * @param {string} action - The action type ('plant', 'harvest', 'unlock')
   * @param {Object} data - The action data
   */
  function processFarmUpdate(action, data) {
    console.log(`Processing farm update: ${action}`, data);
    
    switch (action) {
      case 'plant':
        processFarmUpdatePlant(data);
        break;
      case 'harvest':
        processFarmUpdateHarvest(data);
        break;
      case 'unlock':
        processFarmUpdateUnlock(data);
        break;
      default:
        console.warn(`Unknown farm update action: ${action}`);
    }
    
    // Update the farm display
    updateFarmDisplay();
  }
  
  /**
   * Process a 'plant' farm update from the server
   * @param {Object} data - The action data
   */
  function processFarmUpdatePlant(data) {
    const { plotId, cropType } = data;
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Get the crop data
    const cropData = GameConfig.crops[cropType];
    if (!cropData) {
      console.error(`Crop type not found: ${cropType}`);
      return;
    }
    
    // Plant the crop
    plot.state = 'planted';
    plot.crop = cropData;
    plot.turnsToHarvest = cropData.turnsTillHarvest;
    
    console.log(`Opponent planted ${cropData.name} in plot ${plotId}`);
  }
  
  /**
   * Process a 'harvest' farm update from the server
   * @param {Object} data - The action data
   */
  function processFarmUpdateHarvest(data) {
    const { plotId } = data;
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Clear the plot
    plot.state = 'empty';
    plot.crop = null;
    plot.turnsToHarvest = 0;
    
    console.log(`Opponent harvested crop from plot ${plotId}`);
  }
  
  /**
   * Process an 'unlock' farm update from the server
   * @param {Object} data - The action data
   */
  function processFarmUpdateUnlock(data) {
    const { plotId } = data;
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Get the player color from the plot ID
    const playerColor = plotId.startsWith('white') ? 'white' : 'black';
    
    // Unlock the plot
    plot.state = 'empty';
    farms[playerColor].unlockedPlots++;
    
    console.log(`Opponent unlocked plot ${plotId}`);
  }
  
  // Public API
  return {
    initialize,
    initializeFarmDisplay,
    plantCrop,
    harvestCrop,
    unlockPlot,
    checkUnlockPlot,
    processTurn,
    updateFarmDisplay,
    processFarmUpdate
  };
})(); 