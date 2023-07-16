import fs from 'fs/promises';
import path from 'path';
import { generateSalesVAD } from './utils/generateRepVAD.js';
import pLimit from 'p-limit';

// ------------------------------------------------- //
// ----------- BATCH PROCESS AUDIO FILES ----------- //
// ------------------------------------------------- //

async function processFilesInFolder(sourceFolder, destinationFolder) {
    const limit = pLimit(10); // Limit concurrency to 10
    try {
        // Read all files in the directory
        const files = await fs.readdir(sourceFolder);

        // Map each file to a promise
        const promises = files.map((fileNameWithExtension) => {
            // Limit # of concurrent requests
            return limit(async () => {
                // Generate & Save Voice Activity Data
                const vaData = await generateSalesVAD(
                    sourceFolder,
                    fileNameWithExtension
                );
                await saveData(
                    vaData,
                    fileNameWithExtension,
                    destinationFolder
                );
            });
        });

        // Wait for all promises to resolve
        await Promise.all(promises);

        console.log('\nAll files processed');
    } catch (error) {
        console.error('\nAn error occurred:', error);
    }
}

async function saveData(vaData, fileNameWithExtension, destinationFolder) {
    // Set the save destination for the VA Data
    const fileNameWithoutExtension = path.parse(fileNameWithExtension).name;
    const newFilePath = path.join(
        destinationFolder,
        `${fileNameWithoutExtension}.json`
    );

    // Write the VA Data to a new file
    await fs.writeFile(newFilePath, JSON.stringify(vaData, null, 2));
    console.log(`Processed file ${fileNameWithExtension}`);
}

// ------------------------------------------------- //
// ---------------- RUN THE FUNCTION --------------- //
// ------------------------------------------------- //
processFilesInFolder('./data/upload', './data/segment-info');
