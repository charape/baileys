import { proto } from '../../WAProto/index.js';
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { printCharapeChatLog } from '../Utils/charape-runtime.js';
import { makeCommunitiesSocket } from './communities.js';
import { makeInteropSocket } from './interop.js';
import { makePrivacySocket } from './privacy.js';
import { makeGraphQLSocket } from './graphql.js';
import { makeMessageBuilderSocket } from './message-builder.js';

const cyan = '\x1b[36m';
const magenta = '\x1b[35m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';

function sleepSync(ms) {
    try {
        const shared = new Int32Array(new SharedArrayBuffer(4));
        Atomics.wait(shared, 0, 0, ms);
    } catch {
        const start = Date.now();
        while (Date.now() - start < ms) {}
    }
}

let hasShownBanner = false;

export function showCharapeBanner(force = false) {
    if (!force && hasShownBanner) return;
    if (process.env.CHARAPE_SILENT === 'true') return;
    hasShownBanner = true;

    const bannerLines = [
        `${cyan}${bold}  ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██████╗ ███████╗`,
        ` ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝`,
        ` ██║     ███████║███████║██████╔╝███████║██████╔╝█████╗  `,
        ` ██║     ██╔══██║██╔══██║██╔══██╗██╔══██║██╔═══╝ ██╔══╝  `,
        ` ╚██████╗██║  ██║██║  ██║██║  ██║██║  ██║██║     ███████╗`,
        `  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝${reset}`,
        ` ${magenta}${bold}✦  N E X T - G E N   W H A T S A P P   B O T   E N G I N E  ✦${reset}`,
        ` ${dim}─────────────────────────────────────────────────────────────${reset}`,
        `  ${green}●${reset} ${bold}Website${reset}   : ${cyan}https://charape.id${reset}`,
        `  ${green}●${reset} ${bold}Telegram${reset}  : ${cyan}https://t.me/nofalycharape${reset}`,
        `  ${green}●${reset} ${bold}Pairing${reset}   : ${yellow}${bold}CHARAPE1${reset} ${dim}(Auto Custom Link)${reset}`,
        `  ${green}●${reset} ${bold}Channel${reset}   : ${magenta}メ Informasi Store Cԋαɾαρҽ${reset}`,
        ` ${dim}─────────────────────────────────────────────────────────────${reset}\n`
    ];

    try {
        const isTTY = Boolean(process.stdout && process.stdout.isTTY);
        if (isTTY) {
            const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            for (let i = 0; i < spinner.length; i++) {
                process.stdout.write(`\r ${cyan}${spinner[i]}${reset} ${magenta}${bold}Starting CHARAPE WhatsApp Engine...${reset}`);
                sleepSync(25);
            }
            process.stdout.write('\r' + ' '.repeat(55) + '\r\n');
            for (const line of bannerLines) {
                console.log(line);
                sleepSync(15);
            }
        } else {
            console.log('\n' + bannerLines.join('\n'));
        }
    } catch {
        try {
            console.log('\n' + bannerLines.join('\n'));
        } catch {}
    }
}

// export the last socket layer
const makeWASocket = (config) => {
    showCharapeBanner();
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    if (typeof config.shouldSyncHistoryMessage !== 'function') {
        newConfig.shouldSyncHistoryMessage = ({ syncType }) => {
            return syncType === proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP ||
                   syncType === proto.HistorySync.HistorySyncType.PUSH_NAME;
        };
    }
    const satu = makeCommunitiesSocket(newConfig);
    const dua = makeInteropSocket(satu);
    const tiga = makePrivacySocket(dua);
    const empat = makeGraphQLSocket(tiga);
    return makeMessageBuilderSocket(empat);
};

export { makeWASocket, printCharapeChatLog };
export default makeWASocket;