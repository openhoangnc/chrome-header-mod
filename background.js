// This background script manages the declarativeNetRequest rules
// for modifying HTTP headers

let ruleGroups = [];
let ruleGroupId = 1;
let nextRuleId = 1000; // Start with a high ID to avoid conflicts
let modifiedRequestCount = 0;

// Update badge with current count
function updateBadge() {
  chrome.action.setBadgeText({ text: modifiedRequestCount.toString() });
  chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
}

// Reset counter when extension starts
chrome.runtime.onStartup.addListener(() => {
  modifiedRequestCount = 0;
  updateBadge();
});

// Load saved rule groups from storage when extension starts
chrome.storage.local.get(['headerRuleGroups'], function(result) {
  if (result.headerRuleGroups) {
    ruleGroups = result.headerRuleGroups;
    
    // Find the highest existing ID to avoid duplicates after restart
    ruleGroups.forEach(group => {
      if (group.id >= ruleGroupId) {
        ruleGroupId = group.id + 1;
      }
    });
    
    updateDynamicRules();
  }
  updateBadge(); // Initialize badge
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addRuleGroup') {
    addRuleGroup(message.ruleGroup);
    sendResponse({success: true});
  } else if (message.action === 'getRuleGroups') {
    sendResponse({ruleGroups: ruleGroups});
  } else if (message.action === 'deleteRuleGroup') {
    deleteRuleGroup(message.ruleGroupId);
    sendResponse({success: true});
  } else if (message.action === 'updateRuleGroup') {
    updateRuleGroup(message.ruleGroupId, message.updatedRuleGroup);
    sendResponse({success: true});
  } else if (message.action === 'getRuleGroup') {
    const ruleGroup = ruleGroups.find(r => r.id === message.ruleGroupId);
    sendResponse({ruleGroup: ruleGroup});
  }
  return true;
});

// Add a new rule group
function addRuleGroup(ruleGroup) {
  // Create a unique ID for the rule group
  const newRuleGroup = {
    ...ruleGroup,
    id: ruleGroupId++
  };
  
  ruleGroups.push(newRuleGroup);
  
  // Save rule groups to storage
  chrome.storage.local.set({headerRuleGroups: ruleGroups});
  
  // Update the dynamic rules
  updateDynamicRules();
}

// Update an existing rule group
function updateRuleGroup(id, updatedRuleGroup) {
  const index = ruleGroups.findIndex(group => group.id === id);
  
  if (index !== -1) {
    // Keep the same rule group ID
    updatedRuleGroup.id = id;
    ruleGroups[index] = updatedRuleGroup;
    
    // Save rule groups to storage
    chrome.storage.local.set({headerRuleGroups: ruleGroups});
    
    // Update the dynamic rules
    updateDynamicRules();
  }
}

// Delete a rule group
function deleteRuleGroup(id) {
  ruleGroups = ruleGroups.filter(group => group.id !== id);
  
  // Save rule groups to storage
  chrome.storage.local.set({headerRuleGroups: ruleGroups});
  
  // Update the dynamic rules
  updateDynamicRules();
}

// Update the dynamic rules based on current rule groups
function updateDynamicRules() {
  let dynamicRules = [];
  let ruleCounter = nextRuleId;
  
  // Get all existing rule IDs to remove them
  chrome.declarativeNetRequest.getDynamicRules(existingRules => {
    const existingRuleIds = existingRules.map(rule => rule.id);
    
    // Process each rule group
    ruleGroups.forEach(group => {
      // Split URL rules by comma and trim whitespace
      const urlRules = group.urlRule.split(',')
                                         .map(rule => rule.trim())
                                         .filter(rule => rule.length > 0);
      
      // For each URL rule, create a set of declarativeNetRequest rules - one for each operation
      urlRules.forEach(urlRule => {
        group.operations.forEach(operation => {
          // Skip operations without required fields
          if (!operation.header) return;
          if (operation.operation !== 'remove' && !operation.value) return;
          
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
    
    // Remove old rules and add new ones
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: dynamicRules
    }, () => {
      // Update the next rule ID for future rules
      nextRuleId = ruleCounter;
    });
  });
}

// Listen for header modifications
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  modifiedRequestCount++;
  updateBadge();
});