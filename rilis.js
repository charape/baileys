#!/usr/bin/env node

/**
 * charape npm release tool
 * Maintained by charape.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

function banner() {
    console.log(`
${c.cyan}${c.bold}====================================================
         charape npm publication utility
                 author: charape
====================================================${c.reset}
`);
}

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function main() {
    banner();

    const pkgPath = resolve(process.cwd(), 'package.json');
    if (!existsSync(pkgPath)) {
        console.error(`${c.red}package.json tidak ditemukan.${c.reset}`);
        process.exit(1);
    }

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    console.log(`${c.bold}[1/4] Memeriksa berkas distribusi...${c.reset}`);
    const requiredFiles = ['lib/index.js', 'lib/index.cjs', 'lib/index.d.ts', 'WAProto/index.js', 'bin/charape.js', 'README.md'];
    for (const f of requiredFiles) {
        if (!existsSync(resolve(process.cwd(), f))) {
            console.error(`${c.red}Berkas hilang: ${f}${c.reset}`);
            process.exit(1);
        }
        console.log(`  - ${f}: OK`);
    }

    try {
        await import('./lib/index.js');
        console.log(`  ${c.green}Resolusi modul: OK${c.reset}\n`);
    } catch (err) {
        console.error(`${c.red}Gagal memuat lib/index.js: ${err.message}${c.reset}`);
        process.exit(1);
    }

    console.log(`${c.bold}[2/4] Memeriksa sesi login npm...${c.reset}`);
    let npmUser = null;
    try {
        npmUser = execSync('npm whoami', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        console.log(`  ${c.green}Pengguna npm: ${npmUser}${c.reset}\n`);
    } catch {
        console.log(`\n${c.yellow}Belum login ke registry npm.${c.reset}`);
        console.log(`Jalankan 'npm login' di terminal terlebih dahulu, lalu ulangi 'npm run rilis'.\n`);
        process.exit(0);
    }

    console.log(`${c.bold}[3/4] Memeriksa status nama paket di npm...${c.reset}`);
    const currentName = pkg.name;
    console.log(`  Nama paket: ${c.cyan}${currentName}${c.reset}`);

    let isAvailable = false;
    let isOwnedByMe = false;

    try {
        const info = execSync(`npm view ${currentName} maintainers --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const maintainers = JSON.parse(info);
        const list = Array.isArray(maintainers) ? maintainers : [maintainers];
        const match = list.find(m => (typeof m === 'string' ? m : m.name) === npmUser);
        if (match) {
            isOwnedByMe = true;
            console.log(`  ${c.green}Paket '${currentName}' terdaftar atas akun Anda.${c.reset}\n`);
        } else {
            console.log(`  ${c.yellow}Nama '${currentName}' sudah digunakan oleh akun lain.${c.reset}`);
        }
    } catch {
        isAvailable = true;
        console.log(`  ${c.green}Nama '${currentName}' tersedia di registry.${c.reset}\n`);
    }

    if (!isAvailable && !isOwnedByMe) {
        console.log(`\nOpsi rilis:`);
        console.log(`  [1] Gunakan scope pengguna: @${npmUser}/${currentName}`);
        console.log(`  [2] Masukkan nama lain`);
        console.log(`  [3] Batalkan\n`);

        const choice = await askQuestion(`${c.cyan}Pilihan (1/2/3) [1]: ${c.reset}`) || '1';

        if (choice === '1') {
            pkg.name = `@${npmUser}/${currentName}`;
            writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
            console.log(`  ${c.green}Nama paket diubah ke: ${pkg.name}${c.reset}\n`);
        } else if (choice === '2') {
            const customName = await askQuestion(`${c.cyan}Nama baru: ${c.reset}`);
            if (customName) {
                pkg.name = customName;
                writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
                console.log(`  ${c.green}Nama paket diubah ke: ${pkg.name}${c.reset}\n`);
            } else {
                console.log(`${c.red}Nama tidak valid.${c.reset}`);
                process.exit(1);
            }
        } else {
            console.log(`${c.yellow}Rilis dibatalkan.${c.reset}`);
            process.exit(0);
        }
    }

    console.log(`${c.bold}[4/4] Publikasi...${c.reset}`);
    const confirm = await askQuestion(`${c.cyan}Publikasikan ${pkg.name}@${pkg.version} ke npm? (y/n) [y]: ${c.reset}`) || 'y';

    if (confirm.toLowerCase() !== 'y') {
        console.log(`${c.yellow}Publikasi dibatalkan.${c.reset}`);
        process.exit(0);
    }

    try {
        execSync('npm publish --access public', { stdio: 'inherit' });
        console.log(`\n${c.green}${c.bold}Paket '${pkg.name}' berhasil dipublikasikan.${c.reset}\n`);
    } catch (err) {
        console.error(`\n${c.red}Gagal menjalankan npm publish: ${err.message}${c.reset}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(`\n${c.red}Error: ${err.message}${c.reset}`);
    process.exit(1);
});
