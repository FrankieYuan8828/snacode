const sharp = require('sharp');
console.log('Sharp loaded successfully');
console.log('Formats:', Object.keys(sharp.format));
console.log('SVG support:', sharp.format.svg ? 'available' : 'not available');
