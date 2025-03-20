document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - screens
  const patternsListScreen = document.getElementById('patterns-list-screen');
  const patternEditScreen = document.getElementById('pattern-edit-screen');
  
  // DOM elements - pattern list screen
  const patternsListDiv = document.getElementById('patternsList');
  const addPatternButton = document.getElementById('addPatternButton');
  
  // DOM elements - pattern edit screen
  const backToListButton = document.getElementById('backToListButton');
  const patternFormTitle = document.getElementById('pattern-form-title');
  const urlPatternInput = document.getElementById('urlPattern');
  const operationsContainer = document.getElementById('operations-container');
  const addOperationButton = document.getElementById('addOperation');
  const savePatternButton = document.getElementById('savePattern');
  
  // Variables to track state
  let isEditing = false;
  let editingRuleGroupId = null;
  let operationRowCounter = 0;

  // Screen navigation
  function showPatternsListScreen() {
    patternsListScreen.style.display = 'block';
    patternEditScreen.style.display = 'none';
    
    // Refresh the patterns list
    loadRuleGroups();
  }
  
  function showPatternEditScreen(isEdit = false, groupId = null) {
    patternsListScreen.style.display = 'none';
    patternEditScreen.style.display = 'block';
    
    // Set the form title based on whether we're editing
    patternFormTitle.textContent = isEdit ? 'Edit Pattern' : 'Add New Pattern';
    
    // Clear form and initialize
    clearForm();
    
    // If editing, load the existing pattern data
    if (isEdit && groupId !== null) {
      loadRuleGroupForEdit(groupId);
    }
  }
  
  // Button event listeners for navigation
  addPatternButton.addEventListener('click', function() {
    showPatternEditScreen(false);
  });
  
  backToListButton.addEventListener('click', function() {
    // Confirm if user has unsaved changes
    if (hasFormChanges()) {
      if (!confirm('You have unsaved changes. Are you sure you want to go back?')) {
        return;
      }
    }
    
    showPatternsListScreen();
  });
  
  // Form change detection (simplified implementation)
  function hasFormChanges() {
    // Consider any non-empty URL pattern as a change
    return urlPatternInput.value.trim() !== '';
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
    
    // Create operation select
    const operationGroup = document.createElement('div');
    operationGroup.className = 'form-group operation-group';
    
    const operationLabel = document.createElement('label');
    operationLabel.setAttribute('for', `operation-${operationRowCounter}`);
    operationLabel.textContent = 'Operation:';
    
    const operationSelect = document.createElement('select');
    operationSelect.className = 'operation-select';
    operationSelect.id = `operation-${operationRowCounter}`;
    
    const setOption = document.createElement('option');
    setOption.value = 'set';
    setOption.textContent = 'Set';
    
    const appendOption = document.createElement('option');
    appendOption.value = 'append';
    appendOption.textContent = 'Append';
    
    const removeOption = document.createElement('option');
    removeOption.value = 'remove';
    removeOption.textContent = 'Remove';
    
    operationSelect.appendChild(setOption);
    operationSelect.appendChild(appendOption);
    operationSelect.appendChild(removeOption);
    operationSelect.value = operationValue;
    
    operationGroup.appendChild(operationLabel);
    operationGroup.appendChild(operationSelect);
    
    // Create value input
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
    operationRow.appendChild(operationGroup);
    operationRow.appendChild(valueGroup);
    operationRow.appendChild(removeButton);
    
    // Add the row to the container
    operationsContainer.appendChild(operationRow);
    
    // Show/hide remove buttons and set up operation select change handlers
    updateRemoveButtons();
    setupOperationChangeHandlers();
    
    // Update counter for next row
    operationRowCounter++;
  }

  // Show/hide value inputs based on operation
  function setupOperationChangeHandlers() {
    const operationSelects = document.querySelectorAll('.operation-select');
    
    operationSelects.forEach(select => {
      // Remove any existing event listeners
      const newSelect = select.cloneNode(true);
      select.parentNode.replaceChild(newSelect, select);
      
      // Add new event listener
      newSelect.addEventListener('change', function() {
        const row = this.closest('.operation-row');
        const valueGroup = row.querySelector('.value-group');
        
        if (this.value === 'remove') {
          valueGroup.style.display = 'none';
        } else {
          valueGroup.style.display = 'block';
        }
      });
      
      // Set initial state
      const row = newSelect.closest('.operation-row');
      const valueGroup = row.querySelector('.value-group');
      
      if (newSelect.value === 'remove') {
        valueGroup.style.display = 'none';
      } else {
        valueGroup.style.display = 'block';
      }
    });
  }

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
      const operationSelect = row.querySelector('.operation-select');
      const valueInput = row.querySelector('.value-input');
      
      const header = headerInput.value.trim();
      const operation = operationSelect.value;
      const value = valueInput.value.trim();
      
      // Basic validation
      if (!header) {
        return; // Skip this row if no header
      }
      
      if (operation !== 'remove' && !value) {
        return; // Skip this row if value is required but missing
      }
      
      operations.push({
        header: header,
        operation: operation,
        value: operation !== 'remove' ? value : ''
      });
    });
    
    return operations;
  }

  // Save pattern button handler
  savePatternButton.addEventListener('click', function() {
    const urlPattern = urlPatternInput.value.trim();
    const operations = collectOperations();
    
    // Basic validation
    if (!urlPattern) {
      alert('Please enter a URL pattern');
      return;
    }
    
    if (operations.length === 0) {
      alert('Please add at least one valid header operation');
      return;
    }
    
    // Create the rule group object
    const ruleGroup = {
      urlPattern: urlPattern,
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
          // Return to the patterns list screen
          showPatternsListScreen();
        }
      });
    } else {
      // Add new rule group
      chrome.runtime.sendMessage({
        action: 'addRuleGroup',
        ruleGroup: ruleGroup
      }, function(response) {
        if (response.success) {
          // Return to the patterns list screen
          showPatternsListScreen();
        }
      });
    }
  });

  // Helper function to clear the form
  function clearForm() {
    urlPatternInput.value = '';
    
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
        
        // Set URL pattern
        urlPatternInput.value = ruleGroup.urlPattern;
        
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

  // Display rule groups as pattern cards
  function displayRuleGroups(ruleGroups) {
    patternsListDiv.innerHTML = '';
    
    if (!ruleGroups || ruleGroups.length === 0) {
      patternsListDiv.innerHTML = '<div class="no-rules">No patterns added yet</div>';
      return;
    }

    ruleGroups.forEach(group => {
      const patternCard = document.createElement('div');
      patternCard.className = 'pattern-card';
      patternCard.dataset.id = group.id;
      
      // Pattern header
      const patternHeader = document.createElement('div');
      patternHeader.className = 'pattern-card-header';
      
      // Get the URL patterns
      const urlPatterns = group.urlPattern.split(',').map(p => p.trim()).filter(p => p);
      patternHeader.textContent = urlPatterns.length > 1 
        ? `${urlPatterns[0]} and ${urlPatterns.length - 1} more...` 
        : urlPatterns[0];
      
      // Operations summary
      const patternOperations = document.createElement('div');
      patternOperations.className = 'pattern-card-operations';
      patternOperations.textContent = `${group.operations.length} operation${group.operations.length !== 1 ? 's' : ''}`;
      
      // Action buttons
      const patternActions = document.createElement('div');
      patternActions.className = 'pattern-card-actions';
      
      const editButton = document.createElement('button');
      editButton.className = 'pattern-card-edit';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', function(e) {
        e.stopPropagation();
        showPatternEditScreen(true, group.id);
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'pattern-card-delete';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this pattern?')) {
          deleteRuleGroup(group.id);
        }
      });
      
      patternActions.appendChild(editButton);
      patternActions.appendChild(deleteButton);
      
      // Make the entire card clickable to edit
      patternCard.addEventListener('click', function() {
        showPatternEditScreen(true, group.id);
      });
      
      // Assemble the card
      patternCard.appendChild(patternHeader);
      patternCard.appendChild(patternOperations);
      patternCard.appendChild(patternActions);
      
      patternsListDiv.appendChild(patternCard);
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

  // Start the app - show the patterns list screen
  showPatternsListScreen();
});