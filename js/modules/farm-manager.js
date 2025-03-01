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
  
  // Use GameConfig.crops as the single source of truth
  const CROPS = GameConfig.crops;
  
  /**
   * Standardizes crop data to ensure consistent property names
   * @param {Object} cropData - The crop data to standardize
   * @returns {Object} - Standardized crop data object
   */
  function standardizeCropData(cropData) {
    if (!cropData) return null;
    
    return {
      type: cropData.type,
      name: cropData.name || (cropData.type ? cropData.type.charAt(0).toUpperCase() + cropData.type.slice(1) : 'Crop'),
      cost: cropData.seedCost || cropData.cost || 5,
      growthTime: cropData.growthTime || cropData.turnsTillHarvest || 2,
      yield: cropData.harvestYield || cropData.yield || 15,
      emoji: cropData.emoji || "🌾"
    };
  }
  
  /**
   * Prepares crop data for planting using the game config as source of truth
   * @param {string} cropType - The type of crop to prepare
   * @returns {Object} - Standardized crop data ready for planting
   */
  function prepareCropForPlanting(cropType) {
    // Get crop data from the game config
    const configCrop = GameConfig.crops[cropType];
    if (!configCrop) {
      console.error(`Unknown crop type: ${cropType}`);
      return null;
    }
    
    // Create a standardized crop object with consistent property names
    return standardizeCropData({
      type: cropType,
      name: configCrop.name,
      cost: configCrop.cost,
      growthTime: configCrop.turnsTillHarvest,
      yield: configCrop.yield,
      emoji: configCrop.emoji
    });
  }
  
  // Plot states enum
  const PLOT_STATE = {
    EMPTY: 'empty',
    PLANTED: 'planted',
    GROWING: 'growing',
    READY: 'ready',
    LOCKED: 'locked'
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
      
      // Add CSS for turns and ready indicators
      const style = document.createElement('style');
      style.textContent = `
        .farm-plot .turns-indicator {
          position: absolute;
          bottom: 5px;
          right: 5px;
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          z-index: 5;
        }
        
        .farm-plot .ready-indicator {
          position: absolute;
          top: 5px;
          right: 5px;
          background-color: rgba(0, 255, 0, 0.7);
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          z-index: 5;
        }
      `;
      document.head.appendChild(style);
      
      // Initialize farms
      initializeFarmState('white');
      initializeFarmState('black');
      
      // Initialize farm displays
      initializeFarmDisplay();
      
      console.log('Farm Manager initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Farm Manager:', error);
      return false;
    }
  }
  
  // Create an alias of initialize as initializeModule for backward compatibility
  const initializeModule = initialize;
  
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
        plantedTurn: null,
        turnsToHarvest: null,
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
        <div class="growth-info">${plot.turnsToHarvest} turns to harvest</div>
      `;
    } else if (plot.state === 'ready') {
      // Ready to harvest - no longer showing harvest button since harvesting is automatic
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
        <div class="ready-for-harvest">✓ Ready for auto-harvest</div>
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
      button.addEventListener('click', handlePlantButtonClick);
    });
    
    console.log('Added event listeners to farm plot buttons');
  }
  
  /**
   * Check if the player can perform a farm action
   * @param {boolean} wasJustHarvested - Optional flag to indicate if the plot was just harvested
   * @returns {boolean} True if the player can perform a farm action
   */
  function canPerformFarmAction(wasJustHarvested) {
    return GameState.isPlayerTurn() && 
           GameState.getCurrentGamePhase() === 'farming' && 
           (wasJustHarvested || !GameState.hasFarmActionBeenTaken());
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
    
    // Get the plot
    const plot = farms[playerColor].plots[plotIndex];
    
    // Check if this plot was just auto-harvested this turn and can be immediately planted on
    const wasJustHarvested = plot && plot.canPlantAfterHarvest === true;
    
    // First check if it's the player's turn and correct phase
    // If the plot was just auto-harvested, bypass the farm action taken check
    if (!(GameState.isPlayerTurn() && 
          GameState.getCurrentGamePhase() === 'farming' && 
          (wasJustHarvested || !GameState.hasFarmActionBeenTaken()))) {
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
    
    // Standardize the crop data to ensure consistent property names
    const standardizedCrop = standardizeCropData(cropData);
    
    // Check if player has enough resources
    const seedCost = standardizedCrop.cost;
    if (!GameState.updateWheat(playerColor, -seedCost)) {
      console.error(`Not enough wheat to plant crop (required: ${seedCost})`);
      showMessage(`Not enough wheat to plant crop (required: ${seedCost})`);
      return false;
    }
    
    // Update farm state with standardized crop data
    farms[playerColor].plots[plotIndex] = {
      id: `${playerColor}-plot-${plotIndex}`,
      index: plotIndex,
      state: 'planted',
      crop: standardizedCrop,
      plantedTurn: GameState.getCurrentTurn(),
      turnsToHarvest: standardizedCrop.growthTime,
      player: playerColor, // Add player color for auto-harvest
      canPlantAfterHarvest: false // Reset this flag
    };
    
    console.log(`Planted ${standardizedCrop.name} in plot ${plotIndex+1} with growth time ${standardizedCrop.growthTime}`);
    console.log(`Plot ${playerColor}-plot-${plotIndex} turnsToHarvest set to: ${standardizedCrop.growthTime}`);
    
    // Register the farm action - this marks that the player has taken an action this turn
    // Only register if this wasn't planting after auto-harvest
    if (!wasJustHarvested) {
      GameState.registerFarmAction();
    } else {
      console.log('Planting on just-harvested plot - not counting as a new farm action');
    }
    
    // Update UI
    displayFarms();
    
    // Notify the server
    SocketManager.sendPlantCrop(plotIndex, standardizedCrop.type);
    
    showMessage(`Planted ${standardizedCrop.name} in plot ${plotIndex+1}`);
    
    // Auto-skip to chess phase after planting
    setTimeout(() => {
      GameState.skipCurrentGamePhase();
      showMessage('Automatically skipping to chess phase after planting');
    }, 500); // Small delay for better user experience
    
    return true;
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
        // Directly unlock the plot instead of marking it as unlockable
        plot.state = 'empty';
        farms[playerColor].unlockedPlots++;
        
        console.log(`Plot ${plot.id} automatically unlocked with ${captures} captures`);
        
        // Show a message to the player
        if (playerColor === GameState.getPlayerColor()) {
          showMessage('New farm plot unlocked!');
          
          // Send the update to the server to inform other players
          SocketManager.sendAutoUnlock(plot.id);
        }
        
        break; // Only unlock one plot at a time
      }
    }
    
    // Update the farm display
    updateFarmDisplay();
  }
  
  /**
   * Process turns for all farm plots and manage crop growth
   */
  function processTurn() {
    console.log('FarmManager.processTurn(): STARTING PROCESSING OF ALL FARM PLOTS');
    
    try {
      // Log farm state before processing
      const currentTurn = GameState.getCurrentTurn();
      const currentPhase = GameState.getCurrentGamePhase();
      console.log(`Current game turn: ${currentTurn}, Phase: ${currentPhase}`);
      
      // If this is the beginning of a farming phase, check for ready crops immediately
      const isBeginningOfFarmPhase = GameState.isPlayerTurn() && currentPhase === 'farming';
      if (isBeginningOfFarmPhase) {
        console.log('Beginning of farm phase detected - checking for ready crops to auto-harvest');
      }
      
      let harvestedCrops = 0;
      
      // Process white player plots ONLY if it's white's turn and farming phase
      console.log('Processing WHITE player plots:');
      farms.white.plots.forEach(plot => {
        // First check if the plot is ready and auto-harvest if needed
        if (isBeginningOfFarmPhase && plot.state === PLOT_STATE.READY && 
            'white' === GameState.getPlayerColor()) {
          if (autoHarvestCrop(plot)) {
            plot.wasJustHarvested = true;
            harvestedCrops++;
          }
        } 
        // Only process white's plots for growth if it's white's turn
        else if (plot.state === PLOT_STATE.PLANTED && currentTurn === 'white') {
          processSinglePlot(plot);
        }
        
        // After processing, check again if the plot became ready
        if (isBeginningOfFarmPhase && plot.state === PLOT_STATE.READY && 
            'white' === GameState.getPlayerColor()) {
          if (autoHarvestCrop(plot)) {
            plot.wasJustHarvested = true;
            harvestedCrops++;
          }
        }
      });
      
      // Process black player plots ONLY if it's black's turn and farming phase
      console.log('Processing BLACK player plots:');
      farms.black.plots.forEach(plot => {
        // First check if the plot is ready and auto-harvest if needed
        if (isBeginningOfFarmPhase && plot.state === PLOT_STATE.READY && 
            'black' === GameState.getPlayerColor()) {
          if (autoHarvestCrop(plot)) {
            plot.wasJustHarvested = true;
            harvestedCrops++;
          }
        } 
        // Only process black's plots for growth if it's black's turn
        else if (plot.state === PLOT_STATE.PLANTED && currentTurn === 'black') {
          processSinglePlot(plot);
        }
        
        // After processing, check again if the plot became ready
        if (isBeginningOfFarmPhase && plot.state === PLOT_STATE.READY && 
            'black' === GameState.getPlayerColor()) {
          if (autoHarvestCrop(plot)) {
            plot.wasJustHarvested = true;
            harvestedCrops++;
          }
        }
      });
      
      // Update the display after all processing
      updateFarmDisplay();
      
      // Show a notification if crops were auto-harvested at the beginning of farm phase
      if (isBeginningOfFarmPhase) {
        // Check if any plots were in ready state and are now empty
        const anyHarvested = [...farms.white.plots, ...farms.black.plots].some(
          plot => plot.state === PLOT_STATE.EMPTY && plot.wasJustHarvested
        );
        
        if (anyHarvested) {
          showMessage('Some crops were automatically harvested! 🌾', 3000);
          
          // Reset the wasJustHarvested flag but keep canPlantAfterHarvest flag
          [...farms.white.plots, ...farms.black.plots].forEach(plot => {
            plot.wasJustHarvested = false;
            // Keep canPlantAfterHarvest flag to allow planting on just-harvested plots
          });
        }
      }
      
      // Clear the canPlantAfterHarvest flag at the beginning of the next phase
      // so it only applies for the current farming phase
      if (currentPhase === 'chess') {
        [...farms.white.plots, ...farms.black.plots].forEach(plot => {
          if (plot.canPlantAfterHarvest) {
            console.log(`Clearing canPlantAfterHarvest flag for plot ${plot.id}`);
            plot.canPlantAfterHarvest = false;
          }
        });
      }
      
      console.log('FarmManager.processTurn(): COMPLETED PROCESSING OF ALL FARM PLOTS');
    } catch (error) {
      console.error('CRITICAL ERROR in FarmManager.processTurn():', error);
    }
  }
  
  /**
   * Process a single plot for growth and state changes
   * @param {Object} plot - The plot to process
   */
  function processSinglePlot(plot) {
    // Only process plots that are planted and have crops
    if (!plot || plot.state !== PLOT_STATE.PLANTED || !plot.crop) {
      return;
    }

    // Get standardized crop data
    let cropData;
    
    // If plot.crop is a string (crop type), get and standardize the data from CROPS
    if (typeof plot.crop === 'string') {
      const configCrop = CROPS[plot.crop];
      if (configCrop) {
        cropData = standardizeCropData({
          type: plot.crop,
          ...configCrop
        });
      }
      console.log(`Processing plot with crop type: ${plot.crop}`);
    } 
    // If plot.crop is an object, standardize it
    else if (typeof plot.crop === 'object') {
      cropData = standardizeCropData(plot.crop);
      console.log(`Processing plot with crop object:`, cropData);
    }

    // If we couldn't get valid crop data, log an error and return
    if (!cropData) {
      console.error(`Invalid crop data for plot ${plot.id}`, plot.crop);
      return;
    }

    // Only initialize turnsToHarvest if it's not already set
    // This prevents re-initializing on subsequent turns
    if (plot.turnsToHarvest === undefined || plot.turnsToHarvest === null) {
      // Use the crop's growth time from standardized data
      plot.turnsToHarvest = cropData.growthTime;
      console.log(`Initialized turnsToHarvest for ${plot.id} to ${plot.turnsToHarvest}`);
    } else {
      // Decrement turns to harvest only if it's already initialized
      // This ensures we don't count down from the wrong starting point
      console.log(`${plot.id} turnsToHarvest BEFORE decrement: ${plot.turnsToHarvest}`);
      plot.turnsToHarvest--;
      console.log(`${plot.id} turns until harvest AFTER decrement: ${plot.turnsToHarvest}`);
    }

    // Check if crop is ready for harvest
    if (plot.turnsToHarvest <= 0) {
      plot.state = PLOT_STATE.READY;
      console.log(`${plot.id} is ready for harvest!`);
    }

    // Update the plot display
    updatePlotDisplay(plot);
  }
  
  /**
   * Auto-harvest crops that are ready
   * @param {Object} plot - The plot object
   */
  function autoHarvestCrop(plot) {
    if (!plot) {
      console.error('autoHarvestCrop called with undefined plot');
      return false;
    }
    
    // Determine player color from plot ID if not explicitly set
    let playerColor = plot.player;
    if (!playerColor && plot.id) {
      // Extract player color from plot ID (format: "color-plot-index")
      const idParts = plot.id.split('-');
      if (idParts.length >= 1) {
        playerColor = idParts[0];
        console.log(`Determined player color from plot ID: ${playerColor}`);
      }
    }
    
    console.log(`AUTO-HARVEST: Attempting to auto-harvest plot ${plot.id} for player ${playerColor}`);
    
    try {
      // Verify the plot is in the READY state
      if (plot.state !== PLOT_STATE.READY) {
        console.log(`Plot ${plot.id} is not ready for harvest, state: ${plot.state}`);
        return false;
      }
      
      // Verify the plot has a valid crop
      if (!plot.crop) {
        console.error(`Plot ${plot.id} has no crop to harvest`);
        // Reset to empty state to avoid further attempts
        plot.state = PLOT_STATE.EMPTY;
        updatePlotDisplay(plot);
        return false;
      }
      
      // Get the standardized crop data
      let cropData = null;
      
      if (typeof plot.crop === 'string') {
        // If plot.crop is a string (crop type), get the data from CROPS and standardize it
        const configCrop = CROPS[plot.crop];
        if (configCrop) {
          cropData = standardizeCropData({
            type: plot.crop,
            ...configCrop
          });
        }
      } else if (plot.crop && typeof plot.crop === 'object') {
        // If plot.crop is already an object, just standardize it
        cropData = standardizeCropData(plot.crop);
      }
      
      if (!cropData) {
        console.error(`Invalid crop data for ${JSON.stringify(plot.crop)} in plot ${plot.id}`);
        // Reset to empty state to avoid further attempts
        plot.state = PLOT_STATE.EMPTY;
        updatePlotDisplay(plot);
        return false;
      }
      
      // Log all available properties for debugging
      console.log(`Standardized crop data for harvesting:`, cropData);
      
      // Use the standardized yield value
      const yieldAmount = cropData.yield;
      
      console.log(`AUTO-HARVEST: harvesting ${cropData.name} from plot ${plot.id} for ${yieldAmount} wheat`);
      
      // Update the player's wheat
      let success = false;
      
      try {
        // Standard method to update wheat via GameState
        if (typeof GameState !== 'undefined' && 
            typeof GameState.updateWheat === 'function' && playerColor) {
          success = GameState.updateWheat(playerColor, yieldAmount);
          console.log(`Standard wheat update for ${playerColor}: ${success ? 'SUCCESS' : 'FAILED'}`);
        }
      } catch (wheatError) {
        console.error('Error updating wheat via GameState:', wheatError);
      }
      
      // Emergency fallback: direct resources update if standard method failed
      if (!success) {
        try {
          console.log('Attempting emergency direct resources update...');
          if (typeof GameState !== 'undefined' && 
              typeof GameState.getResources === 'function') {
            const resources = GameState.getResources(playerColor);
            if (resources && typeof resources.wheat === 'number') {
              resources.wheat += yieldAmount;
              console.log(`Emergency update: ${playerColor} wheat set to ${resources.wheat}`);
              success = true;
              
              // Trigger UI update if possible
              if (typeof UIManager !== 'undefined' && 
                  typeof UIManager.updateResourceDisplay === 'function') {
                UIManager.updateResourceDisplay();
              }
            }
          }
        } catch (emergencyError) {
          console.error('Error during emergency wheat update:', emergencyError);
        }
      }
      
      // Always clear the plot after harvesting, regardless of wheat update success
      // This prevents endless auto-harvest attempts on the same plot
      plot.state = PLOT_STATE.EMPTY;
      plot.crop = null;
      plot.turnsToHarvest = null;
      updatePlotDisplay(plot);
      
      // Important: Auto-harvesting should NOT register as a farm action taken by the player
      // This allows the player to still plant in this plot during the same turn
      // We do NOT call GameState.registerFarmAction() here
      
      // Mark this plot as available for immediate planting
      plot.canPlantAfterHarvest = true;
      
      console.log(`AUTO-HARVEST for plot ${plot.id}: ${success ? 'SUCCESSFUL' : 'PARTIALLY FAILED'} - plot cleared and available for planting`);
      return success;
    } catch (error) {
      console.error(`Error in autoHarvestCrop for plot ${plot.id}:`, error);
      
      // Attempt to clear the plot despite the error
      try {
        plot.state = PLOT_STATE.EMPTY;
        plot.crop = null;
        plot.turnsToHarvest = null;
        updatePlotDisplay(plot);
        console.log(`Plot ${plot.id} cleared after error during auto-harvest`);
      } catch (clearError) {
        console.error(`Failed to clear plot ${plot.id} after error:`, clearError);
      }
      
      return false;
    }
  }
  
  /**
   * Update the display of a plot based on its current state
   * @param {Object} plot - The plot to update
   */
  function updatePlotDisplay(plot) {
    if (!plot || !plot.id) {
      console.error('Invalid plot object for display update:', plot);
      return;
    }
    
    const plotElement = document.getElementById(plot.id);
    if (!plotElement) {
      console.log(`Plot element not found: ${plot.id}`);
      return;
    }
    
    // Remove all state classes
    plotElement.classList.remove('planted', 'ready', 'empty', 'locked', 'unlockable');
    
    // Remove any existing buttons
    const existingButtons = plotElement.querySelectorAll('button');
    existingButtons.forEach(button => {
      button.remove();
    });
    
    // Clear any existing growth indicators
    const existingGrowthIndicators = plotElement.querySelectorAll('.turns-indicator, .ready-indicator');
    existingGrowthIndicators.forEach(indicator => {
      indicator.remove();
    });
    
    // Add class based on plot state
    plotElement.classList.add(plot.state);
    
    // Handle different plot states
    switch (plot.state) {
      case PLOT_STATE.EMPTY:
        // Create "Plant" button for empty plots if it's the player's farm and their turn
        if (isPlayersFarm(plot.player) && GameState.isPlayerTurn() && GameState.getCurrentGamePhase() === 'farming') {
          const canPlant = plot.canPlantAfterHarvest || !GameState.hasFarmActionBeenTaken();
          
          if (canPlant) {
            // Create plant button
            const plantButton = document.createElement('button');
            plantButton.className = 'plant-button';
            plantButton.textContent = 'Plant';
            plantButton.dataset.plotId = plot.id;
            
            // If this plot was just harvested, add special styling
            if (plot.canPlantAfterHarvest) {
              plantButton.style.backgroundColor = '#45a049'; // Darker green
              plantButton.style.animation = 'pulse 1s infinite alternate';
              plantButton.textContent = 'Plant (Harvested)';
            }
            
            // Add plant button to plot
            plotElement.appendChild(plantButton);
            
            // Add event listener
            plantButton.addEventListener('click', handlePlantButtonClick);
          }
        }
        
        break;
      
      case PLOT_STATE.PLANTED:
        // Planted plot - show crop and turns to harvest
        let cropData;
        
        // Get crop data
        if (typeof plot.crop === 'string') {
          cropData = CROPS[plot.crop];
        } else if (plot.crop && typeof plot.crop === 'object') {
          cropData = plot.crop;
          
          // Try to get additional data from CROPS if type is available
          if (plot.crop.type && CROPS[plot.crop.type]) {
            cropData = Object.assign({}, CROPS[plot.crop.type], cropData);
          }
        }
        
        if (cropData) {
          // Get growth stage
          const totalTurns = cropData.turnsTillHarvest || cropData.growthTime || 2;
          const growthClass = getGrowthClass(plot.turnsToHarvest, totalTurns);
          
          // Create crop icon
          const cropIcon = document.createElement('div');
          cropIcon.className = `crop-icon ${growthClass}`;
          cropIcon.textContent = cropData.emoji || '🌱';
          plotElement.appendChild(cropIcon);
          
          // Create crop name
          const cropName = document.createElement('div');
          cropName.className = 'crop-name';
          cropName.textContent = cropData.name || 'Crop';
          plotElement.appendChild(cropName);
          
          // Create turns to harvest indicator
          const turnsIndicator = document.createElement('div');
          turnsIndicator.className = 'turns-indicator';
          turnsIndicator.textContent = `${plot.turnsToHarvest || '?'} turns`;
          plotElement.appendChild(turnsIndicator);
        } else {
          // Fallback if no crop data
          plotElement.textContent = 'Unknown crop';
        }
        
        break;
      
      case PLOT_STATE.READY:
        // Ready plot - show it's ready for auto-harvest
        const readyIcon = document.createElement('div');
        readyIcon.className = 'ready-icon';
        readyIcon.textContent = '✓';
        plotElement.appendChild(readyIcon);
        
        const readyText = document.createElement('div');
        readyText.className = 'ready-text';
        readyText.textContent = 'Ready for auto-harvest';
        plotElement.appendChild(readyText);
        
        break;
      
      case PLOT_STATE.LOCKED:
        // Locked plot
        const lockIcon = document.createElement('div');
        lockIcon.className = 'lock-icon';
        lockIcon.textContent = '🔒';
        plotElement.appendChild(lockIcon);
        
        const unlockCost = document.createElement('div');
        unlockCost.className = 'unlock-cost';
        unlockCost.textContent = `${GameConfig.farmConfig.unlockCost} 🌾`;
        plotElement.appendChild(unlockCost);
        
        break;
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
      case 'auto-unlock':
        processFarmUpdateAutoUnlock(data);
        break;
      default:
        console.warn(`Unknown farm action: ${action}`);
    }
    
    // Update the farm display
    updateFarmDisplay();
  }
  
  /**
   * Process farm update for planting a crop
   * @param {Object} data - The update data
   */
  function processFarmUpdatePlant(data) {
    const { plotId, cropType } = data;
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Get the crop data from GameConfig and standardize it
    const configCrop = GameConfig.crops[cropType];
    if (!configCrop) {
      console.error(`Crop type not found: ${cropType}`);
      return;
    }
    
    // Prepare standardized crop data
    const standardizedCrop = prepareCropForPlanting(cropType);
    
    // Determine the player color from plot ID
    const playerColor = plotId.startsWith('white-') ? 'white' : 'black';
    const plotIndex = parseInt(plotId.split('-').pop());
    
    // Plant the crop with standardized data
    plot.state = 'planted';
    plot.crop = standardizedCrop;
    plot.plantedTurn = GameState.getCurrentTurn();
    plot.turnsToHarvest = standardizedCrop.growthTime;
    
    console.log(`Opponent planted ${standardizedCrop.name} in plot ${plotId}`);
    
    // Update farm display to reflect changes
    updateFarmDisplay();
  }
  
  /**
   * Process farm update for harvesting a crop
   * @param {Object} data - The update data
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
   * Process farm update for automatically unlocking a plot
   * @param {Object} data - The update data
   */
  function processFarmUpdateAutoUnlock(data) {
    const { plotId } = data;
    
    // Get the plot
    const plot = getPlotById(plotId);
    if (!plot) {
      console.error(`Plot not found: ${plotId}`);
      return;
    }
    
    // Get the player color from the plot ID
    const playerColor = plotId.startsWith('white') ? 'white' : 'black';
    
    // Set the plot to empty (unlocked)
    if (plot.state === 'locked') {
      plot.state = 'empty';
      farms[playerColor].unlockedPlots++;
      
      console.log(`Plot ${plotId} was automatically unlocked`);
      
      // Update the farm display
      updateFarmDisplay();
    }
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
  
  /**
   * Get the current state of the farm system for debugging
   * @returns {Object} The current state of the farms
   */
  function getState() {
    try {
      const whitePlots = farms.white.plots.map(plot => ({
        id: plot.id,
        state: plot.state,
        turnsToHarvest: plot.turnsToHarvest,
        crop: plot.crop ? {
          name: plot.crop.name || plot.crop.type || plot.crop,
          yield: typeof plot.crop === 'object' ? (plot.crop.yield || plot.crop.harvestYield || 3) : 3
        } : null
      }));
      
      const blackPlots = farms.black.plots.map(plot => ({
        id: plot.id,
        state: plot.state,
        turnsToHarvest: plot.turnsToHarvest,
        crop: plot.crop ? {
          name: plot.crop.name || plot.crop.type || plot.crop,
          yield: typeof plot.crop === 'object' ? (plot.crop.yield || plot.crop.harvestYield || 3) : 3
        } : null
      }));
      
      const whiteWheat = typeof GameState !== 'undefined' && GameState.getWheat ? 
        GameState.getWheat('white') : 'Unknown';
      
      const blackWheat = typeof GameState !== 'undefined' && GameState.getWheat ? 
        GameState.getWheat('black') : 'Unknown';
      
      return {
        whiteWheat: whiteWheat,
        blackWheat: blackWheat,
        whitePlots,
        blackPlots
      };
    } catch (error) {
      console.error('Error in getState:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Handle click on the plant button
   * @param {Event} event - The click event
   */
  function handlePlantButtonClick(event) {
    const plotId = event.target.dataset.plotId;
    
    // Get the plot from its ID
    const plot = getPlotById(plotId);
    
    // Check if this plot was just auto-harvested
    const wasJustHarvested = plot && plot.canPlantAfterHarvest === true;
    
    if (canPerformFarmAction(wasJustHarvested)) {
      UIManager.showPlantSelector(plotId);
    } else {
      showMessage('You cannot plant now');
    }
  }
  
  /**
   * Check if all unlocked plots for a player are full (planted/growing)
   * Used to auto-skip farming phase if no planting actions are available
   * @param {string} playerColor - The player color ('white' or 'black')
   * @returns {boolean} True if all unlocked plots are full
   */
  function areAllUnlockedPlotsFull(playerColor) {
    if (!farms[playerColor]) {
      console.error(`Invalid player color: ${playerColor}`);
      return false;
    }
    
    // Count empty unlocked plots
    const emptyUnlockedPlotsCount = farms[playerColor].plots.filter(plot => 
      plot.state === PLOT_STATE.EMPTY
    ).length;
    
    console.log(`Player ${playerColor} has ${emptyUnlockedPlotsCount} empty unlocked plots`);
    
    // If there are no empty plots, all plots are full
    return emptyUnlockedPlotsCount === 0;
  }
  
  // Public API
  return {
    initialize: initialize,
    initializeModule: initializeModule,
    initializeFarmDisplay: initializeFarmDisplay,
    plantCrop: plantCrop,
    updateFarmDisplay: updateFarmDisplay,
    updatePlotDisplay: updatePlotDisplay,
    processTurn: processTurn,
    processFarmUpdate: processFarmUpdate,
    processFarmAction: processFarmAction,
    autoHarvestCrop: autoHarvestCrop,
    getState: getState,
    checkUnlockPlot: checkUnlockPlot,
    
    // Debugging functions (consider removing in production)
    getPlotById: getPlotById,
    displayFarms: displayFarms,
    updateFarmsFromServer: updateFarmsFromServer,
    standardizeCropData: standardizeCropData,
    prepareCropForPlanting: prepareCropForPlanting,
    areAllUnlockedPlotsFull: areAllUnlockedPlotsFull
  };
})(); 