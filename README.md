# HTTP Header Modifier

A Chrome extension that allows you to modify HTTP request headers for specific URLs. Perfect for developers, testers, and security professionals who need to customize their web requests.

## Features

- Add, modify, or remove HTTP headers for specific URLs
- Support for multiple header modifications per URL pattern
- User-friendly interface with instant feedback
- Persistent storage of header rules
- Support for URL patterns and wildcards
- Live preview of active rules

## Installation

### From Chrome Web Store

1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/lhjnapningfniffjhppldmpgebkdahpp?utm_source=item-share-cb)
2. Click "Add to Chrome" to install the extension

### Manual Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in Chrome's toolbar
2. Add a new rule by filling in:
   - URL Pattern (e.g., `*://*.example.com/*`)
   - Header Name
   - Header Value
3. Click "Save" to activate the rule

### URL Pattern Examples

- `*://*.example.com/*` - Match all pages on example.com and its subdomains
- `*://api.example.com/*` - Match specific subdomain
- `*://*/*` - Match all URLs (use with caution)

## Development

### Prerequisites

- Node.js and npm

### Setup

```bash
# Install dependencies
npm install

# Generate icons
npm run generate-icons

# Toggle debug mode on (development)
npm run debug:on

# Toggle debug mode off (production)
npm run debug:off

# Build and package the extension (sets to production mode)
npm run build

# Package the extension
npm run package
```

### Debug Mode

The extension includes a debug mode that can be toggled on or off:
- `npm run debug:on` - Enables additional logging and debug features
- `npm run debug:off` - Disables debug features for production use
- `npm run build` - Convenience script that disables debug mode and packages the extension

### Project Structure

- `manifest.json` - Extension configuration
- `background.js` - Background service worker for header modifications
- `popup.html/js/css` - Extension popup interface
- `icons/` - Extension icons in various sizes

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is open source and available under the MIT License.

## Privacy

This extension:
- Does not collect any personal information
- Only modifies headers for user-specified URLs
- Stores all rules locally on your device
- Does not communicate with external servers

## Support

If you encounter any issues or have suggestions, please file an issue on the GitHub repository.