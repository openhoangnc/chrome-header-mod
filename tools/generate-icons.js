const sharp = require('sharp');

async function generateIcons() {
  const sizes = [16, 48, 128];
  
  try {
    for (const size of sizes) {
      await sharp('./icons/icon.svg')
        .resize(size, size)
        .png()
        .toFile(`./icons/icon${size}.png`);
      console.log(`Successfully generated icon${size}.png`);
    }
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();