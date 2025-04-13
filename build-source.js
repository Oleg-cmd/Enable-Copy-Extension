// build-source.js
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const packageJson = require("./package.json");

// --- Configuration ---
const extensionName = packageJson.name || "extension";
const extensionVersion = packageJson.version || "1.0.0";
const outputDir = path.resolve(__dirname, "releases"); // Directory for the final zip
const outputFilename = `${extensionName}-v${extensionVersion}-src.zip`; // Output filename
const outputPath = path.join(outputDir, outputFilename);

// Files and directories to include in the source archive
const sourceItems = [
  { type: "directory", path: "src", name: "src" }, // Source code
  { type: "directory", path: "icons", name: "icons" }, // Icons
  { type: "directory", path: "static", name: "static" }, // Static assets
  { type: "file", path: "package.json", name: "package.json" },
  { type: "file", path: "package-lock.json", name: "package-lock.json" }, // VERY IMPORTANT
  { type: "file", path: "manifest.json", name: "manifest.json" },
  { type: "file", path: "webpack.config.js", name: "webpack.config.js" },
  {
    type: "file",
    path: "BUILD_INSTRUCTIONS.md",
    name: "BUILD_INSTRUCTIONS.md",
  }, // Include instructions
  // Add any other necessary config files (e.g., .babelrc, .eslintrc if needed for build)
];

// --- Create Archive ---

console.log(
  `Creating source archive for ${extensionName} v${extensionVersion}...`
);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  console.log(`Creating output directory: ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create a file stream to write the archive to
const output = fs.createWriteStream(outputPath);
const archive = archiver("zip", {
  zlib: { level: 9 }, // Sets the compression level (optional)
});

// Listen for all archive data to be written
// 'close' event is fired only when a file descriptor is involved
output.on("close", function () {
  console.log(`Successfully created source archive: ${outputPath}`);
  console.log(`Total size: ${archive.pointer()} bytes`);
});

// 'end' event is fired when the data source drains.
output.on("end", function () {
  console.log("Data has been drained");
});

// Good practice to catch warnings (ie stat failures and other non-blocking errors)
archive.on("warning", function (err) {
  if (err.code === "ENOENT") {
    console.warn("Archiver warning: ", err);
  } else {
    // Throw error
    throw err;
  }
});

// Catch errors
archive.on("error", function (err) {
  console.error("Error creating archive:", err);
  throw err;
});

// Pipe archive data to the file stream
archive.pipe(output);

// Add items to the archive
sourceItems.forEach((item) => {
  const itemPath = path.resolve(__dirname, item.path);
  if (fs.existsSync(itemPath)) {
    if (item.type === "directory") {
      console.log(`Adding directory: ${item.path} as ${item.name}`);
      archive.directory(itemPath, item.name);
    } else {
      console.log(`Adding file: ${item.path} as ${item.name}`);
      archive.file(itemPath, { name: item.name });
    }
  } else {
    console.warn(`Item not found, skipping: ${item.path}`);
  }
});

// Finalize the archive (ie we are done appending files but streams have to finish yet)
// 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
console.log("Finalizing archive...");
archive.finalize();
