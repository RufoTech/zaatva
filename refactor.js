const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const allFiles = walk(path.join(__dirname, 'app')).concat(walk(path.join(__dirname, 'components')));

allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes('Alert.alert') || content.search(/\balert\(/) !== -1) {
        // Ensure CustomAlert is imported
        if (!content.includes('CustomAlert')) {
            const importStatement = `import { CustomAlert } from '@/utils/CustomAlert';\n`;
            
            // Insert import after existing imports
            const match = content.match(/import .* from .*;\n/gi);
            if (match) {
                const lastImport = match[match.length - 1];
                content = content.replace(lastImport, lastImport + importStatement);
            } else {
                content = importStatement + content;
            }
            changed = true;
        }

        if (content.includes('Alert.alert')) {
            content = content.replace(/Alert\.alert/g, 'CustomAlert.show');
            changed = true;
        }

        // Replace global alert
        if (content.search(/\balert\(/) !== -1) {
            content = content.replace(/\balert\(/g, 'CustomAlert.show(');
            changed = true;
        }

        if (changed) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    }
});
console.log("Refactoring complete.");
