document.addEventListener('DOMContentLoaded', function() {
  const rulesList = document.getElementById('rulesList');
  const newRuleRow = document.getElementById('newRuleRow');
  const saveNewRuleButton = document.getElementById('saveNewRule');
  
  // Debug mode flag - will be automatically set by the build script
  const isDebugMode = true;
  
  // Debug logging function
  function debugLog(message, data) {
    if (isDebugMode) {
      console.log(`[Popup] ${message}`, data || '');
    }
  }
  
  debugLog('Popup loaded - DOM content loaded');
  debugLog('Debug mode:', isDebugMode);
  
  // Initialize by loading rules immediately after DOM is ready
  loadRuleGroups();
  
  function displayRuleGroups(ruleGroups) {
    debugLog('Displaying rule groups', { count: ruleGroups ? ruleGroups.length : 0 });
    
    // Clear existing rules but keep the new rule row
    while (rulesList.firstChild && rulesList.firstChild !== newRuleRow) {
      rulesList.removeChild(rulesList.firstChild);
    }
    
    if (!ruleGroups || ruleGroups.length === 0) {
      debugLog('No rule groups to display');
      return; // Just show the empty new rule row
    }
    
    ruleGroups.forEach(group => {
      group.operations.forEach(op => {
        const row = document.createElement('tr');
        row.dataset.ruleId = group.id;
        
        // URL Match cell
        const matchCell = document.createElement('td');
        const matchSpan = document.createElement('span');
        matchSpan.textContent = group.urlRule;
        matchCell.appendChild(matchSpan);
        row.appendChild(matchCell);
        
        // Header Name cell
        const headerCell = document.createElement('td');
        const headerSpan = document.createElement('span');
        headerSpan.textContent = op.header;
        headerCell.appendChild(headerSpan);
        row.appendChild(headerCell);
        
        // Header Value cell
        const valueCell = document.createElement('td');
        const valueSpan = document.createElement('span');
        valueSpan.textContent = op.value;
        valueCell.appendChild(valueSpan);
        row.appendChild(valueCell);
        
        // Toggle switch cell
        const toggleCell = document.createElement('td');
        toggleCell.style.textAlign = 'center';
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'toggle-switch';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = group.enabled;
        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';
        
        toggleInput.addEventListener('change', () => {
          const updatedGroup = {...group, enabled: toggleInput.checked};
          chrome.runtime.sendMessage({
            action: 'updateRuleGroup',
            ruleGroupId: group.id,
            updatedRuleGroup: updatedGroup
          }, function(response) {
            if (response && response.success) {
              row.classList.toggle('disabled-rule', !toggleInput.checked);
            } else {
              toggleInput.checked = !toggleInput.checked; // Revert on failure
              alert('Failed to update rule. Please try again.');
            }
          });
        });
        
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(toggleSlider);
        toggleCell.appendChild(toggleLabel);
        row.appendChild(toggleCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.className = 'edit-button';
        editButton.addEventListener('click', () => editRule(row, group, op));
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', () => {
          if (confirm('Are you sure you want to delete this rule?')) {
            deleteRuleGroup(group.id);
          }
        });
        
        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);
        
        // Insert before the new rule row
        rulesList.insertBefore(row, newRuleRow);
      });
    });
    debugLog('Rule groups display completed');
  }
  
  function setEditingMode(isEditing) {
    // Disable/enable all edit buttons
    const editButtons = document.querySelectorAll('.edit-button');
    editButtons.forEach(button => {
      button.disabled = isEditing;
    });
    
    // Disable/enable all delete buttons
    const deleteButtons = document.querySelectorAll('.delete-button:not(.cancel-button)');
    deleteButtons.forEach(button => {
      button.disabled = isEditing;
    });
    
    // Disable/enable the save new rule button
    const saveNewRuleButton = document.getElementById('saveNewRule');
    saveNewRuleButton.disabled = isEditing;
  }
  
  function editRule(row, group, operation) {
    // Set editing mode to disable other buttons
    setEditingMode(true);
    debugLog('Editing rule', { groupId: group.id, operation });
    
    const cells = row.cells;
    
    // Create inputs
    const inputs = ['match', 'header', 'value'].map((type, index) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = `${type}-input`;
      input.value = index === 0 ? group.urlRule : 
                   index === 1 ? operation.header : operation.value;
      
      const cell = cells[index];
      cell.textContent = '';
      cell.appendChild(input);
      return input;
    });
    // Focus first input after DOM update
    requestAnimationFrame(() => {
      inputs[0].focus();
      inputs[0].select();
    });
    
    // Replace action buttons
    cells[4].innerHTML = '';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'delete-button';
    
    saveButton.addEventListener('click', () => {
      debugLog('Saving edited rule', { groupId: group.id });
      const updatedGroup = {
        urlRule: inputs[0].value.trim(),
        operations: [{
          header: inputs[1].value.trim(),
          operation: 'set',
          value: inputs[2].value.trim()
        }]
      };
      
      chrome.runtime.sendMessage({
        action: 'updateRuleGroup',
        ruleGroupId: group.id,
        updatedRuleGroup: updatedGroup
      }, function(response) {
        debugLog('Update rule response', response);
        if (response && response.success) {
          setEditingMode(false);
          loadRuleGroups();
        } else {
          debugLog('Failed to update rule', { error: chrome.runtime.lastError });
          alert('Failed to update rule. Please try again.');
        }
      });
    });
    
    cancelButton.addEventListener('click', () => {
      debugLog('Cancelling rule edit');
      setEditingMode(false);
      loadRuleGroups();
    });
    
    cells[4].appendChild(saveButton);
    cells[4].appendChild(cancelButton);
  }
  
  function handleNewRule() {
    const matchInput = newRuleRow.querySelector('.match-input');
    const headerInput = newRuleRow.querySelector('.header-input');
    const valueInput = newRuleRow.querySelector('.value-input');
    
    const urlRule = matchInput.value.trim();
    const header = headerInput.value.trim();
    const value = valueInput.value.trim();
    
    if (!urlRule || !header || !value) {
      debugLog('New rule validation failed - empty fields');
      alert('Please fill in all fields');
      return;
    }
    
    const ruleGroup = {
      urlRule: urlRule,
      operations: [{
        header: header,
        operation: 'set',
        value: value
      }]
    };
    
    debugLog('Adding new rule', ruleGroup);
    chrome.runtime.sendMessage({
      action: 'addRuleGroup',
      ruleGroup: ruleGroup
    }, function(response) {
      debugLog('Add rule response', response);
      if (response && response.success) {
        // Clear inputs
        matchInput.value = '';
        headerInput.value = '';
        valueInput.value = '';
        loadRuleGroups();
      } else {
        debugLog('Failed to add rule', { error: chrome.runtime.lastError });
        alert('Failed to add rule. Please try again.');
      }
    });
  }
  
  function deleteRuleGroup(ruleGroupId) {
    debugLog('Deleting rule group', { id: ruleGroupId });
    chrome.runtime.sendMessage({
      action: 'deleteRuleGroup',
      ruleGroupId: ruleGroupId
    }, function(response) {
      debugLog('Delete rule response', response);
      if (response && response.success) {
        loadRuleGroups();
      } else {
        debugLog('Failed to delete rule', { error: chrome.runtime.lastError });
        alert('Failed to delete rule. Please try again.');
      }
    });
  }
  
  // Improved rule loading with fallback from storage
  function loadRuleGroups(retryCount = 0) {
    debugLog(`Loading rule groups (attempt ${retryCount + 1})`);
    
    // Show loading state (optional)
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
    }
    
    // Track timing for debugging
    const startTime = Date.now();
    
    chrome.runtime.sendMessage({ action: 'getRuleGroups' }, function(response) {
      const loadTime = Date.now() - startTime;
      debugLog(`Rule groups load request completed in ${loadTime}ms`);
      
      // Handle error or empty response
      if (chrome.runtime.lastError) {
        debugLog('Error loading rules from background', { 
          error: chrome.runtime.lastError,
          retryCount
        });
        
        // Try to load directly from storage as fallback
        chrome.storage.sync.get(['headerRuleGroups'], function(result) {
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
          
          if (result && result.headerRuleGroups) {
            debugLog('Successfully loaded rules from storage fallback', { 
              count: result.headerRuleGroups.length 
            });
            displayRuleGroups(result.headerRuleGroups);
          } else if (retryCount < 3) {
            // Retry a few times with increasing delay
            const retryDelay = 200 * (retryCount + 1);
            debugLog(`Will retry loading in ${retryDelay}ms`);
            setTimeout(() => {
              loadRuleGroups(retryCount + 1);
            }, retryDelay);
          } else {
            debugLog('All retries failed, giving up');
            displayRuleGroups([]);
          }
        });
        return;
      }
      
      // Check if response exists but is empty/invalid
      if (!response) {
        debugLog('Got empty response from background', { retryCount });
        
        if (retryCount < 3) {
          const retryDelay = 200 * (retryCount + 1);
          debugLog(`Will retry loading in ${retryDelay}ms`);
          setTimeout(() => {
            loadRuleGroups(retryCount + 1);
          }, retryDelay);
          
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
          return;
        } else {
          debugLog('All retries failed with empty response, giving up');
        }
      }
      
      // Hide loading indicator if it exists
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      
      // Display rules if they exist in response
      if (response && response.ruleGroups) {
        debugLog('Successfully loaded rule groups from background', { 
          count: response.ruleGroups.length 
        });
        displayRuleGroups(response.ruleGroups);
      } else if (retryCount < 3) {
        debugLog('Invalid response format, missing ruleGroups property', { response });
        // Retry a few times with increasing delay
        const retryDelay = 200 * (retryCount + 1);
        debugLog(`Will retry loading in ${retryDelay}ms`);
        setTimeout(() => {
          loadRuleGroups(retryCount + 1);
        }, retryDelay);
      } else {
        debugLog('All retries failed, giving up');
        displayRuleGroups([]);
      }
    });
  }
  
  // Event listeners
  saveNewRuleButton.addEventListener('click', handleNewRule);
  
  // Periodically check connection to background and reload rules if needed
  const checkBackgroundConnection = () => {
    debugLog('Checking background connection');
    chrome.runtime.sendMessage({ action: 'ping' }, function(response) {
      if (chrome.runtime.lastError) {
        debugLog('Background connection check failed, reloading rules', {
          error: chrome.runtime.lastError
        });
        loadRuleGroups();
      } else {
        debugLog('Background connection check successful');
      }
    });
  };
  
  // Check connection every 30 seconds
  const connectionCheckInterval = setInterval(checkBackgroundConnection, 30000);
  
  // Clean up interval on unload
  window.addEventListener('unload', () => {
    clearInterval(connectionCheckInterval);
  });
});