#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const outputZip = path.join(rootDir, 'chrome-header-mod.zip');

console.log('🚀 Building extension package...');

// Files to include in the zip
const filesToInclude = [
  'manifest.json',
  'background.js',
  'popup.js',
  'popup.html',
  'popup.css',
  'README.md',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

// Step 1: Set debug mode to production (false)
console.log('\n📋 Step 1: Setting debug mode to production...');
exec(`node ${path.join(__dirname, 'set-debug-mode.js')} production`, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error setting debug mode: ${error.message}`);
    process.exit(1);
  }
  
  console.log(stdout);
  
  // Step 2: Create zip file
  console.log('\n📋 Step 2: Creating zip file...');
  
  // Check if zip file already exists and remove it
  if (fs.existsSync(outputZip)) {
    console.log(`Removing existing zip file: ${outputZip}`);
    fs.unlinkSync(outputZip);
  }
  
  // Create zip command - adapt as needed for your environment
  const zipCmd = process.platform === 'win32'
    ? `powershell Compress-Archive -Path "${filesToInclude.map(f => path.join(rootDir, f).replace(/\//g, '\\\\')).join('","')}" -DestinationPath "${outputZip}"`
    : `cd "${rootDir}" && zip -r "${outputZip}" ${filesToInclude.join(' ')}`;
  
  exec(zipCmd, (zipError, zipStdout, zipStderr) => {
    if (zipError) {
      console.error(`❌ Error creating zip: ${zipError.message}`);
      console.error(zipStderr);
      
      // Even if zip fails, try to restore debug mode
      restoreDebugMode();
      return;
    }
    
    console.log(`✅ Successfully created extension package: ${outputZip}`);
    console.log(zipStdout);
    
    // Step 3: Set debug mode back to development (true)
    restoreDebugMode();
  });
});

function restoreDebugMode() {
  console.log('\n📋 Step 3: Restoring debug mode for development...');
  exec(`node ${path.join(__dirname, 'set-debug-mode.js')} development`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error restoring debug mode: ${error.message}`);
      process.exit(1);
    }
    
    console.log(stdout);
    console.log('\n✅ Build process completed!');
  });
}