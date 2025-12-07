/**
 * YOUR COINS VS MARKET - Weekend Edition Integration (7D)
 * 
 * Replace the loadRelativePerformance() function in weekend.js
 * with this updated version that reads from Personal Edition storage.
 * 
 * Also add: <script src="personal-coins-reader.js"></script> to weekend.html
 * before weekend.js
 */

async function loadRelativePerformance() {
    const chartEl = document.getElementById('relative-chart-7d');
    const marketChangeEl = document.getElementById('market-7d-change');
    
    if (!chartEl) return;
    
    try {
        // Get user's coins from Personal Edition
        let personalHoldings = [];
        let personalCoinIds = ['bitcoin', 'ethereum']; // Default to BTC, ETH
        
        if (window.personalCoins && window.personalCoins.hasCoins()) {
            personalHoldings = window.personalCoins.getHoldings();
            if (personalHoldings.length > 0) {
                personalCoinIds = ['bitcoin', 'ethereum', ...personalHoldings.map(c => c.id)];
                personalCoinIds = [...new Set(personalCoinIds)]; // Dedupe
            }
        }
        
        // Fetch coin data with 7d change
        const coinIds = personalCoinIds.join(',');
        const coinsResponse = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=7d`);
        
        // Fetch global market data
        const globalResponse = await fetch('https://api.coingecko.com/api/v3/global');
        
        if (!coinsResponse.ok) return;
        
        const coins = await coinsResponse.json();
        
        // Calculate market 7d change from BTC + ETH average
        const btc = coins.find(c => c.id === 'bitcoin');
        const eth = coins.find(c => c.id === 'ethereum');
        const marketChange = ((btc?.price_change_percentage_7d_in_currency || 0) + 
                              (eth?.price_change_percentage_7d_in_currency || 0)) / 2;
        
        // Update market baseline
        if (marketChangeEl) {
            const sign = marketChange >= 0 ? '+' : '';
            marketChangeEl.textContent = `${sign}${marketChange.toFixed(1)}%`;
        }
        
        // Clear existing coin rows (keep market row)
        const existingRows = chartEl.querySelectorAll('.relative-row:not(.market-row)');
        existingRows.forEach(row => row.remove());
        
        // Render coin rows
        personalCoinIds.forEach(coinId => {
            const coin = coins.find(c => c.id === coinId);
            if (coin) {
                const row = createRelativeRow7d(coin, marketChange);
                chartEl.appendChild(row);
            }
        });
        
        // Show prompt if no personal coins
        if (personalHoldings.length === 0) {
            showPersonalEditionPrompt7d(chartEl);
        }
        
    } catch (error) {
        console.warn('[Weekend] Could not load relative performance:', error);
    }
}

function createRelativeRow7d(coin, marketChange) {
    const change = coin.price_change_percentage_7d_in_currency || 0;
    const relative = change - marketChange;
    const sign = change >= 0 ? '+' : '';
    const relSign = relative >= 0 ? '+' : '';
    const isOutperform = relative >= 0;
    
    // Calculate bar width (max 50% of container width for each direction)
    const barWidth = Math.min(Math.abs(relative) * 2, 50);
    
    const row = document.createElement('div');
    row.className = 'relative-row';
    row.innerHTML = `
        <span class="rel-name">${coin.symbol.toUpperCase()}</span>
        <span class="rel-change">${sign}${change.toFixed(1)}%</span>
        <div class="rel-bar-container">
            <div class="rel-baseline"></div>
            <div class="rel-bar ${isOutperform ? 'outperform' : 'underperform'}" style="width: ${barWidth}%"></div>
        </div>
        <span class="rel-vs ${isOutperform ? 'positive' : 'negative'}">${relSign}${relative.toFixed(1)}%</span>
    `;
    
    return row;
}

function showPersonalEditionPrompt7d(container) {
    const existingPrompt = container.querySelector('.personal-prompt');
    if (existingPrompt) return;
    
    const prompt = document.createElement('div');
    prompt.className = 'personal-prompt';
    prompt.style.cssText = 'font-family: var(--sans); font-size: 0.75rem; color: var(--ink-tertiary); margin-top: var(--sm); text-align: center; padding: var(--sm);';
    prompt.innerHTML = `
        <a href="personal.html" style="color: var(--teal);">Set up your coins</a> in Personal Edition
    `;
    container.parentElement.appendChild(prompt);
}
