import { jidNormalizedUser, isLidUser, isHostedLidUser, isPnUser, isHostedPnUser } from '../WABinary/index.js';

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    magenta: '\x1b[35m',
    yellow: '\x1b[33m',
    white: '\x1b[37m'
};

/**
 * Insert or refresh an entry in a Map while enforcing an upper bound (FIFO/LRU eviction).
 */
export const setBoundedMapEntry = (map, key, value, maxEntries = 2000) => {
    if (!map || key === undefined || key === null) return map;
    if (map.has(key)) {
        map.delete(key);
    }
    map.set(key, value);
    while (map.size > maxEntries) {
        const oldestKey = map.keys().next().value;
        if (oldestKey === undefined) break;
        map.delete(oldestKey);
    }
    return map;
};

/**
 * Insert or refresh an entry in a Set while enforcing an upper bound.
 */
export const addBoundedSetEntry = (set, value, maxEntries = 2000) => {
    if (!set || value === undefined || value === null) return set;
    if (set.has(value)) {
        set.delete(value);
    }
    set.add(value);
    while (set.size > maxEntries) {
        const oldestValue = set.values().next().value;
        if (oldestValue === undefined) break;
        set.delete(oldestValue);
    }
    return set;
};

/**
 * Resolve PN (@s.whatsapp.net) or LID (@lid) JID safely through lidMapping without throwing.
 */
export const resolveJidWithMapping = async (jid, lidMapping, target = 'pn') => {
    if (!jid || typeof jid !== 'string') return jid;
    const normalized = jidNormalizedUser(jid);
    if (!lidMapping) return normalized;

    try {
        if (target === 'pn') {
            if (isPnUser(normalized) || isHostedPnUser(normalized)) return normalized;
            if ((isLidUser(normalized) || isHostedLidUser(normalized)) && typeof lidMapping.getPNForLID === 'function') {
                const pn = await lidMapping.getPNForLID(normalized);
                return pn ? jidNormalizedUser(pn) : normalized;
            }
        } else if (target === 'lid') {
            if (isLidUser(normalized) || isHostedLidUser(normalized)) return normalized;
            if ((isPnUser(normalized) || isHostedPnUser(normalized)) && typeof lidMapping.getLIDForPN === 'function') {
                const lid = await lidMapping.getLIDForPN(normalized);
                return lid ? jidNormalizedUser(lid) : normalized;
            }
        }
    } catch {
        // Fallback silently to normalized JID so caller handlers never crash
    }
    return normalized;
};

const SKIPPED_LOG_CONTENT_TYPES = new Set([
    'protocolMessage',
    'senderKeyDistributionMessage',
    'fastRatchetSenderKeyDistributionMessage',
    'messageContextInfo',
    'historySyncNotification',
    'initialSecurityNotificationSettingSync',
    'appStateSyncKeyShare',
    'appStateFatalExceptionNotification'
]);

const WRAPPER_KEYS = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'editedMessage'
];

const unwrapMessageShape = (message) => {
    let curr = message;
    for (let depth = 0; depth < 4 && curr && typeof curr === 'object'; depth++) {
        let unwrapped = false;
        for (const key of WRAPPER_KEYS) {
            if (curr[key]?.message) {
                curr = curr[key].message;
                unwrapped = true;
                break;
            }
        }
        if (!unwrapped) break;
    }
    return curr;
};

const detectDisplayTypeAndPreview = (message) => {
    const content = unwrapMessageShape(message);
    if (!content || typeof content !== 'object') return null;

    const keys = Object.keys(content).filter(k => k !== 'messageContextInfo' && content[k] !== undefined && content[k] !== null);
    if (keys.length === 0) return null;

    const primaryKey = keys.find(k => !SKIPPED_LOG_CONTENT_TYPES.has(k)) || keys[0];
    if (SKIPPED_LOG_CONTENT_TYPES.has(primaryKey)) return null;

    const val = content[primaryKey];
    let textPreview = '';
    if (primaryKey === 'conversation' && typeof val === 'string') {
        textPreview = val;
    } else if (val && typeof val === 'object') {
        textPreview = val.text || val.caption || val.fileName || val.title || val.body?.text || val.header?.title || val.name || '';
    }

    const cleanPreview = String(textPreview || '').replace(/[\r\n\t]+/g, ' ').trim();
    const byteSize = cleanPreview ? Buffer.byteLength(cleanPreview, 'utf8') : 0;
    const typeLabel = primaryKey
        .replace(/Message$/i, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();

    return {
        rawType: primaryKey,
        typeLabel: typeLabel || 'Message',
        preview: cleanPreview.length > 48 ? cleanPreview.slice(0, 45) + '...' : cleanPreview,
        byteSize
    };
};

let totalLoggedMessages = 0;
let burstWindowStart = 0;
let burstCountInWindow = 0;
const printedLogIds = new Set();
const MAX_PRINTS_PER_SECOND = 25;

/**
 * Format an iconic CHARAPE terminal chat card inspired by the clean MESSAGE INFO layout.
 */
export const formatCharapeChatLog = (direction = 'IN', msg = {}, count = totalLoggedMessages) => {
    const info = detectDisplayTypeAndPreview(msg?.message);
    if (!info) return null;

    const isOut = String(direction).toUpperCase().startsWith('OUT');
    const key = msg?.key || {};
    const remoteJid = key.remoteJid || '-';
    const senderRaw = key.participantAlt || key.remoteJidAlt || key.participant || key.remoteJid || '-';
    const senderId = String(senderRaw).split('@')[0].split(':')[0] || '-';
    const senderName = msg.pushName || (isOut ? 'CHARAPE BOT' : senderId);
    const tsRaw = Number(msg.messageTimestamp || 0);
    const tsDate = tsRaw > 0 ? new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000) : new Date();
    const sentTime = Number.isNaN(tsDate.getTime()) ? new Date().toLocaleString() : tsDate.toLocaleString();
    const sizeInfo = info.preview ? `${info.byteSize} bytes (${info.preview})` : `${info.typeLabel}`;

    const border = `${ANSI.blue}════════════════════════════════════════════════════${ANSI.reset}`;
    const badgeColor = isOut ? ANSI.magenta : ANSI.green;
    const dirLabel = isOut ? 'OUTGOING CHAT' : 'INCOMING CHAT';

    return [
        border,
        ` ${badgeColor}${ANSI.bold}⚡ CHARAPE${ANSI.reset} ${ANSI.dim}•${ANSI.reset} ${ANSI.magenta}${ANSI.bold}${dirLabel}${ANSI.reset}`,
        border,
        `  ${ANSI.cyan}📌 Message Type ${ANSI.reset}: ${ANSI.white}${info.typeLabel}${ANSI.reset}`,
        `  ${ANSI.cyan}🆔 Message ID   ${ANSI.reset}: ${ANSI.white}${key.id || '-'}${ANSI.reset}`,
        `  ${ANSI.cyan}⏰ Sent Time    ${ANSI.reset}: ${ANSI.white}${sentTime}${ANSI.reset}`,
        `  ${ANSI.cyan}📁 Content/Size ${ANSI.reset}: ${ANSI.white}${sizeInfo}${ANSI.reset}`,
        `  ${ANSI.cyan}👤 Sender ID    ${ANSI.reset}: ${ANSI.white}${senderId}${ANSI.reset}`,
        `  ${ANSI.cyan}🎭 Sender Name  ${ANSI.reset}: ${ANSI.white}${senderName}${ANSI.reset}`,
        `  ${ANSI.cyan}💬 Chat ID      ${ANSI.reset}: ${ANSI.white}${remoteJid}${ANSI.reset}`,
        `  ${ANSI.cyan}📊 Total Logs   ${ANSI.reset}: ${ANSI.yellow}${count}${ANSI.reset}`,
        border
    ].join('\n');
};

/**
 * Safely print iconic CHARAPE terminal chat card without blocking or flooding stdout.
 */
export const printCharapeChatLog = (direction = 'IN', msg = {}, options = {}) => {
    try {
        if (options.enabled === false) return false;
        if (!options.ignoreEnvSilent && process.env.CHARAPE_SILENT === 'true') return false;
        if (!msg || typeof msg !== 'object' || !msg.message) return false;

        const dir = String(direction || 'IN').toUpperCase().startsWith('OUT') ? 'OUT' : 'IN';
        const msgId = msg.key?.id;
        if (msgId && !options.force) {
            const dedupeKey = `${dir}:${msgId}`;
            if (printedLogIds.has(dedupeKey)) return false;
            addBoundedSetEntry(printedLogIds, dedupeKey, 600);
        }

        const now = Date.now();
        if (now - burstWindowStart >= 1000) {
            burstWindowStart = now;
            burstCountInWindow = 0;
        }
        if (!options.force && burstCountInWindow >= MAX_PRINTS_PER_SECOND) {
            return false;
        }

        const nextCount = totalLoggedMessages + 1;
        const formatted = formatCharapeChatLog(dir, msg, nextCount);
        if (!formatted) return false;

        totalLoggedMessages = nextCount;
        burstCountInWindow++;

        const writer = typeof options.writer === 'function' ? options.writer : console.log;
        writer(formatted);
        return true;
    } catch {
        return false;
    }
};
