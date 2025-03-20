document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - screens
  const rulesListScreen = document.getElementById('rules-list-screen');
  const ruleEditScreen = document.getElementById('rule-edit-screen');
  
  // DOM elements - rule list screen
  const rulesListDiv = document.getElementById('rulesList');
  const addRuleButton = document.getElementById('addRuleButton');
  
  // DOM elements - rule edit screen
  const backToListButton = document.getElementById('backToListButton');
  const ruleFormTitle = document.getElementById('rule-form-title');
  const urlRuleInput = document.getElementById('urlRule');
  const operationsContainer = document.getElementById('operations-container');
  const addOperationButton = document.getElementById('addOperation');
  const saveRuleButton = document.getElementById('saveRule');
  
  // Variables to track state
  let isEditing = false;
  let editingRuleGroupId = null;
  let operationRowCounter = 0;

  // Screen navigation
  function showRulesListScreen() {
    rulesListScreen.style.display = 'block';
    ruleEditScreen.style.display = 'none';
    addRuleButton.style.display = 'block';
    backToListButton.style.display = 'none';
    clearForm();
    loadRuleGroups();
  }
  
  function showRuleEditScreen(isEdit = false, groupId = null) {
    rulesListScreen.style.display = 'none';
    ruleEditScreen.style.display = 'block';
    addRuleButton.style.display = 'none';
    backToListButton.style.display = 'block';
    
    // Set the form title based on whether we're editing
    ruleFormTitle.textContent = isEdit ? 'Edit Rule' : 'Add New Rule';
    
    // Clear form and initialize
    clearForm();
    
    // If editing, load the existing rule data
    if (isEdit && groupId !== null) {
      loadRuleGroupForEdit(groupId);
    }
  }
  
  // Button event listeners for navigation
  addRuleButton.addEventListener('click', function() {
    showRuleEditScreen(false);
  });
  
  backToListButton.addEventListener('click', async function() {
    // Confirm if user has unsaved changes
    if (await hasFormChanges()) {
      if (!confirm('You have unsaved changes. Are you sure you want to go back?')) {
        return;
      }
    }
    
    showRulesListScreen();
  });
  
  // Form change detection 
  async function hasFormChanges() {
    if (isEditing) {
      // Get current form values
      const currentUrlRule = urlRuleInput.value.trim();
      const currentOperations = collectOperations();
      
      // Get the original values
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getRuleGroup',
          ruleGroupId: editingRuleGroupId
        }, function(response) {
          if (response.ruleGroup) {
            const originalGroup = response.ruleGroup;
            
            // Compare URL rules
            if (currentUrlRule !== originalGroup.urlRule) {
              resolve(true);
              return;
            }
            
            // Compare operations
            if (currentOperations.length !== originalGroup.operations.length) {
              resolve(true);
              return;
            }
            
            // Compare each operation
            for (let i = 0; i < currentOperations.length; i++) {
              const curr = currentOperations[i];
              const orig = originalGroup.operations[i];
              if (curr.header !== orig.header || 
                  curr.operation !== orig.operation || 
                  curr.value !== orig.value) {
                resolve(true);
                return;
              }
            }
            resolve(false);
          } else {
            resolve(false);
          }
        });
      });
    } else {
      // For new rules, check if any fields are filled
      const urlRule = urlRuleInput.value.trim();
      const operations = collectOperations();
      return urlRule !== '' || operations.length > 0;
    }
  }

  // Add operation button handler
  addOperationButton.addEventListener('click', function() {
    addOperationRow();
  });

  // Function to add a new operation row
  function addOperationRow(headerValue = '', operationValue = 'set', valueValue = '') {
    const operationRow = document.createElement('div');
    operationRow.className = 'operation-row';
    
    // Create header input
    const headerGroup = document.createElement('div');
    headerGroup.className = 'form-group header-group';
    
    const headerLabel = document.createElement('label');
    headerLabel.setAttribute('for', `header-${operationRowCounter}`);
    headerLabel.textContent = 'Header Name:';
    
    const headerInput = document.createElement('input');
    headerInput.type = 'text';
    headerInput.className = 'header-input';
    headerInput.id = `header-${operationRowCounter}`;
    headerInput.placeholder = 'e.g., User-Agent';
    headerInput.value = headerValue;
    
    headerGroup.appendChild(headerLabel);
    headerGroup.appendChild(headerInput);
    
    // Create value input (no operation select needed since we only support 'set')
    const valueGroup = document.createElement('div');
    valueGroup.className = 'form-group value-group';
    
    const valueLabel = document.createElement('label');
    valueLabel.setAttribute('for', `value-${operationRowCounter}`);
    valueLabel.textContent = 'Value:';
    
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'value-input';
    valueInput.id = `value-${operationRowCounter}`;
    valueInput.placeholder = 'e.g., Mozilla/5.0...';
    valueInput.value = valueValue;
    
    valueGroup.appendChild(valueLabel);
    valueGroup.appendChild(valueInput);
    
    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-operation';
    removeButton.title = 'Remove this operation';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', function() {
      operationsContainer.removeChild(operationRow);
      
      // Show/hide remove buttons based on how many rows exist
      updateRemoveButtons();
    });
    
    // Add all elements to the row
    operationRow.appendChild(headerGroup);
    operationRow.appendChild(valueGroup);
    operationRow.appendChild(removeButton);
    
    // Add the row to the container
    operationsContainer.appendChild(operationRow);
    
    // Show/hide remove buttons
    updateRemoveButtons();
    
    // Update counter for next row
    operationRowCounter++;
  }

  // Remove setupOperationChangeHandlers since we no longer need it

  // Show/hide remove buttons based on number of operation rows
  function updateRemoveButtons() {
    const removeButtons = document.querySelectorAll('.remove-operation');
    
    if (removeButtons.length <= 1) {
      removeButtons.forEach(button => {
        button.style.display = 'none';
      });
    } else {
      removeButtons.forEach(button => {
        button.style.display = 'block';
      });
    }
  }

  // Helper function to collect all operations from the form
  function collectOperations() {
    const operations = [];
    const rows = operationsContainer.querySelectorAll('.operation-row');
    
    rows.forEach(row => {
      const headerInput = row.querySelector('.header-input');
      const valueInput = row.querySelector('.value-input');
      
      const header = headerInput.value.trim();
      const value = valueInput.value.trim();
      
      // Basic validation
      if (!header || !value) {
        return; // Skip this row if header or value is missing
      }
      
      operations.push({
        header: header,
        operation: 'set', // Always set since it's the only operation we support
        value: value
      });
    });
    
    return operations;
  }

  // Save rule button handler
  saveRuleButton.addEventListener('click', function() {
    const urlRule = urlRuleInput.value.trim();
    const operations = collectOperations();
    
    // Basic validation
    if (!urlRule) {
      alert('Please enter a URL rule');
      return;
    }
    
    if (operations.length === 0) {
      alert('Please add at least one valid header operation');
      return;
    }
    
    // Create the rule group object
    const ruleGroup = {
      urlRule: urlRule,
      operations: operations
    };
    
    if (isEditing) {
      // Update existing rule group
      chrome.runtime.sendMessage({
        action: 'updateRuleGroup',
        ruleGroupId: editingRuleGroupId,
        updatedRuleGroup: ruleGroup
      }, function(response) {
        if (response.success) {
          // Return to the rules list screen
          showRulesListScreen();
        }
      });
    } else {
      // Add new rule group
      chrome.runtime.sendMessage({
        action: 'addRuleGroup',
        ruleGroup: ruleGroup
      }, function(response) {
        if (response.success) {
          // Return to the rules list screen
          showRulesListScreen();
        }
      });
    }
  });

  // Helper function to clear the form
  function clearForm() {
    urlRuleInput.value = '';
    
    // Clear all operation rows
    operationsContainer.innerHTML = '';
    
    // Add a fresh first row
    addOperationRow();
    
    // Reset editing state
    isEditing = false;
    editingRuleGroupId = null;
  }

  // Load a rule group for editing
  function loadRuleGroupForEdit(ruleGroupId) {
    chrome.runtime.sendMessage({
      action: 'getRuleGroup',
      ruleGroupId: ruleGroupId
    }, function(response) {
      if (response.ruleGroup) {
        const ruleGroup = response.ruleGroup;
        
        // Set URL rule
        urlRuleInput.value = ruleGroup.urlRule;
        
        // Clear existing operations
        operationsContainer.innerHTML = '';
        
        // Add an operation row for each operation
        ruleGroup.operations.forEach((op, index) => {
          addOperationRow(op.header, op.operation, op.value);
        });
        
        // Set editing state
        isEditing = true;
        editingRuleGroupId = ruleGroupId;
      }
    });
  }

  // Load rule groups from background script
  function loadRuleGroups() {
    chrome.runtime.sendMessage({action: 'getRuleGroups'}, function(response) {
      displayRuleGroups(response.ruleGroups);
    });
  }

  // Display rule groups as rule cards
  function displayRuleGroups(ruleGroups) {
    rulesListDiv.innerHTML = '';
    
    if (!ruleGroups || ruleGroups.length === 0) {
      rulesListDiv.innerHTML = '<div class="no-rules">No rules added yet</div>';
      return;
    }

    ruleGroups.forEach(group => {
      const ruleCard = document.createElement('div');
      ruleCard.className = 'rule-card';
      ruleCard.dataset.id = group.id;
      
      // Rule header
      const ruleHeader = document.createElement('div');
      ruleHeader.className = 'rule-card-header';
      
      // Get the URL rules
      const urlRules = group.urlRule.split(',').map(p => p.trim()).filter(p => p);
      ruleHeader.textContent = urlRules.length > 1 
        ? `${urlRules[0]} and ${urlRules.length - 1} more...` 
        : urlRules[0];
      
      // Operations summary
      const ruleOperations = document.createElement('div');
      ruleOperations.className = 'rule-card-operations';
      ruleOperations.textContent = `${group.operations.length} operation${group.operations.length !== 1 ? 's' : ''}`;
      
      // Action buttons
      const ruleActions = document.createElement('div');
      ruleActions.className = 'rule-card-actions';
      
      const editButton = document.createElement('button');
      editButton.className = 'rule-card-edit';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', function(e) {
        e.stopPropagation();
        showRuleEditScreen(true, group.id);
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'rule-card-delete';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this rule?')) {
          deleteRuleGroup(group.id);
        }
      });
      
      ruleActions.appendChild(editButton);
      ruleActions.appendChild(deleteButton);
      
      // Make the entire card clickable to edit
      ruleCard.addEventListener('click', function() {
        showRuleEditScreen(true, group.id);
      });
      
      // Assemble the card
      ruleCard.appendChild(ruleHeader);
      ruleCard.appendChild(ruleOperations);
      ruleCard.appendChild(ruleActions);
      
      rulesListDiv.appendChild(ruleCard);
    });
  }

  // Delete a rule group
  function deleteRuleGroup(ruleGroupId) {
    chrome.runtime.sendMessage({
      action: 'deleteRuleGroup',
      ruleGroupId: ruleGroupId
    }, function(response) {
      if (response.success) {
        loadRuleGroups();
      }
    });
  }

  // Start the app - show the rules list screen
  showRulesListScreen();
});