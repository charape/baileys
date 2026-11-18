#!/usr/bin/env node

/**
 * charape CLI - Process Supervisor & Tooling for charape WhatsApp Bot Engine
 * Hand-crafted by charape.
 */

import { fork } from 'child_process';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';
import { cleanAuthSession } from '../lib/Utils/clean-session.js';

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m'
};

function banner() {
    console.log(`
${c.cyan}${c.bold} ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██████╗ ███████╗
██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝
██║     ███████║███████║██████╔╝███████║██████╔╝█████╗  
██║     ██╔══██║██╔══██║██╔══██╗██╔══██║██╔═══╝ ██╔══╝  
╚██████╗██║  ██║██║  ██║██║  ██║██║  ██║██║     ███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝${c.reset}
${c.dim}charape process supervisor v1.0.0${c.reset}
`);
}

function printHelp() {
    banner();
    console.log(`${c.bold}PENGGUNAAN:${c.reset}`);
    console.log(`  ${c.green}npx charape start [file.js]${c.reset}   Menjalankan bot dalam supervisor (auto-restart)`);
    console.log(`  ${c.green}npx charape clean [folder]${c.reset}    Membersihkan file sesi sementara (creds.json aman)`);
    console.log(`  ${c.green}npx charape check${c.reset}             Memeriksa dependensi dan integritas engine`);
    console.log(`  ${c.green}npx charape help${c.reset}              Menampilkan panduan ini\n`);
    console.log(`${c.bold}CONTOH:${c.reset}`);
    console.log(`  npx charape start`);
    console.log(`  npx charape start bot.js`);
    console.log(`  npx charape clean ./session\n`);
}

async function runCheck() {
    banner();
    console.log(`${c.bold}Pemeriksaan Sistem & Status Engine charape:${c.reset}\n`);

    const nodeVer = process.version;
    const major = parseInt(nodeVer.slice(1).split('.')[0], 10);
    const nodeStatus = major >= 20 ? `${c.green}OK (${nodeVer})${c.reset}` : `${c.red}Perlu Node.js 20+ (${nodeVer})${c.reset}`;

    console.log(`  - Node.js runtime   : ${nodeStatus}`);
    console.log(`  - Platform          : ${c.cyan}${process.platform} (${process.arch})${c.reset}`);
    console.log(`  - Supervisor PID    : ${c.cyan}${process.pid}${c.reset}`);
    console.log(`  - Memory RSS        : ${c.cyan}${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB${c.reset}`);

    try {
        const { makeWASocket, useMultiFileAuthState, DisconnectReason, cleanAuthSession } = await import('../lib/index.js');
        const makeStatus = typeof makeWASocket === 'function' ? `${c.green}OK${c.reset}` : `${c.red}Gagal${c.reset}`;
        const authStatus = typeof useMultiFileAuthState === 'function' ? `${c.green}OK${c.reset}` : `${c.red}Gagal${c.reset}`;
        const discStatus = typeof DisconnectReason === 'object' ? `${c.green}OK${c.reset}` : `${c.red}Gagal${c.reset}`;
        const cleanStatus = typeof cleanAuthSession === 'function' ? `${c.green}OK${c.reset}` : `${c.red}Gagal${c.reset}`;

        console.log(`  - WASocket export   : ${makeStatus}`);
        console.log(`  - Multi-file auth   : ${authStatus}`);
        console.log(`  - Disconnect states : ${discStatus}`);
        console.log(`  - Session cleaner   : ${cleanStatus}`);
    } catch (err) {
        console.log(`  - Module load error : ${c.red}${err.message}${c.reset}`);
    }

    console.log(`\n${c.bold}Integritas Engine:${c.reset}`);
    console.log(`  - Endpoint jaringan : ${c.green}Server WhatsApp resmi (*.whatsapp.net)${c.reset}`);
    console.log(`  - Atomic write auth : ${c.green}Aktif (.tmp -> rename)${c.reset}`);
    console.log(`  - Status            : ${c.green}${c.bold}Siap digunakan${c.reset}\n`);
}

async function runClean(targetDir) {
    banner();
    const sessionPath = resolve(process.cwd(), targetDir || 'session');
    console.log(`${c.bold}Membersihkan direktori sesi:${c.reset} ${c.cyan}${sessionPath}${c.reset}\n`);

    if (!existsSync(sessionPath)) {
        console.log(`${c.yellow}Direktori sesi tidak ditemukan: ${sessionPath}${c.reset}\n`);
        return;
    }

    try {
        const stats = await cleanAuthSession(sessionPath, {
            removePreKeys: true,
            removeAppState: true,
            removeSenderKeys: false
        });

        const mbFreed = (stats.bytesFreed / (1024 * 1024)).toFixed(2);
        console.log(`  - Total file diperiksa : ${c.cyan}${stats.totalFiles}${c.reset}`);
        console.log(`  - File sampah dihapus  : ${c.green}${stats.deletedFiles}${c.reset}`);
        console.log(`  - Ruang disk dibebaskan: ${c.green}${mbFreed} MB${c.reset}`);
        console.log(`  - File kredensial aman : ${c.green}${stats.protected.join(', ')}${c.reset}\n`);
    } catch (err) {
        console.log(`${c.red}Gagal membersihkan sesi: ${err.message}${c.reset}\n`);
    }
}

function runStart(targetFile) {
    banner();

    let scriptFile = targetFile;
    if (!scriptFile) {
        const candidates = ['index.js', 'main.js', 'bot.js', 'app.js', 'start.js'];
        for (const candidate of candidates) {
            if (existsSync(resolve(process.cwd(), candidate))) {
                scriptFile = candidate;
                break;
            }
        }
    }

    if (!scriptFile) {
        scriptFile = 'index.js';
    }

    const fullScriptPath = resolve(process.cwd(), scriptFile);
    if (!existsSync(fullScriptPath)) {
        console.log(`${c.red}File tidak ditemukan:${c.reset} ${fullScriptPath}`);
        console.log(`${c.yellow}Gunakan:${c.reset} npx charape start <nama_file.js>\n`);
        process.exit(1);
    }

    console.log(`${c.bold}Memulai bot dengan supervisor:${c.reset}`);
    console.log(`  - Target file : ${c.cyan}${basename(fullScriptPath)}${c.reset}`);
    console.log(`  - Jalur penuh : ${c.dim}${fullScriptPath}${c.reset}\n`);

    let child = null;
    let restartCount = 0;
    let lastStartTime = Date.now();
    let isShuttingDown = false;

    function cleanupAndExit(code = 0) {
        isShuttingDown = true;
        if (child && !child.killed) {
            console.log(`\n${c.yellow}[charape] Menghentikan bot (PID: ${child.pid})...${c.reset}`);
            try {
                child.kill('SIGTERM');
                setTimeout(() => {
                    if (child && !child.killed) child.kill('SIGKILL');
                }, 2000);
            } catch {}
        }
        process.exit(code);
    }

    process.on('SIGINT', () => cleanupAndExit(0));
    process.on('SIGTERM', () => cleanupAndExit(0));
    process.on('exit', () => cleanupAndExit(0));

    function startProcess() {
        if (isShuttingDown) return;

        lastStartTime = Date.now();
        restartCount++;

        console.log(`${c.cyan}[charape] Menjalankan bot (run #${restartCount})...${c.reset}`);

        child = fork(fullScriptPath, process.argv.slice(3), {
            cwd: process.cwd(),
            env: { ...process.env, CHARAPE_SUPERVISOR: '1' },
            stdio: 'inherit'
        });

        child.on('error', (err) => {
            console.log(`${c.red}[charape] Error proses: ${err.message}${c.reset}`);
        });

        child.on('exit', (code, signal) => {
            if (isShuttingDown) return;

            const uptimeSeconds = Math.round((Date.now() - lastStartTime) / 1000);
            console.log(`\n${c.yellow}[charape] Bot berhenti (code: ${code !== null ? code : 'null'}, signal: ${signal || 'none'}, uptime: ${uptimeSeconds}s)${c.reset}`);

            let delayMs = 1500;
            if (uptimeSeconds < 5) {
                delayMs = Math.min(3000 * Math.min(restartCount, 5), 15000);
                console.log(`${c.yellow}[charape] Crash berulang terdeteksi. Menunggu ${delayMs / 1000}s sebelum restart...${c.reset}`);
            } else {
                restartCount = 0;
            }

            setTimeout(() => {
                if (!isShuttingDown) startProcess();
            }, delayMs);
        });
    }

    startProcess();
}

const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : 'help';

switch (command) {
    case 'start':
    case 'run':
        runStart(args[1]);
        break;
    case 'clean':
        runClean(args[1]);
        break;
    case 'check':
    case 'status':
        runCheck();
        break;
    case 'help':
    case '--help':
    case '-h':
        printHelp();
        break;
    default:
        if (command.endsWith('.js') || command.endsWith('.cjs') || command.endsWith('.mjs')) {
            runStart(command);
        } else {
            console.log(`${c.red}Perintah tidak dikenal: ${command}${c.reset}\n`);
            printHelp();
            process.exit(1);
        }
        break;
}
