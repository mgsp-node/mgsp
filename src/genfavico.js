#!/usr/local/bin/node
const fs = require('fs');
if (process.argv.length == 3) {
    const filename = process.argv[2];
    if (!fs.existsSync(filename)) {
        console.log("Could not find the file.");
        process.exit(1);
    } else {
        const imageData = fs.readFileSync(filename);
        const imageDatab64 = Buffer.from(imageData).toString('base64');
        console.log(JSON.stringify({"favicon":"data:image/png;base64,"+imageDatab64}));
    }
} else {
    console.log("Please specify filename.")
}
