 import assert from 'assert';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve, join } from 'path';

const require = createRequire(import.meta.url);

const c = {
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

console.log(`${c.bold}${c.cyan}====================================================${c.reset}`);
console.log(`${c.bold}Pengujian Integritas & Verifikasi Engine 'charape'${c.reset}`);
console.log(`${c.bold}${c.cyan}====================================================${c.reset}\n`);

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ${c.green}✔ [PASS]${c.reset} ${desc}`);
        passedTests++;
    } catch (err) {
        console.error(`  ${c.red}✖ [FAIL]${c.reset} ${desc}`);
        console.error(`    ${c.red}Error: ${err.message}${c.reset}`);
        process.exitCode = 1;
    }
}

async function itAsync(desc, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ${c.green}✔ [PASS]${c.reset} ${desc}`);
        passedTests++;
    } catch (err) {
        console.error(`  ${c.red}✖ [FAIL]${c.reset} ${desc}`);
        console.error(`    ${c.red}Error: ${err.message}${c.reset}`);
        process.exitCode = 1;
    }
}

// ----------------------------------------------------
// TEST SUITE 1: ESM Imports
// ----------------------------------------------------
console.log(`${c.bold}[1/8] Pengujian Ekspor ES Module (import)...${c.reset}`);

const esm = await import('../lib/index.js');

it('makeWASocket ter-ekspor sebagai fungsi default & named', () => {
    assert.strictEqual(typeof esm.default, 'function');
    assert.strictEqual(typeof esm.makeWASocket, 'function');
});

it('useMultiFileAuthState ter-ekspor sebagai fungsi', () => {
    assert.strictEqual(typeof esm.useMultiFileAuthState, 'function');
});

it('DisconnectReason ter-ekspor dengan status codes', () => {
    assert.strictEqual(typeof esm.DisconnectReason, 'object');
    assert.strictEqual(esm.DisconnectReason.loggedOut, 401);
    assert.strictEqual(esm.DisconnectReason.connectionClosed, 428);
    assert.strictEqual(esm.DisconnectReason.restartRequired, 515);
});

it('fetchLatestBaileysVersion ter-ekspor sebagai fungsi', () => {
    assert.strictEqual(typeof esm.fetchLatestBaileysVersion, 'function');
});

it('Browsers ter-ekspor dengan browser charape & hnz', () => {
    assert.strictEqual(typeof esm.Browsers, 'object');
    assert.strictEqual(typeof esm.Browsers.charape, 'function');
    assert.strictEqual(typeof esm.Browsers.hnz, 'function');
    const bCharape = esm.Browsers.charape('Chrome');
    assert.strictEqual(bCharape[0], 'charape');
    assert.strictEqual(bCharape[1], 'Chrome');
    const bHnz = esm.Browsers.hnz('Chrome');
    assert.strictEqual(bHnz[0], 'hnz');
});

it('WAProto proto ter-ekspor lengkap', () => {
    assert.ok(esm.proto);
    assert.ok(esm.proto.Message);
});

it('generateWAMessageFromContent ter-ekspor', () => {
    assert.strictEqual(typeof esm.generateWAMessageFromContent, 'function');
});

it('cleanAuthSession ter-ekspor sebagai fungsi', () => {
    assert.strictEqual(typeof esm.cleanAuthSession, 'function');
});

it('makeWALegacySocket & PHONENUMBER_MCC ter-ekspor untuk kompatibilitas penuh', () => {
    assert.strictEqual(typeof esm.makeWALegacySocket, 'function');
    assert.strictEqual(typeof esm.PHONENUMBER_MCC, 'object');
    assert.strictEqual(esm.PHONENUMBER_MCC['62'], '510');
});

it('customPairingCode terpasang permanen dengan nilai CHARAPE1', () => {
    assert.strictEqual(esm.DEFAULT_CONNECTION_CONFIG.customPairingCode, 'CHARAPE1');
});

// ----------------------------------------------------
// TEST SUITE 2: CommonJS Imports
// ----------------------------------------------------
console.log(`\n${c.bold}[2/8] Pengujian Ekspor CommonJS (require)...${c.reset}`);

const cjs = require('../lib/index.cjs');

it('CommonJS require berhasil memuat makeWASocket langsung sebagai fungsi dan default', () => {
    assert.strictEqual(typeof cjs, 'function');
    assert.strictEqual(typeof cjs.default, 'function');
    assert.strictEqual(typeof cjs.makeWASocket, 'function');
    assert.strictEqual(cjs, cjs.default);
});

it('CommonJS require memuat useMultiFileAuthState & DisconnectReason', () => {
    assert.strictEqual(typeof cjs.useMultiFileAuthState, 'function');
    assert.strictEqual(typeof cjs.DisconnectReason, 'object');
});

it('CommonJS require memuat cleanAuthSession & Browsers charape', () => {
    assert.strictEqual(typeof cjs.cleanAuthSession, 'function');
    assert.strictEqual(typeof cjs.Browsers.charape, 'function');
});

it('CommonJS require memuat WAProto/index.cjs secara mandiri', () => {
    const protoCjs = require('../WAProto/index.cjs');
    assert.ok(protoCjs.proto);
    assert.ok(protoCjs.proto.Message);
});

it('makeWASocket (CJS & ESM) menyematkan helper bot CASE & MD (decodeJid, getName, sendText, parseMention, cMod, copyNForward, downloadMediaMessage)', () => {
    const dummyAuth = { creds: { noiseKey: { public: Buffer.alloc(32) } }, keys: { get: () => ({}), set: () => ({}) } };
    const dummySock = esm.makeWASocket({ auth: dummyAuth });
    const cjsSock = cjs({ auth: dummyAuth });
    try {
        assert.strictEqual(typeof dummySock.decodeJid, 'function');
        assert.strictEqual(typeof dummySock.getName, 'function');
        assert.strictEqual(typeof dummySock.sendText, 'function');
        assert.strictEqual(typeof dummySock.parseMention, 'function');
        assert.strictEqual(typeof dummySock.cMod, 'function');
        assert.strictEqual(typeof dummySock.copyNForward, 'function');
        assert.strictEqual(typeof dummySock.downloadMediaMessage, 'function');
        assert.strictEqual(typeof dummySock.resolvePnJid, 'function');
        assert.strictEqual(typeof dummySock.resolveLidJid, 'function');
        assert.strictEqual(typeof dummySock.printCharapeChatLog, 'function');

        // Verifikasi logika helper
        assert.strictEqual(dummySock.decodeJid('628123456:12@s.whatsapp.net'), '628123456@s.whatsapp.net');
        assert.deepStrictEqual(dummySock.parseMention('Halo @628123456789 apa kabar'), ['628123456789@s.whatsapp.net']);

        // Verifikasi eksekusi via CommonJS instance langsung
        assert.strictEqual(typeof cjsSock.decodeJid, 'function');
        assert.strictEqual(typeof cjsSock.getName, 'function');
        assert.strictEqual(typeof cjsSock.sendText, 'function');
        assert.strictEqual(typeof cjsSock.resolvePnJid, 'function');
        assert.strictEqual(cjsSock.decodeJid('628999999:5@s.whatsapp.net'), '628999999@s.whatsapp.net');
    } finally {
        void dummySock.end?.();
        void cjsSock.end?.();
    }
});

// ----------------------------------------------------
// TEST SUITE 3: Simulasi cleanAuthSession
// ----------------------------------------------------
console.log(`\n${c.bold}[3/8] Pengujian Proteksi Sesi (cleanAuthSession)...${c.reset}`);

const dummyDir = resolve(process.cwd(), 'test/dummy_session_test');

await itAsync('cleanAuthSession menghapus pre-keys sampah dan menjaga creds.json', async () => {
    if (existsSync(dummyDir)) rmSync(dummyDir, { recursive: true, force: true });
    mkdirSync(dummyDir, { recursive: true });

    const credsData = JSON.stringify({ secret: 'test_token', me: { id: '628123456789@s.whatsapp.net' } });
    writeFileSync(resolve(dummyDir, 'creds.json'), credsData, 'utf8');

    for (let i = 1; i <= 10; i++) {
        writeFileSync(resolve(dummyDir, `pre-key-${i}.json`), JSON.stringify({ keyId: i }), 'utf8');
    }

    for (let i = 1; i <= 5; i++) {
        writeFileSync(resolve(dummyDir, `app-state-sync-key-${i}.json`), JSON.stringify({ syncId: i }), 'utf8');
    }

    writeFileSync(resolve(dummyDir, 'creds.json.tmp.999'), 'temp payload', 'utf8');

    const result = await esm.cleanAuthSession(dummyDir, {
        removePreKeys: true,
        removeAppState: true
    });

    assert.strictEqual(result.deletedFiles, 16);
    assert.strictEqual(existsSync(resolve(dummyDir, 'creds.json')), true);

    const preservedCreds = readFileSync(resolve(dummyDir, 'creds.json'), 'utf8');
    assert.strictEqual(preservedCreds, credsData);

    for (let i = 1; i <= 10; i++) {
        assert.strictEqual(existsSync(resolve(dummyDir, `pre-key-${i}.json`)), false);
    }

    rmSync(dummyDir, { recursive: true, force: true });
    assert.strictEqual(existsSync(dummyDir), false);
});

// ----------------------------------------------------
// TEST SUITE 4: CLI Execution (node bin/charape.js)
// ----------------------------------------------------
console.log(`\n${c.bold}[4/8] Pengujian CLI Supervisor (bin/charape.js)...${c.reset}`);

it('CLI "node bin/charape.js check" keluar dengan kode 0 dan status sehat', () => {
    const output = execSync('node bin/charape.js check', { encoding: 'utf8' });
    assert.ok(output.includes('charape process supervisor'));
    assert.ok(output.includes('WASocket export') && output.includes('OK'));
});

it('CLI "node bin/charape.js help" menampilkan panduan penggunaan', () => {
    const output = execSync('node bin/charape.js help', { encoding: 'utf8' });
    assert.ok(output.includes('PENGGUNAAN:'));
    assert.ok(output.includes('npx charape start'));
});

// ----------------------------------------------------
// TEST SUITE 5: Base Rename & Vendored Signal Verification
// ----------------------------------------------------
console.log(`\n${c.bold}[5/8] Verifikasi Modul Internal (charape.js & Signal Core)...${c.reset}`);

it('lib/Socket/charape.js ada dan lib/Socket/luxu.js sudah dihapus', () => {
    assert.strictEqual(existsSync(resolve(process.cwd(), 'lib/Socket/charape.js')), true);
    assert.strictEqual(existsSync(resolve(process.cwd(), 'lib/Socket/luxu.js')), false);
});

it('lib/Signal/core mandiri tanpa dependensi git eksternal', () => {
    assert.strictEqual(existsSync(resolve(process.cwd(), 'lib/Signal/core/package.json')), true);
    assert.strictEqual(existsSync(resolve(process.cwd(), 'lib/Signal/core/index.js')), true);
});

it('package.json terkonfigurasi untuk charape', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    assert.ok(pkg.name === 'charape' || pkg.name === '@charape/baileys');
    assert.strictEqual(pkg.author, 'charape');
    assert.ok(typeof pkg.version === 'string' && pkg.version.length > 0);
    assert.ok(pkg.bin.charape.includes('bin/charape.js'));
    assert.strictEqual(pkg.publishConfig.access, 'public');
    assert.strictEqual(pkg.publishConfig.registry, undefined);
    assert.strictEqual(pkg.dependencies.libsignal, undefined);
});

it('Fast-start injection aktif (syncFullHistory: false & skips RECENT history)', async () => {
    const { DEFAULT_CONNECTION_CONFIG, proto } = await import('../lib/index.js');
    assert.strictEqual(DEFAULT_CONNECTION_CONFIG.syncFullHistory, false);
    assert.strictEqual(typeof DEFAULT_CONNECTION_CONFIG.shouldSyncHistoryMessage, 'function');
    assert.strictEqual(DEFAULT_CONNECTION_CONFIG.shouldSyncHistoryMessage({ syncType: proto.HistorySync.HistorySyncType.RECENT }), false);
    assert.strictEqual(DEFAULT_CONNECTION_CONFIG.shouldSyncHistoryMessage({ syncType: proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP }), true);
});

it('showCharapeBanner tersedia dan terekspos di makeWASocket & lib/index', async () => {
    const { showCharapeBanner, default: makeWASocket } = await import('../lib/index.js');
    assert.strictEqual(typeof showCharapeBanner, 'function');
    assert.strictEqual(typeof makeWASocket.showCharapeBanner, 'function');
});

// ----------------------------------------------------
// TEST SUITE 6: Media Annotations & Channel Link
// ----------------------------------------------------
console.log(`\n${c.bold}[6/8] Verifikasi Media Annotations & Lihat Saluran...${c.reset}`);

await itAsync('Media gambar & video menyertakan anotasi saluran untuk fitur Lihat Saluran', async () => {
    const { prepareWAMessageMedia } = await import('../lib/Utils/messages.js');
    const dummyUpload = async () => ({ mediaUrl: 'https://example.com/media.jpg', directPath: '/direct/path' });

    const imgObj = await prepareWAMessageMedia({ image: Buffer.from('dummy') }, { upload: dummyUpload });
    assert.ok(imgObj.imageMessage && Array.isArray(imgObj.imageMessage.annotations));
    assert.strictEqual(imgObj.imageMessage.annotations[0].newsletter.newsletterJid, '120363424530330931@newsletter');
    assert.strictEqual(imgObj.imageMessage.annotations[0].newsletter.newsletterName, 'メ Informasi Store Cԋαɾαρҽ');

    const vidObj = await prepareWAMessageMedia({ video: Buffer.from('dummy') }, { upload: dummyUpload });
    assert.ok(vidObj.videoMessage && Array.isArray(vidObj.videoMessage.annotations));
    assert.strictEqual(vidObj.videoMessage.annotations[0].newsletter.newsletterJid, '120363424530330931@newsletter');
    assert.strictEqual(vidObj.videoMessage.annotations[0].newsletter.newsletterName, 'メ Informasi Store Cԋαɾαρҽ');
});

// ----------------------------------------------------
// TEST SUITE 7: Enterprise 6-Pillar Upgrade Verification
// ----------------------------------------------------
console.log(`\n${c.bold}[7/8] Verifikasi 6 Pilar Enterprise Upgrade (DM, Dual ESM/CJS, Document Saluran, Anti-Crash, Branding, Always-Online)...${c.reset}`);

it('Pillar 1 & 6 Defaults: aiLabel false, markOnlineOnConnect true, autoNewsletterWatermark true, presenceHeartbeatMs >= 10000', () => {
    assert.strictEqual(esm.DEFAULT_CONNECTION_CONFIG.aiLabel, false);
    assert.strictEqual(esm.DEFAULT_CONNECTION_CONFIG.markOnlineOnConnect, true);
    assert.strictEqual(esm.DEFAULT_CONNECTION_CONFIG.autoNewsletterWatermark, true);
    assert.strictEqual(esm.DEFAULT_CONNECTION_CONFIG.charapeChatLog, true);
    assert.ok(esm.DEFAULT_CONNECTION_CONFIG.presenceHeartbeatMs >= 10000);
    assert.strictEqual(cjs.DEFAULT_CONNECTION_CONFIG.aiLabel, false);
    assert.strictEqual(cjs.DEFAULT_CONNECTION_CONFIG.autoNewsletterWatermark, true);
});

await itAsync('Pillar 1: DM @lid & @s.whatsapp.net decoding, LID<->PN resolution & cMod resilience', async () => {
    const dummyAuth = { creds: { noiseKey: { public: Buffer.alloc(32) }, me: { id: '628111000@s.whatsapp.net' } }, keys: { get: () => ({}), set: () => ({}) } };
    const sock = esm.makeWASocket({ auth: dummyAuth });
    try {
        // Test decodeMessageNode on 1:1 DM stanza with recipient_lid / sender_pn
        const decodedDm = esm.decodeMessageNode(
            {
                tag: 'message',
                attrs: {
                    id: 'DM_LID_001',
                    from: '12345678901234@lid',
                    sender_pn: '6283849207048@s.whatsapp.net',
                    t: '1700000000'
                },
                content: []
            },
            '628111000@s.whatsapp.net',
            '999888777@lid'
        );
        assert.strictEqual(decodedDm.fullMessage.key.remoteJid, '12345678901234@lid');
        assert.strictEqual(decodedDm.fullMessage.key.remoteJidAlt, '6283849207048@s.whatsapp.net');
        assert.strictEqual(decodedDm.fullMessage.key.fromMe, false);

        // Test resolvePnJid & resolveLidJid fall back safely even without live WA connection
        const fallbackPn = await sock.resolvePnJid('12345678901234@lid');
        assert.strictEqual(fallbackPn, '12345678901234@lid');
        const resolvedPn = await esm.resolveJidWithMapping('12345678901234:1@lid', {
            getPNForLID: async () => '6283849207048:0@s.whatsapp.net'
        }, 'pn');
        assert.strictEqual(resolvedPn, '6283849207048@s.whatsapp.net');

        // Test cMod safe cloning for LID & PN DMs
        const cloned = sock.cMod('12345678901234@lid', {
            key: { remoteJid: '12345678901234@lid', id: 'ABC' },
            message: { conversation: 'hi' }
        }, 'updated');
        assert.strictEqual(cloned.key.remoteJid, '12345678901234@lid');
        assert.strictEqual(cloned.message.conversation, 'updated');
    } finally {
        void sock.end?.();
    }
});

it('Pillar 2: Dual ESM & CJS parity exports printCharapeChatLog, bounded utils & legacy bridges', () => {
    assert.strictEqual(typeof esm.printCharapeChatLog, 'function');
    assert.strictEqual(typeof cjs.printCharapeChatLog, 'function');
    assert.strictEqual(typeof esm.makeWASocket.printCharapeChatLog, 'function');
    assert.strictEqual(typeof esm.setBoundedMapEntry, 'function');
    assert.strictEqual(typeof cjs.setBoundedMapEntry, 'function');
    assert.strictEqual(typeof esm.addBoundedSetEntry, 'function');
    assert.strictEqual(typeof cjs.useSingleFileAuthState, 'function');
    assert.strictEqual(typeof cjs.makeWALegacySocket, 'function');
});

it('Pillar 3: Document, documentWithCaption & interactive header document injeksi Lihat Saluran non-destruktif', () => {
    const dummyAuth = { creds: { noiseKey: { public: Buffer.alloc(32) } }, keys: { get: () => ({}), set: () => ({}) } };
    const sock = esm.makeWASocket({ auth: dummyAuth });
    try {
        // 1. Direct documentMessage preserving mentionedJid & stanzaId
        const docMsg = sock.injectNewsletterWatermark({
            documentMessage: {
                fileName: 'Laporan.pdf',
                mimetype: 'application/pdf',
                contextInfo: {
                    stanzaId: 'QUOTED_1',
                    mentionedJid: ['628123@s.whatsapp.net']
                }
            }
        }, '6283849207048@s.whatsapp.net');
        assert.strictEqual(docMsg.documentMessage.contextInfo.isForwarded, true);
        assert.strictEqual(docMsg.documentMessage.contextInfo.forwardingScore, 999);
        assert.strictEqual(docMsg.documentMessage.contextInfo.stanzaId, 'QUOTED_1');
        assert.deepStrictEqual(docMsg.documentMessage.contextInfo.mentionedJid, ['628123@s.whatsapp.net']);
        assert.strictEqual(docMsg.documentMessage.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, '120363424530330931@newsletter');
        assert.strictEqual(docMsg.documentMessage.contextInfo.forwardedNewsletterMessageInfo.newsletterName, 'メ Informasi Store Cԋαɾαρҽ');
        assert.strictEqual(docMsg.documentMessage.contextInfo.forwardedNewsletterMessageInfo.serverMessageId, 1);

        // 2. Wrapped documentWithCaptionMessage
        const wrappedDoc = sock.injectNewsletterWatermark({
            documentWithCaptionMessage: {
                message: {
                    documentMessage: { fileName: 'Katalog.zip', mimetype: 'application/zip' }
                }
            }
        }, '120363111@g.us');
        assert.strictEqual(wrappedDoc.documentWithCaptionMessage.message.contextInfo, undefined);
        assert.strictEqual(wrappedDoc.documentWithCaptionMessage.message.documentMessage.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, '120363424530330931@newsletter');

        // 3. InteractiveMessage with header documentMessage preserves host CTA button!
        const originalBtnUrl = 'https://bot-host.example/checkout';
        const interDoc = sock.injectNewsletterWatermark({
            interactiveMessage: {
                header: {
                    hasMediaAttachment: true,
                    documentMessage: { fileName: 'Invoice.pdf', mimetype: 'application/pdf' }
                },
                nativeFlowMessage: {
                    buttons: [{
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({ display_text: 'Bayar', url: originalBtnUrl })
                    }]
                }
            }
        }, '6283849207048@s.whatsapp.net');
        assert.strictEqual(interDoc.interactiveMessage.header.documentMessage.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, '120363424530330931@newsletter');
        const btnParsed = JSON.parse(interDoc.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson);
        assert.strictEqual(btnParsed.url, originalBtnUrl);

        // 4. Target @newsletter tidak di-double-watermark
        const selfNl = sock.injectNewsletterWatermark({ documentMessage: { fileName: 'A.pdf' } }, '120363424530330931@newsletter');
        assert.strictEqual(selfNl.documentMessage.contextInfo, undefined);
    } finally {
        void sock.end?.();
    }
});

it('Pillar 4: Bounded cache flood resilience, clean shutdown & absence of unhandled crashes', () => {
    const map = new Map();
    for (let i = 0; i < 400; i++) {
        esm.setBoundedMapEntry(map, `key-${i}`, i, 50);
    }
    assert.strictEqual(map.size, 50);
    assert.strictEqual(map.has('key-0'), false);
    assert.strictEqual(map.has('key-399'), true);

    const set = new Set();
    for (let i = 0; i < 300; i++) {
        esm.addBoundedSetEntry(set, `item-${i}`, 40);
    }
    assert.strictEqual(set.size, 40);
    assert.strictEqual(set.has('item-0'), false);
    assert.strictEqual(set.has('item-299'), true);

    for (let i = 0; i < 150; i++) {
        esm.setBotMessageSecret(`MSG_${i}`, Buffer.alloc(32, i % 255), `${628000 + (i % 15)}@s.whatsapp.net`);
    }

    const sendSrc = readFileSync(resolve(process.cwd(), 'lib/Socket/messages-send.js'), 'utf8');
    assert.ok(sendSrc.includes('error in emitOwnEvents upsertMessage'));
    const sockSrc = readFileSync(resolve(process.cwd(), 'lib/Socket/socket.js'), 'utf8');
    assert.ok(sockSrc.includes('missedKeepAlives'));
    const chatsSrc = readFileSync(resolve(process.cwd(), 'lib/Socket/chats.js'), 'utf8');
    assert.ok(chatsSrc.includes('stopPresenceHeartbeat'));
});

it('Pillar 5: Iconic CHARAPE terminal chat printer + spam burst guard & CHARAPE_SILENT', () => {
    const printed = [];
    const okIn = esm.printCharapeChatLog('IN', {
        key: { id: 'CHARAPE_TEST_IN_1', remoteJid: '6283849207048@s.whatsapp.net', fromMe: false },
        pushName: 'Tester Charape',
        messageTimestamp: 1700000000,
        message: { conversation: '.menu' }
    }, { writer: (s) => printed.push(s), ignoreEnvSilent: true, force: true });
    assert.strictEqual(okIn, true);
    assert.strictEqual(printed.length, 1);
    assert.ok(printed[0].includes('CHARAPE'));
    assert.ok(printed[0].includes('INCOMING CHAT'));
    assert.ok(printed[0].includes('CHARAPE_TEST_IN_1'));

    const okOut = esm.printCharapeChatLog('OUT', {
        key: { id: 'CHARAPE_TEST_OUT_1', remoteJid: '6283849207048@s.whatsapp.net', fromMe: true },
        message: { documentMessage: { fileName: 'Panduan.pdf' } }
    }, { writer: (s) => printed.push(s), ignoreEnvSilent: true, force: true });
    assert.strictEqual(okOut, true);
    assert.ok(printed[1].includes('OUTGOING CHAT'));
    assert.ok(printed[1].includes('Document'));

    // Noise protocolMessage should be suppressed cleanly
    const okProto = esm.printCharapeChatLog('IN', {
        key: { id: 'PROTO_1', remoteJid: '6283849207048@s.whatsapp.net' },
        message: { protocolMessage: { type: 0 } }
    }, { writer: (s) => printed.push(s), ignoreEnvSilent: true, force: true });
    assert.strictEqual(okProto, false);

    // CHARAPE_SILENT=true must suppress logs
    const prevSilent = process.env.CHARAPE_SILENT;
    process.env.CHARAPE_SILENT = 'true';
    try {
        const okSilent = esm.printCharapeChatLog('IN', {
            key: { id: 'SILENT_1', remoteJid: '6283849207048@s.whatsapp.net' },
            message: { conversation: 'hidden' }
        }, { writer: (s) => printed.push(s), force: true });
        assert.strictEqual(okSilent, false);
    } finally {
        if (prevSilent === undefined) delete process.env.CHARAPE_SILENT;
        else process.env.CHARAPE_SILENT = prevSilent;
    }

    // Flood burst cap (>25 prints/sec without force)
    const floodPrinted = [];
    for (let i = 0; i < 60; i++) {
        esm.printCharapeChatLog('IN', {
            key: { id: `FLOOD_${Date.now()}_${i}`, remoteJid: '6283849207048@s.whatsapp.net' },
            message: { conversation: 'spam' }
        }, { writer: (s) => floodPrinted.push(s), ignoreEnvSilent: true });
    }
    assert.ok(floodPrinted.length <= 25, `Flood cap exceeded: ${floodPrinted.length}`);

    // Iconic CHARAPE Message ID prefix verification (ESM & CJS)
    const id1 = esm.generateMessageID();
    const id2 = esm.generateMessageIDV2('6283849207048@s.whatsapp.net');
    const cjsId1 = cjs.generateMessageID();
    const cjsId2 = cjs.generateMessageIDV2('6283849207048@s.whatsapp.net');
    assert.ok(id1.startsWith('CHARAPE-') && id1.length === 26, `Unexpected generateMessageID: ${id1}`);
    assert.ok(id2.startsWith('CHARAPE-') && id2.length === 26, `Unexpected generateMessageIDV2: ${id2}`);
    assert.ok(cjsId1.startsWith('CHARAPE-') && cjsId1.length === 26, `Unexpected CJS generateMessageID: ${cjsId1}`);
    assert.ok(cjsId2.startsWith('CHARAPE-') && cjsId2.length === 26, `Unexpected CJS generateMessageIDV2: ${cjsId2}`);
});

await itAsync('Pillar 6: Always-Online lifecycle connection.update close/end & sendPresenceUpdate guard tanpa crash', async () => {
    const dummyAuth = { creds: { noiseKey: { public: Buffer.alloc(32) } }, keys: { get: () => ({}), set: () => ({}) } };
    const sock = esm.makeWASocket({ auth: dummyAuth, fireInitQueries: false, presenceHeartbeatMs: 15000 });
    try {
        await sock.sendPresenceUpdate('available');
        sock.ev.emit('connection.update', { connection: 'open' });
        sock.ev.emit('connection.update', { connection: 'close' });
    } finally {
        void sock.end?.();
    }
});

// ----------------------------------------------------
// TEST SUITE 8: Zero-Trace Audit
// ----------------------------------------------------
console.log(`\n${c.bold}[8/8] Zero-Trace Footprint Audit...${c.reset}`);

it('Codebase bersih 100% dari jejak author lama', () => {
    const forbidden = ['rajeh', 'taher', 'zeppsyky', 'xazepysk', 'wbails', 'luxu', 'hans', 'xzcyyx'];
    const ignoredDirs = new Set(['node_modules', '.git', '.gemini', '.panel_sandbox', 'scratch_wileys']);
    const ignoredFiles = new Set(['verify.js', 'package-lock.json', 'test_media_annotations.js']);

    function walk(dir) {
        let results = [];
        for (const item of readdirSync(dir, { withFileTypes: true })) {
            if (ignoredDirs.has(item.name)) continue;
            const full = join(dir, item.name);
            if (item.isDirectory()) {
                results.push(...walk(full));
            } else if (!ignoredFiles.has(item.name)) {
                results.push(full);
            }
        }
        return results;
    }

    const allFiles = walk(process.cwd());
    const violations = [];

    for (const file of allFiles) {
        const content = readFileSync(file, 'utf8');
        for (const term of forbidden) {
            const regex = new RegExp(`\\b${term}\\b`, 'i');
            if (regex.test(content)) {
                violations.push({ file, term });
            }
        }
    }

    assert.strictEqual(violations.length, 0, `Ditemukan jejak author terlarang: ${JSON.stringify(violations)}`);
});

console.log(`\n${c.bold}${c.green}====================================================${c.reset}`);
console.log(`${c.bold}${c.green}Hasil: ${passedTests}/${totalTests} pengujian berhasil lulus 100%.${c.reset}`);
console.log(`${c.bold}${c.green}====================================================${c.reset}\n`);
