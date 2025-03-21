// This background script manages the declarativeNetRequest rules
// for modifying HTTP headers

let ruleGroups = [];
let ruleGroupId = 1;
let nextRuleId = 1000; // Start with a high ID to avoid conflicts
let modifiedRequestCount = 0;

// Debug mode flag - will be automatically set by the build script
const isDebugMode = true;

// Debug logging function
function debugLog(message, data) {
  if (isDebugMode) {
    console.log(`[Background] ${message}`, data || '');
  }
}

debugLog('Background script initialized');
debugLog('Debug mode:', isDebugMode);

// Update badge with current count
function updateBadge() {
  chrome.action.setBadgeText({ text: modifiedRequestCount.toString() });
  chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
}

// Reset counter when extension starts
chrome.runtime.onStartup.addListener(() => {
  debugLog('Extension startup event triggered');
  modifiedRequestCount = 0;
  updateBadge();
});

// Load saved rule groups from storage when extension starts
chrome.storage.sync.get(['headerRuleGroups'], function(result) {
  debugLog('Loading rules from storage', result);
  if (result.headerRuleGroups) {
    ruleGroups = result.headerRuleGroups;
    debugLog('Loaded rule groups count:', ruleGroups.length);
    
    // Find the highest existing ID to avoid duplicates after restart
    ruleGroups.forEach(group => {
      if (group.id >= ruleGroupId) {
        ruleGroupId = group.id + 1;
      }
    });
    
    updateDynamicRules();
  } else {
    debugLog('No saved rules found in storage');
  }
  updateBadge(); // Initialize badge
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Message received', message);
  
  if (message.action === 'ping') {
    // Simple ping to check if background script is alive
    debugLog('Received ping, responding');
    sendResponse({ status: 'alive' });
  } else if (message.action === 'addRuleGroup') {
    debugLog('Adding rule group', message.ruleGroup);
    addRuleGroup(message.ruleGroup);
    sendResponse({success: true});
  } else if (message.action === 'getRuleGroups') {
    debugLog('Getting rule groups, current count:', ruleGroups.length);
    sendResponse({ruleGroups: ruleGroups});
  } else if (message.action === 'deleteRuleGroup') {
    debugLog('Deleting rule group', message.ruleGroupId);
    deleteRuleGroup(message.ruleGroupId);
    sendResponse({success: true});
  } else if (message.action === 'updateRuleGroup') {
    debugLog('Updating rule group', {id: message.ruleGroupId, data: message.updatedRuleGroup});
    updateRuleGroup(message.ruleGroupId, message.updatedRuleGroup);
    sendResponse({success: true});
  } else if (message.action === 'getRuleGroup') {
    const ruleGroup = ruleGroups.find(r => r.id === message.ruleGroupId);
    debugLog('Getting specific rule group', {id: message.ruleGroupId, found: !!ruleGroup});
    sendResponse({ruleGroup: ruleGroup});
  }
  return true;
});

// Add a new rule group
function addRuleGroup(ruleGroup) {
  // Create a unique ID for the rule group and set enabled by default
  const newRuleGroup = {
    ...ruleGroup,
    id: ruleGroupId++,
    enabled: true
  };
  
  ruleGroups.push(newRuleGroup);
  debugLog('Rule group added, new count:', ruleGroups.length);
  
  // Save rule groups to storage
  chrome.storage.sync.set({headerRuleGroups: ruleGroups}, () => {
    debugLog('Rule groups saved to storage');
  });
  
  // Update the dynamic rules
  updateDynamicRules();
}

// Update an existing rule group
function updateRuleGroup(id, updatedRuleGroup) {
  const index = ruleGroups.findIndex(group => group.id === id);
  
  if (index !== -1) {
    // Keep the same rule group ID and enabled state if not provided
    updatedRuleGroup.id = id;
    updatedRuleGroup.enabled = 'enabled' in updatedRuleGroup ? updatedRuleGroup.enabled : ruleGroups[index].enabled;
    
    ruleGroups[index] = updatedRuleGroup;
    
    debugLog('Rule group updated', {id, index, updatedRuleGroup});
    
    // Save rule groups to storage
    chrome.storage.sync.set({headerRuleGroups: ruleGroups}, () => {
      debugLog('Updated rule groups saved to storage');
    });
    
    // Update the dynamic rules
    updateDynamicRules();
  } else {
    debugLog('Rule group update failed - ID not found', id);
  }
}

// Delete a rule group
function deleteRuleGroup(id) {
  const previousCount = ruleGroups.length;
  ruleGroups = ruleGroups.filter(group => group.id !== id);
  
  debugLog('Rule group deleted', {id, previousCount, newCount: ruleGroups.length});
  
  // Save rule groups to storage
  chrome.storage.sync.set({headerRuleGroups: ruleGroups}, () => {
    debugLog('Rule groups saved after deletion');
  });
  
  // Update the dynamic rules
  updateDynamicRules();
}

// Update the dynamic rules based on current rule groups
function updateDynamicRules() {
  let dynamicRules = [];
  let ruleCounter = nextRuleId;
  
  debugLog('Updating dynamic rules, group count:', ruleGroups.length);
  
  // Get all existing rule IDs to remove them
  chrome.declarativeNetRequest.getDynamicRules(existingRules => {
    const existingRuleIds = existingRules.map(rule => rule.id);
    debugLog('Existing rule count to remove:', existingRuleIds.length);
    
    // Process each enabled rule group
    ruleGroups.forEach(group => {
      // Skip disabled rules
      if (!group.enabled) {
        debugLog('Skipping disabled rule group', {id: group.id});
        return;
      }

      // Split URL rules by comma and trim whitespace
      const urlRules = group.urlRule.split(',')
                                   .map(rule => rule.trim())
                                   .filter(rule => rule.length > 0);
      
      debugLog('Processing rule group', {id: group.id, urlRules});
      
      // For each URL rule, create a set of declarativeNetRequest rules - one for each operation
      urlRules.forEach(urlRule => {
        group.operations.forEach(operation => {
          // Skip operations without required fields
          if (!operation.header) {
            debugLog('Skipping operation with no header', operation);
            return;
          }
          if (operation.operation !== 'remove' && !operation.value) {
            debugLog('Skipping non-remove operation with no value', operation);
            return;
          }
          
          dynamicRules.push({
            id: ruleCounter++,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {
                  header: operation.header,
                  operation: operation.operation,
                  value: operation.value || '' // Ensure value exists for non-remove operations
                }
              ]
            },
            condition: {
              urlFilter: urlRule,
              resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"]
            }
          });
        });
      });
    });
    
    debugLog('New dynamic rules to add:', dynamicRules.length);
    
    // Remove old rules and add new ones
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: dynamicRules
    }, () => {
      if (chrome.runtime.lastError) {
        debugLog('Error updating dynamic rules:', chrome.runtime.lastError);
      } else {
        debugLog('Dynamic rules updated successfully');
        // Update the next rule ID for future rules
        nextRuleId = ruleCounter;
      }
    });
  });
}

// Listen for header modifications
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  modifiedRequestCount++;
  updateBadge();
});