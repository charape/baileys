import { readFileSync, writeFileSync, existsSync } from 'fs';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';

const KEY_MAP = {
    'pre-key': 'preKeys',
    'session': 'sessions',
    'sender-key': 'senderKeys',
    'app-state-sync-key': 'appStateSyncKeys',
    'app-state-sync-version': 'appStateVersions',
    'sender-key-memory': 'senderKeyMemory'
};

/**
 * Authentic Adiwajshing useSingleFileAuthState implementation.
 * Provides backwards compatibility for legacy Adiwajshing Baileys bots that use single JSON sessions.
 */
export const useSingleFileAuthState = (filename, logger) => {
    let creds;
    let keys = {};
    let saveTimeout = null;

    const saveStateImmediate = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
        try {
            writeFileSync(filename, JSON.stringify({ creds, keys }, BufferJSON.replacer));
        } catch (e) {
            logger?.error({ err: e }, 'failed to save auth state');
        }
    };

    const saveState = () => {
        if (!saveTimeout) {
            saveTimeout = setTimeout(() => {
                saveTimeout = null;
                try {
                    writeFileSync(filename, JSON.stringify({ creds, keys }, BufferJSON.replacer));
                } catch (e) {
                    logger?.error({ err: e }, 'failed to save auth state');
                }
            }, 100);
        }
    };

    if (existsSync(filename)) {
        try {
            const result = JSON.parse(readFileSync(filename, { encoding: 'utf-8' }), BufferJSON.reviver);
            creds = result.creds;
            keys = result.keys || {};
        } catch (e) {
            logger?.error({ err: e }, 'failed to parse auth state, recreating');
        }
    }

    if (!creds) {
        creds = initAuthCreds();
    }

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const key = KEY_MAP[type];
                    return ids.reduce((dict, id) => {
                        let value = keys[key]?.[id];
                        if (value) {
                            if (type === 'app-state-sync-key') {
                                value = proto.AppStateSyncKeyData.fromObject(value);
                            }
                            dict[id] = value;
                        }
                        return dict;
                    }, {});
                },
                set: (data) => {
                    for (const _key in data) {
                        const key = KEY_MAP[_key];
                        keys[key] = keys[key] || {};
                        Object.assign(keys[key], data[_key]);
                    }
                    saveState();
                }
            }
        },
        saveState: saveStateImmediate
    };
};
