const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { PythonShell } = require('python-shell');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== تشغيل Python Shell داخلياً =====
let pythonShell = null;

function startPythonService() {
  if (pythonShell) {
    pythonShell.kill();
  }

  pythonShell = new PythonShell('obd_bridge/obd_service.py', {
    mode: 'text',
    pythonPath: 'python3',
    pythonOptions: ['-u'],
  });

  pythonShell.on('message', (message) => {
    console.log('[Python]:', message);
  });

  pythonShell.on('stderr', (stderr) => {
    console.error('[Python Error]:', stderr);
  });

  pythonShell.on('close', () => {
    console.log('🔴 تم إيقاف خدمة Python');
    pythonShell = null;
  });

  console.log('🟢 تم بدء خدمة Python');
}

startPythonService();

// ===== قاعدة البيانات العملاقة =====
const dbPath = path.join(__dirname, 'database', 'dtc_full.db');
let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('❌ خطأ في فتح قاعدة البيانات العملاقة:', err.message);
        // استخدام قاعدة احتياطية إذا فشلت
        console.log('⚠️ محاولة استخدام قاعدة البيانات التجريبية...');
        const fallbackDbPath = path.join(__dirname, 'database', 'dtc.db');
        db = new sqlite3.Database(fallbackDbPath, (err) => {
            if (err) console.error('❌ فشل حتى في قاعدة البيانات التجريبية:', err.message);
            else console.log('✅ تم استخدام قاعدة البيانات التجريبية بنجاح');
        });
    } else {
        console.log('✅ قاعدة البيانات العملاقة متصلة بنجاح');
    }
});

// ===== نقاط النهاية (API) =====
const PYTHON_SERVICE_URL = 'http://127.0.0.1:5000';
const axios = require('axios');

async function waitForPython(timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await axios.get(`${PYTHON_SERVICE_URL}/api/data`);
      return true;
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  return false;
}

app.post('/api/connect', async (req, res) => {
    try {
        await waitForPython();
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/connect`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'فشل الاتصال' });
    }
});

app.post('/api/disconnect', async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/disconnect`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'فشل قطع الاتصال' });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_SERVICE_URL}/api/data`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'فشل جلب البيانات' });
    }
});

// ===== دالة قراءة رموز الأعطال (مع الشركة المصنعة) =====
app.get('/api/dtc', async (req, res) => {
    try {
        const dtcResponse = await axios.get(`${PYTHON_SERVICE_URL}/api/dtc`);
        const codes = dtcResponse.data;
        if (!codes || codes.length === 0) return res.json([]);

        const placeholders = codes.map(() => '?').join(',');
        db.all(`SELECT code, description, manufacturer, category, common_cause, fix_tip FROM dtc WHERE code IN (${placeholders})`, codes, (err, rows) => {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات' });
            const result = codes.map(code => {
                const found = rows.find(r => r.code === code);
                return { 
                    code, 
                    description: found ? found.description : 'رمز غير معروف',
                    manufacturer: found ? found.manufacturer : 'GENERIC',
                    category: found ? found.category : '',
                    common_cause: found ? found.common_cause : '',
                    fix_tip: found ? found.fix_tip : ''
                };
            });
            res.json(result);
        });
    } catch (error) {
        res.status(500).json({ error: 'فشل جلب الرموز' });
    }
});

// ===== نقطة نهاية البحث عن الرموز =====
app.get('/api/search-dtc', (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) {
        return res.json([]);
    }

    db.all(
        `SELECT code, description, manufacturer FROM dtc 
         WHERE code LIKE ? OR description LIKE ? 
         LIMIT 20`,
        [`%${query}%`, `%${query}%`],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في البحث' });
            }
            res.json(rows);
        }
    );
});

app.post('/api/clear_dtc', async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/clear_dtc`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'فشل مسح الرموز' });
    }
});

// WebSocket
io.on('connection', (socket) => {
    console.log('🟢 متصل');
    let interval = setInterval(async () => {
        try {
            const response = await axios.get(`${PYTHON_SERVICE_URL}/api/data`);
            socket.emit('obd-data', response.data);
        } catch (error) {}
    }, 1000);
    socket.on('disconnect', () => {
        console.log('🔴 مفصول');
        clearInterval(interval);
    });
});

// ملفات اللغة
app.get('/lang/:lang', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'lang', `${req.params.lang}.json`);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).json({ error: 'Language file not found' });
    });
});

// تنظيف عند إغلاق الخادم
process.on('SIGINT', () => {
    if (pythonShell) {
        pythonShell.kill();
    }
    process.exit();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 خادم Node.js على المنفذ ${PORT}`);
});