// This background script manages the declarativeNetRequest rules
// for modifying HTTP headers

let rules = [];
let ruleId = 1;
let modifiedRequestCount = 0;
let ruleMatchCounts = {}; // Track match counts per rule

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

const rotatingCharacters = ['◐', '◓', '◑', '◒'];
let rotationIndex = 0;

// Update badge with rotating characters
function updateBadge() {
  chrome.action.setBadgeText({ text: rotatingCharacters[rotationIndex] });
  chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
  rotationIndex = (rotationIndex + 1) % rotatingCharacters.length;
}

// Reset counters when extension starts
chrome.runtime.onStartup.addListener(() => {
  debugLog('Extension startup event triggered');
  modifiedRequestCount = 0;
  ruleMatchCounts = {};
  updateBadge();
});

// Load saved rules from storage when extension starts
chrome.storage.sync.get(['headerRules', 'ruleMatchCounts'], function (result) {
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

    // Load saved match counts if they exist
    if (result.ruleMatchCounts) {
      ruleMatchCounts = result.ruleMatchCounts;
    }

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
  } else if (message.action === 'addRule') {
    debugLog('Adding rule', message.rule);
    addRule(message.rule);
    sendResponse({ success: true });
  } else if (message.action === 'getRules') {
    debugLog('Getting rules, current count:', rules.length);
    // Include match counts with rules
    const rulesWithCounts = rules.map(rule => ({
      ...rule,
      matchCount: ruleMatchCounts[rule.id] || 0
    }));
    sendResponse({ rules: rulesWithCounts });
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

  // Update the dynamic rules
  updateDynamicRules();
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

    // Update the dynamic rules
    updateDynamicRules();
  } else {
    debugLog('Rule update failed - ID not found', id);
  }
}

// Delete a rule
function deleteRule(id) {
  const previousCount = rules.length;
  rules = rules.filter(rule => rule.id !== id);

  // Clean up match count for deleted rule
  delete ruleMatchCounts[id];
  chrome.storage.sync.set({ ruleMatchCounts });

  debugLog('Rule deleted', { id, previousCount, newCount: rules.length });

  // Save rules to storage
  chrome.storage.sync.set({ headerRules: rules }, () => {
    debugLog('Rules saved after deletion');
  });

  // Update the dynamic rules
  updateDynamicRules();
}

let ruleUpdateCounter = 0;
// Update the dynamic rules based on current rules
function updateDynamicRules() {
  ruleUpdateCounter++;
  let dynamicRules = [];

  debugLog('Updating dynamic rules', rules);

  // Get all existing rule IDs to remove them
  chrome.declarativeNetRequest.getDynamicRules(existingRules => {
    const existingRuleIds = existingRules.map(rule => rule.id);
    debugLog('Existing rule count to remove:', existingRuleIds.length);

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

      let dynamicRuleId = rule.id * 1_000_000 + ruleUpdateCounter * 1000;
      urlMatches.forEach(urlMatch => {
        dynamicRules.push({
          id: dynamicRuleId++,
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

    debugLog('New dynamic rules to add:', dynamicRules);

    // Remove old rules and add new ones
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: dynamicRules
    }, () => {
      if (chrome.runtime.lastError) {
        debugLog('Error updating dynamic rules:', chrome.runtime.lastError);
      } else {
        debugLog('Dynamic rules updated successfully');
      }
    });
  });
}

// Listen for header modifications
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  modifiedRequestCount++;

  debugLog('Header modification detected', info.rule, rules);

  // Find the rule that matched
  const matchedRule = rules.find(rule => {
    return Math.floor(info.rule.ruleId/1_000_000) === rule.id;
  });

  if (matchedRule) {
    // Increment the match count for this rule
    ruleMatchCounts[matchedRule.id] = (ruleMatchCounts[matchedRule.id] || 0) + 1;
    // Save updated counts to storage
    chrome.storage.sync.set({ ruleMatchCounts });

    debugLog('Match count updated', { rule: matchedRule, count: ruleMatchCounts[matchedRule.id] });
  }

  updateBadge();
});