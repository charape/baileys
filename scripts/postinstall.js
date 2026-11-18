import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');

try {
  // Cek apakah terpasang di dalam node_modules
  const parent1 = path.resolve(pkgRoot, '..');
  const parent2 = path.resolve(parent1, '..');
  
  let nodeModulesDir = null;
  if (path.basename(parent1) === 'node_modules') {
    nodeModulesDir = parent1;
  } else if (path.basename(parent2) === 'node_modules') {
    nodeModulesDir = parent2;
  }

  if (nodeModulesDir) {
    const botRootDir = path.resolve(nodeModulesDir, '..');
    
    // 1. Tulis .npmrc untuk mencegah bug ERESOLVE jika ada update package lain
    try {
      const npmrcPath = path.join(botRootDir, '.npmrc');
      if (!fs.existsSync(npmrcPath)) {
        fs.writeFileSync(npmrcPath, 'legacy-peer-deps=true\n');
      } else {
        const cur = fs.readFileSync(npmrcPath, 'utf8');
        if (!cur.includes('legacy-peer-deps')) {
          fs.appendFileSync(npmrcPath, '\nlegacy-peer-deps=true\n');
        }
      }
    } catch (_) {}

    // 2. Buat jembatan otomatis (bridge) untuk @whiskeysockets/baileys, @adiwajshing/baileys, dan baileys
    const aliasTargets = [
      path.join(nodeModulesDir, '@whiskeysockets', 'baileys'),
      path.join(nodeModulesDir, '@adiwajshing', 'baileys'),
      path.join(nodeModulesDir, 'baileys')
    ];

    for (const target of aliasTargets) {
      if (path.resolve(target) === path.resolve(pkgRoot)) continue;
      
      try {
        const parentDir = path.dirname(target);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

        // Jika target belum ada atau hanya link rusak, buat folder proxy
        if (!fs.existsSync(target)) {
          fs.mkdirSync(target, { recursive: true });
        }

        const relPath = path.relative(target, pkgRoot).replace(/\\/g, '/');
        const aliasName = path.basename(parentDir).startsWith('@') 
          ? `${path.basename(parentDir)}/${path.basename(target)}` 
          : path.basename(target);

        // Tulis package.json proxy
        fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
          name: aliasName,
          version: "1.0.0",
          type: "module",
          main: `${relPath}/lib/index.cjs`,
          module: `${relPath}/lib/index.js`,
          types: `${relPath}/lib/index.d.ts`,
          exports: {
            ".": {
              "types": `${relPath}/lib/index.d.ts`,
              "import": `${relPath}/lib/index.js`,
              "require": `${relPath}/lib/index.cjs`,
              "default": `${relPath}/lib/index.js`
            },
            "./package.json": "./package.json",
            "./*": `${relPath}/lib/*.js`,
            "./lib/*": `${relPath}/lib/*.js`,
            "./WAProto": {
              "types": `${relPath}/WAProto/index.d.ts`,
              "import": `${relPath}/WAProto/index.js`,
              "require": `${relPath}/WAProto/index.cjs`,
              "default": `${relPath}/WAProto/index.js`
            },
            "./WAProto/*": `${relPath}/WAProto/*`
          }
        }, null, 2));

        // Tulis index.js & index.cjs proxy
        fs.writeFileSync(path.join(target, 'index.js'), `export * from '${relPath}/lib/index.js';\nexport { default } from '${relPath}/lib/index.js';\n`);
        fs.writeFileSync(path.join(target, 'index.cjs'), `module.exports = require('${relPath}/lib/index.cjs');\n`);
        
      } catch (_) {}
    }
  }
} catch (_) {}
