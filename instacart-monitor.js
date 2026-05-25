const express = require('express');
const puppeteer = require('puppeteer');
const nodeCron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const INSTACART_EMAIL = process.env.INSTACART_EMAIL;
const INSTACART_PASSWORD = process.env.INSTACART_PASSWORD;

let filters = {
  minMoney: 8,
  maxMiles: 5,
  excludeItems: ['alcohol', 'heavy'],
  includeItems: []
};

let browser = null;
let page = null;
let lastBatchId = null;
let isMonitoring = false;

// ===== FUNCIONES PRINCIPALES =====

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(5000);
    console.log('✅ Browser iniciado');
  }
  return page;
}

async function loginInstacart() {
  try {
    console.log('🔐 Iniciando login...');
    await page.goto('https://www.instacart.com/store/home', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('[data-test="profile-menu"]') !== null;
    });

    if (isLoggedIn) {
      console.log('✅ Ya logueado');
      return true;
    }

    await page.click('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', INSTACART_EMAIL, { delay: 10 });
    
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', INSTACART_PASSWORD, { delay: 10 });
    
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('✅ Login exitoso');
    return true;
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    return false;
  }
}

async function checkForBatches() {
  try {
    console.log('🔍 Checando batches...');
    
    await page.goto('https://www.instacart.com/store/home', { 
      waitUntil: 'networkidle1',
      timeout: 15000 
    });

    const batches = await page.evaluate(() => {
      const batchElements = document.querySelectorAll('[data-test*="batch"]');
      const data = [];

      batchElements.forEach(el => {
        const id = el.getAttribute('data-test');
        const money = el.querySelector('[data-test*="pay"]')?.textContent || '$0';
        const miles = el.querySelector('[data-test*="miles"]')?.textContent || '0';
        const items = el.querySelector('[data-test*="items"]')?.textContent || '0 items';
        
        data.push({
          id,
          money: parseFloat(money.replace('$', '')),
          miles: parseFloat(miles),
          items: items,
          element: id
        });
      });

      return data;
    });

    console.log(`📦 Encontradas ${batches.length} batches`);
    
    for (const batch of batches) {
      if (await shouldAcceptBatch(batch)) {
        await openBatchAndNotify(batch);
        return;
      }
    }
  } catch (error) {
    console.error('❌ Error checando batches:', error.message);
  }
}

async function shouldAcceptBatch(batch) {
  if (batch.money < filters.minMoney) {
    console.log(`❌ ${batch.id}: Dinero insuficiente ($${batch.money})`);
    return false;
  }

  if (batch.miles > filters.maxMiles) {
    console.log(`❌ ${batch.id}: Millas excesivas (${batch.miles})`);
    return false;
  }

  if (batch.id === lastBatchId) {
    console.log(`❌ ${batch.id}: Ya procesado`);
    return false;
  }

  console.log(`✅ ${batch.id}: Pasa filtros iniciales`);
  return true;
}

async function openBatchAndNotify(batch) {
  try {
    console.log(`🎯 Abriendo batch: ${batch.id}`);
    
    await page.click(`[data-test="${batch.id}"]`);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    const batchDetails = await page.evaluate(() => {
      const items = [];
      const itemElements = document.querySelectorAll('[data-test*="item"]');

      itemElements.forEach(el => {
        const name = el.querySelector('[data-test*="name"]')?.textContent || '';
        const quantity = el.querySelector('[data-test*="qty"]')?.textContent || '';
        
        if (name) items.push({ name, quantity });
      });

      return {
        items: items.slice(0, 10),
        totalItems: itemElements.length
      };
    });

    if (!passesItemFilter(batchDetails.items)) {
      console.log('❌ No pasa filtro de items');
      await page.goBack();
      return;
    }

    lastBatchId = batch.id;
    await sendNotification({
      title: '💰 ¡BATCH BUENA!',
      body: `$${batch.money} • ${batch.miles}mi • ${batchDetails.totalItems} items`,
      items: batchDetails.items.map(i => i.name).join(' • '),
      batchId: batch.id,
      deeplink: page.url()
    });

    console.log('✅ Notificación enviada');

  } catch (error) {
    console.error('❌ Error abriendo batch:', error.message);
  }
}

function passesItemFilter(items) {
  const itemNames = items.map(i => i.name.toLowerCase());

  if (filters.excludeItems.length > 0) {
    for (const excluded of filters.excludeItems) {
      if (itemNames.some(name => name.includes(excluded.toLowerCase()))) {
        console.log(`❌ Item excluido encontrado: ${excluded}`);
        return false;
      }
    }
  }

  if (filters.includeItems.length > 0) {
    const hasRequired = filters.includeItems.some(required => 
      itemNames.some(name => name.includes(required.toLowerCase()))
    );
    if (!hasRequired) {
      console.log('❌ No contiene items requeridos');
      return false;
    }
  }

  return true;
}

async function sendNotification(data) {
  try {
    console.log('📲 Notificación:', data.title);
  } catch (error) {
    console.error('❌ Error enviando notificación:', error.message);
  }
}

// ===== RUTAS API =====

app.post('/config', (req, res) => {
  const { minMoney, maxMiles, excludeItems, includeItems } = req.body;
  
  if (minMoney) filters.minMoney = minMoney;
  if (maxMiles) filters.maxMiles = maxMiles;
  if (excludeItems) filters.excludeItems = excludeItems;
  if (includeItems) filters.includeItems = includeItems;

  console.log('⚙️ Filtros actualizados:', filters);
  res.json({ success: true, filters });
});

app.get('/status', (req, res) => {
  res.json({
    monitoring: isMonitoring,
    filters,
    lastBatch: lastBatchId
  });
});

app.post('/start', async (req, res) => {
  try {
    if (isMonitoring) {
      return res.json({ error: 'Ya está monitoreando' });
    }

    await initBrowser();
    const loginSuccess = await loginInstacart();

    if (!loginSuccess) {
      return res.status(401).json({ error: 'Login fallido' });
    }

    isMonitoring = true;

    nodeCron.schedule('*/5 * * * * *', async () => {
      if (isMonitoring) await checkForBatches();
    });

    console.log('🚀 Monitoreo iniciado');
    res.json({ success: true, message: 'Monitoreo iniciado' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/stop', (req, res) => {
  isMonitoring = false;
  console.log('⏹️ Monitoreo detenido');
  res.json({ success: true });
});

// ===== SERVIDOR =====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor en puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV}`);
});

process.on('SIGTERM', async () => {
  isMonitoring = false;
  if (browser) await browser.close();
  process.exit(0);
});
