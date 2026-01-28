# Changelog

All notable changes to Enable Copy Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-01-28

### Added
- **OCR Text Recognition**: Extract text from images and screenshots using Tesseract.js
  - Area selection tool for selecting regions on any webpage
  - Support for multiple languages (English included, custom languages can be added)
  - Upload custom `.traineddata.gz` language files via Options page
  - Automatic language file management in IndexedDB
  - Visual selection overlay with cancel button
  - Works on images, canvas elements, and regular page content
  - Text automatically copied to clipboard after recognition
  
### Technical Details
- New modules: `ocrManager.js`, `ocrSelector.js`, `languageStore.js`
- Integrated Tesseract.js v7 with custom worker patch
- Automatic patch applied via `postinstall` script to fix Tesseract.js bug
- IndexedDB storage for language files (compressed gzip format)
- Multi-language support via `Lang` objects API
- CSP policy updated to support WebAssembly and Workers
- Area capture with fallback methods (tab capture → canvas → DOM rendering)

### Fixed
- **Tesseract.js Bug**: Patched worker to fix `l.data` → `l.code` issue in initialize function
- This allows proper use of custom language files from memory

### Notes
- OCR works best with clear, high-contrast text
- Language files are stored compressed to save space
- Patch is automatically applied during `npm install`
- Backup of original worker file is created automatically

## [2.0.0] - 2024-XX-XX

### Added
- Standard and Force modes for different levels of copy protection bypass
- Whitelist functionality to exclude specific domains
- Global enable/disable toggle
- Badge indicators (OFF/ON/F) for current state
- Persistent settings using chrome.storage.local

### Changed
- Complete rewrite with modular architecture
- Webpack build system
- Manifest V3 migration
- Improved event handling with capture phase

### Technical
- Modular code structure with separate concerns
- Background service worker
- Content script with state management
- Popup with dynamic UI updates

## [1.0.0] - Initial Release

### Added
- Basic copy protection bypass functionality
- CSS user-select override
- Event listener blocking
