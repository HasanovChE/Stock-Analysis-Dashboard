console.log("Stock Dashboard App v3 Loaded");
let chartInstance = null;
let miniChartInstance = null;
let fullChartInstance = null;
let stockData = null;
let currentPage = 1;
let currentChartType = 'candle';
let AUTH_TOKEN = localStorage.getItem('token');

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://stock-analysis-backend-h6u5.onrender.com'; // Placeholder, user will need to update this

const parameterValues = {
    ma_window: 30, ema_span: 14, rsi_window: 14,
    bb_window: 20, bb_std: 2.0, atr_window: 14,
    sma_window: 20, std_window: 20, macd_fast: 12, macd_slow: 26, macd_signal: 9,
    williams_window: 14
};

const parameterColors = {
    ma_window: '#3b82f6', ema_span: '#a855f7', rsi_window: '#f43f5e',
    atr_window: '#10b981', sma_window: '#f59e0b', std_window: '#8b5cf6',
    bb_window: '#34d399', bb_std: '#34d399', macd_fast: '#06b6d4', macd_signal: '#ec4899',
    williams_window: '#fbbf24', tenkan_sen: '#f87171', kijun_sen: '#60a5fa', span_a: '#34d399', span_b: '#f472b6'
};

const pageConfigs = [
    { name: 'Trend Indicators', params: ['ma_window', 'ema_span', 'rsi_window'] },
    { name: 'Volatility & Stats', params: ['atr_window', 'sma_window', 'std_window'] },
    { name: 'Bollinger Bands', params: ['bb_window', 'bb_std'] },
    { name: 'MACD Analysis', params: ['macd_fast', 'macd_signal'] },
    { name: 'Premium Insights', params: ['williams_window'] }
];

const paramMeta = {
    ma_window: { label: 'MA Window', min: 2, max: 200, step: 1, tooltip: 'Simple Moving Average (SMA) calculates the average price over a specific number of days. It helps smooth price action and identify the overall trend direction.' },
    ema_span: { label: 'EMA Span', min: 2, max: 200, step: 1, tooltip: 'Exponential Moving Average (EMA) gives more weight to recent prices. This makes it more responsive to new information compared to a simple moving average.' },
    rsi_window: { label: 'RSI Period', min: 2, max: 100, step: 1, tooltip: 'Relative Strength Index (RSI) measures the momentum of price changes. It is used to identify overbought (above 70) or oversold (below 30) market conditions.' },
    atr_window: { label: 'ATR Period', min: 2, max: 100, step: 1, tooltip: 'Average True Range (ATR) measures market volatility by decomposing the entire range of an asset price for that period.' },
    sma_window: { label: 'SMA Window', min: 2, max: 200, step: 1, tooltip: 'Simple Moving Average used as a statistical baseline for trend and volatility calculations.' },
    std_window: { label: 'STD Window', min: 2, max: 200, step: 1, tooltip: 'Standard Deviation measures price dispersion. Higher values indicate higher volatility and greater price swings away from the average.' },
    bb_window: { label: 'BB Window', min: 2, max: 200, step: 1, tooltip: 'Bollinger Bands use a central average with upper and lower bands that expand and contract as volatility changes.' },
    bb_std: { label: 'BB Std Dev', min: 0.1, max: 5, step: 0.1, tooltip: 'Sets the standard deviation multiplier for the Bollinger Bands width. A higher value makes the bands wider, capturing more price data.' },
    macd_fast: { label: 'MACD Fast', min: 1, max: 100, step: 1, tooltip: 'The shorter period used to calculate the MACD line, identifying quick momentum shifts in price movement.' },
    macd_signal: { label: 'MACD Signal', min: 1, max: 100, step: 1, tooltip: 'A moving average of the MACD line itself. Crosses between the MACD and Signal lines are used as buy/sell indicators.' },
    williams_window: { label: 'Williams %R', min: 2, max: 100, step: 1, tooltip: 'Williams %R is a momentum indicator that measures overbought and oversold levels, similar to a stochastic oscillator.' }
};

const getEl = (id) => document.getElementById(id);

async function authFetch(url, options = {}) {
    if (!AUTH_TOKEN) {
        showAuth(true);
        throw new Error("No auth token");
    }

    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${AUTH_TOKEN}`
    };

    const res = await fetch(url, options);
    if (res.status === 401) {
        logout();
        throw new Error("Unauthorized");
    }
    return res;
}

function logout() {
    localStorage.removeItem('token');
    AUTH_TOKEN = null;
    showAuth(true);
}

function showAuth(show) {
    const overlay = getEl('authOverlay');
    if (show) overlay.classList.add('active');
    else overlay.classList.remove('active');
}

async function handleAuth() {
    const username = getEl('username').value;
    const password = getEl('password').value;
    const errorEl = getEl('authError');
    const isRegister = getEl('authBtn').innerText === 'Register';

    if (!username || !password) {
        errorEl.innerText = "Please enter username and password";
        return;
    }

    try {
        let res;
        if (isRegister) {
            res = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Registration failed");
            }
            // Auto login after register
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            res = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
        } else {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            res = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Login failed");
        }

        const data = await res.json();
        AUTH_TOKEN = data.access_token;
        localStorage.setItem('token', AUTH_TOKEN);
        showAuth(false);
        errorEl.innerText = "";
        await initDashboard();

    } catch (e) {
        errorEl.innerText = e.message;
    }
}

async function init() {
    // Auth Event Listeners
    getEl('authBtn').onclick = handleAuth;
    getEl('closeAuthBtn').onclick = () => {
        if (!AUTH_TOKEN) {
            alert("Please login or register to access the dashboard.");
            return;
        }
        showAuth(false);
    };
    getEl('authSwitchBtn').onclick = (e) => {
        e.preventDefault();
        const isLogin = getEl('authTitle').innerText === 'Login';
        if (isLogin) {
            getEl('authTitle').innerText = 'Register';
            getEl('authBtn').innerText = 'Register';
            getEl('authSwitchText').innerText = 'Already have an account?';
            getEl('authSwitchBtn').innerText = 'Login';
        } else {
            getEl('authTitle').innerText = 'Login';
            getEl('authBtn').innerText = 'Login';
            getEl('authSwitchText').innerText = "Don't have an account?";
            getEl('authSwitchBtn').innerText = 'Register';
        }
        getEl('authError').innerText = "";
    };

    if (!AUTH_TOKEN) {
        showAuth(true);
    } else {
        await initDashboard();
    }
}

async function initDashboard() {
    getEl('prevPage').onclick = () => { if (currentPage > 1) { currentPage--; updatePage(); } };
    getEl('nextPage').onclick = () => { if (currentPage < 5) { currentPage++; updatePage(); } };

    getEl('themeToggle').onclick = () => {
        const theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = theme;
        getEl('themeToggle').innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        renderChart();
    };

    getEl('bgColorPicker').oninput = (e) => {
        document.body.style.setProperty('--bg-color', e.target.value);
    };

    // Profile dropdown
    getEl('profileBtn').onclick = (e) => {
        e.stopPropagation();
        getEl('profileDropdown').classList.toggle('active');
    };

    document.addEventListener('click', (e) => {
        const dropdown = getEl('profileDropdown');
        if (dropdown && !getEl('profileContainer')?.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    getEl('logoutBtn').onclick = () => {
        logout();
    };

    getEl('changePasswordBtn').onclick = () => {
        const newPassword = prompt("Enter new password:");
        if (newPassword) {
            alert("Password change functionality coming soon!");
        }
    };

    getEl('csvUpload').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/upload-csv`, { method: 'POST', body: formData });
            const data = await res.json();
            alert(`Imported ${data.ticker}`);
            await loadStockList(data.ticker);
        } catch (err) { alert('Import failed'); }
    };

    getEl('exportBtn').onclick = () => {
        const stock = getEl('stock-select').value;
        if (!stock) return;
        const params = new URLSearchParams({ stock, ...parameterValues });
        const start = getEl('start-date').value;
        const end = getEl('end-date').value;
        if (start) params.append('start_date', start);
        if (end) params.append('end_date', end);

        // Ensure export uses token (download link trick)
        fetch(`${API_BASE_URL}/api/export-csv?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        })
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${stock}_processed.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch(err => alert("Export failed"));
    };

    getEl('fullscreenBtn').onclick = () => { getEl('stockChartModal').classList.add('active'); renderFullChart(); };
    getEl('closeModalBtn').onclick = () => getEl('stockChartModal').classList.remove('active');
    getEl('backToDashboardBtn').onclick = () => getEl('stockChartModal').classList.remove('active');

    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartType = btn.dataset.type;
            renderChart();
            renderMiniChart();
            if (getEl('stockChartModal').classList.contains('active')) renderFullChart();
        };
    });

    await loadStockList();
}

async function loadStockList(selectedTicker = null) {
    try {
        const res = await authFetch(`${API_BASE_URL}/api/stocks`);
        const data = await res.json();
        const select = getEl('stock-select');
        select.innerHTML = data.stocks.map(s => `<option value="${s}">${s}</option>`).join('');
        select.onchange = fetchData;
        getEl('start-date').onchange = fetchData;
        getEl('end-date').onchange = fetchData;

        if (data.stocks.length) {
            select.value = selectedTicker || data.stocks[0];
            updatePage();
            await fetchData();
        }
    } catch (e) { console.error("Failed to load stocks:", e); }
}

function updatePage() {
    getEl('pageIndicator').innerText = `Page ${currentPage} of 5`;
    getEl('prevPage').disabled = (currentPage === 1);
    getEl('nextPage').disabled = (currentPage === 5);
    renderParams();
    if (stockData) renderChart();
}

function renderParams() {
    const container = getEl('parametersContainer');
    const config = pageConfigs[currentPage - 1];
    container.innerHTML = `<h3 style="font-size: 0.9rem; margin-bottom: 8px;">${config.name}</h3>`;

    config.params.forEach(pKey => {
        const meta = paramMeta[pKey];
        const val = parameterValues[pKey];
        const color = parameterColors[pKey];

        const group = document.createElement('div');
        group.className = 'control-group';
        group.innerHTML = `
            <div class="param-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="margin:0; font-size: 0.75rem;">${meta.label}</label>
                    <div class="info-icon">
                        <i class="fas fa-question-circle"></i>
                        <div class="tooltip">${meta.tooltip}</div>
                    </div>
                </div>
                <input type="color" value="${color}" data-color-param="${pKey}" style="width:20px; height:20px; border:none; background:none; cursor:pointer;">
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <input type="number" value="${val}" step="${meta.step}" min="${meta.min}" max="${meta.max}" data-input-param="${pKey}" style="width:55px; padding:2px; font-size: 0.75rem;">
                <input type="range" value="${val}" step="${meta.step}" min="${meta.min}" max="${meta.max}" data-range-param="${pKey}" style="flex:1;">
            </div>
        `;
        container.appendChild(group);

        const colorInp = group.querySelector(`[data-color-param="${pKey}"]`);
        const numInp = group.querySelector(`[data-input-param="${pKey}"]`);
        const rangeInp = group.querySelector(`[data-range-param="${pKey}"]`);

        colorInp.onchange = (e) => { parameterColors[pKey] = e.target.value; renderChart(); };
        const updateVal = (e) => {
            const v = parseFloat(e.target.value);
            parameterValues[pKey] = v;
            numInp.value = v;
            rangeInp.value = v;
            debouncedFetch();
        };

        numInp.oninput = updateVal;
        rangeInp.oninput = updateVal;
    });
}

const debouncedFetch = debounce(fetchData, 300);

async function fetchData() {
    const stock = getEl('stock-select').value;
    if (!stock) return;
    try {
        const queryParams = new URLSearchParams({ stock, ...parameterValues });
        const start = getEl('start-date').value;
        const end = getEl('end-date').value;
        if (start) queryParams.append('start_date', start);
        if (end) queryParams.append('end_date', end);

        const res = await authFetch(`${API_BASE_URL}/api/analyze?${queryParams.toString()}`);
        stockData = await res.json();

        // Update Advice
        const latest = stockData.data[stockData.data.length - 1];
        if (latest && latest.Advice) {
            const badge = getEl('adviceContainer');
            badge.innerText = `Advice: ${latest.Advice}`;
            badge.className = 'advice-badge ' + latest.Advice.toLowerCase().replace(' ', '-');
        }

        renderChart();
        renderMiniChart();
    } catch (e) { console.error("Fetch Error:", e); }
}

function renderChart() {
    if (!stockData || !stockData.data) return;
    const ctx = getEl('stockChart').getContext('2d');
    const datasets = [];

    const isDash = (currentChartType === 'dash');
    const isCandle = (currentChartType === 'candle');

    // Add main price data
    if (isCandle) {
        datasets.push({
            type: 'candlestick',
            label: 'Price',
            data: stockData.data.map(d => ({
                x: luxon.DateTime.fromISO(d.Date).valueOf(),
                o: d.Open, h: d.High, l: d.Low, c: d.Close
            })),
            color: { up: '#26a69a', down: '#ef5350', unchanged: '#888' },
            borderColor: { up: '#26a69a', down: '#ef5350', unchanged: '#888' },
            yAxisID: 'y'
        });
    }

    const config = pageConfigs[currentPage - 1];
    config.params.forEach(p => {
        const val = parameterValues[p];
        const color = parameterColors[p];
        let keys = [];
        let yAxis = (p === 'rsi_window' || p === 'williams_window' ? 'y1' : 'y');

        if (p === 'ma_window') keys = [`MA_${val}`];
        else if (p === 'ema_span') keys = [`EMA_${val}`];
        else if (p === 'rsi_window') keys = [`RSI_${val}`];
        else if (p === 'atr_window') keys = [`ATR_${val}`];
        else if (p === 'sma_window') keys = [`SMA_${val}`];
        else if (p === 'std_window') keys = [`STD_${val}`];
        else if (p === 'bb_window') keys = [`Upper_BB_${val}`, `Lower_BB_${val}`];
        else if (p === 'macd_fast') keys = ['MACD'];
        else if (p === 'macd_signal') keys = ['MACD_Signal'];
        else if (p === 'williams_window') keys = [`WilliamsR_${val}`];

        keys.forEach(key => {
            if (stockData.data[0] && stockData.data[0][key] !== undefined) {
                datasets.push({
                    type: 'line',
                    label: key,
                    data: stockData.data.map(d => ({
                        x: luxon.DateTime.fromISO(d.Date).valueOf(),
                        y: d[key]
                    })),
                    borderColor: color,
                    borderWidth: isDash ? 1 : 1.5,
                    borderDash: (currentChartType === 'dash') ? [5, 5] : [],
                    pointRadius: 0,
                    showLine: true,
                    yAxisID: yAxis
                });
            }
        });
    });

    // Special: Ichimoku (always plotted on Page 5)
    if (currentPage === 5) {
        const ichiKeys = [
            { k: 'Tenkan_Sen', c: parameterColors.tenkan_sen },
            { k: 'Kijun_Sen', c: parameterColors.kijun_sen },
            { k: 'Senkou_Span_A', c: parameterColors.span_a },
            { k: 'Senkou_Span_B', c: parameterColors.span_b }
        ];
        ichiKeys.forEach(item => {
            if (stockData.data[0] && stockData.data[0][item.k] !== undefined) {
                datasets.push({
                    type: 'line',
                    label: item.k,
                    data: stockData.data.map(d => ({
                        x: luxon.DateTime.fromISO(d.Date).valueOf(),
                        y: d[item.k]
                    })),
                    borderColor: item.c,
                    borderWidth: 1,
                    pointRadius: 0,
                    showLine: true,
                    yAxisID: 'y'
                });
            }
        });
    }

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: isCandle ? 'candlestick' : 'line',
        data: { datasets },
        options: {
            animation: false, responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day', displayFormats: { day: 'yyyy-MM-dd' } },
                    ticks: { maxTicksLimit: 8, color: '#8b949e' }, grid: { color: '#30363d' }
                },
                y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
                y1: {
                    display: (currentPage === 1 || currentPage === 5),
                    position: 'right',
                    min: currentPage === 5 ? -100 : 0,
                    max: currentPage === 5 ? 0 : 100,
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#8b949e' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#8b949e',
                        boxWidth: 10,
                        font: { size: 10 },
                        filter: function (item, chart) {
                            return !item.text.includes('Price') && !item.text.includes('Close Price');
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#f0f6fc',
                    bodyColor: '#8b949e',
                    callbacks: {
                        title: function (context) {
                            if (context[0] && context[0].parsed) {
                                const date = new Date(context[0].parsed.x);
                                return date.toISOString().split('T')[0];
                            }
                            return '';
                        },
                        label: function (context) {
                            if (context.dataset.type === 'candlestick') {
                                const d = context.raw;
                                return `Open: ${d.o.toFixed(3)} High: ${d.h.toFixed(3)} Low: ${d.l.toFixed(3)} Close: ${d.c.toFixed(3)}`;
                            }

                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(3);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderMiniChart() {
    if (!stockData || !stockData.data) return;
    const ctx = getEl('miniStockChart').getContext('2d');
    const data = stockData.data.slice(-30);
    const isDash = (currentChartType === 'dash');
    const isCandle = (currentChartType === 'candle');

    const datasets = [];
    if (isCandle) {
        datasets.push({
            type: 'candlestick',
            data: data.map(d => ({
                x: luxon.DateTime.fromISO(d.Date).valueOf(),
                o: d.Open, h: d.High, l: d.Low, c: d.Close
            })),
            background: { up: '#26a69a', down: '#ef5350', unchanged: '#888' },
            border: { up: '#26a69a', down: '#ef5350', unchanged: '#888' },
            borderWidth: 1
        });
    } else {
        datasets.push({
            type: 'line',
            data: data.map(d => ({
                x: luxon.DateTime.fromISO(d.Date).valueOf(),
                y: d.Close
            })),
            borderColor: '#1f6feb',
            borderWidth: isDash ? 1 : 2,
            borderDash: isDash ? [5, 5] : [],
            pointRadius: 0
        });
    }

    if (miniChartInstance) miniChartInstance.destroy();
    miniChartInstance = new Chart(ctx, {
        type: isCandle ? 'candlestick' : 'line',
        data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: false,
                tooltip: { enabled: false }
            },
            scales: {
                x: { type: 'time', display: false },
                y: { display: false }
            }
        }
    });
}

function renderFullChart() {
    if (!stockData || !stockData.data) return;
    const ctx = getEl('fullStockChart').getContext('2d');
    const isDash = (currentChartType === 'dash');
    const isCandle = (currentChartType === 'candle');

    const datasets = [];
    if (isCandle) {
        datasets.push({
            type: 'candlestick',
            label: 'Price',
            data: stockData.data.map(d => ({
                x: luxon.DateTime.fromISO(d.Date).valueOf(),
                o: d.Open, h: d.High, l: d.Low, c: d.Close
            })),
            color: { up: '#26a69a', down: '#ef5350', unchanged: '#888' },
            borderColor: { up: '#26a69a', down: '#ef5350', unchanged: '#888' },
            yAxisID: 'y'
        });
    } else {
        datasets.push({
            type: 'line',
            label: 'Price',
            data: stockData.data.map(d => ({
                x: luxon.DateTime.fromISO(d.Date).valueOf(),
                y: d.Close
            })),
            borderColor: '#f0f6fc',
            borderWidth: isDash ? 1 : 2,
            borderDash: isDash ? [5, 5] : [],
            pointRadius: 0,
            yAxisID: 'y'
        });
    }

    datasets.push({
        label: 'Volume',
        data: stockData.data.map(d => ({
            x: luxon.DateTime.fromISO(d.Date).valueOf(),
            y: d.Volume
        })),
        type: 'bar',
        backgroundColor: 'rgba(31, 111, 235, 0.3)',
        yAxisID: 'yVolume'
    });

    if (fullChartInstance) fullChartInstance.destroy();
    fullChartInstance = new Chart(ctx, {
        type: isCandle ? 'candlestick' : 'line',
        data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { type: 'time', ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
                y: { type: 'linear', position: 'left', ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
                yVolume: { type: 'linear', position: 'right', display: false, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: function (context) {
                            if (context[0] && context[0].parsed) {
                                const date = new Date(context[0].parsed.x);
                                return date.toISOString().split('T')[0];
                            }
                            return '';
                        },
                        label: function (context) {
                            const d = stockData.data[context.dataIndex];
                            if (context.dataset.type === 'candlestick' || context.dataset.label === 'Price') {
                                return [
                                    `Open: ${d.Open.toFixed(3)}`,
                                    `High: ${d.High.toFixed(3)}`,
                                    `Low: ${d.Low.toFixed(3)}`,
                                    `Close: ${d.Close.toFixed(3)}`
                                ];
                            }
                            if (context.dataset.label === 'Volume') {
                                return `Volume: ${d.Volume.toLocaleString()}`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;
                        }
                    }
                }
            }
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}

window.onload = init;
