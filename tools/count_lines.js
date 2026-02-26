const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const excludeDirs = ['node_modules', '.git', 'experiment_results', 'dist'];
const exts = ['.js','.ts','.jsx','.tsx','.ejs','.css','.html','.json','.md','.ps1','.sh','.py'];

let totalLines = 0;
let totalFiles = 0;
const byExt = {};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (excludeDirs.includes(e.name)) continue;
      walk(full);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (!exts.includes(ext)) continue;
      try {
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split(/\r?\n/).length;
        totalLines += lines;
        totalFiles += 1;
        byExt[ext] = (byExt[ext] || 0) + lines;
      } catch (err) {
        // ignore unreadable
      }
    }
  }
}

walk(root);
console.log(`Total files counted: ${totalFiles}`);
console.log(`Total lines: ${totalLines}`);
console.log('Lines by extension:');
Object.keys(byExt).sort().forEach(k => console.log(`  ${k}: ${byExt[k]}`));
