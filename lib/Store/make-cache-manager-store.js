import { createRequire } from "module";
import { join } from "path";
import { pathToFileURL } from "url";

let cacheManager;
const loadCacheManager = async () => {
    if (cacheManager) return cacheManager;
    if (typeof require === "function") {
        cacheManager = require("cache-manager");
        return cacheManager;
    }
    try {
        const mod = await import("cache-manager");
        cacheManager = mod?.default || mod;
        return cacheManager;
    } catch {
        const _require = createRequire(pathToFileURL(join(process.cwd(), "package.json")).href);
        cacheManager = _require("cache-manager");
        return cacheManager;
    }
};

import * as WAProto_1 from "../../WAProto/index.js";
import * as Utils_1 from "../Utils/index.js";
import logger from "../Utils/logger.js";

export default async function makeCacheManagerAuthState(store, sessionKey) {
    const defaultKey = (file) => `${sessionKey}:${file}`;
    const cm = await loadCacheManager();
    const databaseConn = await cm.caching(store);

    const writeData = async (file, data) => {
        let ttl = undefined;
        if (file === "creds") ttl = 63115200; // 2 years
        await databaseConn.set(
            defaultKey(file),
            JSON.stringify(data, Utils_1.BufferJSON.replacer),
            ttl
        );
    };

    const readData = async (file) => {
        try {
            const data = await databaseConn.get(defaultKey(file));
            if (data) return JSON.parse(data, Utils_1.BufferJSON.reviver);
            return null;
        } catch (error) {
            logger.error(error);
            return null;
        }
    };

    const removeData = async (file) => {
        try {
            return await databaseConn.del(defaultKey(file));
        } catch {
            logger.error(`Error removing ${file} from session ${sessionKey}`);
        }
    };

    const clearState = async () => {
        try {
            const result = await databaseConn.store.keys(`${sessionKey}*`);
            await Promise.all(result.map(async (key) => databaseConn.del(key)));
        } catch {}
    };

    const creds = (await readData("creds")) || Utils_1.initAuthCreds();

    return {
        clearState,
        saveCreds: () => writeData("creds", creds),
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === "app-state-sync-key" && value) {
                                value =
                                    WAProto_1.proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(key, value) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        }
    };
}