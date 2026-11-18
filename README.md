# Baileys (charape Edition)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-charape%2Fbaileys-informational.svg)](https://github.com/charape/baileys)

High-performance, resilient WhatsApp Multi-Device engine and process supervisor for Node.js. Hand-crafted and maintained by **charape**.

Engine ini dibangun khusus untuk pengembang bot WhatsApp yang membutuhkan stabilitas absolut, tahan terhadap spam berat/barbar, dan handal di lingkungan long-running seperti VPS dan panel Pterodactyl.

---

## Keunggulan & Fitur Utama

- **100% Fix Respon Private Chat (DM) & Kontak:** Menyelesaikan masalah klasik bot yang hanya merespon di grup. Menjamin bot selalu merespon di chat pribadi (`@s.whatsapp.net` & `@lid`), kontak tersimpan, maupun nomor baru.
- **Always-Online & Real-Time Presence:** Sistem heartbeat keep-alive otomatis yang menjaga status bot tetap aktif online secara realtime dan tahan terhadap fluktuasi jaringan.
- **Anti-Crash & Kebal Spam:** Dilengkapi pelindung bounded cache dan isolasi error unhandled rejection, menjaga bot tetap kokoh dan tidak mental/mokad saat dieksekusi secara barbar.
- **Iconic Message ID & Terminal Info:** Format ID pesan otomatis berawalan `CHARAPE-` serta kartu log terminal estetik `CHARAPE • INCOMING/OUTGOING CHAT` dengan pelindung batas flood output.
- **Dual-Engine Universal Drop-in:** Mendukung 100% script bot model **`@whiskeysockets/baileys`** maupun **`@adiwajshing/baileys`**, baik tipe CASE (CommonJS / `require`) maupun Plugin (ES Module / `import`).
- **Helper Bot Bawaan Lengkap:** Membawa helper esensial seperti `decodeJid`, `getName`, `sendText`, `parseMention`, `cMod`, `copyNForward`, `downloadMediaMessage`, `resolvePnJid`, dan `resolveLidJid`.
- **Atomic Session Protection:** Menulis file kredensial secara atomik (`.tmp` -> `rename`) dengan mutex lock, mencegah korupsi file `creds.json` berukuran 0-byte akibat crash tiba-tiba atau restart panel paksa.
- **Smart Session Cleaner Terintegrasi:** Dilengkapi fungsi `cleanAuthSession` untuk membersihkan ribuan file pre-keys sampah tanpa menyentuh file inti sesi.
- **Smart Process Supervisor CLI:** Perintah bawaan `charape` untuk menjalankan bot dengan auto-restart cerdas dan graceful shutdown.

---

## Instalasi

### 1. Pasang Langsung via Terminal
```bash
npm install github:charape/baileys
```

### 2. Pasang di `package.json` Bot

Jika bot Anda menggunakan dependensi **`@whiskeysockets/baileys`**:
```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "github:charape/baileys"
  }
}
```

Atau jika script bot Anda menggunakan tipe **`@adiwajshing/baileys`**:
```json
{
  "dependencies": {
    "@adiwajshing/baileys": "github:charape/baileys"
  }
}
```

Kemudian jalankan:
```bash
npm install
```
Seluruh import (`@whiskeysockets/baileys` maupun `@adiwajshing/baileys`) pada bot Anda akan otomatis dialihkan ke engine `charape` tanpa perlu mengubah baris kode script bot Anda.

---

## Penggunaan Cepat

```javascript
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from '@whiskeysockets/baileys';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.charape('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Mencoba menghubungkan kembali:', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Koneksi WhatsApp berhasil dibuka.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const sender = msg.key.remoteJid;

            if (text === '!ping') {
                await sock.sendMessage(sender, { text: 'pong!' }, { quoted: msg });
            }
        }
    });
}

startBot();
```

---

## Pembersihan Sesi Otomatis

Untuk mencegah penumpukan file cache pre-keys pada penyimpanan server:

```javascript
import { cleanAuthSession } from '@whiskeysockets/baileys';

// Bersihkan file pre-key dan sync tanpa menyentuh creds.json
const stats = await cleanAuthSession('./session', {
    removePreKeys: true,
    removeAppState: true,
    removeSenderKeys: false
});

console.log(`Pembersihan selesai: ${stats.deletedFiles} file dihapus (${(stats.bytesFreed / 1024).toFixed(1)} KB dibebaskan)`);
```

---

## CLI Supervisor (`npx charape`)

Package ini menyertakan CLI supervisor mandiri:

### Menjalankan Bot dengan Auto-Restart
```bash
npx charape start [file.js]
```
Jika file tidak ditentukan, CLI akan otomatis mencari `index.js`, `main.js`, atau `bot.js`.

### Membersihkan Sesi dari Terminal
```bash
npx charape clean ./session
```

### Memeriksa Integritas Engine
```bash
npx charape check
```

---

## Lisensi

Didistribusikan di bawah [MIT License](LICENSE). Hak cipta milik **charape** dan para kontributor.
