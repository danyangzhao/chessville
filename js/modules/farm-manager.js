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
      if (!plot.crop) {
        console.error('Plot is in planted state but crop data is missing', plot);
        plotElement.innerHTML = `<div class="error">Error: Missing crop data</div>`;
        return plotElement;
      }
      
      // Use the correct property names and provide fallbacks
      const cropName = plot.crop.name || plot.crop.type || 'Crop';
      const cropEmoji = plot.crop.emoji || '🌱';
      const turnsTillHarvest = plot.crop.turnsTillHarvest || plot.turnsToHarvest || 0;
      
      // Get the growth stage
      const growthClass = getGrowthClass(plot.turnsToHarvest, turnsTillHarvest);
      
      plotElement.innerHTML = `
        <div class="plant ${growthClass}">${cropEmoji}</div>
        <div class="crop-name">${cropName}</div>
        <div class="growth-info">${plot.turnsToHarvest} turns</div>
      `;
    } else if (plot.state === 'ready') {
      // Ready to harvest
      if (!plot.crop) {
        console.error('Plot is in ready state but crop data is missing', plot);
        plotElement.innerHTML = `<div class="error">Error: Missing crop data</div>`;
        return plotElement;
      }
      
      // Use the correct property names and provide fallbacks
      const cropName = plot.crop.name || plot.crop.type || 'Crop';
      const cropEmoji = plot.crop.emoji || '🌱';
      
      plotElement.innerHTML = `
        <div class="plant mature">${cropEmoji}</div>
        <div class="crop-name">${cropName}</div>
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
    console.log(`Attempting to plant crop in plot ${plotIndex} for ${playerColor}`);
    console.log('Crop data:', cropData);
    
    // First check if it's the player's turn and correct phase
    if (!canPerformFarmAction()) {
      const reason = !GameState.isPlayerTurn() ? "It's not your turn" : 
                     GameState.getCurrentGamePhase() !== 'farming' ? "Not in farming phase" :
                     "Farm action already taken";
      console.error(`Cannot plant crop: ${reason}`);
      showMessage(`Cannot plant crop: ${reason}`);
      return false;
    }
    
    // Then check if it's the player's farm
    if (!isPlayersFarm(playerColor)) {
      console.error(`Cannot plant crop: Not ${playerColor}'s farm`);
      return false;
    }
    
    // Then check if the plot is available
    if (!isPlotAvailable(playerColor, plotIndex)) {
      console.error(`Cannot plant crop: Plot ${plotIndex} is not available`);
      return false;
    }
    
    // Finally check if the crop data is valid
    if (!cropData || !cropData.type) {
      console.error('Cannot plant crop: Invalid crop data');
      return false;
    }
    
    // Check if player has enough resources
    const seedCost = cropData.cost || 1;
    if (!GameState.updateWheat(playerColor, -seedCost)) {
      console.error(`Not enough wheat to plant crop (required: ${seedCost})`);
      showMessage(`Not enough wheat to plant crop (required: ${seedCost})`);
      return false;
    }
    
    // Update farm state - FIXING: Store complete crop object with proper property names
    farms[playerColor].plots[plotIndex] = {
      id: `${playerColor}-plot-${plotIndex}`,
      index: plotIndex,
      state: 'planted',
      crop: {
        type: cropData.type,
        name: cropData.name,
        emoji: cropData.emoji,
        turnsTillHarvest: cropData.growthTime,
        yield: cropData.yield,
        cost: cropData.cost
      },
      turnsToHarvest: cropData.growthTime
    };
    
    // Register the farm action - this marks that the player has taken an action this turn
    GameState.registerFarmAction();
    
    // Update UI
    displayFarms();
    
    // Notify the server
    SocketManager.sendPlantCrop(plotIndex, cropData.type);
    
    showMessage(`Planted ${cropData.name} in plot ${plotIndex+1}`);
    
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
    
    // Make sure we have a valid yield value from the crop
    const yieldAmount = cropData.yield || cropData.harvestYield || 15; // Default to 15 if missing
    
    // Update player's wheat
    const playerColor = GameState.getPlayerColor();
    const previousWheat = GameState.getWheat(playerColor);
    
    // Add logging to debug harvest issue
    console.log(`Before harvest: Player ${playerColor} has ${previousWheat} wheat`);
    console.log(`Harvesting ${cropData.name || cropData.type} with yield ${yieldAmount}`);
    
    // Update wheat with yield amount
    if (!GameState.updateWheat(playerColor, yieldAmount)) {
      console.error(`Failed to update wheat for player ${playerColor}`);
    }
    
    // Verify the wheat was actually added
    const newWheat = GameState.getWheat(playerColor);
    console.log(`After harvest: Player ${playerColor} has ${newWheat} wheat (expected: ${previousWheat + yieldAmount})`);
    
    // Clear the plot
    plot.state = 'empty';
    plot.crop = null;
    plot.turnsToHarvest = 0;
    
    console.log(`Harvested ${cropData.name || cropData.type} from plot ${plotId}, gained ${yieldAmount} wheat`);
    showMessage(`Harvested ${cropData.name || cropData.type} for ${yieldAmount} wheat`);
    
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
    console.log('Processing farm turn for all plots');
    
    // Process white player's plots
    farms.white.plots.forEach(plot => {
      if (plot.state === 'planted' && plot.turnsToHarvest > 0) {
        console.log(`Processing white plot ${plot.id}: turnsToHarvest before: ${plot.turnsToHarvest}`);
        plot.turnsToHarvest--;
        console.log(`Plot ${plot.id} turns to harvest now: ${plot.turnsToHarvest}`);
        
        // Check if the crop is ready for harvest
        if (plot.turnsToHarvest <= 0) {
          plot.state = 'ready';
          console.log(`Crop in plot ${plot.id} is ready for harvest`);
          
          // Automatically harvest crops that are ready for white player
          autoHarvestCrop(plot, 'white');
        }
      }
    });
    
    // Process black player's plots
    farms.black.plots.forEach(plot => {
      if (plot.state === 'planted' && plot.turnsToHarvest > 0) {
        console.log(`Processing black plot ${plot.id}: turnsToHarvest before: ${plot.turnsToHarvest}`);
        plot.turnsToHarvest--;
        console.log(`Plot ${plot.id} turns to harvest now: ${plot.turnsToHarvest}`);
        
        // Check if the crop is ready for harvest
        if (plot.turnsToHarvest <= 0) {
          plot.state = 'ready';
          console.log(`Crop in plot ${plot.id} is ready for harvest`);
          
          // Automatically harvest crops that are ready for black player
          autoHarvestCrop(plot, 'black');
        }
      }
    });
    
    // Update the farm display
    updateFarmDisplay();
  }
  
  /**
   * Get the current state of the farm system for debugging
   * @returns {Object} The current state of the farms
   */
  function getState() {
    const whitePlots = farms.white.plots.map(plot => ({
      id: plot.id,
      state: plot.state,
      turnsToHarvest: plot.turnsToHarvest,
      crop: plot.crop ? {
        name: plot.crop.name || plot.crop.type,
        yield: plot.crop.yield || plot.crop.harvestYield || 15
      } : null
    }));
    
    const blackPlots = farms.black.plots.map(plot => ({
      id: plot.id,
      state: plot.state,
      turnsToHarvest: plot.turnsToHarvest,
      crop: plot.crop ? {
        name: plot.crop.name || plot.crop.type,
        yield: plot.crop.yield || plot.crop.harvestYield || 15
      } : null
    }));
    
    return {
      whiteWheat: GameState.getWheat('white'),
      blackWheat: GameState.getWheat('black'),
      whitePlots,
      blackPlots
    };
  }
  
  /**
   * Automatically harvest a crop that is ready
   * @param {Object} plot - The plot object
   * @param {string} playerColor - The color of the player who owns the plot
   */
  function autoHarvestCrop(plot, playerColor) {
    if (plot.state !== 'ready' || !plot.crop) {
      console.log(`Cannot auto-harvest plot ${plot.id}: state=${plot.state}, has crop=${!!plot.crop}`);
      return; // Not ready for harvest or no crop data
    }
    
    console.log(`Auto-harvesting crop from plot ${plot.id} for ${playerColor}`);
    
    try {
      // Get the crop data
      const cropData = plot.crop;
      
      if (!cropData) {
        console.error(`Crop data is missing from plot ${plot.id}`);
        return;
      }
      
      // Make sure we have a valid yield value from the crop
      // Improved yield extraction with multiple fallbacks and detailed logging
      let yieldAmount = 15; // Default fallback yield
      
      if (typeof cropData.yield === 'number') {
        yieldAmount = cropData.yield;
        console.log(`Using crop.yield value: ${yieldAmount}`);
      } else if (typeof cropData.harvestYield === 'number') {
        yieldAmount = cropData.harvestYield;
        console.log(`Using crop.harvestYield value: ${yieldAmount}`);
      } else if (typeof cropData.baseYield === 'number') {
        yieldAmount = cropData.baseYield;
        console.log(`Using crop.baseYield value: ${yieldAmount}`);
      } else {
        console.warn(`No yield property found in crop data, using default value: ${yieldAmount}`);
        console.log('Crop data:', JSON.stringify(cropData));
      }
      
      // Update player's wheat
      const previousWheat = GameState.getWheat(playerColor);
      
      // Add logging to debug auto-harvest
      console.log(`Before auto-harvest: Player ${playerColor} has ${previousWheat} wheat`);
      console.log(`Auto-harvesting ${cropData.name || cropData.type || 'unknown crop'} with yield ${yieldAmount}`);
      
      // Update wheat with yield amount - ENSURE THIS GOES THROUGH
      if (!GameState.updateWheat(playerColor, yieldAmount)) {
        console.error(`Failed to update wheat for player ${playerColor} during auto-harvest`);
        // Try forcibly updating the wheat
        try {
          // Direct update to ensure wheat is added
          const resources = GameState.getResources ? GameState.getResources() : null;
          if (resources && resources[playerColor]) {
            resources[playerColor].wheat += yieldAmount;
            console.log(`Forcibly updated ${playerColor} player wheat: ${resources[playerColor].wheat}`);
            // Update UI after forced update
            if (typeof UIManager !== 'undefined' && UIManager.updateResourceDisplay) {
              UIManager.updateResourceDisplay();
            }
          }
        } catch (error) {
          console.error('Error during forced wheat update:', error);
        }
        return;
      }
      
      // Verify the wheat was actually added
      const newWheat = GameState.getWheat(playerColor);
      console.log(`After auto-harvest: Player ${playerColor} has ${newWheat} wheat (expected: ${previousWheat + yieldAmount})`);
      
      // Clear the plot
      plot.state = 'empty';
      plot.crop = null;
      plot.turnsToHarvest = 0;
      
      console.log(`Auto-harvested ${cropData.name || cropData.type || 'unknown crop'} from plot ${plot.id}, ${playerColor} gained ${yieldAmount} wheat`);
      
      // Send the update to the server
      if (typeof SocketManager !== 'undefined' && SocketManager.sendFarmUpdate) {
        SocketManager.sendFarmUpdate('harvest', {
          plotId: plot.id
        });
      }
    } catch (error) {
      console.error(`Error during auto-harvest for plot ${plot.id}:`, error);
    }
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
    
    // Determine the player color from plot ID
    const playerColor = plotId.startsWith('white-') ? 'white' : 'black';
    const plotIndex = parseInt(plotId.split('-').pop());
    
    // Plant the crop - store with consistent data structure
    plot.state = 'planted';
    plot.crop = {
      type: cropType,
      name: cropData.name,
      emoji: cropData.emoji,
      turnsTillHarvest: cropData.turnsTillHarvest,
      yield: cropData.yield,
      cost: cropData.cost
    };
    plot.turnsToHarvest = cropData.turnsTillHarvest;
    
    console.log(`Opponent planted ${cropData.name} in plot ${plotId}`);
    
    // Update farm display to reflect changes
    updateFarmDisplay();
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
    
    // Update farm display to reflect changes
    updateFarmDisplay();
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
  
  /**
   * Process a farm action received from the server
   * @param {Object} action - The action object containing type and data
   */
  function processFarmAction(action) {
    console.log('Processing farm action from server:', action);
    
    if (!action || !action.action || !action.data) {
      console.error('Invalid farm action received:', action);
      return;
    }
    
    // Handle different action types
    switch (action.action) {
      case 'plant':
        processFarmUpdatePlant(action.data);
        break;
      case 'harvest':
        processFarmUpdateHarvest(action.data);
        break;
      case 'unlock':
        processFarmUpdateUnlock(action.data);
        break;
      default:
        console.warn(`Unknown farm action type: ${action.action}`);
    }
    
    // Update the farm display
    updateFarmDisplay();
    
    // Update resources
    UIManager.updateResourceDisplay();
  }
  
  /**
   * Check if a farm belongs to the player
   * @param {string} playerColor - The player color
   * @returns {boolean} True if the farm belongs to the player
   */
  function isPlayersFarm(playerColor) {
    return playerColor === GameState.getPlayerColor();
  }
  
  /**
   * Check if a plot is available for planting
   * @param {string} playerColor - The player color
   * @param {number} plotIndex - The plot index
   * @returns {boolean} True if the plot is available
   */
  function isPlotAvailable(playerColor, plotIndex) {
    if (!farms[playerColor] || !farms[playerColor].plots[plotIndex]) {
      return false;
    }
    
    return farms[playerColor].plots[plotIndex].state === 'empty';
  }
  
  /**
   * Display the updated farms in the UI
   * This is an alias for updateFarmDisplay for backward compatibility
   */
  function displayFarms() {
    updateFarmDisplay();
  }
  
  /**
   * Update farms data from server
   * @param {Object} serverFarms - The farms data from the server
   */
  function updateFarmsFromServer(serverFarms) {
    console.log('Updating farms from server:', serverFarms);
    
    // Update white farm data
    if (serverFarms.white) {
      // Update wheat
      if (typeof serverFarms.white.wheat === 'number') {
        farms.white.wheat = serverFarms.white.wheat;
      }
      
      // Update plots
      if (Array.isArray(serverFarms.white.plots)) {
        farms.white.plots = serverFarms.white.plots.map(plot => ({
          ...plot,
          // Ensure the plot has an id if not provided
          id: plot.id || `white-plot-${plot.index || 0}`
        }));
      }
    }
    
    // Update black farm data
    if (serverFarms.black) {
      // Update wheat
      if (typeof serverFarms.black.wheat === 'number') {
        farms.black.wheat = serverFarms.black.wheat;
      }
      
      // Update plots
      if (Array.isArray(serverFarms.black.plots)) {
        farms.black.plots = serverFarms.black.plots.map(plot => ({
          ...plot,
          // Ensure the plot has an id if not provided
          id: plot.id || `black-plot-${plot.index || 0}`
        }));
      }
    }
    
    // Update the farm display to reflect changes
    updateFarmDisplay();
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
    processFarmUpdate,
    updateFarmsFromServer,
    processFarmAction,
    getState
  };
})(); 