const express = require('express');
const app = express();

app.use(express.json());

const STATE = {
    monitoring: false,
    filters: { minMoney: 8, maxMiles: 5, maxItems: 20 },
    stats: { checked: 0, found: 0 }
};

app.post('/start', (req, res) => {
    STATE.monitoring = true;
    res.json({ status: 'monitoring', message: 'Abre Instacart en tu app y acepta manualmente' });
});

app.post('/stop', (req, res) => {
    STATE.monitoring = false;
    res.json({ status: 'stopped' });
});

app.get('/status', (req, res) => {
    res.json({ monitoring: STATE.monitoring, filters: STATE.filters });
});

app.post('/config', (req, res) => {
    if (req.body.minMoney) STATE.filters.minMoney = req.body.minMoney;
    if (req.body.maxMiles) STATE.filters.maxMiles = req.body.maxMiles;
    if (req.body.maxItems) STATE.filters.maxItems = req.body.maxItems;
    res.json({ filters: STATE.filters });
});

app.listen(10000, () => console.log('✅ Instacart Monitor LISTO'));
