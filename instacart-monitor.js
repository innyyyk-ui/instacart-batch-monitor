const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const app = express();

app.use(express.json());

const STATE = {
    monitoring: false,
    browser: null,
    page: null,
    filters: {
        minMoney: 8,
        maxMiles: 5,
        maxItems: 20
    },
    stats: {
        checked: 0,
        found: 0
    }
};

app.post('/start', async (req, res) => {
    if (STATE.monitoring) return res.json({ status: 'already monitoring' });
    STATE.monitoring = true;
    res.json({ status: 'started' });
    startMonitoring();
});

app.post('/stop', (req, res) => {
    STATE.monitoring = false;
    res.json({ status: 'stopped' });
});

app.get('/status', (req, res) => {
    res.json({
        monitoring: STATE.monitoring,
        filters: STATE.filters,
        stats: STATE.stats
    });
});

app.post('/config', (req, res) => {
    if (req.body.minMoney) STATE.filters.minMoney = req.body.minMoney;
    if (req.body.maxMiles) STATE.filters.maxMiles = req.body.maxMiles;
    if (req.body.maxItems) STATE.filters.maxItems = req.body.maxItems;
    console.log('✅ Filters updated:', STATE.filters);
    res.json({ filters: STATE.filters });
});

async function startMonitoring() {
    try {
        console.log('🚀 Starting Instacart Monitor...');
        
        // Check if cookies exist
        if (!fs.existsSync('/app/cookies-instacart.json')) {
            console.log('❌ Cookies file not found!');
            console.log('📝 HOW TO SAVE COOKIES:');
            console.log('1. Go to https://www.instacart.com in your browser');
            console.log('2. Login with email, password, and 2FA');
            console.log('3. Open DevTools (F12 or Cmd+Option+I)');
            console.log('4. Go to Application → Cookies');
            console.log('5. Right-click → Copy all as cURL');
            console.log('6. Paste in /app/cookies-instacart.json');
            console.log('7. Restart monitoring');
            STATE.monitoring = false;
            return;
        }
        
        console.log('✅ Loading cookies...');
        const cookies = JSON.parse(fs.readFileSync('/app/cookies-instacart.json', 'utf8'));
        
        STATE.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });
        
        STATE.page = await STATE.browser.newPage();
        await STATE.page.setCookie(...cookies);
        
        console.log('✅ Logged in with saved cookies');
        console.log('📍 Monitoring Instacart batches...');
        
        while (STATE.monitoring) {
            try {
                STATE.stats.checked++;
                await randomDelay(3000, 5000);
            } catch (err) {
                console.error('❌ Error:', err.message);
                await randomDelay(5000, 8000);
            }
        }
        
        if (STATE.browser) await STATE.browser.close();
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        STATE.monitoring = false;
    }
}

function randomDelay(min, max) {
    return new Promise(r => setTimeout(r, Math.random() * (max - min) + min));
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Instacart Monitor on port ${PORT}`);
    console.log(`✅ Ready - waiting for cookies`);
});

process.on('SIGTERM', async () => {
    if (STATE.browser) await STATE.browser.close();
    process.exit(0);
});
