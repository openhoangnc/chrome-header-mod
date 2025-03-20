document.addEventListener('DOMContentLoaded', function() {
  const rulesList = document.getElementById('rulesList');
  const newRuleRow = document.getElementById('newRuleRow');
  const saveNewRuleButton = document.getElementById('saveNewRule');
  
  function displayRuleGroups(ruleGroups) {
    // Clear existing rules but keep the new rule row
    while (rulesList.firstChild && rulesList.firstChild !== newRuleRow) {
      rulesList.removeChild(rulesList.firstChild);
    }
    
    if (!ruleGroups || ruleGroups.length === 0) {
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
  }
  
  function editRule(row, group, operation) {
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
    cells[3].innerHTML = '';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'delete-button';
    
    saveButton.addEventListener('click', () => {
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
        if (response.success) {
          loadRuleGroups();
        }
      });
    });
    
    cancelButton.addEventListener('click', loadRuleGroups);
    
    cells[3].appendChild(saveButton);
    cells[3].appendChild(cancelButton);
  }
  
  function handleNewRule() {
    const matchInput = newRuleRow.querySelector('.match-input');
    const headerInput = newRuleRow.querySelector('.header-input');
    const valueInput = newRuleRow.querySelector('.value-input');
    
    const urlRule = matchInput.value.trim();
    const header = headerInput.value.trim();
    const value = valueInput.value.trim();
    
    if (!urlRule || !header || !value) {
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
    
    chrome.runtime.sendMessage({
      action: 'addRuleGroup',
      ruleGroup: ruleGroup
    }, function(response) {
      if (response.success) {
        // Clear inputs
        matchInput.value = '';
        headerInput.value = '';
        valueInput.value = '';
        loadRuleGroups();
      }
    });
  }
  
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
  
  function loadRuleGroups() {
    chrome.runtime.sendMessage({ action: 'getRuleGroups' }, function(response) {
      displayRuleGroups(response.ruleGroups);
    });
  }
  
  // Event listeners
  saveNewRuleButton.addEventListener('click', handleNewRule);
  
  // Initialize
  loadRuleGroups();
});