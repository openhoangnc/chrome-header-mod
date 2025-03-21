#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to modify
const filesToUpdate = [
  path.join(__dirname, '../background.js'),
  path.join(__dirname, '../popup.js')
];

// Mode to set (passed as command line argument)
const targetMode = process.argv[2] === 'production' ? false : true;
const modeText = targetMode ? 'enabled' : 'disabled';

console.log(`Setting debug mode to ${modeText} (${targetMode})`);

filesToUpdate.forEach(filePath => {
  try {
    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the isDebugMode variable with our target mode
    // This regex looks for "const isDebugMode = " followed by anything, and replaces it with our value
    const isDebugModeRegex = /(const\s+isDebugMode\s*=\s*)[^;]+;/;
    
    if (isDebugModeRegex.test(content)) {
      content = content.replace(isDebugModeRegex, `$1${targetMode};`);
      
      // Write the modified content back to the file
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${path.basename(filePath)}`);
    } else {
      console.log(`❌ Could not find isDebugMode in ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log(`\nDebug mode ${modeText} in all files. Ready for ${targetMode ? 'development' : 'packaging'}.`);