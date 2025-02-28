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
      button.addEventListener('click', function() {
        const plotId = this.getAttribute('data-plot-id');
        if (canPerformFarmAction()) {
          UIManager.showPlantSelector(plotId);
        } else {
          showMessage('You cannot plant now');
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
    
    console.log('Added event listeners to farm plot buttons');
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
      plantedTurn: GameState.getCurrentTurn(),
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
      
      // Process white player plots
      console.log('Processing WHITE player plots:');
      farms.white.plots.forEach(plot => {
        processSinglePlot(plot, 'white', isBeginningOfFarmPhase);
      });
      
      // Process black player plots
      console.log('Processing BLACK player plots:');
      farms.black.plots.forEach(plot => {
        processSinglePlot(plot, 'black', isBeginningOfFarmPhase);
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
          
          // Reset the wasJustHarvested flag
          [...farms.white.plots, ...farms.black.plots].forEach(plot => {
            plot.wasJustHarvested = false;
          });
        }
      }
      
      console.log('FarmManager.processTurn(): COMPLETED PROCESSING OF ALL FARM PLOTS');
    } catch (error) {
      console.error('CRITICAL ERROR in FarmManager.processTurn():', error);
    }
  }
  
  /**
   * Helper to process a single plot during turn change
   * @param {Object} plot - The plot object
   * @param {string} playerColor - The color of the player who owns the plot
   * @param {boolean} isBeginningOfFarmPhase - Whether this is the beginning of a farm phase
   */
  function processSinglePlot(plot, playerColor, isBeginningOfFarmPhase) {
    if (!plot) {
      console.error(`Invalid plot for ${playerColor} player`);
      return;
    }
    
    const plotId = plot.id;
    console.log(`Processing ${playerColor} plot ${plotId}:`, 
      `state=${plot.state}`, 
      `crop=${plot.crop}`, 
      `turnsToHarvest=${plot.turnsToHarvest}`);
    
    try {
      // First, check for crops that are already ready for harvest
      if (plot.state === PLOT_STATE.READY && plot.crop) {
        console.log(`CROP ALREADY READY: ${playerColor} plot ${plotId} (${plot.crop}) - attempting auto-harvest`);
        
        // Auto-harvest the crop
        const harvestSuccess = autoHarvestCrop(plot);
        
        // Mark this plot as just harvested for notification purposes
        if (harvestSuccess) {
          plot.wasJustHarvested = true;
        }
        
        // After handling ready plots, continue with the rest of the function
      }
      
      // Only process plots that are planted and have a valid crop
      if (plot.state === PLOT_STATE.PLANTED && plot.crop) {
        const cropData = CROPS[plot.crop];
        
        if (!cropData) {
          console.error(`Invalid crop data for ${plot.crop} in plot ${plotId}`);
          return;
        }
        
        // If turnsToHarvest is null or undefined, initialize it based on crop data
        if (plot.turnsToHarvest === null || plot.turnsToHarvest === undefined) {
          plot.turnsToHarvest = cropData.growthTime || cropData.turnsTillHarvest || 3;
          console.log(`Initializing turnsToHarvest for ${plotId} to ${plot.turnsToHarvest}`);
        }
        
        // Decrement turns counter
        if (plot.turnsToHarvest > 0) {
          plot.turnsToHarvest--;
          console.log(`${playerColor} plot ${plotId}: ${plot.turnsToHarvest} turns remaining until harvest`);
        }
        
        // Check if the crop is ready to harvest
        if (plot.turnsToHarvest <= 0) {
          console.log(`CROP READY: ${playerColor} plot ${plotId} (${plot.crop}) is now ready for harvest`);
          plot.state = PLOT_STATE.READY;
          
          // Auto-harvest immediately if this is the beginning of a farming phase
          if (isBeginningOfFarmPhase && playerColor === GameState.getPlayerColor()) {
            console.log(`Auto-harvesting at beginning of farm phase for player ${playerColor}`);
            const harvestSuccess = autoHarvestCrop(plot);
            
            // Mark this plot as just harvested for notification purposes
            if (harvestSuccess) {
              plot.wasJustHarvested = true;
            }
          }
        }
      }
      
      // Always update the plot display
      updatePlotDisplay(plot);
      
    } catch (error) {
      console.error(`Error processing ${playerColor} plot ${plotId}:`, error);
    }
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
    
    console.log(`AUTO-HARVEST: Attempting to auto-harvest plot ${plot.id} for player ${plot.player}`);
    
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
      
      // Get the crop data
      const cropData = CROPS[plot.crop];
      if (!cropData) {
        console.error(`Invalid crop data for ${plot.crop} in plot ${plot.id}`);
        // Reset to empty state to avoid further attempts
        plot.state = PLOT_STATE.EMPTY;
        updatePlotDisplay(plot);
        return false;
      }
      
      // Determine yield amount (try multiple property names for robustness)
      let yieldAmount = 0;
      
      // Log all available properties for debugging
      console.log(`Crop data for ${plot.crop}:`, cropData);
      
      // Try multiple possible property names for yield amount
      if (typeof cropData.yield === 'number') {
        yieldAmount = cropData.yield;
        console.log(`Using 'yield' property: ${yieldAmount}`);
      } else if (typeof cropData.yieldAmount === 'number') {
        yieldAmount = cropData.yieldAmount;
        console.log(`Using 'yieldAmount' property: ${yieldAmount}`);
      } else if (typeof cropData.harvestYield === 'number') {
        yieldAmount = cropData.harvestYield;
        console.log(`Using 'harvestYield' property: ${yieldAmount}`);
      } else if (typeof cropData.harvest === 'number') {
        yieldAmount = cropData.harvest;
        console.log(`Using 'harvest' property: ${yieldAmount}`);
      } else {
        // Default to the yield of wheat if available, or a fallback value
        yieldAmount = CROPS.wheat ? (CROPS.wheat.yield || 3) : 3;
        console.log(`No yield property found, defaulting to ${yieldAmount}`);
      }
      
      // Sanity check the yield amount
      if (yieldAmount <= 0) {
        console.error(`Invalid yield amount (${yieldAmount}) for ${plot.crop}, using default of 3`);
        yieldAmount = 3;
      }
      
      console.log(`AUTO-HARVEST: harvesting ${plot.crop} from plot ${plot.id} for ${yieldAmount} wheat`);
      
      // Update the player's wheat
      let success = false;
      
      try {
        // Standard method to update wheat via GameState
        if (typeof GameState !== 'undefined' && 
            typeof GameState.updateWheat === 'function') {
          success = GameState.updateWheat(plot.player, yieldAmount);
          console.log(`Standard wheat update for ${plot.player}: ${success ? 'SUCCESS' : 'FAILED'}`);
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
            const resources = GameState.getResources(plot.player);
            if (resources && typeof resources.wheat === 'number') {
              resources.wheat += yieldAmount;
              console.log(`Emergency update: ${plot.player} wheat set to ${resources.wheat}`);
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
      
      console.log(`AUTO-HARVEST for plot ${plot.id}: ${success ? 'SUCCESSFUL' : 'PARTIALLY FAILED'} - plot cleared`);
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
   * Update the display of a plot element
   * @param {Object} plot - The plot to update
   */
  function updatePlotDisplay(plot) {
    try {
        if (!plot || !plot.display) {
            console.error('updatePlotDisplay: Invalid plot or display element');
            return;
        }
        
        const element = plot.display;
        
        // Remove all state classes first
        Object.values(PLOT_STATE).forEach(state => {
            element.classList.remove(state);
        });
        
        // Add the current state class
        element.classList.add(plot.state);
        
        // Clear any existing content
        element.innerHTML = '';
        
        // Create inner container for plot content (helps with positioning indicators)
        const plotContent = document.createElement('div');
        plotContent.classList.add('plot-content');
        element.appendChild(plotContent);
        
        // Add crop image if there is a crop
        if (plot.crop && (plot.state === PLOT_STATE.PLANTED || plot.state === PLOT_STATE.READY)) {
            const cropData = CROPS[plot.crop];
            if (cropData) {
                const cropImg = document.createElement('img');
                cropImg.src = cropData.image;
                cropImg.alt = plot.crop;
                cropImg.classList.add('crop-image');
                plotContent.appendChild(cropImg);
                
                // Add crop name below the image
                const cropName = document.createElement('div');
                cropName.classList.add('crop-name');
                cropName.textContent = cropData.name || plot.crop;
                plotContent.appendChild(cropName);
                
                // Add turns to harvest indicator for planted crops
                if (plot.state === PLOT_STATE.PLANTED && 
                    plot.turnsToHarvest !== null && 
                    plot.turnsToHarvest !== undefined) {
                    
                    // Create a more prominent turns indicator
                    const turnsIndicator = document.createElement('div');
                    turnsIndicator.classList.add('turns-indicator');
                    
                    // Create circular countdown display
                    const countdownCircle = document.createElement('div');
                    countdownCircle.classList.add('countdown-circle');
                    
                    // Create number display
                    const turnsNumber = document.createElement('div');
                    turnsNumber.classList.add('turns-number');
                    turnsNumber.textContent = plot.turnsToHarvest;
                    
                    // Add label
                    const turnsLabel = document.createElement('div');
                    turnsLabel.classList.add('turns-label');
                    turnsLabel.textContent = 'turns to harvest';
                    
                    // Assemble the indicator
                    countdownCircle.appendChild(turnsNumber);
                    turnsIndicator.appendChild(countdownCircle);
                    turnsIndicator.appendChild(turnsLabel);
                    
                    // Add to plot element
                    element.appendChild(turnsIndicator);
                    console.log(`Added enhanced turns indicator for plot ${plot.id}: ${plot.turnsToHarvest} turns remaining`);
                }
            }
        }
        
        // Add ready indicator for ready crops
        if (plot.state === PLOT_STATE.READY) {
            // Create a visual "ready" indicator
            const readyIndicator = document.createElement('div');
            readyIndicator.classList.add('ready-indicator');
            
            // Create checkmark icon
            const checkmark = document.createElement('div');
            checkmark.classList.add('ready-checkmark');
            checkmark.innerHTML = '✓'; // Unicode checkmark
            
            // Add ready text
            const readyText = document.createElement('div');
            readyText.classList.add('ready-text');
            readyText.textContent = 'Auto-harvest on next turn';
            
            // Assemble the indicator
            readyIndicator.appendChild(checkmark);
            readyIndicator.appendChild(readyText);
            
            // Add to plot element
            element.appendChild(readyIndicator);
            console.log(`Added ready indicator for plot ${plot.id}`);
        }
        
        // For empty plots, add plant button
        if (plot.state === PLOT_STATE.EMPTY) {
            const plantButton = document.createElement('button');
            plantButton.classList.add('plant-button');
            plantButton.textContent = 'Plant';
            plantButton.setAttribute('data-plot-id', plot.id);
            
            // Add event listener directly
            plantButton.addEventListener('click', function() {
                if (canPerformFarmAction()) {
                    UIManager.showPlantSelector(plot.id);
                } else {
                    showMessage('You cannot plant now');
                }
            });
            
            plotContent.appendChild(plantButton);
        }
        
        // For unlockable plots, add unlock button
        if (plot.state === PLOT_STATE.UNLOCKABLE) {
            const unlockButton = document.createElement('button');
            unlockButton.classList.add('unlock-plot-button');
            unlockButton.textContent = 'Unlock';
            unlockButton.setAttribute('data-plot-id', plot.id);
            
            // Add event listener directly
            unlockButton.addEventListener('click', function() {
                if (canPerformFarmAction()) {
                    unlockPlot(plot.id);
                } else {
                    showMessage('You cannot unlock plots now');
                }
            });
            
            plotContent.appendChild(unlockButton);
        }
        
    } catch (error) {
        console.error('Error updating plot display:', error);
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
    plot.plantedTurn = GameState.getCurrentTurn();
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
  
  // Public API
  return {
    initialize,
    initializeModule: initialize, // Backwards compatibility alias
    initializeFarmDisplay,
    plantCrop,
    unlockPlot,
    updateFarmDisplay,
    updatePlotDisplay,
    processTurn,
    processFarmUpdate,
    processFarmAction,
    autoHarvestCrop, // Still needed internally for socket events
    getState,
    
    // Debugging functions (consider removing in production)
    getPlotById,
    displayFarms,
    updateFarmsFromServer
  };
})(); 