// This background script manages the declarativeNetRequest rules
// for modifying HTTP headers

let rules = [];
let ruleId = 1;
let modifiedRequestCount = 0;
let requestLog = [];
const MAX_LOG_ENTRIES = 300;

// Track which tabs have had headers modified
let tabsWithModifiedHeaders = new Set();

// Debug mode flag - will be automatically set by the build script
const isDebugMode = true;

// Debug logging function
function debugLog(message, data) {
  if (isDebugMode) {
    console.log(`[Background] ${message}`, data || '');
  }
}

// Badge colors
const BADGE_ACTIVE_COLOR = '#4CAF50'; // Green
const BADGE_INACTIVE_COLOR = '#757575'; // Gray

debugLog('Background script initialized');
debugLog('Debug mode:', isDebugMode);

// Set initial badge state
chrome.action.setBadgeBackgroundColor({ color: BADGE_INACTIVE_COLOR });
chrome.action.setBadgeText({ text: '' });

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
    // Check current tab after rules are loaded
    updateBadgeForCurrentTab();
  } else {
    debugLog('No saved rules found in storage');
  }
});

// Update badge for the current active tab
function updateBadgeForCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const tabId = tabs[0].tabId || tabs[0].id;
      const url = tabs[0].url;
      
      // Check both if the current URL matches any rules AND if this tab has had headers modified
      checkIfUrlMatchesRules(url, tabId);
    }
  });
}

// Check if a URL matches any of our rules
function checkIfUrlMatchesRules(url, tabId) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    // Skip chrome URLs as they can't have headers modified
    setBadgeState(false);
    return;
  }

  // Check if this tab has had headers modified
  const tabHasModifiedHeaders = tabId && tabsWithModifiedHeaders.has(tabId);
  
  // Default to no match
  let hasMatch = false;

  // Check each enabled rule
  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Split URL rules by comma and trim whitespace
    const urlMatches = rule.urlRule.split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    // Check if any of the URL patterns match the current URL
    for (const pattern of urlMatches) {
      if (isUrlMatchingPattern(url, pattern)) {
        hasMatch = true;
        debugLog('URL matches rule pattern', { url, pattern, ruleId: rule.id });
        break;
      }
    }

    if (hasMatch) break;
  }

  // Update badge state based on match result or if this tab has modified headers
  setBadgeState(hasMatch || tabHasModifiedHeaders);
  
  if (tabHasModifiedHeaders) {
    debugLog('Tab has previously modified headers', { tabId });
  }
}

// Simple URL pattern matching
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

// Set badge state (active/inactive)
function setBadgeState(isActive) {
  chrome.action.setBadgeBackgroundColor({ color: isActive ? BADGE_ACTIVE_COLOR : BADGE_INACTIVE_COLOR });
  chrome.action.setBadgeText({ text: isActive ? '✓' : '' });
  debugLog('Badge state updated', { isActive });
}

// Listen for tab events to update the badge
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      debugLog('Tab activated', { tabId: activeInfo.tabId, url: tab.url });
      checkIfUrlMatchesRules(tab.url, activeInfo.tabId);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react to URL changes and for the active tab
  if (changeInfo.url && tab.active) {
    debugLog('Tab URL updated', { tabId, url: changeInfo.url });
    checkIfUrlMatchesRules(changeInfo.url, tabId);
  }
});

// Remove from tracked tabs when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabsWithModifiedHeaders.has(tabId)) {
    debugLog('Removing closed tab from tracking', { tabId });
    tabsWithModifiedHeaders.delete(tabId);
  }
});

// WebRequest listener to track header modifications
function setupWebRequestListeners() {
  const filter = { urls: ["<all_urls>"] };
  
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const matchingRules = findMatchingRules(details.url);
      
      if (matchingRules.length > 0) {
        modifiedRequestCount++;
        
        // Track the tab that had headers modified
        if (details.tabId > 0) {  // Ignore background requests with tabId = -1
          tabsWithModifiedHeaders.add(details.tabId);
          debugLog('Added tab to tracking', { tabId: details.tabId });
          
          // If this is the active tab, update badge immediately
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id === details.tabId) {
              setBadgeState(true);
            }
          });
        }
        
        // Add to request log
        requestLog.unshift({
          timestamp: Date.now(),
          url: details.url,
          tabId: details.tabId,
          matchedRules: matchingRules.map(rule => ({
            id: rule.id,
            header: rule.header,
            value: rule.value
          }))
        });
        
        // Limit log size
        if (requestLog.length > MAX_LOG_ENTRIES) {
          requestLog.pop();
        }
        
        // Update badge text with count if needed
        if (isDebugMode) {
          chrome.action.setBadgeText({ text: modifiedRequestCount.toString() });
        }
        
        debugLog('Request matched rules', { 
          url: details.url, 
          tabId: details.tabId,
          ruleCnt: matchingRules.length,
          totalModified: modifiedRequestCount 
        });
      }
      
      return { requestHeaders: details.requestHeaders };
    },
    filter,
    ["requestHeaders"]
  );
}

// Find all rules matching this URL
function findMatchingRules(url) {
  const matchingRules = [];
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    const urlMatches = rule.urlRule.split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0);
      
    for (const pattern of urlMatches) {
      if (isUrlMatchingPattern(url, pattern)) {
        matchingRules.push(rule);
        break; // Only add each rule once
      }
    }
  }
  
  return matchingRules;
}

// Initialize the webRequest listener
setupWebRequestListeners();

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
    updateBadgeForCurrentTab();
    sendResponse({ success: true });
  } else if (message.action === 'getRules') {
    debugLog('Getting rules, current count:', rules.length);
    sendResponse({ rules: rules });
  } else if (message.action === 'deleteRule') {
    debugLog('Deleting rule', message.ruleId);
    deleteRule(message.ruleId);
    updateBadgeForCurrentTab();
    sendResponse({ success: true });
  } else if (message.action === 'updateRule') {
    debugLog('Updating rule', { id: message.ruleId, data: message.updatedRule });
    updateRule(message.ruleId, message.updatedRule);
    updateBadgeForCurrentTab();
    sendResponse({ success: true });
  } else if (message.action === 'getRule') {
    const rule = rules.find(r => r.id === message.ruleId);
    debugLog('Getting specific rule', { id: message.ruleId, found: !!rule });
    sendResponse({ rule: rule });
  } else if (message.action === 'getRequestStats') {
    sendResponse({ 
      modifiedCount: modifiedRequestCount,
      recentRequests: requestLog
    });
  } else if (message.action === 'clearRequestStats') {
    modifiedRequestCount = 0;
    requestLog = [];
    tabsWithModifiedHeaders.clear();
    chrome.action.setBadgeText({ text: '' });
    updateBadgeForCurrentTab();
    sendResponse({ success: true });
  } else if (message.action === 'getTabStats') {
    // New method to get tab-specific stats
    sendResponse({
      tabsWithModifications: Array.from(tabsWithModifiedHeaders)
    });
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
        // Update badge after rules are updated
        updateBadgeForCurrentTab();
      }
    });
  });
}
