// webpack.config.js
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin"); // Import the copy plugin
const ZipPlugin = require("zip-webpack-plugin"); // Import the zip plugin
const packageJson = require("./package.json"); // Import package.json for version info

// --- Configuration for Archive ---
const extensionName = packageJson.name || "extension"; // Use name from package.json or default
const extensionVersion = packageJson.version || "1.0.0"; // Use version from package.json
// Define the output archive name using name and version
const archiveName = `${extensionName}-v${extensionVersion}.zip`;

// --- Build Mode ---
// Determine build mode (development or production) based on NODE_ENV
const isProduction = process.env.NODE_ENV === "production";
const mode = isProduction ? "production" : "development";

module.exports = {
  mode: mode, // Set mode based on NODE_ENV
  // --- Entry Points ---
  // Define source files for each bundle (remains the same)
  entry: {
    "background/main": "./src/background/main.js",
    "content/content": "./src/content/content.js",
    "popup/popup": "./src/popup/popup.js",
    "options/options": "./src/options/options.js",
  },
  // --- Output Configuration ---
  output: {
    // Define output filename pattern for JS bundles
    // Puts bundled JS into a 'scripts' subdirectory within the output path
    filename: "scripts/[name].js",
    // Define the ABSOLUTE path for ALL build output
    path: path.resolve(__dirname, "dist"),
    // Clean the output directory before each build (recommended for 'dist')
    clean: true,
  },
  // --- Module Resolution ---
  resolve: {
    extensions: [".js"], // Default JS extension resolution
  },
  // --- Module Loaders ---
  module: {
    rules: [
      // Add loaders here if needed (e.g., Babel for older JS compatibility)
    ],
  },
  // --- Source Maps ---
  // Generate source maps only for development builds for easier debugging
  devtool: isProduction ? false : "cheap-module-source-map",
  // --- Plugins ---
  plugins: [
    // Plugin to copy static files from source to the output directory ('dist')
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "." }, // Copy manifest.json to dist root
        { from: "icons", to: "icons" }, // Copy icons folder to dist/icons
        { from: "static", to: "static" }, // Copy static folder to dist/static
        // tesseract
        {
          from: "node_modules/tesseract.js/dist/worker.min.js",
          to: "static/tesseract/worker.min.js",
        },
        {
          from: "node_modules/tesseract.js-core/tesseract-core-simd.wasm.js",
          to: "static/tesseract/tesseract-core-simd.wasm.js",
        },
        {
          from: "node_modules/tesseract.js-core/tesseract-core-simd.wasm",
          to: "static/tesseract/tesseract-core-simd.wasm",
        },
      ],
    }),
    // Plugin to create a zip archive AFTER the build is complete
    // Conditionally added only when running in production mode
    ...(isProduction
      ? [
          // Spread operator adds ZipPlugin only if isProduction is true
          new ZipPlugin({
            // Define the path where the zip archive will be saved (relative to project root)
            // e.g., a 'releases' folder in the project root
            path: path.resolve(__dirname, "releases"),
            // Define the filename for the zip archive
            filename: archiveName,
            // Define the archive extension
            extension: "zip",
            // IMPORTANT: By default, ZipPlugin zips the 'output.path' directory ('dist').
            // Using pathPrefix avoids including the 'dist' folder itself inside the archive.
            // You might need to adjust depending on the plugin version's default behavior.
            // Check plugin docs if the structure inside the zip isn't right.

            // Optional: Exclude source maps from the production zip archive
            // exclude: [/\.map$/],
          }),
        ]
      : []), // If not production, this results in an empty array (no ZipPlugin added)
  ],
  // --- Watch Mode ---
  // Enable watch mode only for development builds
  watch: !isProduction,
};
