import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Session storage cleaner for WhatsApp multi-file auth.
 * Prunes ephemeral sync files and pre-keys while strictly preserving creds.json.
 *
 * @param {string} sessionDir - Target session directory
 * @param {object} [options]
 * @param {number} [options.maxAgeHours=0] - Minimum age in hours before removal
 * @param {boolean} [options.dryRun=false] - Preview deletions without modifying disk
 * @param {boolean} [options.removePreKeys=true] - Remove pre-key-*.json
 * @param {boolean} [options.removeSenderKeys=false] - Remove sender-key-*.json
 * @param {boolean} [options.removeAppState=true] - Remove app-state-sync-*.json
 * @returns {Promise<{ totalFiles: number, deletedFiles: number, bytesFreed: number, errors: number, protected: string[] }>}
 */
export async function cleanAuthSession(sessionDir, options = {}) {
    const {
        maxAgeHours = 0,
        dryRun = false,
        removePreKeys = true,
        removeSenderKeys = false,
        removeAppState = true
    } = options;

    const result = {
        totalFiles: 0,
        deletedFiles: 0,
        bytesFreed: 0,
        errors: 0,
        protected: ['creds.json']
    };

    if (!sessionDir) {
        throw new Error('sessionDir parameter is required for cleanAuthSession');
    }

    try {
        const files = await readdir(sessionDir);
        result.totalFiles = files.length;
        const now = Date.now();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

        for (const file of files) {
            // CRITICAL: NEVER touch valid creds.json or database files!
            if (file === 'creds.json' || file === 'creds' || file.endsWith('.sqlite') || file.endsWith('.db')) {
                continue;
            }

            let shouldDelete = false;

            if (file.includes('.tmp') || file.endsWith('.tmp')) {
                // Leftover temporary files from interrupted writes
                shouldDelete = true;
            } else if (removePreKeys && file.startsWith('pre-key-')) {
                shouldDelete = true;
            } else if (removeAppState && file.startsWith('app-state-sync-')) {
                shouldDelete = true;
            } else if (removeSenderKeys && (file.startsWith('sender-key-') || file.startsWith('sender-key-memory-'))) {
                shouldDelete = true;
            }

            if (shouldDelete) {
                const filePath = join(sessionDir, file);
                try {
                    const fileStat = await stat(filePath);
                    if (maxAgeMs > 0 && (now - fileStat.mtimeMs) < maxAgeMs) {
                        continue; // Not old enough yet
                    }

                    result.bytesFreed += fileStat.size;
                    if (!dryRun) {
                        await unlink(filePath);
                    }
                    result.deletedFiles++;
                } catch {
                    result.errors++;
                }
            }
        }
    } catch (err) {
        throw new Error(`Failed to clean session directory "${sessionDir}": ${err.message}`);
    }

    return result;
}

export default cleanAuthSession;
