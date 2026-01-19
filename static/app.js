let chartInstance = null;
let miniChartInstance = null;
let fullChartInstance = null;
let stockData = null;
let currentPage = 1;
let currentChartType = 'line';

const parameterValues = {
    ma_window: 30, ema_span: 14, rsi_window: 14,
    bb_window: 20, bb_std: 2.0, atr_window: 14,
    sma_window: 20, std_window: 20, macd_fast: 12, macd_slow: 26, macd_signal: 9
};

const parameterColors = {
    ma_window: '#3b82f6', ema_span: '#a855f7', rsi_window: '#f43f5e',
    atr_window: '#10b981', sma_window: '#f59e0b', std_window: '#8b5cf6',
    bb_window: '#34d399', bb_std: '#34d399', macd_fast: '#06b6d4', macd_signal: '#ec4899'
};

const pageConfigs = [
    { name: 'Trend Indicators', params: ['ma_window', 'ema_span', 'rsi_window'] },
    { name: 'Volatility & Stats', params: ['atr_window', 'sma_window', 'std_window'] },
    { name: 'Bollinger Bands', params: ['bb_window', 'bb_std'] },
    { name: 'MACD Analysis', params: ['macd_fast', 'macd_signal'] }
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
    macd_signal: { label: 'MACD Signal', min: 1, max: 100, step: 1, tooltip: 'A moving average of the MACD line itself. Crosses between the MACD and Signal lines are used as buy/sell indicators.' }
};

const getEl = (id) => document.getElementById(id);

async function init() {
    getEl('prevPage').onclick = () => { if (currentPage > 1) { currentPage--; updatePage(); } };
    getEl('nextPage').onclick = () => { if (currentPage < 4) { currentPage++; updatePage(); } };

    getEl('themeToggle').onclick = () => {
        const theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = theme;
        getEl('themeToggle').innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    };

    getEl('bgColorPicker').oninput = (e) => {
        document.documentElement.style.setProperty('--bg-color', e.target.value);
    };

    getEl('csvUpload').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload-csv', { method: 'POST', body: formData });
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
        window.open(`/api/export-csv?${params.toString()}`, '_blank');
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
        };
    });

    await loadStockList();
}

async function loadStockList(selectedTicker = null) {
    try {
        const res = await fetch('/api/stocks');
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
    getEl('pageIndicator').innerText = `Page ${currentPage} of 4`;
    getEl('prevPage').disabled = (currentPage === 1);
    getEl('nextPage').disabled = (currentPage === 4);
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

        const res = await fetch(`/api/analyze?${queryParams.toString()}`);
        stockData = await res.json();
        renderChart();
        renderMiniChart();
    } catch (e) { console.error("Fetch Error:", e); }
}

function renderChart() {
    if (!stockData || !stockData.data) return;
    const ctx = getEl('stockChart').getContext('2d');
    const labels = stockData.data.map(d => d.Date);
    const datasets = [];

    const config = pageConfigs[currentPage - 1];
    config.params.forEach(p => {
        const val = parameterValues[p];
        const color = parameterColors[p];
        let keys = [];
        let yAxis = (p === 'rsi_window' ? 'y1' : 'y');

        if (p === 'ma_window') keys = [`MA_${val}`];
        else if (p === 'ema_span') keys = [`EMA_${val}`];
        else if (p === 'rsi_window') keys = [`RSI_${val}`];
        else if (p === 'atr_window') keys = [`ATR_${val}`];
        else if (p === 'sma_window') keys = [`SMA_${val}`];
        else if (p === 'std_window') keys = [`STD_${val}`];
        else if (p === 'bb_window') {
            keys = [`Upper_BB_${val}`, `Lower_BB_${val}`];
        }
        else if (p === 'macd_fast') keys = ['MACD'];
        else if (p === 'macd_signal') keys = ['MACD_Signal'];

        keys.forEach(key => {
            if (stockData.data[0] && stockData.data[0][key] !== undefined) {
                const isDash = (currentChartType === 'dash');
                datasets.push({
                    label: key,
                    data: stockData.data.map(d => d[key]),
                    borderColor: color,
                    borderWidth: isDash ? 1 : (key.includes('_BB_') ? 1 : 2),
                    borderDash: isDash ? [2, 2] : (key.includes('_BB_') ? [5, 5] : []),
                    pointRadius: (currentChartType === 'scatter' ? 1 : 0),
                    pointHoverRadius: (currentChartType === 'scatter' ? 2 : 0),
                    showLine: (currentChartType !== 'scatter'),
                    yAxisID: yAxis
                });
            }
        });
    });

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line', data: { labels, datasets },
        options: {
            animation: false, responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { ticks: { maxTicksLimit: 8, color: '#8b949e' }, grid: { color: '#30363d' } },
                y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
                y1: { display: (currentPage === 1), position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { color: '#8b949e' } }
            },
            plugins: {
                legend: { labels: { color: '#8b949e', boxWidth: 10, font: { size: 10 } } },
                tooltip: { backgroundColor: 'rgba(22, 27, 34, 0.9)', titleColor: '#f0f6fc', bodyColor: '#8b949e' }
            }
        }
    });
}

function renderMiniChart() {
    const ctx = getEl('miniStockChart').getContext('2d');
    const data = stockData.data.slice(-30);
    if (miniChartInstance) miniChartInstance.destroy();
    miniChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: data.map(d => d.Date), datasets: [{ data: data.map(d => d.Close), borderColor: '#1f6feb', borderWidth: 2, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, scales: { x: { display: false }, y: { display: false } } }
    });
}

function renderFullChart() {
    const ctx = getEl('fullStockChart').getContext('2d');
    if (fullChartInstance) fullChartInstance.destroy();
    fullChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: stockData.data.map(d => d.Date),
            datasets: [
                { label: 'Price', data: stockData.data.map(d => d.Close), borderColor: '#f0f6fc', borderWidth: 2, pointRadius: 0, yAxisID: 'y' },
                { label: 'Volume', data: stockData.data.map(d => d.Volume), type: 'bar', backgroundColor: 'rgba(31, 111, 235, 0.3)', yAxisID: 'yVolume', pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', position: 'left', ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
                yVolume: { type: 'linear', position: 'right', display: false, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            const d = stockData.data[context.dataIndex];
                            if (context.dataset.label === 'Price') {
                                return [
                                    `Open: ${d.Open.toLocaleString()}`,
                                    `High: ${d.High.toLocaleString()}`,
                                    `Low: ${d.Low.toLocaleString()}`,
                                    `Close: ${d.Close.toLocaleString()}`
                                ];
                            }
                            if (context.dataset.label === 'Volume') {
                                return `Volume: ${d.Volume.toLocaleString()}`;
                            }
                            return context.parsed.y.toLocaleString();
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
