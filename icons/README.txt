Icon Generation Instructions

This directory contains the extension icons in various sizes:
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

The icons are generated from the icon.svg source file using the Sharp image processing library.
To regenerate the icons after modifying icon.svg, run:

npm run generate-icons

Current Icon Design:
- Dark gray background (#2F2F2F)
- Gold "H" character (#FFD700)
- Rounded corners (10px radius)
- Minimal padding for better visibility at small sizes

Note: The generation script uses Sharp for high-quality SVG to PNG conversion with proper anti-aliasing and rendering.