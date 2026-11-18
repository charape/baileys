import makeWASocket, { showCharapeBanner, printCharapeChatLog } from './Socket/index.js';
import * as WAProto from '../WAProto/index.js';
import * as Utils from './Utils/index.js';
import * as Types from './Types/index.js';
import * as Defaults from './Defaults/index.js';
import * as WABinary from './WABinary/index.js';
import * as WAM from './WAM/index.js';
import * as WAUSync from './WAUSync/index.js';
import * as Store from './Store/index.js';
import { cleanAuthSession } from './Utils/clean-session.js';
import { useSingleFileAuthState } from './Utils/use-single-file-auth-state.js';

// Adiwajshing / Classic Baileys full compatibility bridge
// Attaches all properties onto makeWASocket and makeWASocket.default
const allProps = {
    ...WAProto,
    ...Utils,
    ...Types,
    ...Defaults,
    ...WABinary,
    ...WAM,
    ...WAUSync,
    ...Store,
    cleanAuthSession,
    useSingleFileAuthState,
    makeWASocket,
    makeWALegacySocket: makeWASocket,
    showCharapeBanner,
    printCharapeChatLog
};

Object.assign(makeWASocket, allProps);
makeWASocket.default = makeWASocket;

export * from '../WAProto/index.js';
export * from './Utils/index.js';
export * from './Types/index.js';
export * from './Defaults/index.js';
export * from './WABinary/index.js';
export * from './WAM/index.js';
export * from './WAUSync/index.js';
export * from './Store/index.js';
export { cleanAuthSession } from './Utils/clean-session.js';
export { useSingleFileAuthState } from './Utils/use-single-file-auth-state.js';
export { makeWASocket, makeWASocket as makeWALegacySocket, showCharapeBanner, printCharapeChatLog };
export default makeWASocket;