import { Boom } from '@hapi/boom';
import { exec, spawn } from 'child_process';
import * as Crypto from 'crypto';
import { once } from 'events';
import { createReadStream, createWriteStream, promises as fs, WriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable, Transform } from 'stream';
import { URL } from 'url';
import { proto } from '../../WAProto/index.js';
import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP } from '../Defaults/index.js';
import { getBinaryNodeChild, getBinaryNodeChildBuffer, jidNormalizedUser } from '../WABinary/index.js';
import { aesDecryptGCM, aesEncryptGCM, hkdf } from './crypto.js';
import { generateMessageIDV2 } from './generics.js';
const getTmpFilesDirectory = () => tmpdir();
const getImageProcessingLibrary = async () => {
    const [_jimp, _sharp] = await Promise.all([
        import('jimp').catch(() => null),
        import('sharp').catch(() => null)
    ]);
    const sharp = _sharp?.default || _sharp;
    if (sharp && typeof sharp === 'function') {
        return { sharp };
    }
    const jimp = _jimp?.default || _jimp;
    if (jimp) {
        return { jimp };
    }
    return {};
};
export const hkdfInfoKey = (type) => {
    const hkdfInfo = MEDIA_HKDF_KEY_MAPPING[type];
    return `WhatsApp ${hkdfInfo} Keys`;
};
export const getRawMediaUploadData = async (media, mediaType, logger) => {
    const { stream } = await getStream(media);
    logger?.debug('got stream for raw upload');
    const hasher = Crypto.createHash('sha256');
    const filePath = join(tmpdir(), mediaType + generateMessageIDV2());
    const fileWriteStream = createWriteStream(filePath);
    let fileLength = 0;
    try {
        for await (const data of stream) {
            fileLength += data.length;
            hasher.update(data);
            if (!fileWriteStream.write(data)) {
                await once(fileWriteStream, 'drain');
            }
        }
        fileWriteStream.end();
        await once(fileWriteStream, 'finish');
        stream.destroy();
        const fileSha256 = hasher.digest();
        logger?.debug('hashed data for raw upload');
        return {
            filePath: filePath,
            fileSha256,
            fileLength
        };
    }
    catch (error) {
        fileWriteStream.destroy();
        stream.destroy();
        try {
            await fs.unlink(filePath);
        }
        catch {
            //
        }
        throw error;
    }
};
/** generates all the keys required to encrypt/decrypt & sign a media message */
export async function getMediaKeys(buffer, mediaType) {
    if (!buffer) {
        throw new Boom('Cannot derive from empty media key');
    }
    if (typeof buffer === 'string') {
        buffer = Buffer.from(buffer.replace('data:;base64,', ''), 'base64');
    }
    // expand using HKDF to 112 bytes, also pass in the relevant app info
    const expandedMediaKey = hkdf(buffer, 112, { info: hkdfInfoKey(mediaType) });
    return {
        iv: expandedMediaKey.slice(0, 16),
        cipherKey: expandedMediaKey.slice(16, 48),
        macKey: expandedMediaKey.slice(48, 80)
    };
}
/** Extracts video thumb using FFMPEG */
export const extractVideoThumb = async (videoPath, time = '00:00:00', size = { width: 256 }) => {
    return new Promise((resolve, reject) => {
        const args = [
            '-ss', time,
            '-i', videoPath,
            '-y',
            '-vf', `scale=${size.width}:-1`,
            '-vframes', '1',
            '-f', 'image2',
            '-vcodec', 'mjpeg',
            'pipe:1'
        ];
        const ffmpeg = spawn('ffmpeg', args);
        const chunks = [];
        let errorOutput = '';
        ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
        ffmpeg.stderr.on('data', data => {
            errorOutput += data.toString();
        });
        ffmpeg.on('error', reject);
        ffmpeg.on('close', code => {
            if (code === 0) {
                return resolve(Buffer.concat(chunks));
            }
            reject(new Error(`ffmpeg exited with code ${code}\n${errorOutput}`));
        });
    });
};
export const extractImageThumb = async (bufferOrFilePath, width = 32) => {
    try {
        if (bufferOrFilePath instanceof Readable) {
            bufferOrFilePath = await toBuffer(bufferOrFilePath);
        }
        const lib = await getImageProcessingLibrary();
        if (lib.sharp && typeof lib.sharp === 'function') {
            const img = lib.sharp(bufferOrFilePath);
            const dimensions = await img.metadata();
            const buffer = await img.resize(width).jpeg({ quality: 50 }).toBuffer();
            return {
                buffer,
                original: {
                    width: dimensions.width,
                    height: dimensions.height
                }
            };
        }
        if (lib.jimp) {
            const jimpLib = lib.jimp;
            const readFn = jimpLib.read || jimpLib.Jimp?.read || jimpLib.default?.read;
            if (typeof readFn === 'function') {
                const jimp = await readFn(bufferOrFilePath);
                const widthVal = typeof jimp.getWidth === 'function' ? jimp.getWidth() : (jimp.width || 0);
                const heightVal = typeof jimp.getHeight === 'function' ? jimp.getHeight() : (jimp.height || 0);
                const dimensions = { width: widthVal, height: heightVal };
                let buffer;
                if (typeof jimp.getBufferAsync === 'function') {
                    const mime = jimpLib.MIME_JPEG || 'image/jpeg';
                    const auto = jimpLib.AUTO || -1;
                    const bilinear = jimpLib.RESIZE_BILINEAR || undefined;
                    buffer = await jimp.quality(50).resize(width, auto, bilinear).getBufferAsync(mime);
                } else if (typeof jimp.getBuffer === 'function') {
                    buffer = await jimp.resize({ w: width }).getBuffer('image/jpeg', { quality: 50 });
                }
                if (buffer) {
                    return { buffer, original: dimensions };
                }
            }
        }
    }
    catch (_) {
        // Thumbnail generation is non-fatal
    }
    return {
        buffer: Buffer.alloc(0),
        original: { width: 0, height: 0 }
    };
};
export const encodeBase64EncodedStringForUpload = (b64) => encodeURIComponent(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/, ''));
export const generateProfilePicture = async (mediaUpload, dimensions) => {
    let buffer;
    const { width: w = 640, height: h = 640 } = dimensions || {};
    if (Buffer.isBuffer(mediaUpload)) {
        buffer = mediaUpload;
    }
    else {
        const { stream } = await getStream(mediaUpload);
        buffer = await toBuffer(stream);
    }
    try {
        const lib = await getImageProcessingLibrary();
        if (lib.sharp && typeof lib.sharp === 'function') {
            const img = await lib.sharp(buffer).resize(w, h).jpeg({ quality: 50 }).toBuffer();
            return { img };
        }
        if (lib.jimp) {
            const jimpLib = lib.jimp;
            const readFn = jimpLib.read || jimpLib.Jimp?.read || jimpLib.default?.read;
            if (typeof readFn === 'function') {
                const jimp = await readFn(buffer);
                const widthVal = typeof jimp.getWidth === 'function' ? jimp.getWidth() : jimp.width;
                const heightVal = typeof jimp.getHeight === 'function' ? jimp.getHeight() : jimp.height;
                const min = Math.min(widthVal, heightVal);
                if (typeof jimp.getBufferAsync === 'function') {
                    const cropped = jimp.crop(0, 0, min, min);
                    const auto = jimpLib.AUTO || -1;
                    const img = await cropped.quality(50).resize(w, h).getBufferAsync(jimpLib.MIME_JPEG || 'image/jpeg');
                    return { img };
                } else if (typeof jimp.getBuffer === 'function') {
                    const cropped = jimp.crop({ x: 0, y: 0, w: min, h: min });
                    const img = await cropped.resize({ w, h }).getBuffer('image/jpeg', { quality: 50 });
                    return { img };
                }
            }
        }
    } catch (_) {}
    return {
        img: buffer
    };
};
/** gets the SHA256 of the given media message */
export const mediaMessageSHA256B64 = (message) => {
    const media = Object.values(message)[0];
    return media?.fileSha256 && Buffer.from(media.fileSha256).toString('base64');
};
export async function getAudioDuration(buffer) {
    const musicMetadata = await import('music-metadata');
    let metadata;
    const options = {
        duration: true
    };
    if (Buffer.isBuffer(buffer)) {
        metadata = await musicMetadata.parseBuffer(buffer, undefined, options);
    }
    else if (typeof buffer === 'string') {
        metadata = await musicMetadata.parseFile(buffer, options);
    }
    else {
        metadata = await musicMetadata.parseStream(buffer, undefined, options);
    }
    return metadata.format.duration;
}
/**
  referenced from and modifying https://github.com/wppconnect-team/wa-js/blob/main/src/chat/functions/prepareAudioWaveform.ts
 */
export async function getAudioWaveform(buffer, logger) {
    try {
        // @ts-ignore
        const { default: decoder } = await import('audio-decode');
        let audioData;
        if (Buffer.isBuffer(buffer)) {
            audioData = buffer;
        }
        else if (typeof buffer === 'string') {
            const rStream = createReadStream(buffer);
            audioData = await toBuffer(rStream);
        }
        else {
            audioData = await toBuffer(buffer);
        }
        const audioBuffer = await decoder(audioData);
        const rawData = audioBuffer.getChannelData(0); // We only need to work with one channel of data
        const samples = 64; // Number of samples we want to have in our final data set
        const blockSize = Math.floor(rawData.length / samples); // the number of samples in each subdivision
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i; // the location of the first sample in the block
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
            }
            filteredData.push(sum / blockSize); // divide the sum by the block size to get the average
        }
        // This guarantees that the largest data point will be set to 1, and the rest of the data will scale proportionally.
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        const normalizedData = filteredData.map(n => n * multiplier);
        // Generate waveform like WhatsApp
        const waveform = new Uint8Array(normalizedData.map(n => Math.floor(100 * n)));
        return waveform;
    }
    catch (e) {
        logger?.debug('Failed to generate waveform: ' + e);
    }
}
export const toReadable = (buffer) => {
    const readable = new Readable({ read: () => { } });
    readable.push(buffer);
    readable.push(null);
    return readable;
};
export const toBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    stream.destroy();
    return Buffer.concat(chunks);
};
export const getStream = async (item, opts) => {
    if (Buffer.isBuffer(item)) {
        return { stream: toReadable(item), type: 'buffer' };
    }
    if ('stream' in item) {
        return { stream: item.stream, type: 'readable' };
    }
    const urlStr = item.url.toString();
    if (urlStr.startsWith('data:')) {
        const buffer = Buffer.from(urlStr.split(',')[1], 'base64');
        return { stream: toReadable(buffer), type: 'buffer' };
    }
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        return { stream: await getHttpStream(item.url, opts), type: 'remote' };
    }
    return { stream: createReadStream(item.url), type: 'file' };
};
/** generates a thumbnail for a given media, if required */
export async function generateThumbnail(file, mediaType, options) {
    let thumbnail;
    let originalImageDimensions;
    if (mediaType === 'image') {
        try {
            const { buffer, original } = await extractImageThumb(file);
            if (buffer && buffer.length > 0) {
                thumbnail = buffer.toString('base64');
            }
            if (original?.width && original?.height) {
                originalImageDimensions = {
                    width: original.width,
                    height: original.height
                };
            }
        }
        catch (err) {
            options?.logger?.debug('could not generate image thumb: ' + err);
        }
    }
    else if (mediaType === 'video') {
        let videoPath = file;
        let didWriteVideo = false;
        try {
            if (Buffer.isBuffer(file) || file instanceof Readable) {
                videoPath = join(getTmpFilesDirectory(), generateMessageIDV2() + '.mp4');
                const buffer = Buffer.isBuffer(file) ? file : await toBuffer(file);
                await fs.writeFile(videoPath, buffer);
                didWriteVideo = true;
            }
            const thumbBuffer = await extractVideoThumb(videoPath);
            const { buffer: processedThumb, original } = await extractImageThumb(thumbBuffer);
            if (processedThumb && processedThumb.length > 0) {
                thumbnail = processedThumb.toString('base64');
            }
            if (original?.width && original?.height) {
                originalImageDimensions = {
                    width: original.width,
                    height: original.height
                };
            }
        }
        catch (err) {
            options?.logger?.debug('could not generate video thumb: ' + err);
        }
        finally {
            if (didWriteVideo && videoPath) {
                try {
                    await fs.unlink(videoPath);
                }
                catch (_) {}
            }
        }
    }
    return {
        thumbnail,
        originalImageDimensions
    };
}
export const getHttpStream = async (url, options = {}) => {
    const response = await fetch(url.toString(), {
        dispatcher: options.dispatcher,
        method: 'GET',
        headers: options.headers
    });
    if (!response.ok) {
        throw new Boom(`Failed to fetch stream from ${url}`, { statusCode: response.status, data: { url } });
    }
    // @ts-ignore Node18+ Readable.fromWeb exists
    return response.body instanceof Readable ? response.body : Readable.fromWeb(response.body);
};
export const prepareStream = async (media, mediaType, { logger, saveOriginalFileIfRequired, opts } = {}) => {
    const { stream, type } = await getStream(media, opts);
    logger?.debug('fetched media stream');
    let originalFilePath;
    let didSaveToTmpPath = false;
    try {
        const buffer = await toBuffer(stream);
        if (type === 'file') {
            originalFilePath = media.url;
        }
        else if (saveOriginalFileIfRequired) {
            originalFilePath = join(getTmpFilesDirectory(), mediaType + generateMessageIDV2());
            await fs.writeFile(originalFilePath, buffer);
            didSaveToTmpPath = true;
        }
        const fileLength = buffer.length;
        const fileSha256 = Crypto.createHash('sha256').update(buffer).digest();
        stream?.destroy?.();
        logger?.debug('prepare stream data successfully');
        return {
            mediaKey: undefined,
            encWriteStream: buffer,
            fileLength,
            fileSha256,
            fileEncSha256: undefined,
            originalFilePath,
            didSaveToTmpPath
        };
    }
    catch (error) {
        stream?.destroy?.();
        if (didSaveToTmpPath && originalFilePath) {
            try {
                await fs.unlink(originalFilePath);
            }
            catch (err) {
                logger?.error({ err }, 'failed to save to tmp path');
            }
        }
        throw error;
    }
};
export const encryptedStream = async (media, mediaType, { logger, saveOriginalFileIfRequired, opts } = {}) => {
    const { stream, type } = await getStream(media, opts);
    logger?.debug('fetched media stream');
    const mediaKey = Crypto.randomBytes(32);
    const { cipherKey, iv, macKey } = await getMediaKeys(mediaKey, mediaType);
    const encWriteStream = new Readable({ read: () => { } });
    let originalFileStream;
    let originalFilePath;
    let didSaveToTmpPath = false;
    if (type === 'file') {
        originalFilePath = media.url;
    }
    else if (saveOriginalFileIfRequired) {
        originalFilePath = join(getTmpFilesDirectory(), mediaType + generateMessageIDV2() + '-original');
        originalFileStream = createWriteStream(originalFilePath);
        didSaveToTmpPath = true;
    }
    let fileLength = 0;
    const aes = Crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    const hmac = Crypto.createHmac('sha256', macKey).update(iv);
    const sha256Plain = Crypto.createHash('sha256');
    const sha256Enc = Crypto.createHash('sha256');
    const onChunk = (buff) => {
        sha256Enc.update(buff);
        hmac.update(buff);
        encWriteStream.push(buff);
    };
    try {
        for await (const data of stream) {
            fileLength += data.length;
            if (type === 'remote' &&
                opts?.maxContentLength &&
                fileLength + data.length > opts.maxContentLength) {
                throw new Boom(`content length exceeded when encrypting "${type}"`, {
                    data: { media, type }
                });
            }
            if (originalFileStream) {
                if (!originalFileStream.write(data)) {
                    await once(originalFileStream, 'drain');
                }
            }
            sha256Plain.update(data);
            onChunk(aes.update(data));
        }
        onChunk(aes.final());
        const mac = hmac.digest().slice(0, 10);
        sha256Enc.update(mac);
        const fileSha256 = sha256Plain.digest();
        const fileEncSha256 = sha256Enc.digest();
        encWriteStream.push(mac);
        encWriteStream.push(null);
        if (originalFileStream) {
            originalFileStream.end();
            await once(originalFileStream, 'finish');
        }
        stream?.destroy?.();
        logger?.debug('encrypted data successfully');
        return {
            mediaKey,
            encWriteStream,
            originalFilePath,
            mac,
            fileEncSha256,
            fileSha256,
            fileLength,
            didSaveToTmpPath
        };
    }
    catch (error) {
        encWriteStream.destroy();
        originalFileStream?.destroy?.();
        aes.destroy();
        hmac.destroy();
        sha256Plain.destroy();
        sha256Enc.destroy();
        stream?.destroy?.();
        if (didSaveToTmpPath && originalFilePath) {
            try {
                await fs.unlink(originalFilePath);
            }
            catch (err) {
                logger?.error({ err }, 'failed deleting tmp files');
            }
        }
        throw error;
    }
};
export const DEF_MEDIA_HOST = 'mmg.whatsapp.net';
const AES_CHUNK_SIZE = 16;
const toSmallestChunkSize = (num) => {
    return Math.floor(num / AES_CHUNK_SIZE) * AES_CHUNK_SIZE;
};
export const getUrlFromDirectPath = (directPath, host = DEF_MEDIA_HOST) => `https://${host}${directPath}`;
const extractHost = (url) => {
    if (!url)
        return undefined;
    try {
        return new URL(url).host;
    }
    catch {
        return undefined;
    }
};
export const downloadContentFromMessage = async ({ mediaKey, directPath, url }, type, opts = {}) => {
    // Fallback host: explicit opt > host parsed from `url` > DEF_MEDIA_HOST.
    // Lets us honor a non-default host carried by the proto without forcing callers to thread it through.
    const fallbackHost = opts.host ?? extractHost(url);
    const downloadUrl = directPath ? getUrlFromDirectPath(directPath, fallbackHost) : url;
    if (!downloadUrl) {
        throw new Boom('No valid media URL or directPath present in message', { statusCode: 400 });
    }
    const keys = await getMediaKeys(mediaKey, type);
    return downloadEncryptedContent(downloadUrl, keys, opts);
};
/**
 * Decrypts and downloads an AES256-CBC encrypted file given the keys.
 * Assumes the SHA256 of the plaintext is appended to the end of the ciphertext
 * */
export const downloadEncryptedContent = async (downloadUrl, { cipherKey, iv }, { startByte, endByte, options } = {}) => {
    let bytesFetched = 0;
    let startChunk = 0;
    let firstBlockIsIV = false;
    // if a start byte is specified -- then we need to fetch the previous chunk as that will form the IV
    if (startByte) {
        const chunk = toSmallestChunkSize(startByte || 0);
        if (chunk) {
            startChunk = chunk - AES_CHUNK_SIZE;
            bytesFetched = chunk;
            firstBlockIsIV = true;
        }
    }
    const endChunk = endByte ? toSmallestChunkSize(endByte || 0) + AES_CHUNK_SIZE : undefined;
    const headersInit = options?.headers ? options.headers : undefined;
    const headers = {
        ...(headersInit
            ? Array.isArray(headersInit)
                ? Object.fromEntries(headersInit)
                : headersInit
            : {}),
        Origin: DEFAULT_ORIGIN
    };
    if (startChunk || endChunk) {
        headers.Range = `bytes=${startChunk}-`;
        if (endChunk) {
            headers.Range += endChunk;
        }
    }
    // download the message
    const fetched = await getHttpStream(downloadUrl, {
        ...(options || {}),
        headers
    });
    let remainingBytes = Buffer.from([]);
    let aes;
    const pushBytes = (bytes, push) => {
        if (startByte || endByte) {
            const start = bytesFetched >= startByte ? undefined : Math.max(startByte - bytesFetched, 0);
            const end = bytesFetched + bytes.length < endByte ? undefined : Math.max(endByte - bytesFetched, 0);
            push(bytes.slice(start, end));
            bytesFetched += bytes.length;
        }
        else {
            push(bytes);
        }
    };
    const output = new Transform({
        transform(chunk, _, callback) {
            let data = remainingBytes.length ? Buffer.concat([remainingBytes, chunk]) : chunk;
            const decryptLength = toSmallestChunkSize(data.length);
            remainingBytes = data.slice(decryptLength);
            data = data.slice(0, decryptLength);
            if (!aes) {
                let ivValue = iv;
                if (firstBlockIsIV) {
                    ivValue = data.slice(0, AES_CHUNK_SIZE);
                    data = data.slice(AES_CHUNK_SIZE);
                }
                aes = Crypto.createDecipheriv('aes-256-cbc', cipherKey, ivValue);
                // if an end byte that is not EOF is specified
                // stop auto padding (PKCS7) -- otherwise throws an error for decryption
                if (endByte) {
                    aes.setAutoPadding(false);
                }
            }
            try {
                pushBytes(aes.update(data), b => this.push(b));
                callback();
            }
            catch (error) {
                callback(error);
            }
        },
        final(callback) {
            try {
                pushBytes(aes.final(), b => this.push(b));
                callback();
            }
            catch (error) {
                callback(error);
            }
        }
    });
    return fetched.pipe(output, { end: true });
};
export function extensionForMediaMessage(message) {
    const getExtension = (mimetype) => mimetype.split(';')[0]?.split('/')[1];
    const type = Object.keys(message)[0];
    let extension;
    if (type === 'locationMessage' || type === 'liveLocationMessage' || type === 'productMessage') {
        extension = '.jpeg';
    }
    else {
        const messageContent = message[type];
        extension = getExtension(messageContent.mimetype);
    }
    return extension;
}
const isNodeRuntime = () => {
    return (typeof process !== 'undefined' &&
        process.versions?.node !== null &&
        typeof process.versions.bun === 'undefined' &&
        typeof globalThis.Deno === 'undefined');
};
export async function uploadFile(buffer, logger) {
    if (!Buffer.isBuffer(buffer)) {
        buffer = Buffer.from(buffer || []);
    }
    // 1. Catbox service
    try {
        const FormDataModule = await import('form-data').catch(() => null);
        const FormData = FormDataModule?.default || FormDataModule;
        const axiosModule = await import('axios').catch(() => null);
        const axios = axiosModule?.default || axiosModule;
        if (FormData && axios) {
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', buffer, { filename: 'file.bin' });
            const res = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders(),
                timeout: 30000
            });
            if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
                return res.data.trim();
            }
        }
    }
    catch (e) {
        logger?.debug('catbox upload fallback: ' + e.message);
    }
    // 2. Tmpfiles service fallback via fetch
    try {
        const boundary = '----WebKitFormBoundary' + Crypto.randomBytes(8).toString('hex');
        const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`);
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, buffer, footer]);
        const res = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body
        });
        const json = await res.json();
        if (json?.data?.url) {
            return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
    }
    catch (e) {
        logger?.debug('tmpfiles upload fallback: ' + e.message);
    }
    throw new Boom('Failed to upload file to external hosting provider', { statusCode: 500 });
}
export const uploadBufferWithNodeHttp = async ({ url, buffer, headers, timeoutMs, agent }, redirectCount = 0) => {
    if (redirectCount > 5) {
        throw new Error('Too many redirects');
    }
    const parsedUrl = new URL(url);
    const httpModule = parsedUrl.protocol === 'https:' ? await import('https') : await import('http');
    return new Promise((resolve, reject) => {
        const req = httpModule.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': buffer.length
            },
            agent,
            timeout: timeoutMs
        }, res => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const newUrl = new URL(res.headers.location, url).toString();
                resolve(uploadBufferWithNodeHttp({
                    url: newUrl,
                    buffer,
                    headers,
                    timeoutMs,
                    agent
                }, redirectCount + 1));
                return;
            }
            let body = '';
            res.on('data', chunk => (body += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                }
                catch {
                    resolve(body ? { raw: body } : undefined);
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Upload timeout'));
        });
        req.end(buffer);
    });
};
export const uploadWithNodeHttp = uploadBufferWithNodeHttp;
export const uploadMedia = async ({ url, body, headers, timeoutMs, agent }, logger) => {
    // 1. Try axios if available in environment (supports infinity body and proxy smoothly)
    try {
        const axiosModule = await import('axios').catch(() => null);
        const axios = axiosModule?.default || axiosModule;
        if (axios && typeof axios.post === 'function') {
            const res = await axios.post(url, body, {
                headers,
                httpsAgent: agent,
                timeout: timeoutMs,
                responseType: 'json',
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            if (res.data) {
                return res.data;
            }
        }
    }
    catch (axiosErr) {
        if (axiosErr?.response?.data) {
            return axiosErr.response.data;
        }
        logger?.debug('axios upload failed, trying fallback: ' + (axiosErr?.message || axiosErr));
    }
    // 2. Node.js native HTTPS request with direct Buffer write
    if (isNodeRuntime()) {
        try {
            return await uploadBufferWithNodeHttp({ url, buffer: body, headers, timeoutMs, agent });
        }
        catch (nodeErr) {
            logger?.debug('nodeHttp upload failed: ' + (nodeErr?.message || nodeErr));
        }
    }
    // 3. Web-standard Fetch API fallback
    try {
        const response = await fetch(url, {
            method: 'POST',
            body,
            headers,
            duplex: 'half',
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
        });
        return await response.json();
    }
    catch (fetchErr) {
        logger?.debug('fetch upload failed: ' + (fetchErr?.message || fetchErr));
        return undefined;
    }
};
export const getWAUploadToServer = ({ customUploadHosts, fetchAgent, logger, options }, refreshMediaConn) => {
    return async (streamOrBufferOrPath, { mediaType, fileEncSha256B64, newsletter, timeoutMs }) => {
        let uploadInfo = await refreshMediaConn(false);
        let urls;
        const hosts = [...(customUploadHosts || []), ...uploadInfo.hosts];
        // Normalize any input (Buffer, string filepath, Readable stream) into Buffer
        let reqBody;
        if (Buffer.isBuffer(streamOrBufferOrPath)) {
            reqBody = streamOrBufferOrPath;
        }
        else if (typeof streamOrBufferOrPath === 'string') {
            reqBody = await fs.readFile(streamOrBufferOrPath);
        }
        else if (streamOrBufferOrPath && typeof streamOrBufferOrPath[Symbol.asyncIterator] === 'function') {
            const chunks = [];
            for await (const chunk of streamOrBufferOrPath) {
                chunks.push(chunk);
            }
            reqBody = Buffer.concat(chunks);
        }
        else if (streamOrBufferOrPath?.stream && typeof streamOrBufferOrPath.stream[Symbol.asyncIterator] === 'function') {
            const chunks = [];
            for await (const chunk of streamOrBufferOrPath.stream) {
                chunks.push(chunk);
            }
            reqBody = Buffer.concat(chunks);
        }
        else {
            reqBody = Buffer.from(streamOrBufferOrPath || []);
        }
        fileEncSha256B64 = encodeBase64EncodedStringForUpload(fileEncSha256B64);
        let mediaPath = MEDIA_PATH_MAP[mediaType];
        if (newsletter) {
            mediaPath = mediaPath?.replace('/mms/', '/newsletter/newsletter-');
        }
        const customHeaders = (() => {
            const hdrs = options?.headers;
            if (!hdrs)
                return {};
            return Array.isArray(hdrs) ? Object.fromEntries(hdrs) : hdrs;
        })();
        const headers = {
            ...customHeaders,
            'Content-Type': 'application/octet-stream',
            Origin: DEFAULT_ORIGIN
        };
        for (const { hostname, maxContentLengthBytes } of hosts) {
            logger?.debug(`uploading to "${hostname}"`);
            const auth = encodeURIComponent(uploadInfo.auth);
            const url = `https://${hostname}${mediaPath}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}`;
            let result;
            try {
                if (maxContentLengthBytes && reqBody.length > maxContentLengthBytes) {
                    throw new Boom(`Body too large for "${hostname}"`, { statusCode: 413 });
                }
                result = await uploadMedia({
                    url,
                    body: reqBody,
                    headers,
                    timeoutMs,
                    agent: fetchAgent
                }, logger);
                if (result?.url || result?.directPath || result?.direct_path) {
                    urls = {
                        mediaUrl: result.url,
                        directPath: result.direct_path || result.directPath,
                        handle: result.handle,
                        meta_hmac: result.meta_hmac,
                        fbid: result.fbid,
                        ts: result.ts
                    };
                    break;
                }
                else {
                    uploadInfo = await refreshMediaConn(true);
                    throw new Error(`upload failed, reason: ${JSON.stringify(result)}`);
                }
            }
            catch (error) {
                const isLast = hostname === hosts[uploadInfo.hosts.length - 1]?.hostname;
                logger?.warn({ trace: error?.stack, uploadResult: result }, `Error in uploading to ${hostname} ${isLast ? '' : ', retrying...'}`);
            }
        }
        if (!urls) {
            throw new Boom('Media upload failed on all hosts', { statusCode: 500 });
        }
        return urls;
    };
};
const getMediaRetryKey = (mediaKey) => {
    return hkdf(mediaKey, 32, { info: 'WhatsApp Media Retry Notification' });
};
/**
 * Generate a binary node that will request the phone to re-upload the media & return the newly uploaded URL
 */
export const encryptMediaRetryRequest = (key, mediaKey, meId) => {
    const recp = { stanzaId: key.id };
    const recpBuffer = proto.ServerErrorReceipt.encode(recp).finish();
    const iv = Crypto.randomBytes(12);
    const retryKey = getMediaRetryKey(mediaKey);
    const ciphertext = aesEncryptGCM(recpBuffer, retryKey, iv, Buffer.from(key.id));
    const req = {
        tag: 'receipt',
        attrs: {
            id: key.id,
            to: jidNormalizedUser(meId),
            type: 'server-error'
        },
        content: [
            // this encrypt node is actually pretty useless
            // the media is returned even without this node
            // keeping it here to maintain parity with WA Web
            {
                tag: 'encrypt',
                attrs: {},
                content: [
                    { tag: 'enc_p', attrs: {}, content: ciphertext },
                    { tag: 'enc_iv', attrs: {}, content: iv }
                ]
            },
            {
                tag: 'rmr',
                attrs: {
                    jid: key.remoteJid,
                    from_me: (!!key.fromMe).toString(),
                    // @ts-ignore
                    participant: key.participant || undefined
                }
            }
        ]
    };
    return req;
};
export const decodeMediaRetryNode = (node) => {
    const rmrNode = getBinaryNodeChild(node, 'rmr');
    const event = {
        key: {
            id: node.attrs.id,
            remoteJid: rmrNode.attrs.jid,
            fromMe: rmrNode.attrs.from_me === 'true',
            participant: rmrNode.attrs.participant
        }
    };
    const errorNode = getBinaryNodeChild(node, 'error');
    if (errorNode) {
        const errorCode = +errorNode.attrs.code;
        event.error = new Boom(`Failed to re-upload media (${errorCode})`, {
            data: errorNode.attrs,
            statusCode: getStatusCodeForMediaRetry(errorCode)
        });
    }
    else {
        const encryptedInfoNode = getBinaryNodeChild(node, 'encrypt');
        const ciphertext = getBinaryNodeChildBuffer(encryptedInfoNode, 'enc_p');
        const iv = getBinaryNodeChildBuffer(encryptedInfoNode, 'enc_iv');
        if (ciphertext && iv) {
            event.media = { ciphertext, iv };
        }
        else {
            event.error = new Boom('Failed to re-upload media (missing ciphertext)', { statusCode: 404 });
        }
    }
    return event;
};
export const decryptMediaRetryData = ({ ciphertext, iv }, mediaKey, msgId) => {
    const retryKey = getMediaRetryKey(mediaKey);
    const plaintext = aesDecryptGCM(ciphertext, retryKey, iv, Buffer.from(msgId));
    return proto.MediaRetryNotification.decode(plaintext);
};
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();
export const crc32 = (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};
export const buildZipArchive = (files) => {
    const localChunks = [];
    const centralChunks = [];
    let offset = 0;
    for (const { name, data } of files) {
        const nameBuf = Buffer.from(name, 'utf8');
        const crc = crc32(data);
        const dosTime = 0;
        const dosDate = 0x21;
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(data.length, 18);
        localHeader.writeUInt32LE(data.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);
        localChunks.push(localHeader, nameBuf, data);
        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(data.length, 20);
        centralHeader.writeUInt32LE(data.length, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        centralChunks.push(centralHeader, nameBuf);
        offset += localHeader.length + nameBuf.length + data.length;
    }
    const centralDirStart = offset;
    const centralDirBuf = Buffer.concat(centralChunks);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(centralDirBuf.length, 12);
    eocd.writeUInt32LE(centralDirStart, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...localChunks, centralDirBuf, eocd]);
};
export const resolveStickerBuffer = async (item, opts) => {
    if (Buffer.isBuffer(item)) {
        return item;
    }
    const media = typeof item === 'string' ? { url: item } : item;
    const { stream } = await getStream(media, opts);
    return toBuffer(stream);
};
export const getStatusCodeForMediaRetry = (code) => MEDIA_RETRY_STATUS_MAP[code];
const MEDIA_RETRY_STATUS_MAP = {
    [proto.MediaRetryNotification.ResultType.SUCCESS]: 200,
    [proto.MediaRetryNotification.ResultType.DECRYPTION_ERROR]: 412,
    [proto.MediaRetryNotification.ResultType.NOT_FOUND]: 404,
    [proto.MediaRetryNotification.ResultType.GENERAL_ERROR]: 418
};
//# sourceMappingURL=messages-media.js.map