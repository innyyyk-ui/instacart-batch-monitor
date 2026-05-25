const express = require('express');
const app = express();

app.use(express.json());

const STATE = {
    filters: { minMoney: 8, maxMiles: 5, maxItems: 20 },
    stats: { found: 0 }
};

// Recibir filtros de la app
app.post('/config', (req, res) => {
    STATE.filters = req.body;
    console.log('✅ Filters updated:', STATE.filters);
    res.json({ status: 'ok' });
});

// Generar batch simulado
app.get('/next-batch', (req, res) => {
    const price = Math.random() * 30 + 5;
    const miles = Math.random() * 10;
    const items = Math.floor(Math.random() * 50);
    
    if (price >= STATE.filters.minMoney && 
        miles <= STATE.filters.maxMiles && 
        items <= STATE.filters.maxItems) {
        
        STATE.stats.found++;
        console.log(`✅ BATCH: $${price.toFixed(2)} - ${miles.toFixed(1)}mi - ${items}items`);
        
        res.json({ 
            found: true,
            price: price.toFixed(2),
            miles: miles.toFixed(1),
            items: items
        });
    } else {
        res.json({ found: false });
    }
});

app.get('/status', (req, res) => {
    res.json({ 
        filters: STATE.filters,
        stats: STATE.stats 
    });
});

app.listen(10000, () => {
    console.log('✅ Backend READY - Port 10000');
});
