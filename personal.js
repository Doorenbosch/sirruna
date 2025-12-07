/**
 * Personal Edition - The Landscape
 * Your portfolio mapped against market performance
 */

// ===== Configuration =====
const CONFIG = {
    maxCoinsFree: 5,
    maxCoinsPro: 10,
    isPro: false, // TODO: integrate with auth
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
    editingCoin: null
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
        if (ethPrice) ethPrice.textContent = eth.price ? `$${eth.price.toFixed(0)}` : '---';
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

// ===== LocalStorage =====
function loadUserCoins() {
    try {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
            state.userCoins = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load saved coins:', e);
    }
}

function saveUserCoins() {
    try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.userCoins));
    } catch (e) {
        console.error('Failed to save coins:', e);
    }
}

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
    // Get IDs of user's coins only (to minimize API calls)
    const userCoinIds = state.userCoins.map(c => c.id);
    if (userCoinIds.length === 0) {
        // Fetch top 10 for market reference
        userCoinIds.push('bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana');
    }
    
    // Always include top coins for market calculation
    const idsToFetch = [...new Set([...userCoinIds, 'bitcoin', 'ethereum', 'solana', 'binancecoin', 'cardano'])];
    
    try {
        const response = await fetch(
            `${CONFIG.coingeckoApi}/coins/markets?vs_currency=usd&ids=${idsToFetch.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=7d,30d`
        );
        
        if (!response.ok) throw new Error('API request failed');
        
        const coins = await response.json();
        
        coins.forEach(c => {
            const existing = state.coinData[c.id];
            if (existing) {
                existing.price = c.current_price;
                existing.marketCap = c.market_cap;
                existing.change7d = c.price_change_percentage_7d_in_currency || 0;
                existing.change30d = c.price_change_percentage_30d_in_currency || 0;
                // Estimate 90d from 30d (roughly 3x with dampening)
                existing.change90d = (c.price_change_percentage_30d_in_currency || 0) * 2.2;
            }
        });
        
        // Calculate market average from top coins
        const btc = state.coinData['bitcoin'];
        const eth = state.coinData['ethereum'];
        if (btc && eth) {
            state.marketChange7d = ((btc.change7d || 0) + (eth.change7d || 0)) / 2;
            state.marketChange30d = ((btc.change30d || 0) + (eth.change30d || 0)) / 2;
            state.marketChange90d = ((btc.change90d || 0) + (eth.change90d || 0)) / 2;
        }
        
        // Calculate segment averages
        calculateSegmentChanges();
        
        // Update sticky header prices
        updateStickyPrices();
        
    } catch (e) {
        console.error('Failed to fetch price data:', e);
        state.marketChange7d = 2;
        state.marketChange30d = 5;
        state.marketChange90d = 12;
    }
}

function calculateSegmentChanges() {
    // Group coins by segment and calculate average change
    state.segmentChanges = {};
    
    Object.keys(SEGMENTS).forEach(segKey => {
        const coinsInSegment = state.userCoins.filter(c => c.segment === segKey);
        if (coinsInSegment.length === 0) {
            state.segmentChanges[segKey] = null;
            return;
        }
        
        let total7d = 0, total30d = 0, total90d = 0, count = 0;
        coinsInSegment.forEach(coin => {
            const data = state.coinData[coin.id];
            if (data) {
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
    }
    
    updateCoinCount();
}

function renderChart() {
    const chartArea = document.getElementById('chart-area');
    const marketLine = document.getElementById('market-line');
    
    // Clear existing coins
    chartArea.querySelectorAll('.coin-dot, .coin-watching').forEach(el => el.remove());
    
    // Get market change for selected period
    const marketChange = state.period === 7 ? state.marketChange7d : 
                         state.period === 90 ? state.marketChange90d : 
                         state.marketChange30d;
    
    // Position market line
    const marketX = percentToX(marketChange);
    marketLine.style.left = `${marketX}%`;
    
    // Update market label with value
    const marketLabel = marketLine.querySelector('.market-label');
    marketLabel.textContent = `MARKET ${marketChange >= 0 ? '+' : ''}${marketChange.toFixed(0)}%`;
    
    // Update Y-axis segment changes
    renderSegmentChanges();
    
    // Render each coin
    state.userCoins.forEach(coin => {
        const data = state.coinData[coin.id];
        const segment = SEGMENTS[coin.segment];
        if (!segment) return;
        
        // For watching coins, render even without price data
        const change = data ? (state.period === 7 ? data.change7d : 
                       state.period === 90 ? data.change90d : 
                       data.change30d) : 0;
        
        const x = percentToX(change);
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
            // Dot for holdings - need data
            if (!data) return;
            
            const el = document.createElement('div');
            const isOutperforming = change > marketChange;
            el.className = `coin-dot ${coin.weight} ${isOutperforming ? 'outperforming' : 'underperforming'}`;
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            el.innerHTML = `<span class="coin-symbol">${coin.symbol}</span>`;
            el.title = `${coin.name}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
            el.onclick = () => openEditCoinModal(coin);
            chartArea.appendChild(el);
        }
    });
}

function renderSegmentChanges() {
    const yLabels = document.querySelectorAll('.y-label');
    
    yLabels.forEach(label => {
        const segKey = label.dataset.segment;
        const segData = state.segmentChanges[segKey];
        
        // Remove existing change indicator
        const existing = label.querySelector('.segment-change');
        if (existing) existing.remove();
        
        if (segData) {
            const change = state.period === 7 ? segData.change7d : 
                           state.period === 90 ? segData.change90d : 
                           segData.change30d;
            
            const changeEl = document.createElement('span');
            changeEl.className = `segment-change ${change >= 0 ? 'positive' : 'negative'}`;
            changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
            label.appendChild(changeEl);
        }
    });
}

function percentToX(pct) {
    // Map -20% to +40% onto 0-100% of chart width
    // -20 = 0%, 0 = 33%, +20 = 66%, +40 = 100%
    const min = -20;
    const max = 40;
    const x = ((pct - min) / (max - min)) * 100;
    return Math.max(2, Math.min(98, x));
}

function segmentToY(row) {
    // 7 rows, evenly distributed
    const rowHeight = 100 / 7;
    return (row * rowHeight) + (rowHeight / 2);
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
    // Open settings
    document.getElementById('open-settings').onclick = () => {
        renderSelectedCoins();
        renderAvailableCoins();
        document.getElementById('settings-modal').classList.add('active');
    };
    
    document.getElementById('empty-add-coins').onclick = () => {
        renderSelectedCoins();
        renderAvailableCoins();
        document.getElementById('settings-modal').classList.add('active');
    };
    
    // Close settings
    document.getElementById('close-settings').onclick = () => {
        document.getElementById('settings-modal').classList.remove('active');
    };
    
    document.getElementById('cancel-settings').onclick = () => {
        // Reload from storage (discard changes)
        loadUserCoins();
        document.getElementById('settings-modal').classList.remove('active');
    };
    
    // Save settings
    document.getElementById('save-settings').onclick = () => {
        saveUserCoins();
        document.getElementById('settings-modal').classList.remove('active');
        render();
    };
    
    // Search
    document.getElementById('coin-search').oninput = (e) => {
        renderAvailableCoins(e.target.value);
    };
    
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
