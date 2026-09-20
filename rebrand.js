const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname);

function searchAndReplace(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  
  for (const file of files) {
    if (['node_modules', '.git', '.next', '.turbo', 'dist', 'dumps', '.yarn', '.mercato'].includes(file)) continue;
    
    const filePath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (e) {
      continue;
    }
    
    if (stat.isDirectory()) {
      searchAndReplace(filePath);
    } else {
      // Skip binary/media files
      if (!file.match(/\.(png|jpg|jpeg|gif|ico|webp|svg|woff|woff2|ttf|eot|pdf|zip|tar|gz|lock)$/i)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          let modified = content;
          modified = modified.replace(/@wantace/g, '@wantace');
          modified = modified.replace(/Wantace/g, 'Wantace');
          modified = modified.replace(/wantace/g, 'wantace');
          
          if (content !== modified) {
            fs.writeFileSync(filePath, modified, 'utf8');
            console.log(`Updated ${filePath}`);
          }
        } catch (e) {
          // ignore binary files read as utf8 throwing errors
        }
      }
    }
  }
}

console.log("Starting rebranding process...");
searchAndReplace(directoryPath);
console.log("Rebranding process complete.");
