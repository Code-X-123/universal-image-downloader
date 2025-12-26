const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { exec } = require('child_process');
const urlModule = require('url');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- CONFIGURATION ---
const HISTORY_FILE = path.join(__dirname, 'history.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));

app.use(express.static('public'));

// --- GLOBAL VARIABLES ---
let searchQueue = [];
let isScanning = false;
let currentAbortController = null;

// --- HELPER FUNCTIONS ---
function getHistory() { try { return JSON.parse(fs.readFileSync(HISTORY_FILE)); } catch (e) { return []; } }
function saveHistory(newEntry) {
    let history = getHistory();
    if (!history.find(h => h.url === newEntry.url)) history.unshift(newEntry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return history;
}

// --- QUEUE MANAGER ---
async function processQueue(socket) {
    if (isScanning || searchQueue.length === 0) return;

    isScanning = true;
    const task = searchQueue.shift();
    
    socket.emit('queue-update', searchQueue.length);
    
    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();

    try {
        await startScraping(task.url, task.loopMode, task.showBrowser, socket, currentAbortController.signal);
    } catch (e) {
        console.log("Task ended:", e.message);
    } finally {
        isScanning = false;
        if (searchQueue.length > 0) {
            socket.emit('log', '⏳ Starting next task in queue...');
            processQueue(socket);
        } else {
            socket.emit('log', '✅ All tasks completed.');
            socket.emit('queue-empty');
        }
    }
}

// --- SMART ROUTING ---
function getSmartUrl(input) {
    if (input.startsWith('http')) return { url: input, type: 'url' };
    const k = input.toLowerCase();
    
    // PNGWing for Logos/Icons
    if (k.includes('logo') || k.includes('icon') || k.includes('symbol') || k.includes('png')) {
        return { url: `https://www.pngwing.com/en/search?q=${encodeURIComponent(input)}`, type: 'png_search' };
    }
    // Unsplash for Photos
    return { url: `https://unsplash.com/s/photos/${encodeURIComponent(input)}`, type: 'photo_search' };
}

// --- CORE SCRAPER ---
async function startScraping(userInput, isLoopMode, showBrowser, socket, abortSignal) {
    let browser = null;
    let folderPath = null; 

    try {
        if (abortSignal.aborted) throw new Error('Stopped by user');

        const smartResult = getSmartUrl(userInput);
        const targetUrl = smartResult.url;
        
        socket.emit('log', `▶️ Starting: ${userInput}`);
        
        // Folder Naming
        let folderName = '';
        if (smartResult.type !== 'url') {
            folderName = `search_${smartResult.type === 'png_search' ? 'logo' : 'photo'}_${userInput.replace(/[^a-z0-9]/gi, '_')}`;
        } else {
            const parsed = urlModule.parse(targetUrl);
            const host = parsed.hostname.replace(/www\./, '').replace(/\./g, '_');
            let pathClean = parsed.pathname.replace(/[^a-z0-9]/gi, '_');
            if (pathClean === '_') pathClean = '_home';
            folderName = `${host}${pathClean}`;
        }
        folderPath = path.join(DOWNLOADS_DIR, folderName);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

        // Browser Launch
        browser = await puppeteer.launch({ 
            headless: showBrowser ? false : "new", 
            args: ['--no-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36');

        socket.emit('log', '⏳ Loading page...');
        try { await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) {}

        saveHistory({ url: userInput, folder: folderPath, pinned: false, date: Date.now() });
        socket.emit('update-history', getHistory());

        let totalDownloaded = 0;
        let totalSkipped = 0;
        let seenUrls = new Set(); 

        if (isLoopMode) {
            socket.emit('log', '🔄 Infinite Loop Active.');
            while (!abortSignal.aborted) {
                await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
                await new Promise(r => setTimeout(r, 2000));
                const newCount = await processBatch(page, folderPath, seenUrls, socket, abortSignal, smartResult.type);
                if (newCount > 0) {
                    totalDownloaded += newCount;
                    socket.emit('progress', { percent: 100, saved: totalDownloaded, skipped: totalSkipped, total: seenUrls.size });
                }
            }
        } else {
            socket.emit('log', '⬇️ Standard Mode: Scanning...');
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0, distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight || totalHeight > 15000) { clearInterval(timer); resolve(); }
                    }, 50);
                });
            });
            const newCount = await processBatch(page, folderPath, seenUrls, socket, abortSignal, smartResult.type);
            totalDownloaded += newCount;
            socket.emit('log', `✅ Finished. Saved: ${totalDownloaded}`);
            socket.emit('done', { folderPath, status: 'completed' });
        }
    } catch (error) {
        if (error.message === 'Stopped by user') {
            socket.emit('log', '🛑 Stopped/Skipped.');
            socket.emit('done', { folderPath, status: 'stopped' }); 
        } else {
            socket.emit('log', `❌ Error: ${error.message}`);
            socket.emit('done', { status: 'error' });
        }
    } finally {
        if (browser) await browser.close();
    }
}

async function processBatch(page, folderPath, seenUrls, socket, abortSignal, searchType) {
    const foundImages = await page.evaluate((type) => {
        const elements = Array.from(document.querySelectorAll('img'));
        return elements.map(img => {
            if (type === 'png_search') return img.src;
            const parentLink = img.closest('a');
            if (parentLink && parentLink.href && parentLink.href.match(/\.(jpg|jpeg|png|webp|svg|ico|gif)(\?.*)?$/i)) return parentLink.href;
            let bestUrl = img.src;
            if (img.srcset) {
                const s = img.srcset.split(',').map(x => ({ url: x.trim().split(' ')[0], width: parseInt(x.trim().split(' ')[1]) || 0 }));
                s.sort((a, b) => b.width - a.width);
                if (s.length > 0) bestUrl = s[0].url;
            }
            return { url: bestUrl, width: img.naturalWidth || 0 };
        })
        .filter(item => {
            if (typeof item === 'string') return item.startsWith('http');
            return (item.width > 50 && item.url.startsWith('http'));
        })
        .map(item => (typeof item === 'string') ? item : item.url);
    }, searchType);

    const newBatch = foundImages.filter(u => !seenUrls.has(u));
    let savedCount = 0;
    for (const imgUrl of newBatch) {
        if (abortSignal.aborted) break;
        seenUrls.add(imgUrl);
        let cleanUrl = imgUrl;
        try {
            const u = new URL(imgUrl);
            ['w', 'h', 'width', 'height', 'resize'].forEach(p => u.searchParams.delete(p));
            cleanUrl = u.toString();
        } catch(e) {}

        const hash = crypto.createHash('md5').update(cleanUrl).digest('hex').substring(0, 10);
        let ext = path.extname(cleanUrl).split('?')[0] || '.jpg';
        if (searchType === 'png_search' && !ext.includes('png')) ext = '.png';
        if (ext.length > 5) ext = '.jpg';
        
        const filePath = path.join(folderPath, `${hash}${ext}`);
        if (!fs.existsSync(filePath)) {
            try { await downloadFile(cleanUrl, filePath); savedCount++; } catch (e) {}
        }
    }
    return savedCount;
}

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, res => {
            if (res.statusCode === 200) {
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
            } else {
                fs.unlink(filepath, () => {}); reject(new Error(res.statusCode));
            }
        }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
    });
}

// --- SOCKET HANDLERS ---
io.on('connection', (socket) => {
    socket.emit('update-history', getHistory());

    socket.on('start-download', (data) => {
        searchQueue.push(data);
        socket.emit('log', `📝 Added to Queue. Position: ${searchQueue.length}`);
        socket.emit('queue-update', searchQueue.length);
        processQueue(socket);
    });

    socket.on('stop-download', () => { 
        if (currentAbortController) currentAbortController.abort(); 
    });
    
    socket.on('clear-queue', () => {
        searchQueue = [];
        socket.emit('queue-update', 0);
        socket.emit('log', '🗑️ Queue Cleared. Stopping all...');
        if (currentAbortController) currentAbortController.abort();
    });

    socket.on('open-folder', (f) => { const t = f || DOWNLOADS_DIR; exec(process.platform==='win32'?`explorer "${t}"`:`xdg-open "${t}"`); });
    socket.on('toggle-pin', (u) => { let h=getHistory(); let i=h.find(x=>x.url===u); if(i)i.pinned=!i.pinned; fs.writeFileSync(HISTORY_FILE,JSON.stringify(h,null,2)); socket.emit('update-history',h); });
    socket.on('remove-history', (u) => { let h=getHistory().filter(x=>x.url!==u); fs.writeFileSync(HISTORY_FILE,JSON.stringify(h,null,2)); socket.emit('update-history',h); });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));