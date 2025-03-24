// This background script manages the declarativeNetRequest rules
// for modifying HTTP headers

let rules = [];
let ruleId = 1;
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

// Load saved rules from storage when extension starts
chrome.storage.sync.get(['headerRules'], function (result) {
  debugLog('Loading rules from storage', result);
  if (result.headerRules) {
    rules = result.headerRules;
    debugLog('Loaded rules count:', rules.length);

    // Find the highest existing ID to avoid duplicates after restart
    rules.forEach(rule => {
      if (rule.id >= ruleId) {
        ruleId = rule.id + 1;
      }
    });

    updateSessionRules();
  } else {
    debugLog('No saved rules found in storage');
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Message received', message);

  if (message.action === 'ping') {
    // Simple ping to check if background script is alive
    debugLog('Received ping, responding');
    sendResponse({ status: 'alive' });
  } else if (message.action === 'addRule') {
    debugLog('Adding rule', message.rule);
    addRule(message.rule);
    sendResponse({ success: true });
  } else if (message.action === 'getRules') {
    debugLog('Getting rules, current count:', rules.length);
    sendResponse({ rules: rules });
  } else if (message.action === 'deleteRule') {
    debugLog('Deleting rule', message.ruleId);
    deleteRule(message.ruleId);
    sendResponse({ success: true });
  } else if (message.action === 'updateRule') {
    debugLog('Updating rule', { id: message.ruleId, data: message.updatedRule });
    updateRule(message.ruleId, message.updatedRule);
    sendResponse({ success: true });
  } else if (message.action === 'getRule') {
    const rule = rules.find(r => r.id === message.ruleId);
    debugLog('Getting specific rule', { id: message.ruleId, found: !!rule });
    sendResponse({ rule: rule });
  }
  return true;
});

// Add a new rule
function addRule(rule) {
  // Create a unique ID for the rule and set enabled by default
  const newRule = {
    ...rule,
    id: ruleId++,
    enabled: true
  };

  rules.push(newRule);
  debugLog('Rule added, new count:', rules.length);

  // Save rules to storage
  chrome.storage.sync.set({ headerRules: rules }, () => {
    debugLog('Rules saved to storage');
  });

  // Update the session rules
  updateSessionRules();
}

// Update an existing rule
function updateRule(id, updatedRule) {
  const index = rules.findIndex(rule => rule.id === id);

  if (index !== -1) {
    // Keep the same rule ID and enabled state if not provided
    updatedRule.id = id;
    updatedRule.enabled = 'enabled' in updatedRule ? updatedRule.enabled : rules[index].enabled;

    rules[index] = updatedRule;

    debugLog('Rule updated', { id, index, updatedRule });

    // Save rules to storage
    chrome.storage.sync.set({ headerRules: rules }, () => {
      debugLog('Updated rules saved to storage');
    });

    // Update the session rules
    updateSessionRules();
  } else {
    debugLog('Rule update failed - ID not found', id);
  }
}

// Delete a rule
function deleteRule(id) {
  const previousCount = rules.length;
  rules = rules.filter(rule => rule.id !== id);

  debugLog('Rule deleted', { id, previousCount, newCount: rules.length });

  // Save rules to storage
  chrome.storage.sync.set({ headerRules: rules }, () => {
    debugLog('Rules saved after deletion');
  });

  // Update the session rules
  updateSessionRules();
}

let ruleUpdateCounter = 0;
// Update the session rules based on current rules
function updateSessionRules() {
  ruleUpdateCounter++;
  let sessionRules = [];

  debugLog('Updating session rules', rules);

  // Get all existing session rule IDs to remove them
  chrome.declarativeNetRequest.getSessionRules(existingRules => {
    const existingRuleIds = existingRules.map(rule => rule.id);
    debugLog('Existing session rule count to remove:', existingRuleIds.length);

    // Process each enabled rule
    rules.forEach(rule => {
      // Skip disabled rules
      if (!rule.enabled) {
        debugLog('Skipping disabled rule', { id: rule.id });
        return;
      }

      // Split URL rules by comma and trim whitespace
      const urlMatches = rule.urlRule.split(',')
        .map(rule => rule.trim())
        .filter(rule => rule.length > 0);

      debugLog('Processing rule', { rule, urlMatches });

      // For each URL rule, create a set of declarativeNetRequest rules
      let sessionRuleId = rule.id * 1_000_000 + ruleUpdateCounter * 1000;
      urlMatches.forEach(urlMatch => {
        sessionRules.push({
          id: sessionRuleId++,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              {
                header: rule.header,
                operation: 'set',
                value: rule.value
              }
            ]
          },
          condition: {
            urlFilter: urlMatch,
            resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"]
          }
        });
      });
    });

    debugLog('New session rules to add:', sessionRules);

    // Remove old rules and add new ones
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existingRuleIds,
      addRules: sessionRules
    }, () => {
      if (chrome.runtime.lastError) {
        debugLog('Error updating session rules:', chrome.runtime.lastError);
      } else {
        debugLog('Session rules updated successfully');
      }
    });
  });
}

// The onRuleMatchedDebug listener and related functionality has been removed
// as per request since it's not being used
