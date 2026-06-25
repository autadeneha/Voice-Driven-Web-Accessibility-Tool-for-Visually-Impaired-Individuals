const fs = require('fs');
const path = require('path');
const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
const scripts = manifest.content_scripts[0].js;
const css = manifest.content_scripts[0].css || [];
let ok = true;
[...scripts, ...css].forEach(f => {
  if (fs.existsSync(f)) { console.log('✅  ' + f); }
  else { console.log('❌  MISSING: ' + f); ok = false; }
});
// check popup files
['popup.html','popup.css','popup.js','background.js'].forEach(f => {
  if (fs.existsSync(f)) { console.log('✅  ' + f); }
  else { console.log('❌  MISSING: ' + f); ok = false; }
});
// check icons
['icons/icon16.png','icons/icon48.png','icons/icon128.png'].forEach(f => {
  if (fs.existsSync(f)) { console.log('✅  ' + f); }
  else { console.log('❌  MISSING: ' + f); ok = false; }
});
console.log(ok ? '\n✅  All files present — extension ready to load.' : '\n❌  Some files are missing!');
