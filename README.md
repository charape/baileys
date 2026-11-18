# charape

High-performance, resilient WhatsApp Multi-Device engine and process supervisor for Node.js. Hand-crafted and maintained by **charape**.

`charape` is built for bot developers who require absolute stability in long-running production environments, such as VPS instances and Pterodactyl panels.

---

## Fitur Utama

- **Dual-Engine Universal Drop-in:** Mendukung 100% ekosistem bot berbasis **`@adiwajshing/baileys`** (arsitektur klasik: `useSingleFileAuthState`, `makeWALegacySocket`, `isJidUser`, `STORIES_JID`, default function exports) maupun **`@whiskeysockets/baileys`** (arsitektur modern).
- **SWGC & Group Status Full Support:** Mendukung penuh Status WhatsApp Group Chat (`groupStatusMessageV2`), sinkronisasi `messageSecret` 32-byte tanpa corrupt key, serta banner dan anotasi **"Lihat saluran"** pada video, gambar, dan dokumen.
- **Media Upload Hardened:** Kompatibel dengan Jimp 0.x / 1.x dan Sharp, thumbnail extractor non-fatal fallback (tidak pernah crash saat thumbnail gagal), video thumbnail via direct pipe spawn, dan MMS handle destructuring.
- **Atomic Session Protection:** Menulis file kredensial secara atomik (`.tmp` -> `rename`) dengan mutex lock, mencegah korupsi file `creds.json` berukuran 0-byte akibat crash tiba-tiba, Out of Memory (OOM), atau restart panel paksa.
- **Session Cleaner Terintegrasi:** Dilengkapi fungsi `cleanAuthSession` untuk memangkas ribuan file sementara (`pre-key-*`, `app-state-sync-*`) yang kerap menghabiskan inode/disk server (ENOSPC), dengan proteksi mutlak pada `creds.json`.
- **Smart Process Supervisor CLI:** Perintah `charape` untuk menjalankan bot dengan auto-restart cerdas (exponential backoff) dan graceful shutdown.
- **Mandiri & Bersih:** Tanpa dependensi git eksternal, tanpa telemetry, dan hanya berkomunikasi langsung dengan server resmi WhatsApp (`*.whatsapp.net`).

---

## Instalasi

### Sebagai Paket Utama
```bash
npm install charape
```

### Sebagai Pengganti Bot Tipe `@adiwajshing/baileys` (Tanpa Ubah Script Bot)
Jika script bot Anda menggunakan tipe `@adiwajshing/baileys`, cukup arahkan di `package.json`:
```json
{
  "dependencies": {
    "@adiwajshing/baileys": "npm:charape@latest"
  }
}
```
Atau jika menggunakan tarball offline:
```json
{
  "dependencies": {
    "@adiwajshing/baileys": "file:./charape-1.0.0.tgz"
  }
}
```

### Sebagai Pengganti Bot Tipe `@whiskeysockets/baileys`
```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "npm:charape@latest"
  }
}
```
Kemudian jalankan:
```bash
npm install
```
Seluruh import (`@adiwajshing/baileys` maupun `@whiskeysockets/baileys`) yang ada pada bot Anda akan otomatis dialihkan ke engine `charape` tanpa error missing export maupun undefined property!

---

## Penggunaan Cepat

```javascript
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'charape';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.charape('Chrome'),
        syncFullHistory: false
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

Untuk mencegah penumpukan file cache pada penyimpanan server:

```javascript
import { cleanAuthSession } from 'charape';

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

Package ini menyertakan CLI mandiri:

### Menjalankan Bot dengan Auto-Restart
```bash
npx charape start [file.js]
```
Jika file tidak ditentukan, CLI akan otomatis mencari `index.js`, `main.js`, atau `bot.js`. Supervisor menangani sinyal `SIGINT`/`SIGTERM` untuk mematikan proses anak dengan aman.

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

Didistribusikan di bawah lisensi MIT. Hak cipta milik **charape** dan para kontributor.
