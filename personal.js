/**
 * Personal Edition - The Landscape
 * Your portfolio mapped against market performance
 */

// ===== Configuration =====
const CONFIG = {
    maxCoinsFree: 5,
    maxCoinsPro: 10,
    get isPro() {
        // Check Firebase user sync for premium status
        return typeof userSync !== 'undefined' && userSync.isPremium();
    },
    storageKey: 'litmus_personal_coins',
    coingeckoApi: 'https://api.coingecko.com/api/v3'
};

// ===== Segments =====
const SEGMENTS = {
    store_of_value: { label: 'Store of Value', row: 0 },
    infrastructure: { label: 'Infrastructure', row: 1 },
    defi: { label: 'DeFi', row: 2 },
    real_world: { label: 'Real World Use', row: 3 },
    ai_compute: { label: 'AI & Compute', row: 4 },
    entertainment: { label: 'Entertainment', row: 5 },
    payments: { label: 'Payments', row: 6 }
};

// ===== Weight sizes =====
const WEIGHTS = {
    core: { label: 'Core', size: 40, priority: 1 },
    significant: { label: 'Significant', size: 30, priority: 2 },
    moderate: { label: 'Moderate', size: 22, priority: 3 },
    small: { label: 'Small', size: 14, priority: 4 },
    watching: { label: 'Watching', size: 0, priority: 5 }
};

// ===== State =====
let state = {
    userCoins: [], // { id, symbol, name, weight, segment }
    coinData: {}, // { id: { price, change7d, change30d, change90d, marketCap } }
    marketChange7d: 0,
    marketChange30d: 0,
    marketChange90d: 0,
    segmentChanges: {}, // { segment: { change7d, change30d, change90d } }
    availableCoins: [], // Top 100 from CoinGecko
    period: 30, // 7, 30, or 90 days
    editingCoin: null,
    region: 'americas' // apac, emea, americas
};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupStickyHeader();
    loadUserCoins();
    loadAvailableCoins();
    render();
});

// ===== Sticky Header =====
function setupStickyHeader() {
    const stickyHeader = document.getElementById('sticky-header');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 150) {
            stickyHeader.classList.add('visible');
        } else {
            stickyHeader.classList.remove('visible');
        }
        
        lastScroll = currentScroll;
    });
}

function updateStickyPrices() {
    const btc = state.coinData['bitcoin'];
    const eth = state.coinData['ethereum'];
    
    if (btc) {
        const btcPrice = document.getElementById('sticky-btc-price');
        const btcChange = document.getElementById('sticky-btc-change');
        if (btcPrice) btcPrice.textContent = btc.price ? `$${(btc.price / 1000).toFixed(1)}k` : '---';
        if (btcChange) {
            const change = btc.change7d || 0;
            btcChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
            btcChange.className = `sticky-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    if (eth) {
        const ethPrice = document.getElementById('sticky-eth-price');
        const ethChange = document.getElementById('sticky-eth-change');
        if (ethPrice) ethPrice.textContent = eth.price ? `$${(eth.price / 1000).toFixed(1)}k` : '---';
        if (ethChange) {
            const change = eth.change7d || 0;
            ethChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
            ethChange.className = `sticky-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    const marketEl = document.getElementById('sticky-market');
    if (marketEl) {
        const marketChange = state.marketChange7d || 0;
        marketEl.textContent = `${marketChange >= 0 ? '+' : ''}${marketChange.toFixed(1)}%`;
    }
}

// ===== Data Storage (LocalStorage + Firebase Sync) =====
function loadUserCoins() {
    try {
        // Try to get from localStorage first (cached/offline)
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
            state.userCoins = JSON.parse(saved);
        }
        
        // If user is signed in, data will be updated via userDataLoaded event
    } catch (e) {
        console.error('Failed to load saved coins:', e);
    }
}

function loadRegionSelection() {
    // Get current region from userSync or localStorage
    if (typeof userSync !== 'undefined' && userSync.getRegion) {
        state.region = userSync.getRegion();
    } else {
        state.region = localStorage.getItem('litmus_region') || 'americas';
    }
    
    // Update UI
    document.querySelectorAll('#region-options .region-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.region === state.region);
    });
}

async function saveUserCoins() {
    try {
        // Always save to localStorage (offline fallback)
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.userCoins));
        
        // If signed in, sync full coin objects to Firebase (includes weight, segment)
        if (typeof userSync !== 'undefined' && typeof getCurrentUser === 'function' && getCurrentUser()) {
            await userSync.saveFocusCoins(state.userCoins);
            console.log('[Personal] Synced to cloud:', state.userCoins.length, 'coins');
        }
    } catch (e) {
        console.error('Failed to save coins:', e);
    }
}

// Listen for user data loaded from Firebase
window.addEventListener('userDataLoaded', async (e) => {
    const userData = e.detail;
    if (userData?.focusCoins && Array.isArray(userData.focusCoins)) {
        console.log('[Personal] Loading coins from cloud:', userData.focusCoins);
        
        // Handle both old format (array of strings) and new format (array of objects)
        const cloudCoins = [];
        for (const item of userData.focusCoins) {
            // Check if it's already a full object or just a string ID
            if (typeof item === 'object' && item.id) {
                // New format: full coin object with weight/segment
                cloudCoins.push(item);
            } else if (typeof item === 'string') {
                // Old format: just coin ID, need to enrich
                const coinData = typeof TOP_100_COINS !== 'undefined' 
                    ? TOP_100_COINS.find(c => c.id === item) 
                    : null;
                    
                if (coinData) {
                    cloudCoins.push({
                        id: item,
                        symbol: coinData.symbol,
                        name: coinData.name,
                        weight: 'moderate',
                        segment: coinData.segment || 'store_of_value'
                    });
                }
            }
        }
        
        if (cloudCoins.length > 0) {
            state.userCoins = cloudCoins;
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.userCoins));
            renderPortfolio();
            await fetchLivePrices();
        }
    }
});

// ===== API =====
async function loadAvailableCoins() {
    // Use static coin list (from coins-data.js)
    if (typeof TOP_100_COINS === 'undefined') {
        console.error('coins-data.js not loaded');
        return;
    }
    
    state.availableCoins = TOP_100_COINS.map(c => ({
        ...c,
        marketCap: 0,
        price: 0,
        change30d: 0,
        change7d: 0
    }));
    
    // Store in coinData for quick lookup
    state.availableCoins.forEach(c => {
        state.coinData[c.id] = c;
    });
    
    renderAvailableCoins();
    
    // Then fetch live price data
    await fetchPriceData();
    render();
}

async function fetchPriceData() {
    // Get IDs of user's coins
    const userCoinIds = state.userCoins.map(c => c.id);
    
    // Representative coins for each segment (for segment % calculation)
    const segmentRepresentatives = [
        'bitcoin', 'wrapped-bitcoin', // Store of Value
        'ethereum', 'solana', 'cardano', 'avalanche-2', 'polkadot', // Infrastructure
        'uniswap', 'aave', 'maker', 'lido-dao', // DeFi
        'chainlink', 'the-graph', 'filecoin', 'vechain', // Real World Use
        'render-token', 'fetch-ai', 'bittensor', // AI & Compute
        'chiliz', 'gala', 'theta-token', 'the-sandbox', 'immutable-x', // Entertainment
        'ripple', 'litecoin', 'stellar', 'dogecoin' // Payments
    ];
    
    // Combine all needed coins
    const idsToFetch = [...new Set([...userCoinIds, ...segmentRepresentatives])];
    
    try {
        // Try cached API first (refreshes at 00:00 and 12:00 UTC)
        let coins = [];
        const cacheResponse = await fetch('/api/personal-cache');
        
        if (cacheResponse.ok) {
            const cacheData = await cacheResponse.json();
            // Filter to only coins we need
            coins = (cacheData.coins || []).filter(c => idsToFetch.includes(c.id));
            
            // Update data timestamp display
            updateDataTimestamp(cacheData.updated, cacheData.dataPeriod);
            
            // Update market data from cache
            if (cacheData.market) {
                state.marketChange7d = cacheData.market.marketCapChange24h * 7 / 24 || 0; // Estimate
            }
            
            // Map cached format to expected format
            coins.forEach(c => {
                if (!state.coinData[c.id]) {
                    state.coinData[c.id] = {
                        id: c.id,
                        symbol: c.symbol,
                        name: c.name,
                        image: c.image
                    };
                }
                
                const entry = state.coinData[c.id];
                entry.price = c.price;
                entry.marketCap = c.marketCap;
                entry.change7d = c.change7d || 0;
                entry.change30d = c.change30d || 0;
                entry.change90d = c.change90d || 0;
            });
        } else {
            // Fallback to direct CoinGecko
            const response = await fetch(
                `${CONFIG.coingeckoApi}/coins/markets?vs_currency=usd&ids=${idsToFetch.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=7d,30d`
            );
            
            if (!response.ok) throw new Error('API request failed');
            
            coins = await response.json();
            
            coins.forEach(c => {
                if (!state.coinData[c.id]) {
                    state.coinData[c.id] = {
                        id: c.id,
                        symbol: c.symbol.toUpperCase(),
                        name: c.name,
                        image: c.image
                    };
                }
                
                const entry = state.coinData[c.id];
                entry.price = c.current_price;
                entry.marketCap = c.market_cap;
                entry.change7d = c.price_change_percentage_7d_in_currency || 0;
                entry.change30d = c.price_change_percentage_30d_in_currency || 0;
                entry.change90d = (c.price_change_percentage_30d_in_currency || 0) * 2.2;
            });
        }
        
        // Calculate market change as market-cap-weighted average of all coins
        // This represents the actual total market movement
        calculateMarketChange();
        
        // Calculate segment averages
        calculateSegmentChanges();
        
        // Update sticky header prices
        updateStickyPrices();
        
    } catch (e) {
        console.error('Failed to fetch price data:', e);
        state.marketChange7d = 0;
        state.marketChange30d = 0;
        state.marketChange90d = 0;
    }
}

// Calculate market change as market-cap-weighted average
function calculateMarketChange() {
    let totalMarketCap = 0;
    let weighted7d = 0;
    let weighted30d = 0;
    let weighted90d = 0;
    
    // Use all available coins with price data
    state.availableCoins.forEach(coin => {
        const data = state.coinData[coin.id];
        if (data && data.marketCap && data.marketCap > 0) {
            const cap = data.marketCap;
            totalMarketCap += cap;
            weighted7d += (data.change7d || 0) * cap;
            weighted30d += (data.change30d || 0) * cap;
            weighted90d += (data.change90d || 0) * cap;
        }
    });
    
    if (totalMarketCap > 0) {
        state.marketChange7d = weighted7d / totalMarketCap;
        state.marketChange30d = weighted30d / totalMarketCap;
        state.marketChange90d = weighted90d / totalMarketCap;
    } else {
        // Fallback to BTC+ETH average if no market cap data
        const btc = state.coinData['bitcoin'];
        const eth = state.coinData['ethereum'];
        if (btc && eth) {
            state.marketChange7d = ((btc.change7d || 0) + (eth.change7d || 0)) / 2;
            state.marketChange30d = ((btc.change30d || 0) + (eth.change30d || 0)) / 2;
            state.marketChange90d = ((btc.change90d || 0) + (eth.change90d || 0)) / 2;
        }
    }
}

function calculateSegmentChanges() {
    // Calculate segment averages from ALL available coins (not just user's)
    state.segmentChanges = {};
    
    // Group all available coins by their default segment
    const segmentCoins = {};
    Object.keys(SEGMENTS).forEach(segKey => {
        segmentCoins[segKey] = [];
    });
    
    // Use DEFAULT_SEGMENTS to categorize all coins
    state.availableCoins.forEach(coin => {
        const segment = DEFAULT_SEGMENTS[coin.id] || 'infrastructure';
        if (segmentCoins[segment]) {
            segmentCoins[segment].push(coin.id);
        }
    });
    
    // Calculate average for each segment
    Object.keys(SEGMENTS).forEach(segKey => {
        const coinIds = segmentCoins[segKey];
        if (coinIds.length === 0) {
            state.segmentChanges[segKey] = { change7d: 0, change30d: 0, change90d: 0 };
            return;
        }
        
        let total7d = 0, total30d = 0, total90d = 0, count = 0;
        coinIds.forEach(coinId => {
            const data = state.coinData[coinId];
            if (data && (data.change7d !== 0 || data.change30d !== 0)) {
                total7d += data.change7d || 0;
                total30d += data.change30d || 0;
                total90d += data.change90d || 0;
                count++;
            }
        });
        
        if (count > 0) {
            state.segmentChanges[segKey] = {
                change7d: total7d / count,
                change30d: total30d / count,
                change90d: total90d / count
            };
        } else {
            state.segmentChanges[segKey] = { change7d: 0, change30d: 0, change90d: 0 };
        }
    });
}

// ===== Rendering =====
function render() {
    const hasCoins = state.userCoins.length > 0;
    
    document.getElementById('empty-state').style.display = hasCoins ? 'none' : 'block';
    document.getElementById('landscape-chart').style.display = hasCoins ? 'block' : 'none';
    document.getElementById('portfolio-read').style.display = hasCoins ? 'block' : 'none';
    document.getElementById('coins-section').style.display = hasCoins ? 'block' : 'none';
    
    if (hasCoins) {
        renderChart();
        renderPortfolioRead();
        renderCoinsList();
        updateMarketConditionHeader();
    }
    
    updateCoinCount();
}

// ===== Dynamic Market Condition Header =====
function updateMarketConditionHeader() {
    const labelEl = document.getElementById('market-condition-label');
    if (!labelEl) return;
    
    // Get market change for selected period
    let marketChange;
    switch (state.period) {
        case 7:
            marketChange = state.marketChange7d;
            break;
        case 90:
            marketChange = state.marketChange90d;
            break;
        default: // 30
            marketChange = state.marketChange30d;
    }
    
    // Determine headline based on market condition
    // Using ±0.5% as the "flat" buffer
    let headline;
    if (marketChange > 3) {
        headline = 'Riding the Wave';
    } else if (marketChange > 0.5) {
        headline = 'Steady Gains';
    } else if (marketChange >= -0.5) {
        headline = 'Holding Pattern';
    } else if (marketChange >= -3) {
        headline = 'Against the Tide';
    } else {
        headline = 'Weathering the Storm';
    }
    
    labelEl.textContent = headline;
}

// Update data timestamp display with regional time for logged-in users
function updateDataTimestamp(isoString, dataPeriod) {
    const el = document.getElementById('data-timestamp');
    const nextEl = document.getElementById('next-update');
    if (!el) return;
    
    // Check if user is logged in by checking if getCurrentUser exists and returns a user
    // Also check firebase auth directly as fallback
    let isLoggedIn = false;
    if (typeof getCurrentUser === 'function' && getCurrentUser()) {
        isLoggedIn = true;
    } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        isLoggedIn = true;
    }
    
    // Region timezone mapping
    const regionTimezones = {
        'apac': { offset: 8, abbrev: 'SGT' },
        'emea': { offset: 0, abbrev: 'GMT' },
        'americas': { offset: -5, abbrev: 'EST' }
    };
    
    // Get user's timezone info (or default to UTC)
    // Use state.region which is already loaded from userSync or localStorage
    const userRegion = state.region || 'americas';
    const tz = isLoggedIn ? regionTimezones[userRegion] : { offset: 0, abbrev: 'UTC' };
    
    // Data refresh times in UTC: 00:00 and 12:00
    const refreshTimesUTC = [0, 12];
    
    // Convert UTC refresh time to regional time
    function utcToRegional(utcHour) {
        let regionalHour = utcHour + tz.offset;
        if (regionalHour < 0) regionalHour += 24;
        if (regionalHour >= 24) regionalHour -= 24;
        return String(regionalHour).padStart(2, '0') + ':00';
    }
    
    // Determine current data time and next update time
    let currentDataTime, nextUpdateTime;
    
    if (dataPeriod) {
        // dataPeriod is like "00:00 UTC" or "12:00 UTC"
        const utcHour = dataPeriod.startsWith('00') ? 0 : 12;
        currentDataTime = utcToRegional(utcHour);
        
        // Next update is the other refresh time
        const nextUtcHour = utcHour === 0 ? 12 : 0;
        nextUpdateTime = utcToRegional(nextUtcHour);
    } else if (isoString) {
        // Parse from ISO string
        const date = new Date(isoString);
        const utcHour = date.getUTCHours();
        
        // Find which refresh period this belongs to
        const periodUtcHour = utcHour < 12 ? 0 : 12;
        currentDataTime = utcToRegional(periodUtcHour);
        
        const nextUtcHour = periodUtcHour === 0 ? 12 : 0;
        nextUpdateTime = utcToRegional(nextUtcHour);
    } else {
        currentDataTime = '--:--';
        nextUpdateTime = '--:--';
    }
    
    // Display with timezone abbreviation
    el.textContent = `${currentDataTime} ${tz.abbrev}`;
    if (nextEl) {
        nextEl.textContent = `${nextUpdateTime} ${tz.abbrev}`;
    }
}

function renderChart() {
    const chartArea = document.getElementById('chart-area');
    const marketLine = document.getElementById('market-line');
    
    // Clear existing coins and segment lines
    chartArea.querySelectorAll('.coin-dot, .coin-watching, .segment-line').forEach(el => el.remove());
    
    // Get market change for selected period
    const marketChange = state.period === 7 ? state.marketChange7d : 
                         state.period === 90 ? state.marketChange90d : 
                         state.marketChange30d;
    
    // Calculate relative changes (coin vs market) and find max spread
    let maxSpread = 5; // Minimum spread of 5%
    const coinRelativeChanges = [];
    
    state.userCoins.forEach(coin => {
        const data = state.coinData[coin.id];
        if (!data) return;
        
        const change = state.period === 7 ? data.change7d : 
                       state.period === 90 ? data.change90d : 
                       data.change30d;
        
        const relativeChange = change - marketChange;
        coinRelativeChanges.push({ coin, relativeChange, absoluteChange: change });
        
        // Track max spread from market (0)
        maxSpread = Math.max(maxSpread, Math.abs(relativeChange));
    });
    
    // Also factor in segment spreads for axis range
    Object.keys(SEGMENTS).forEach(segKey => {
        const segData = state.segmentChanges[segKey];
        if (segData) {
            const segChange = state.period === 7 ? segData.change7d : 
                             state.period === 90 ? segData.change90d : 
                             segData.change30d;
            const segRelative = segChange - marketChange;
            maxSpread = Math.max(maxSpread, Math.abs(segRelative));
        }
    });
    
    // Round up to nearest 5% for clean axis labels
    const axisRange = Math.ceil(maxSpread / 5) * 5;
    
    // Update x-axis labels dynamically
    updateXAxisLabels(axisRange);
    
    // Position market line at center (0% relative = 50% position)
    marketLine.style.left = '50%';
    
    // Update market label with absolute value and color
    const marketLabel = marketLine.querySelector('.market-label');
    marketLabel.textContent = `MARKET ${marketChange >= 0 ? '+' : ''}${marketChange.toFixed(0)}%`;
    marketLabel.classList.toggle('negative', marketChange < 0);
    
    // Update Y-axis segment changes
    renderSegmentChanges();
    
    // Render segment indicator lines (from center to segment's relative position)
    renderSegmentLines(chartArea, marketChange, axisRange);
    
    // Render each coin at relative position
    coinRelativeChanges.forEach(({ coin, relativeChange, absoluteChange }) => {
        const data = state.coinData[coin.id];
        const segment = SEGMENTS[coin.segment];
        if (!segment) return;
        
        const x = relativePercentToX(relativeChange, axisRange);
        const y = segmentToY(segment.row);
        
        if (coin.weight === 'watching') {
            // Text only for watching
            const el = document.createElement('div');
            el.className = 'coin-watching';
            el.textContent = coin.symbol;
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            el.onclick = () => openEditCoinModal(coin);
            chartArea.appendChild(el);
        } else {
            // Dot for holdings
            const el = document.createElement('div');
            const isOutperforming = relativeChange > 0;
            el.className = `coin-dot ${coin.weight} ${isOutperforming ? 'outperforming' : 'underperforming'}`;
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            el.innerHTML = `<span class="coin-symbol">${coin.symbol}</span>`;
            el.title = `${coin.name}: ${absoluteChange >= 0 ? '+' : ''}${absoluteChange.toFixed(1)}% (${relativeChange >= 0 ? '+' : ''}${relativeChange.toFixed(1)}% vs market)`;
            el.onclick = () => openEditCoinModal(coin);
            chartArea.appendChild(el);
        }
    });
    
    // Also render watching coins without data
    state.userCoins.filter(c => c.weight === 'watching' && !coinRelativeChanges.find(r => r.coin.id === c.id)).forEach(coin => {
        const segment = SEGMENTS[coin.segment];
        if (!segment) return;
        
        const x = 50; // Center (at market)
        const y = segmentToY(segment.row);
        
        const el = document.createElement('div');
        el.className = 'coin-watching';
        el.textContent = coin.symbol;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.onclick = () => openEditCoinModal(coin);
        chartArea.appendChild(el);
    });
}

function updateXAxisLabels(axisRange) {
    const xAxis = document.querySelector('.x-axis');
    if (!xAxis) return;
    
    // Clear existing labels
    xAxis.innerHTML = '';
    
    // Create 5 labels: -range, -half, 0, +half, +range
    const labels = [
        { value: -axisRange, text: `${-axisRange}%` },
        { value: -axisRange / 2, text: `${-axisRange / 2}%` },
        { value: 0, text: '0%' },
        { value: axisRange / 2, text: `+${axisRange / 2}%` },
        { value: axisRange, text: `+${axisRange}%` }
    ];
    
    labels.forEach(label => {
        const span = document.createElement('span');
        span.className = 'x-label';
        span.textContent = label.text;
        xAxis.appendChild(span);
    });
}

function relativePercentToX(relativePct, axisRange) {
    // Map -axisRange to +axisRange onto 0-100% of chart width
    // -axisRange = 0%, 0 = 50%, +axisRange = 100%
    const x = ((relativePct + axisRange) / (2 * axisRange)) * 100;
    return Math.max(2, Math.min(98, x));
}

function renderSegmentChanges() {
    const yLabels = document.querySelectorAll('.y-label');
    
    yLabels.forEach(label => {
        const segKey = label.dataset.segment;
        const segData = state.segmentChanges[segKey];
        
        // Remove existing change indicator
        const existing = label.querySelector('.segment-change');
        if (existing) existing.remove();
        
        // Always show segment change (even if 0)
        const change = segData ? (state.period === 7 ? segData.change7d : 
                       state.period === 90 ? segData.change90d : 
                       segData.change30d) : 0;
        
        const changeEl = document.createElement('span');
        changeEl.className = `segment-change ${change >= 0 ? 'positive' : 'negative'}`;
        changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        label.appendChild(changeEl);
    });
}

function segmentToY(row) {
    // 7 rows, evenly distributed
    const rowHeight = 100 / 7;
    return (row * rowHeight) + (rowHeight / 2);
}

// Render segment indicator lines from center (market) to segment's relative position
function renderSegmentLines(chartArea, marketChange, axisRange) {
    Object.keys(SEGMENTS).forEach(segKey => {
        const segment = SEGMENTS[segKey];
        const segData = state.segmentChanges[segKey];
        
        if (!segData) return;
        
        // Get segment change for current period
        const segChange = state.period === 7 ? segData.change7d : 
                         state.period === 90 ? segData.change90d : 
                         segData.change30d;
        
        // Calculate relative to market
        const relativeChange = segChange - marketChange;
        
        // Skip if essentially at market (within 0.5%)
        if (Math.abs(relativeChange) < 0.5) return;
        
        const y = segmentToY(segment.row);
        const endX = relativePercentToX(relativeChange, axisRange);
        const startX = 50; // Center (market = 0%)
        
        // Determine color: teal if outperforming, gold if underperforming
        const isOutperforming = relativeChange > 0;
        const color = isOutperforming ? 'var(--teal)' : 'var(--gold)';
        
        // Create the line element
        const lineEl = document.createElement('div');
        lineEl.className = `segment-line ${isOutperforming ? 'outperforming' : 'underperforming'}`;
        
        // Position and size the line
        const leftX = Math.min(startX, endX);
        const width = Math.abs(endX - startX);
        
        lineEl.style.left = `${leftX}%`;
        lineEl.style.top = `${y}%`;
        lineEl.style.width = `${width}%`;
        lineEl.style.backgroundColor = color;
        
        // Create the dot at the end
        const dotEl = document.createElement('div');
        dotEl.className = 'segment-dot';
        dotEl.style.backgroundColor = color;
        
        // Position dot at the segment's end (not center)
        if (isOutperforming) {
            dotEl.style.right = '-4px'; // Dot on right end
        } else {
            dotEl.style.left = '-4px'; // Dot on left end
        }
        
        lineEl.appendChild(dotEl);
        chartArea.appendChild(lineEl);
    });
}

function renderPortfolioRead() {
    const container = document.getElementById('portfolio-read-content');
    const analysis = generatePortfolioAnalysis();
    container.innerHTML = `<p>${analysis}</p>`;
}

function generatePortfolioAnalysis() {
    if (state.userCoins.length === 0) return '';
    
    const holdings = state.userCoins.filter(c => c.weight !== 'watching');
    const watching = state.userCoins.filter(c => c.weight === 'watching');
    
    if (holdings.length === 0) {
        return `You're watching ${watching.length} coin${watching.length > 1 ? 's' : ''} but haven't added any holdings yet. Add your positions to see personalized portfolio insights.`;
    }
    
    // Get market reference for selected period
    const marketRef = state.period === 7 ? state.marketChange7d : 
                      state.period === 90 ? state.marketChange90d : 
                      state.marketChange30d;
    
    const periodLabel = state.period === 7 ? 'week' : state.period === 90 ? 'quarter' : 'month';
    
    // Segment breakdown
    const segmentCounts = {};
    holdings.forEach(c => {
        segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1;
    });
    
    const topSegment = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])[0];
    const topSegmentLabel = SEGMENTS[topSegment[0]]?.label || topSegment[0];
    
    // Performance analysis
    let outperformers = 0;
    let underperformers = 0;
    
    holdings.forEach(coin => {
        const data = state.coinData[coin.id];
        if (!data) return;
        const change = state.period === 7 ? data.change7d : 
                       state.period === 90 ? data.change90d : 
                       data.change30d;
        if (change > marketRef) outperformers++;
        else underperformers++;
    });
    
    // Core holdings
    const coreCoins = holdings.filter(c => c.weight === 'core');
    let coreText = '';
    if (coreCoins.length > 0) {
        const coreNames = coreCoins.map(c => c.symbol).join(', ');
        const corePerf = coreCoins.map(c => {
            const data = state.coinData[c.id];
            return data ? (state.period === 7 ? data.change7d : 
                          state.period === 90 ? data.change90d : 
                          data.change30d) : 0;
        });
        const avgCorePerf = corePerf.reduce((a, b) => a + b, 0) / corePerf.length;
        const coreVsMarket = avgCorePerf > marketRef ? 'outperforming' : 'underperforming';
        coreText = `Your core position${coreCoins.length > 1 ? 's' : ''} (${coreNames}) ${coreCoins.length > 1 ? 'are' : 'is'} ${coreVsMarket} the market. `;
    }
    
    // Build narrative
    let analysis = '';
    
    if (holdings.length === 1) {
        const coin = holdings[0];
        const data = state.coinData[coin.id];
        const change = data ? (state.period === 7 ? data.change7d : 
                              state.period === 90 ? data.change90d : 
                              data.change30d) : 0;
        const vsMarket = change > marketRef ? 'outperforming' : 'underperforming';
        analysis = `Your ${WEIGHTS[coin.weight].label.toLowerCase()} position in ${coin.name} is ${vsMarket} the market (${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs market ${marketRef >= 0 ? '+' : ''}${marketRef.toFixed(1)}%).`;
    } else {
        analysis = `Your portfolio is weighted toward ${topSegmentLabel} (${topSegment[1]} of ${holdings.length} holdings). ${coreText}`;
        
        if (outperformers > underperformers) {
            analysis += `Overall, ${outperformers} of ${holdings.length} positions are beating the market this ${periodLabel}.`;
        } else if (underperformers > outperformers) {
            analysis += `${underperformers} of ${holdings.length} positions are trailing the market — worth reviewing your thesis on underperformers.`;
        } else {
            analysis += `Your holdings are split evenly between outperformers and underperformers relative to market.`;
        }
    }
    
    if (watching.length > 0) {
        const watchNames = watching.slice(0, 3).map(c => c.symbol).join(', ');
        analysis += ` You're also watching ${watchNames}${watching.length > 3 ? ` and ${watching.length - 3} more` : ''}.`;
    }
    
    return analysis;
}

function renderCoinsList() {
    const container = document.getElementById('coins-list');
    const marketRef = state.period === 7 ? state.marketChange7d : 
                      state.period === 90 ? state.marketChange90d : 
                      state.marketChange30d;
    
    // Sort: Core first, then by market cap
    const sorted = [...state.userCoins].sort((a, b) => {
        const pa = WEIGHTS[a.weight]?.priority || 5;
        const pb = WEIGHTS[b.weight]?.priority || 5;
        if (pa !== pb) return pa - pb;
        
        const mcA = state.coinData[a.id]?.marketCap || 0;
        const mcB = state.coinData[b.id]?.marketCap || 0;
        return mcB - mcA;
    });
    
    container.innerHTML = sorted.map(coin => {
        const data = state.coinData[coin.id];
        const change = data ? (state.period === 7 ? data.change7d : 
                              state.period === 90 ? data.change90d : 
                              data.change30d) : 0;
        const vsMarket = change - marketRef;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const weightLabel = WEIGHTS[coin.weight]?.label || coin.weight;
        const segmentLabel = SEGMENTS[coin.segment]?.label || coin.segment;
        
        return `
            <div class="coin-card" data-coin-id="${coin.id}">
                <div class="coin-icon">
                    ${data?.image ? `<img src="${data.image}" alt="${coin.symbol}">` : ''}
                </div>
                <div class="coin-info">
                    <span class="coin-name">${coin.symbol} · ${coin.name}</span>
                    <span class="coin-meta">${weightLabel} · ${segmentLabel}</span>
                </div>
                <div class="coin-performance">
                    <span class="coin-change ${changeClass}">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</span>
                    <span class="coin-vs-market">${vsMarket >= 0 ? '+' : ''}${vsMarket.toFixed(1)}% vs market</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.coin-card').forEach(card => {
        card.onclick = () => {
            const coinId = card.dataset.coinId;
            const coin = state.userCoins.find(c => c.id === coinId);
            if (coin) openEditCoinModal(coin);
        };
    });
}

function updateCoinCount() {
    const max = CONFIG.isPro ? CONFIG.maxCoinsPro : CONFIG.maxCoinsFree;
    document.getElementById('coin-count').textContent = `${state.userCoins.length} / ${max}`;
    document.getElementById('selected-count').textContent = `(${state.userCoins.length}/${max})`;
}

// ===== Settings Modal =====
function renderAvailableCoins(filter = '') {
    const container = document.getElementById('available-coins');
    const max = CONFIG.isPro ? CONFIG.maxCoinsPro : CONFIG.maxCoinsFree;
    const atLimit = state.userCoins.length >= max;
    
    const filtered = filter 
        ? state.availableCoins.filter(c => 
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.symbol.toLowerCase().includes(filter.toLowerCase())
          )
        : state.availableCoins;
    
    container.innerHTML = filtered.map(coin => {
        const isSelected = state.userCoins.some(c => c.id === coin.id);
        const disabled = !isSelected && atLimit;
        
        return `
            <button class="coin-option ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}" 
                    data-coin-id="${coin.id}"
                    ${disabled ? 'disabled' : ''}>
                ${coin.image ? `<img src="${coin.image}" alt="${coin.symbol}" onerror="this.style.display='none'">` : ''}
                <span>${coin.symbol}</span>
            </button>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.coin-option:not(.disabled)').forEach(btn => {
        btn.onclick = () => toggleCoinSelection(btn.dataset.coinId);
    });
}

function renderSelectedCoins() {
    const container = document.getElementById('selected-list');
    
    if (state.userCoins.length === 0) {
        container.innerHTML = '<p class="empty-selected">No coins selected</p>';
        return;
    }
    
    container.innerHTML = state.userCoins.map(coin => `
        <span class="selected-chip" data-coin-id="${coin.id}">
            ${coin.symbol}
            <span class="remove">&times;</span>
        </span>
    `).join('');
    
    // Click to remove
    container.querySelectorAll('.selected-chip').forEach(chip => {
        chip.onclick = () => {
            removeCoin(chip.dataset.coinId);
            renderSelectedCoins();
            renderAvailableCoins(document.getElementById('coin-search').value);
            updateCoinCount();
        };
    });
}

function toggleCoinSelection(coinId) {
    const existing = state.userCoins.findIndex(c => c.id === coinId);
    
    if (existing >= 0) {
        // Remove
        state.userCoins.splice(existing, 1);
    } else {
        // Add with defaults
        const coinData = state.availableCoins.find(c => c.id === coinId);
        if (!coinData) return;
        
        const defaultSegment = DEFAULT_SEGMENTS[coinId] || 'infrastructure';
        
        state.userCoins.push({
            id: coinId,
            symbol: coinData.symbol,
            name: coinData.name,
            weight: 'moderate',
            segment: defaultSegment
        });
    }
    
    renderSelectedCoins();
    renderAvailableCoins(document.getElementById('coin-search').value);
    updateCoinCount();
}

function removeCoin(coinId) {
    const idx = state.userCoins.findIndex(c => c.id === coinId);
    if (idx >= 0) {
        state.userCoins.splice(idx, 1);
    }
}

// ===== Edit Coin Modal =====
function openEditCoinModal(coin) {
    state.editingCoin = coin;
    
    document.getElementById('edit-coin-name').textContent = `${coin.symbol} · ${coin.name}`;
    
    // Set active weight
    document.querySelectorAll('#weight-options .weight-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.weight === coin.weight);
    });
    
    // Set active segment
    document.querySelectorAll('#segment-options .segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.segment === coin.segment);
    });
    
    document.getElementById('edit-coin-modal').classList.add('active');
}

function closeEditCoinModal() {
    state.editingCoin = null;
    document.getElementById('edit-coin-modal').classList.remove('active');
}

function saveEditCoin() {
    if (!state.editingCoin) return;
    
    const weight = document.querySelector('#weight-options .weight-btn.active')?.dataset.weight;
    const segment = document.querySelector('#segment-options .segment-btn.active')?.dataset.segment;
    
    if (weight) state.editingCoin.weight = weight;
    if (segment) state.editingCoin.segment = segment;
    
    saveUserCoins();
    closeEditCoinModal();
    render();
}

function removeEditCoin() {
    if (!state.editingCoin) return;
    
    removeCoin(state.editingCoin.id);
    saveUserCoins();
    closeEditCoinModal();
    render();
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Open settings (from user menu)
    const openSettingsBtn = document.getElementById('open-settings');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            // Close user menu if open
            const userMenu = document.getElementById('user-menu');
            if (userMenu) userMenu.classList.remove('active');
            
            // Load current region
            loadRegionSelection();
            
            renderSelectedCoins();
            renderAvailableCoins();
            document.getElementById('settings-modal').classList.add('active');
        });
    }
    
    // Open settings from empty state
    const emptyAddBtn = document.getElementById('empty-add-coins');
    if (emptyAddBtn) {
        emptyAddBtn.onclick = () => {
            // Load current region
            loadRegionSelection();
            
            renderSelectedCoins();
            renderAvailableCoins();
            document.getElementById('settings-modal').classList.add('active');
        };
    }
    
    // Close settings
    const closeSettingsBtn = document.getElementById('close-settings');
    if (closeSettingsBtn) {
        closeSettingsBtn.onclick = () => {
            document.getElementById('settings-modal').classList.remove('active');
        };
    }
    
    const cancelSettingsBtn = document.getElementById('cancel-settings');
    if (cancelSettingsBtn) {
        cancelSettingsBtn.onclick = () => {
            // Reload from storage (discard changes)
            loadUserCoins();
            document.getElementById('settings-modal').classList.remove('active');
        };
    }
    
    // Save settings
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = async () => {
            saveUserCoins();
            
            // Save region
            if (typeof userSync !== 'undefined') {
                await userSync.saveRegion(state.region);
            } else {
                localStorage.setItem('litmus_region', state.region);
            }
            
            document.getElementById('settings-modal').classList.remove('active');
            render();
        };
    }
    
    // Search
    const coinSearch = document.getElementById('coin-search');
    if (coinSearch) {
        coinSearch.oninput = (e) => {
            renderAvailableCoins(e.target.value);
        };
    }
    
    // Edit coin modal
    document.getElementById('close-edit-coin').onclick = closeEditCoinModal;
    document.getElementById('save-coin-edit').onclick = saveEditCoin;
    document.getElementById('remove-coin').onclick = removeEditCoin;
    
    // Weight buttons
    document.querySelectorAll('#weight-options .weight-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#weight-options .weight-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    
    // Segment buttons
    document.querySelectorAll('#segment-options .segment-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#segment-options .segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    
    // Region buttons
    document.querySelectorAll('#region-options .region-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#region-options .region-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.region = btn.dataset.region;
        };
    });
    
    // Period selector
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.period = parseInt(btn.dataset.period);
            render();
        };
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        };
    });
}
