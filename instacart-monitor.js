const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());

// ===== STATE =====
const STATE = {
    monitoring: false,
    loggedIn: false,
    browser: null,
    page: null,
    filters: {
        minMoney: 8,
        maxMiles: 5,
        maxItems: 20,
        autoAccept: false
    },
    foundBatches: [],
    acceptedBatches: [],
    rejectedBatches: []
};

// ===== ENDPOINTS =====

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
        loggedIn: STATE.loggedIn,
        filters: STATE.filters,
        foundBatches: STATE.foundBatches.length,
        acceptedBatches: STATE.acceptedBatches.length,
        rejectedBatches: STATE.rejectedBatches.length
    });
});

app.post('/config', (req, res) => {
    if (req.body.minMoney) STATE.filters.minMoney = req.body.minMoney;
    if (req.body.maxMiles) STATE.filters.maxMiles = req.body.maxMiles;
    if (req.body.maxItems) STATE.filters.maxItems = req.body.maxItems;
    if (req.body.autoAccept !== undefined) STATE.filters.autoAccept = req.body.autoAccept;
    
    console.log('✅ Filters updated:', STATE.filters);
    res.json({ filters: STATE.filters });
});

app.get('/stats', (req, res) => {
    res.json({
        monitoring: STATE.monitoring,
        found: STATE.foundBatches.length,
        accepted: STATE.acceptedBatches.length,
        rejected: STATE.rejectedBatches.length,
        filters: STATE.filters
    });
});

// ===== MAIN MONITORING =====

async function startMonitoring() {
    try {
        console.log('🚀 Starting Instacart Monitor...');
        
        STATE.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });
        
        STATE.page = await STATE.browser.newPage();
        STATE.page.setDefaultTimeout(15000);
        
        // Login
        await loginToInstacart();
        STATE.loggedIn = true;
        
        // Poll for batches
        while (STATE.monitoring) {
            try {
                await checkForBatches();
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
                console.error('❌ Error checking batches:', err.message);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        if (STATE.browser) await STATE.browser.close();
        STATE.browser = null;
        STATE.loggedIn = false;
        
    } catch (err) {
        console.error('❌ Monitoring error:', err.message);
        STATE.monitoring = false;
        STATE.loggedIn = false;
    }
}

async function loginToInstacart() {
    const email = process.env.INSTACART_EMAIL;
    const password = process.env.INSTACART_PASSWORD;
    
    try {
        console.log('🔐 Logging in...');
        
        await STATE.page.goto('https://www.instacart.com/auth/login', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Email
        await STATE.page.type('input[type="email"]', email, { delay: 50 });
        await STATE.page.click('button[type="submit"]');
        await STATE.page.waitForNavigation().catch(() => {});
        
        // Password
        await STATE.page.type('input[type="password"]', password, { delay: 50 });
        await STATE.page.click('button[type="submit"]');
        await STATE.page.waitForNavigation().catch(() => {});
        
        console.log('✅ Login successful');
    } catch (err) {
        console.error('❌ Login failed:', err.message);
    }
}

async function checkForBatches() {
    try {
        await STATE.page.goto('https://www.instacart.com/shoppers/batches', {
            waitUntil: 'networkidle2',
            timeout: 15000
        }).catch(() => {});
        
        // Get batch elements
        const batches = await STATE.page.evaluate(() => {
            const items = [];
            document.querySelectorAll('[data-testid*="batch"]').forEach(el => {
                const text = el.innerText;
                const money = text.match(/\$[\d.]+/)?.[0];
                const miles = text.match(/([\d.]+)\s*mi/)?.[1];
                
                if (money && miles) {
                    items.push({
                        money: parseFloat(money.replace('$', '')),
                        miles: parseFloat(miles),
                        element: el
                    });
                }
            });
            return items;
        });
        
        for (const batch of batches) {
            // Check filters
            if (batch.money < STATE.filters.minMoney || 
                batch.miles > STATE.filters.maxMiles) {
                continue;
            }
            
            // Open batch to count items
            try {
                await STATE.page.evaluate(() => {
                    document.querySelector('[data-testid*="batch"]')?.click();
                });
                
                await STATE.page.waitForNavigation().catch(() => {});
                
                const itemCount = await STATE.page.evaluate(() => {
                    return document.querySelectorAll('[data-testid*="item"]').length || 
                           document.querySelectorAll('.item-card').length ||
                           0;
                });
                
                console.log(`📦 Batch: $${batch.money}, ${batch.miles}mi, ${itemCount} items`);
                
                if (itemCount <= STATE.filters.maxItems) {
                    console.log('✅ GOOD BATCH FOUND!');
                    
                    // Add to found list
                    STATE.foundBatches.push({
                        money: batch.money,
                        miles: batch.miles,
                        items: itemCount,
                        time: new Date().toISOString()
                    });
                    
                    // Send notification to iOS device
                    sendNotification(batch.money, batch.miles, itemCount);
                    
                    if (STATE.filters.autoAccept) {
                        // Auto-accept
                        await autoAcceptBatch();
                        STATE.acceptedBatches.push({
                            money: batch.money,
                            miles: batch.miles,
                            items: itemCount,
                            time: new Date().toISOString()
                        });
                    } else {
                        // Just open for manual accept
                        console.log('📱 Opening Instacart for manual accept...');
                    }
                } else {
                    console.log(`❌ Too many items (${itemCount} > ${STATE.filters.maxItems})`);
                    STATE.rejectedBatches.push({
                        money: batch.money,
                        miles: batch.miles,
                        items: itemCount,
                        reason: 'Too many items',
                        time: new Date().toISOString()
                    });
                }
                
                // Return to batches list
                await STATE.page.goto('https://www.instacart.com/shoppers/batches', {
                    waitUntil: 'networkidle2',
                    timeout: 10000
                }).catch(() => {});
                
            } catch (err) {
                console.error('❌ Error processing batch:', err.message);
            }
        }
        
    } catch (err) {
        console.error('❌ Check batches error:', err.message);
    }
}

async function autoAcceptBatch() {
    try {
        console.log('🤖 Auto-accepting batch...');
        
        // Wait for accept button
        await STATE.page.waitForSelector('button:has-text("Accept")', { timeout: 5000 })
            .catch(() => STATE.page.waitForSelector('button[type="submit"]', { timeout: 5000 }));
        
        // Click accept
        await STATE.page.click('button:has-text("Accept")').catch(() => {
            return STATE.page.click('button[type="submit"]');
        });
        
        console.log('✅ Batch auto-accepted!');
        
    } catch (err) {
        console.error('❌ Auto-accept failed:', err.message);
    }
}

function sendNotification(money, miles, items) {
    // Log notification (in production, integrate with Firebase Cloud Messaging or similar)
    const notification = {
        title: '✅ Good Batch Found!',
        body: `$${money.toFixed(2)} • ${miles}mi • ${items} items`,
        deeplink: 'instacart://shoppers/batches',
        timestamp: new Date().toISOString()
    };
    
    console.log('📬 Notification:', notification);
    
    // TODO: Send to Firebase Cloud Messaging or Apple Push Notifications
    // For now, log it
}

// ===== SERVER =====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Instacart Monitor V4 running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`✅ Ready to monitor batches\n`);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (STATE.browser) await STATE.browser.close();
    process.exit(0);
});
