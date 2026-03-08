let currentLanguage = 'en';
let translations = {};
let socket = io();
let updateInterval = null;
let logs = [];

// عناصر واجهة المستخدم
const connectionStatus = document.getElementById('connectionStatus');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');

// متغيرات للرسوم البيانية
let rpmChart = null;
let speedChart = null;
let rpmData = [];
let speedData = [];
const MAX_DATA_POINTS = 20;

function showLoading(message = 'جاري التحميل...') {
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function updateConnectionStatus(status, message) {
    if (statusIndicator) {
        statusIndicator.className = 'status-indicator ' + status;
    }
    if (statusText) {
        statusText.textContent = message;
    }
}

function showError(message, duration = 5000) {
    let errorDiv = document.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.connection-panel'));
    }
    errorDiv.innerHTML = `
        <span>⚠️ ${message}</span>
        <button onclick="this.parentElement.style.display='none'">حسناً</button>
    `;
    errorDiv.style.display = 'flex';
    if (duration > 0) {
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, duration);
    }
}

// ========== دوال الترجمة ==========
async function loadLanguage(lang) {
    try {
        const response = await fetch(`/lang/${lang}.json`);
        translations = await response.json();
        currentLanguage = lang;
        applyTranslations();
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    } catch (error) {
        console.error('خطأ في تحميل اللغة:', error);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key]) el.textContent = translations[key];
    });
    document.getElementById('app-title').textContent = translations.app_title || 'OBD-II Diagnostic';
    document.title = translations.app_title || 'OBD-II Diagnostic';
}

function setLanguage(lang) { loadLanguage(lang); }

// ========== دوال القائمة الجانبية ==========
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('active');
        loadSettingsIntoModal();
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
}

// ========== دوال الإعدادات ==========
function changeLanguageFromSettings() {
    const select = document.getElementById('settingsLanguage');
    if (select) {
        setLanguage(select.value);
        localStorage.setItem('language', select.value);
    }
}

function loadSettingsIntoModal() {
    const tempUnit = localStorage.getItem('tempUnit');
    if (tempUnit) document.getElementById('tempUnit').value = tempUnit;

    const speedUnit = localStorage.getItem('speedUnit');
    if (speedUnit) document.getElementById('speedUnit').value = speedUnit;

    const simulationMode = localStorage.getItem('simulationMode');
    if (simulationMode !== null) 
        document.getElementById('simulationMode').checked = simulationMode === 'true';

    const autoSaveLogs = localStorage.getItem('autoSaveLogs');
    if (autoSaveLogs !== null) 
        document.getElementById('autoSaveLogs').checked = autoSaveLogs === 'true';

    const darkMode = localStorage.getItem('darkMode');
    if (darkMode !== null) 
        document.getElementById('darkModeToggle').checked = darkMode === 'true';

    const savedLang = localStorage.getItem('language') || 'en';
    document.getElementById('settingsLanguage').value = savedLang;
}

function saveSettings() {
    const tempUnit = document.getElementById('tempUnit')?.value;
    const speedUnit = document.getElementById('speedUnit')?.value;
    const simulationMode = document.getElementById('simulationMode')?.checked;
    const autoSaveLogs = document.getElementById('autoSaveLogs')?.checked;

    if (tempUnit !== undefined) localStorage.setItem('tempUnit', tempUnit);
    if (speedUnit !== undefined) localStorage.setItem('speedUnit', speedUnit);
    if (simulationMode !== undefined) localStorage.setItem('simulationMode', simulationMode);
    if (autoSaveLogs !== undefined) localStorage.setItem('autoSaveLogs', autoSaveLogs);

    showError('✅ تم حفظ الإعدادات', 2000);
    closeSidebar();
}

function loadSettings() {
    const savedLang = localStorage.getItem('language');
    if (savedLang) setLanguage(savedLang);

    const autoSaveLogs = localStorage.getItem('autoSaveLogs');
    if (autoSaveLogs !== null) {
        const elem = document.getElementById('autoSaveLogs');
        if (elem) elem.checked = autoSaveLogs === 'true';
    }

    loadDarkMode();
    loadLogs();
}

// ========== دوال الوضع الليلي ==========
function toggleDarkMode() {
    const isDark = document.getElementById('darkModeToggle')?.checked;
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDark);
}

function loadDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        toggle.checked = isDark;
        if (isDark) document.body.classList.add('dark-mode');
    }
}

// ========== دوال حفظ السجلات ==========
function loadLogs() {
    const stored = localStorage.getItem('obdLogs');
    if (stored) {
        logs = JSON.parse(stored);
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        logs = logs.filter(log => log.timestamp > oneWeekAgo);
        saveLogs();
    }
    displayLogs();
}

function saveLogs() {
    localStorage.setItem('obdLogs', JSON.stringify(logs));
}

function addLog(data) {
    const autoSave = document.getElementById('autoSaveLogs');
    if (!autoSave || !autoSave.checked) return;

    const log = {
        timestamp: Date.now(),
        date: new Date().toLocaleString(),
        data: { rpm: data.rpm, speed: data.speed }
    };
    logs.push(log);

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    logs = logs.filter(log => log.timestamp > oneWeekAgo);

    saveLogs();
    displayLogs();
}

function displayLogs() {
    const container = document.getElementById('logsList');
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = '<p class="no-logs">لا توجد سجلات محفوظة</p>';
        return;
    }

    let html = '';
    logs.slice().reverse().forEach(log => {
        html += `
            <div class="log-item">
                <span class="log-date">${log.date}</span>
                <span class="log-data">RPM: ${log.data.rpm || '--'}, سرعة: ${log.data.speed || '--'}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

function clearAllLogs() {
    if (confirm('هل أنت متأكد من حذف جميع السجلات؟')) {
        logs = [];
        saveLogs();
        displayLogs();
        showError('✅ تم حذف جميع السجلات', 3000);
    }
}

// ========== دوال التحديث اليدوي ==========
function manualRefresh() {
    showLoading('جاري تحديث البيانات...');
    setTimeout(() => {
        hideLoading();
        showError('✅ تم تحديث البيانات', 2000);
    }, 500);
}

// ========== دوال البحث عن الرموز ==========
async function searchDTC() {
    const searchInput = document.getElementById('dtcSearchInput');
    const resultsContainer = document.getElementById('searchResults');
    const query = searchInput.value.trim().toUpperCase();

    if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    showLoading('جاري البحث...');

    try {
        const response = await fetch(`/api/search-dtc?q=${query}`);
        const results = await response.json();

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-item">لا توجد نتائج</div>';
        } else {
            let html = '';
            results.slice(0, 10).forEach(item => {
                html += `
                    <div class="search-item" onclick="selectDTC('${item.code}')">
                        <span class="search-code">${item.code}</span>
                        <span class="search-manufacturer">[${item.manufacturer}]</span>
                        <span class="search-description">${item.description.substring(0, 50)}...</span>
                    </div>
                `;
            });
            resultsContainer.innerHTML = html;
        }
        resultsContainer.style.display = 'block';
    } catch (error) {
        showError('فشل البحث');
    } finally {
        hideLoading();
    }
}

function selectDTC(code) {
    document.getElementById('dtcSearchInput').value = code;
    document.getElementById('searchResults').style.display = 'none';
    showError(`✅ تم اختيار الرمز: ${code}`, 2000);
}

// ========== دوال الاتصال والبيانات ==========
async function connect() {
    showLoading('جاري الاتصال بالسيارة...');
    updateConnectionStatus('connecting', 'جاري الاتصال...');

    try {
        const response = await fetch('/api/connect', { method: 'POST' });
        const data = await response.json();

        if (data.status === 'connected') {
            const deviceName = data.deviceName || 'جهاز غير معروف';
            updateConnectionStatus('connected', `متصل بـ ${deviceName}`);
            document.getElementById('connectBtn').disabled = true;
            document.getElementById('disconnectBtn').disabled = false;
            startDataUpdates();
            hideLoading();
            showError(`✅ تم الاتصال بـ ${deviceName}`, 3000);
        } else if (data.status === 'simulation') {
            updateConnectionStatus('simulation', 'وضع المحاكاة (غير متصل)');
            document.getElementById('connectBtn').disabled = true;
            document.getElementById('disconnectBtn').disabled = false;
            startDataUpdates();
            hideLoading();
            showError('⚠️ لا يوجد جهاز حقيقي، استخدام بيانات المحاكاة', 4000);
        } else {
            throw new Error('فشل الاتصال');
        }
    } catch (error) {
        updateConnectionStatus('disconnected', 'غير متصل');
        hideLoading();
        showError('❌ فشل الاتصال بالسيارة. تأكد من تشغيل جهاز ELM327 والمحاولة مرة أخرى.');
    }
}

async function disconnect() {
    showLoading('جاري قطع الاتصال...');

    try {
        const response = await fetch('/api/disconnect', { method: 'POST' });
        const data = await response.json();

        if (data.status === 'disconnected') {
            updateConnectionStatus('disconnected', 'غير متصل');
            document.getElementById('connectBtn').disabled = false;
            document.getElementById('disconnectBtn').disabled = true;
            stopDataUpdates();
            clearDataGrid();
            hideLoading();
        }
    } catch (error) {
        hideLoading();
        showError('حدث خطأ أثناء قطع الاتصال');
    }
}

function startDataUpdates() {
    socket.on('obd-data', (data) => renderData(data));
    socket.on('obd-error', (errorMsg) => {
        showError(errorMsg, 0);
        updateConnectionStatus('disconnected', 'غير متصل');
        clearDataGrid();
    });
}

function stopDataUpdates() {
    socket.off('obd-data');
    socket.off('obd-error');
}

function renderData(data) {
    const grid = document.getElementById('dataGrid');
    if (!grid) return;

    console.log('البيانات المستلمة:', data);

    if (data.simulated === true) {
        updateConnectionStatus('simulation', 'وضع المحاكاة (غير متصل)');
    } else {
        updateConnectionStatus('connected', 'متصل');
    }

    const isSimulated = data.simulated === true;
    const items = [
        { key: 'rpm', label: translations.rpm, unit: 'rpm', value: data.rpm },
        { key: 'load', label: translations.load, unit: '%', value: data.load },
        { key: 'coolant_temp', label: translations.coolant_temp, unit: '°C', value: data.coolant_temp },
        { key: 'fuel_status', label: translations.fuel_status, unit: '', value: data.fuel_status === 1 ? 'Open loop' : 'Closed loop' },
        { key: 'speed', label: translations.speed, unit: 'km/h', value: data.speed },
        { key: 'short_fuel_trim', label: translations.short_fuel_trim, unit: '%', value: data.short_fuel_trim },
        { key: 'long_fuel_trim', label: translations.long_fuel_trim, unit: '%', value: data.long_fuel_trim },
        { key: 'intake_pressure', label: translations.intake_pressure, unit: 'kPa', value: data.intake_pressure },
        { key: 'timing_advance', label: translations.timing_advance, unit: '°', value: data.timing_advance },
        { key: 'intake_temp', label: translations.intake_temp, unit: '°C', value: data.intake_temp },
        { key: 'maf', label: translations.maf, unit: 'g/s', value: data.maf },
        { key: 'throttle', label: translations.throttle, unit: '%', value: data.throttle },
        { key: 'o2_voltage', label: translations.o2_voltage, unit: 'V', value: data.o2_voltage },
        { key: 'fuel_pressure', label: translations.fuel_pressure, unit: 'kPa', value: data.fuel_pressure },
    ];

    let html = '';
    items.forEach(item => {
        const simulatedMark = isSimulated ? ' *' : '';
        html += `
            <div class="card">
                <h3>${item.label}</h3>
                <div class="value">${item.value ?? '--'} ${item.unit}${simulatedMark}</div>
            </div>
        `;
    });
    grid.innerHTML = html;

    updateCharts(data);

    const autoSave = document.getElementById('autoSaveLogs')?.checked;
    if (autoSave && data && !data.simulated) {
        addLog(data);
    }
}

function updateCharts(data) {
    if (data.rpm) {
        rpmData.push(data.rpm);
        if (rpmData.length > MAX_DATA_POINTS) rpmData.shift();
    }
    if (data.speed) {
        speedData.push(data.speed);
        if (speedData.length > MAX_DATA_POINTS) speedData.shift();
    }

    const rpmCtx = document.getElementById('rpmChart')?.getContext('2d');
    if (rpmCtx) {
        if (!rpmChart) {
            rpmChart = new Chart(rpmCtx, {
                type: 'line',
                data: {
                    labels: Array.from({ length: rpmData.length }, (_, i) => i + 1),
                    datasets: [{
                        label: translations.rpm || 'RPM',
                        data: rpmData,
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#ddd' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#ddd' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#fff' } }
                    }
                }
            });
        } else {
            rpmChart.data.labels = Array.from({ length: rpmData.length }, (_, i) => i + 1);
            rpmChart.data.datasets[0].data = rpmData;
            rpmChart.update();
        }
    }

    const speedCtx = document.getElementById('speedChart')?.getContext('2d');
    if (speedCtx) {
        if (!speedChart) {
            speedChart = new Chart(speedCtx, {
                type: 'line',
                data: {
                    labels: Array.from({ length: speedData.length }, (_, i) => i + 1),
                    datasets: [{
                        label: translations.speed || 'Speed',
                        data: speedData,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#ddd' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#ddd' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#fff' } }
                    }
                }
            });
        } else {
            speedChart.data.labels = Array.from({ length: speedData.length }, (_, i) => i + 1);
            speedChart.data.datasets[0].data = speedData;
            speedChart.update();
        }
    }
}

function clearDataGrid() {
    const grid = document.getElementById('dataGrid');
    if (grid) grid.innerHTML = '';

    rpmData = [];
    speedData = [];
    if (rpmChart) { rpmChart.destroy(); rpmChart = null; }
    if (speedChart) { speedChart.destroy(); speedChart = null; }
}

// ===== دالة قراءة رموز الأعطال (مطورة) =====
async function readDTC() {
    showLoading('جاري قراءة رموز الأعطال...');
    try {
        const response = await fetch('/api/dtc');
        const dtcList = await response.json();
        const container = document.getElementById('dtcList');
        if (!container) return;

        if (dtcList.length === 0) {
            container.innerHTML = `<div class="dtc-item">${translations.no_dtc || 'لا توجد رموز أعطال'}</div>`;
        } else {
            let html = '';
            dtcList.forEach(item => {
                html += `
                    <div class="dtc-item" onclick="showDTCDetails('${item.code}')">
                        <div class="dtc-header">
                            <span class="dtc-code">${item.code}</span>
                            <span class="dtc-manufacturer">[${item.manufacturer}]</span>
                        </div>
                        <div class="dtc-description">${item.description}</div>
                        ${item.common_cause ? `
                            <div class="dtc-cause">
                                <span class="dtc-label">⚠️ السبب الشائع:</span> ${item.common_cause}
                            </div>
                        ` : ''}
                        ${item.fix_tip ? `
                            <div class="dtc-fix">
                                <span class="dtc-label">🔧 نصيحة الإصلاح:</span> ${item.fix_tip}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    } catch (error) {
        showError('فشل قراءة الرموز');
    } finally {
        hideLoading();
    }
}

// دالة مؤقتة لعرض التفاصيل (يمكن تطويرها لاحقاً)
function showDTCDetails(code) {
    showError(`🔍 عرض تفاصيل الرمز: ${code}`, 2000);
}

async function clearDTC() {
    showLoading('جاري مسح الرموز...');
    try {
        const response = await fetch('/api/clear_dtc', { method: 'POST' });
        const data = await response.json();

        if (data.status === 'cleared') {
            document.getElementById('dtcList').innerHTML = '';
            showError('✅ تم مسح الرموز بنجاح', 3000);
        }
    } catch (error) {
        showError('فشل مسح الرموز');
    } finally {
        hideLoading();
    }
}

// ========== معالج الأخطاء العام ==========
window.addEventListener('error', (event) => {
    console.error('خطأ عام:', event.error);
    showError('حدث خطأ غير متوقع. يرجى تحديث الصفحة.');
});

// ========== التهيئة ==========
updateConnectionStatus('disconnected', 'غير متصل');
loadLanguage('en');
loadSettings();

// إغلاق القائمة عند النقر خارجها
document.addEventListener('click', (event) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebar && menuBtn) {
        if (!sidebar.contains(event.target) && !menuBtn.contains(event.target) && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    }
});