/**
 * Thunderbird Vericode - Build Script
 * Used to package the plugin into an XPI file
 * Only includes files necessary for plugin operation
 */

import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get current file path and directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version info from manifest.json
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const version = manifest.version;

// Create output directory
const outputDir = path.join(__dirname, "dist");
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir);
}

// Output file path
const outputFile = path.join(outputDir, `thunderbird-vericode-${version}.xpi`);

// Create file write stream
const output = fs.createWriteStream(outputFile);
const archive = archiver("zip", {
	zlib: { level: 9 }, // Maximum compression level
});

// Listen for output stream end event
output.on("close", () => {
	console.log(`XPI file created successfully: ${outputFile}`);
	console.log(`File size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
});

// Listen for error events
archive.on("error", (err) => {
	throw err;
});

// Pipe output stream to archive
archive.pipe(output);

// Define necessary plugin files
const necessaryFiles = [
	// Plugin manifest file, defines basic info and permissions
	{ path: "manifest.json", type: "file" },

	// Background script containing main plugin logic
	{ path: "background.js", type: "file" },

	// Icon files for toolbar and plugin management page
	{ path: "icons", type: "directory" },

	// Options page for plugin configuration
	{ path: "options", type: "directory" },

	// License file
	{ path: "LICENSE", type: "file" },
];

// Add necessary files to archive
necessaryFiles.forEach((item) => {
	const itemPath = path.join(__dirname, item.path);

	if (fs.existsSync(itemPath)) {
		if (item.type === "directory") {
			// Add directory
			archive.directory(itemPath, item.path);
			console.log(`Adding directory: ${item.path}`);
		} else {
			// Add file
			archive.file(itemPath, { name: item.path });
			console.log(`Adding file: ${item.path}`);
		}
	} else {
		console.warn(`Warning: ${item.path} does not exist, skipped`);
	}
});

// Finalize archive
archive.finalize();
