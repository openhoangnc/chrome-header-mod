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
    // Replace text content with input fields
    const cells = row.cells;
    
    // URL Match input
    const matchInput = document.createElement('input');
    matchInput.type = 'text';
    matchInput.className = 'match-input';
    matchInput.value = group.urlRule;
    cells[0].textContent = '';
    cells[0].appendChild(matchInput);
    
    // Header Name input
    const headerInput = document.createElement('input');
    headerInput.type = 'text';
    headerInput.className = 'header-input';
    headerInput.value = operation.header;
    cells[1].textContent = '';
    cells[1].appendChild(headerInput);
    
    // Header Value input
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'value-input';
    valueInput.value = operation.value;
    cells[2].textContent = '';
    cells[2].appendChild(valueInput);
    
    // Replace buttons with Save/Cancel
    cells[3].innerHTML = '';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'delete-button';
    
    saveButton.addEventListener('click', () => {
      const updatedGroup = {
        urlRule: matchInput.value.trim(),
        operations: [{
          header: headerInput.value.trim(),
          operation: 'set',
          value: valueInput.value.trim()
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
    
    cancelButton.addEventListener('click', () => {
      loadRuleGroups();
    });
    
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