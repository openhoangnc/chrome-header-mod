document.addEventListener('DOMContentLoaded', function () {
  const rulesList = document.getElementById('rulesList');
  const newRuleRow = document.getElementById('newRuleRow');
  const saveNewRuleButton = document.getElementById('saveNewRule');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const requestList = document.getElementById('requestList');
  const matchedRequestCount = document.getElementById('matchedRequestCount');
  const clearStatsButton = document.getElementById('clearStats');
  const noRequestsMessage = document.getElementById('noRequests');

  // Debug mode flag - will be automatically set by the build script
  const isDebugMode = true;

  // Current tab URL
  let currentTabUrl = '';

  // Debug logging function
  function debugLog(message, data) {
    if (isDebugMode) {
      console.log(`[Popup] ${message}`, data || '');
    }
  }

  debugLog('Popup loaded - DOM content loaded');
  debugLog('Debug mode:', isDebugMode);

  // Tab switching logic
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked tab
      button.classList.add('active');
      const tabId = button.dataset.tab;
      document.getElementById(tabId).classList.add('active');

      // Load request data if switching to requests tab
      if (tabId === 'requests-tab') {
        loadRequestStats();
      }
    });
  });

  // Get the current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs.length > 0 && tabs[0].url) {
      currentTabUrl = tabs[0].url;
      debugLog('Current tab URL:', currentTabUrl);
      // Load rules after we have the current URL
      loadRules();
    } else {
      debugLog('Could not get current tab URL');
      // Load rules anyway
      loadRules();
    }
  });

  // Check if a URL matches a rule pattern
  function isUrlMatchingPattern(url, pattern) {
    try {
      // Convert the URL filter pattern to a regular expression
      // Replace * with .* to handle wildcards
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '.*');                 // Convert * to regex wildcard

      const regex = new RegExp(regexPattern);
      return regex.test(url);
    } catch (e) {
      debugLog('Error in URL pattern matching', e);
      return false;
    }
  }

  // Check if a rule matches the current tab URL
  function checkIfRuleMatches(rule) {
    if (!currentTabUrl || !rule.enabled) {
      return false;
    }

    // Split URL rules by comma and trim whitespace
    const urlMatches = rule.urlRule.split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    // Check each pattern
    for (const pattern of urlMatches) {
      if (isUrlMatchingPattern(currentTabUrl, pattern)) {
        return true;
      }
    }

    return false;
  }

  function displayRules(rules) {
    debugLog('Displaying rules', { count: rules ? rules.length : 0 });

    // Clear existing rules but keep the new rule row
    while (rulesList.firstChild && rulesList.firstChild !== newRuleRow) {
      rulesList.removeChild(rulesList.firstChild);
    }

    if (!rules || rules.length === 0) {
      debugLog('No rules to display');
      return; // Just show the empty new rule row
    }

    rules.forEach(rule => {
      const row = document.createElement('tr');
      row.dataset.ruleId = rule.id;

      // Check if this rule matches the current URL
      const isMatched = checkIfRuleMatches(rule);
      if (isMatched) {
        row.classList.add('rule-matched');
      }

      // URL Match cell
      const matchCell = document.createElement('td');
      const matchSpan = document.createElement('span');

      matchSpan.appendChild(document.createTextNode(rule.urlRule));
      matchCell.appendChild(matchSpan);
      row.appendChild(matchCell);

      // Header Name cell
      const headerCell = document.createElement('td');
      const headerSpan = document.createElement('span');
      headerSpan.textContent = rule.header;
      headerCell.appendChild(headerSpan);
      row.appendChild(headerCell);

      // Header Value cell
      const valueCell = document.createElement('td');
      const valueSpan = document.createElement('span');
      valueSpan.textContent = rule.value;
      valueCell.appendChild(valueSpan);
      row.appendChild(valueCell);

      // Toggle switch cell
      const toggleCell = document.createElement('td');
      toggleCell.style.textAlign = 'center';
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch';
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = rule.enabled;
      const toggleSlider = document.createElement('span');
      toggleSlider.className = 'toggle-slider';

      toggleInput.addEventListener('change', () => {
        const updatedRule = { ...rule, enabled: toggleInput.checked };
        chrome.runtime.sendMessage({
          action: 'updateRule',
          ruleId: rule.id,
          updatedRule: updatedRule
        }, function (response) {
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
      editButton.addEventListener('click', () => editRule(row, rule));

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete-button';
      deleteButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this rule?')) {
          deleteRule(rule.id);
        }
      });

      actionsCell.appendChild(editButton);
      actionsCell.appendChild(deleteButton);
      row.appendChild(actionsCell);

      // Insert before the new rule row
      rulesList.insertBefore(row, newRuleRow);
    });
    debugLog('Rules display completed');
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

  function editRule(row, rule) {
    // Set editing mode to disable other buttons
    setEditingMode(true);
    debugLog('Editing rule', { ruleId: rule.id, rule });

    const cells = row.cells;

    // Create inputs
    const inputs = ['match', 'header', 'value'].map((type, index) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = `${type}-input`;
      input.value = index === 0 ? rule.urlRule :
        index === 1 ? rule.header : rule.value;

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
    cells[cells.length-1].innerHTML = '';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'delete-button';

    saveButton.addEventListener('click', () => {
      debugLog('Saving edited rule', { ruleId: rule.id });
      const updatedRule = {
        urlRule: inputs[0].value.trim(),
        header: inputs[1].value.trim(),
        value: inputs[2].value.trim()
      };

      chrome.runtime.sendMessage({
        action: 'updateRule',
        ruleId: rule.id,
        updatedRule: updatedRule
      }, function (response) {
        debugLog('Update rule response', response);
        if (response && response.success) {
          setEditingMode(false);
          loadRules();
        } else {
          debugLog('Failed to update rule', { error: chrome.runtime.lastError });
          alert('Failed to update rule. Please try again.');
        }
      });
    });

    cancelButton.addEventListener('click', () => {
      debugLog('Cancelling rule edit');
      setEditingMode(false);
      loadRules();
    });

    cells[cells.length-1].appendChild(saveButton);
    cells[cells.length-1].appendChild(cancelButton);
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

    const rule = {
      urlRule: urlRule,
      header: header,
      value: value
    };

    debugLog('Adding new rule', rule);
    chrome.runtime.sendMessage({
      action: 'addRule',
      rule: rule
    }, function (response) {
      debugLog('Add rule response', response);
      if (response && response.success) {
        // Clear inputs
        matchInput.value = '';
        headerInput.value = '';
        valueInput.value = '';
        loadRules();
      } else {
        debugLog('Failed to add rule', { error: chrome.runtime.lastError });
        alert('Failed to add rule. Please try again.');
      }
    });
  }

  function deleteRule(ruleId) {
    debugLog('Deleting rule', { id: ruleId });
    chrome.runtime.sendMessage({
      action: 'deleteRule',
      ruleId: ruleId
    }, function (response) {
      debugLog('Delete rule response', response);
      if (response && response.success) {
        loadRules();
      } else {
        debugLog('Failed to delete rule', { error: chrome.runtime.lastError });
        alert('Failed to delete rule. Please try again.');
      }
    });
  }

  // Improved rule loading with fallback from storage
  function loadRules(retryCount = 0) {
    debugLog(`Loading rules (attempt ${retryCount + 1})`);

    // Show loading state (optional)
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
    }

    // Track timing for debugging
    const startTime = Date.now();

    chrome.runtime.sendMessage({ action: 'getRules' }, function (response) {
      const loadTime = Date.now() - startTime;
      debugLog(`Rules load request completed in ${loadTime}ms`);

      // Handle error or empty response
      if (chrome.runtime.lastError) {
        debugLog('Error loading rules from background', {
          error: chrome.runtime.lastError,
          retryCount
        });

        // Try to load directly from storage as fallback
        chrome.storage.sync.get(['headerRules'], function (result) {
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }

          if (result && result.headerRules) {
            debugLog('Successfully loaded rules from storage fallback', {
              count: result.headerRules.length
            });
            displayRules(result.headerRules);
          } else if (retryCount < 3) {
            // Retry a few times with increasing delay
            const retryDelay = 200 * (retryCount + 1);
            debugLog(`Will retry loading in ${retryDelay}ms`);
            setTimeout(() => {
              loadRules(retryCount + 1);
            }, retryDelay);
          } else {
            debugLog('All retries failed, giving up');
            displayRules([]);
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
            loadRules(retryCount + 1);
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
      if (response && response.rules) {
        debugLog('Successfully loaded rules from background', {
          count: response.rules.length
        });
        displayRules(response.rules);
      } else if (retryCount < 3) {
        debugLog('Invalid response format, missing rules property', { response });
        // Retry a few times with increasing delay
        const retryDelay = 200 * (retryCount + 1);
        debugLog(`Will retry loading in ${retryDelay}ms`);
        setTimeout(() => {
          loadRules(retryCount + 1);
        }, retryDelay);
      } else {
        debugLog('All retries failed, giving up');
        displayRules([]);
      }
    });
  }

  // Load request tracking stats
  function loadRequestStats() {
    debugLog('Loading request tracking stats');

    chrome.runtime.sendMessage({ action: 'getRequestStats' }, function(response) {
      if (chrome.runtime.lastError) {
        debugLog('Error loading request stats', chrome.runtime.lastError);
        return;
      }

      if (response) {
        // Update the counter
        matchedRequestCount.textContent = response.modifiedCount || 0;

        // Clear existing request list
        requestList.innerHTML = '';

        // Show/hide no requests message
        if (!response.recentRequests || response.recentRequests.length === 0) {
          noRequestsMessage.style.display = 'block';
          return;
        } else {
          noRequestsMessage.style.display = 'none';
        }

        // Add each request to the table
        response.recentRequests.forEach(request => {
          const row = document.createElement('tr');

          // Time cell
          const timeCell = document.createElement('td');
          const date = new Date(request.timestamp);
          timeCell.textContent = date.toLocaleTimeString();
          row.appendChild(timeCell);

          // URL cell
          const urlCell = document.createElement('td');
          urlCell.className = 'url-cell';
          urlCell.textContent = request.url;
          urlCell.title = request.url; // Show full URL on hover
          row.appendChild(urlCell);

          // Matched Rules cell
          const rulesCell = document.createElement('td');

          if (request.matchedRules && request.matchedRules.length > 0) {
            request.matchedRules.forEach(rule => {
              const ruleBadge = document.createElement('div');
              ruleBadge.className = 'rule-badge';
              ruleBadge.textContent = `${rule.header}: ${rule.value}`;
              ruleBadge.title = `Rule ID: ${rule.id}`;
              rulesCell.appendChild(ruleBadge);
            });
          } else {
            rulesCell.textContent = 'No rule details available';
          }

          row.appendChild(rulesCell);
          requestList.appendChild(row);
        });

        debugLog('Request stats loaded', { 
          count: response.modifiedCount, 
          recentRequests: response.recentRequests.length 
        });
      }
    });
  }

  // Clear request stats
  function clearRequestStats() {
    debugLog('Clearing request stats');

    chrome.runtime.sendMessage({ action: 'clearRequestStats' }, function(response) {
      if (chrome.runtime.lastError) {
        debugLog('Error clearing request stats', chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        // Reset UI
        matchedRequestCount.textContent = '0';
        requestList.innerHTML = '';
        noRequestsMessage.style.display = 'block';

        debugLog('Request stats cleared successfully');
      }
    });
  }

  // Event listeners
  saveNewRuleButton.addEventListener('click', handleNewRule);
  clearStatsButton.addEventListener('click', clearRequestStats);

  // Periodically check connection to background and reload rules if needed
  const checkBackgroundConnection = () => {
    debugLog('Checking background connection');
    chrome.runtime.sendMessage({ action: 'ping' }, function (response) {
      if (chrome.runtime.lastError) {
        debugLog('Background connection check failed, reloading rules', {
          error: chrome.runtime.lastError
        });
        loadRules();
      } else {
        debugLog('Background connection check successful');
      }
    });
  };

  // Check connection every 30 seconds
  setInterval(checkBackgroundConnection, 30000);

  // Auto-refresh request stats when the popup is open
  let requestStatsRefreshInterval = null;

  // Set up auto-refresh when the requests tab is active
  function setupRequestStatsRefresh() {
    const requestsTab = document.querySelector('[data-tab="requests-tab"]');
    if (requestsTab && requestsTab.classList.contains('active')) {
      // Set interval only if not already set
      if (!requestStatsRefreshInterval) {
        debugLog('Setting up request stats auto-refresh');
        requestStatsRefreshInterval = setInterval(loadRequestStats, 2000);
      }
    } else {
      // Clear interval if tab is not active
      if (requestStatsRefreshInterval) {
        debugLog('Clearing request stats auto-refresh');
        clearInterval(requestStatsRefreshInterval);
        requestStatsRefreshInterval = null;
      }
    }
  }

  // Check for tab changes to start/stop auto-refresh
  tabButtons.forEach(button => {
    button.addEventListener('click', setupRequestStatsRefresh);
  });

  // Initial setup - in case requests tab is active by default
  setupRequestStatsRefresh();
});