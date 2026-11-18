import { UserFacingSocketConfig } from './Types/index.js';

export * from '../WAProto/index.js';
export * from './Types/index.js';
export * from './Defaults/index.js';
export * from './Utils/index.js';
export * from './WABinary/index.js';
export * from './WAM/index.js';
export * from './WAUSync/index.js';
export * from './Store/index.js';

export interface CleanSessionResult {
    totalFiles: number;
    deletedFiles: number;
    bytesFreed: number;
    errors: number;
    protected: string[];
}

export interface CleanSessionOptions {
    maxAgeHours?: number;
    dryRun?: boolean;
    removePreKeys?: boolean;
    removeSenderKeys?: boolean;
    removeAppState?: boolean;
}

export declare function cleanAuthSession(sessionDir: string, options?: CleanSessionOptions): Promise<CleanSessionResult>;

export declare function makeWASocket(config: Partial<UserFacingSocketConfig>): any;
export declare const makeWALegacySocket: typeof makeWASocket;
export declare const PHONENUMBER_MCC: Record<string, string>;

export default makeWASocket;
