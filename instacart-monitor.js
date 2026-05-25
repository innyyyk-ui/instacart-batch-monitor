const express = require('express');
const app = express();

app.use(express.json());

const STATE = {
    monitoring: false,
    deviceToken: null,
    filters: { minMoney: 8, maxMiles: 5, maxItems: 20 },
    stats: { checked: 0, found: 0 }
};

// Guardar device token (el iPhone lo envía)
app.post('/register-device', (req, res) => {
    STATE.deviceToken = req.body.deviceToken;
    console.log('✅ Device registered:', STATE.deviceToken);
    res.json({ status: 'registered' });
});

// Backend detecta batch y notifica
app.post('/notify-batch', (req, res) => {
    const { price, miles, items } = req.body;
    
    // Comparar con filtros
    if (price >= STATE.filters.minMoney && 
        miles <= STATE.filters.maxMiles && 
        items <= STATE.filters.maxItems) {
        
        console.log(`✅ BATCH FOUND: $${price} - ${miles}mi - ${items}items`);
        
        // Aquí iría Apple Push Notification (APN)
        // Por ahora simulamos:
        console.log(`📱 Would send notification to: ${STATE.deviceToken}`);
        
        STATE.stats.found++;
        res.json({ status: 'batch found', notification: 'sent' });
    } else {
        res.json({ status: 'batch rejected', reason: 'does not match filters' });
    }
});

app.get('/status', (req, res) => {
    res.json({
        monitoring: STATE.monitoring,
        filters: STATE.filters,
        stats: STATE.stats,
        deviceToken: STATE.deviceToken ? '✅ Registered' : '❌ Not registered'
    });
});

app.listen(10000, () => {
    console.log('✅ Instacart Monitor READY - Port 10000');
});
