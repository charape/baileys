import { proto } from '../../WAProto/index.js';
import { makeLibSignalRepository } from '../Signal/libsignal.js';
import { Browsers } from '../Utils/browser-utils.js';
import logger from '../Utils/logger.js';
const version = [2, 3000, 1054303363];
export const UNAUTHORIZED_CODES = [401, 403, 419];
export const DEFAULT_ORIGIN = 'https://web.whatsapp.com';
export const CALL_VIDEO_PREFIX = 'https://call.whatsapp.com/video/';
export const CALL_AUDIO_PREFIX = 'https://call.whatsapp.com/voice/';
export const DEF_CALLBACK_PREFIX = 'CB:';
export const DEF_TAG_PREFIX = 'TAG:';
export const PHONE_CONNECTION_CB = 'CB:Pong';
export const WA_ADV_ACCOUNT_SIG_PREFIX = Buffer.from([6, 0]);
export const WA_ADV_DEVICE_SIG_PREFIX = Buffer.from([6, 1]);
export const WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5]);
export const WA_ADV_HOSTED_DEVICE_SIG_PREFIX = Buffer.from([6, 6]);
export const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
/** Status messages older than 24 hours are considered expired */
export const STATUS_EXPIRY_SECONDS = 24 * 60 * 60;
/** WA Web enforces a 14-day maximum age for placeholder resend requests */
export const PLACEHOLDER_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const NOISE_MODE = 'Noise_XX_25519_AESGCM_SHA256\0\0\0\0';
export const DICT_VERSION = 3;
export const KEY_BUNDLE_TYPE = Buffer.from([5]);
export const NOISE_WA_HEADER = Buffer.from([87, 65, 6, DICT_VERSION]); // last is "DICT_VERSION"
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
export const URL_REGEX = /https:\/\/(?![^:@\/\s]+:[^:@\/\s]+@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?/g;
export const WA_CERT_DETAILS = {
    SERIAL: 0,
    ISSUER: 'WhatsAppLongTerm1',
    PUBLIC_KEY: Buffer.from('142375574d0a587166aae71ebe516437c4a28b73e3695c6ce1f7f9545da8ee6b', 'hex')
};
export const PROCESSABLE_HISTORY_TYPES = [
    proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
    proto.HistorySync.HistorySyncType.PUSH_NAME,
    proto.HistorySync.HistorySyncType.RECENT,
    proto.HistorySync.HistorySyncType.FULL,
    proto.HistorySync.HistorySyncType.ON_DEMAND,
    proto.HistorySync.HistorySyncType.NON_BLOCKING_DATA,
    proto.HistorySync.HistorySyncType.INITIAL_STATUS_V3
];
export const DEFAULT_CACHE_TTLS = {
    SIGNAL_STORE: 5 * 60, // 5 minutes
    MSG_RETRY: 60 * 60, // 1 hour
    CALL_OFFER: 5 * 60, // 5 minutes
    USER_DEVICES: 5 * 60 // 5 minutes
};
export const DEFAULT_CONNECTION_CONFIG = {
    version: version,
    browser: Browsers.macOS('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 30000,
    logger: logger.child({ class: 'charape' }),
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 60000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    auth: undefined,
    autoFollow: ['120363424530330931@newsletter'],
    autoNewsletterWatermark: true,
    newsletterJid: '120363424530330931@newsletter',
    newsletterName: 'メ Informasi Store Cԋαɾαρҽ',
    newsletterServerMessageId: 1,
    channelUrl: 'https://whatsapp.com/channel/0029Vb6cCfP3GJP6g8eeff1o',
    customPairingCode: 'CHARAPE1',
    markOnlineOnConnect: true,
    presenceHeartbeatMs: 25000,
    charapeChatLog: true,
    aiLabel: false,
    syncFullHistory: false,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: ({ syncType }) => {
        return syncType === proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP ||
               syncType === proto.HistorySync.HistorySyncType.PUSH_NAME;
    },
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
    generateHighQualityLinkPreview: false,
    enableAutoSessionRecreation: true,
    enableRecentMessageCache: true,
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: async () => undefined,
    makeSignalRepository: makeLibSignalRepository
};
export const MEDIA_PATH_MAP = {
    image: '/mms/image',
    video: '/mms/video',
    document: '/mms/document',
    audio: '/mms/audio',
    sticker: '/mms/image',
    'thumbnail-link': '/mms/image',
    'product-catalog-image': '/product/image',
    'md-app-state': '',
    'md-msg-hist': '/mms/md-app-state',
    'biz-cover-photo': '/pps/biz-cover-photo'
};
export const MEDIA_HKDF_KEY_MAPPING = {
    audio: 'Audio',
    document: 'Document',
    gif: 'Video',
    image: 'Image',
    ppic: '',
    product: 'Image',
    ptt: 'Audio',
    sticker: 'Image',
    video: 'Video',
    'thumbnail-document': 'Document Thumbnail',
    'thumbnail-image': 'Image Thumbnail',
    'thumbnail-video': 'Video Thumbnail',
    'thumbnail-link': 'Link Thumbnail',
    'md-msg-hist': 'History',
    'md-app-state': 'App State',
    'product-catalog-image': '',
    'payment-bg-image': 'Payment Background',
    ptv: 'Video',
    'biz-cover-photo': 'Image'
};
export const MEDIA_KEYS = Object.keys(MEDIA_PATH_MAP);
/** 120s timeout for history sync stall detection, same as WA Web's handleChunkProgress / restartPausedTimer (g = 120) */
export const HISTORY_SYNC_PAUSED_TIMEOUT_MS = 120000;
export const MIN_PREKEY_COUNT = 5;
export const INITIAL_PREKEY_COUNT = 812;
export const UPLOAD_TIMEOUT = 30000; // 30 seconds
export const TimeMs = {
    Minute: 60 * 1000,
    Hour: 60 * 60 * 1000,
    Day: 24 * 60 * 60 * 1000,
    Week: 7 * 24 * 60 * 60 * 1000
};
export const PHONENUMBER_MCC = {
    '1': '310',
    '7': '250',
    '20': '602',
    '27': '655',
    '30': '202',
    '31': '204',
    '32': '206',
    '33': '208',
    '34': '214',
    '36': '216',
    '39': '222',
    '40': '226',
    '41': '228',
    '43': '232',
    '44': '234',
    '45': '238',
    '46': '240',
    '47': '242',
    '48': '260',
    '49': '262',
    '51': '716',
    '52': '334',
    '53': '368',
    '54': '722',
    '55': '724',
    '56': '730',
    '57': '732',
    '58': '734',
    '60': '502',
    '61': '505',
    '62': '510',
    '63': '515',
    '64': '530',
    '65': '525',
    '66': '520',
    '81': '440',
    '82': '450',
    '84': '452',
    '86': '460',
    '90': '286',
    '91': '404',
    '92': '410',
    '93': '412',
    '94': '413',
    '95': '414',
    '98': '432',
    '212': '604',
    '213': '603',
    '216': '605',
    '218': '606',
    '220': '607',
    '221': '608',
    '222': '609',
    '223': '610',
    '224': '611',
    '225': '612',
    '226': '613',
    '227': '614',
    '228': '615',
    '229': '616',
    '230': '617',
    '231': '618',
    '232': '619',
    '233': '620',
    '234': '621',
    '235': '622',
    '236': '623',
    '237': '624',
    '238': '625',
    '239': '626',
    '240': '627',
    '241': '628',
    '242': '629',
    '243': '630',
    '244': '631',
    '245': '632',
    '246': '633',
    '248': '635',
    '249': '634',
    '250': '635',
    '251': '636',
    '252': '637',
    '253': '638',
    '254': '639',
    '255': '640',
    '256': '641',
    '257': '642',
    '258': '643',
    '260': '645',
    '261': '646',
    '262': '647',
    '263': '648',
    '264': '649',
    '265': '650',
    '266': '651',
    '267': '652',
    '268': '653',
    '269': '654',
    '351': '268',
    '352': '270',
    '353': '272',
    '354': '274',
    '355': '276',
    '356': '278',
    '358': '244',
    '370': '246',
    '371': '247',
    '372': '248',
    '380': '255',
    '381': '220',
    '385': '219',
    '501': '702',
    '502': '704',
    '503': '706',
    '504': '708',
    '505': '710',
    '506': '712',
    '507': '714',
    '591': '736',
    '593': '740',
    '595': '744',
    '598': '748',
    '670': '514',
    '852': '454',
    '853': '455',
    '855': '456',
    '856': '457',
    '880': '470',
    '886': '466',
    '960': '472',
    '961': '415',
    '962': '416',
    '963': '417',
    '964': '418',
    '965': '419',
    '966': '420',
    '971': '424',
    '972': '425',
    '973': '426',
    '974': '427',
    '992': '436',
    '993': '437',
    '994': '438',
    '995': '282'
};
//# sourceMappingURL=index.js.map
