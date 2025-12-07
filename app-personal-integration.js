/**
 * YOUR COINS VS MARKET - Personal Edition Integration
 * 
 * Replace the existing loadUserCoins() and loadYourCoins() functions in app.js
 * with these updated versions that read from Personal Edition storage.
 * 
 * Also add: <script src="personal-coins-reader.js"></script> to index.html
 * before app.js
 */

// ========== UPDATED: Load user coins from Personal Edition ==========
function loadUserCoins() {
    // Try to load from Personal Edition first
    if (window.personalCoins && window.personalCoins.hasCoins()) {
        const holdings = window.personalCoins.getHoldings();
        userCoins = holdings.map(c => c.id);
    } else {
        // Fallback to old storage for backwards compatibility
        const saved = localStorage.getItem('litmus_user_coins');
        if (saved) {
            try {
                userCoins = JSON.parse(saved);
            } catch (e) {
                userCoins = [];
            }
        }
    }
}

// ========== UPDATED: Load and display user's coins (24h) ==========
async function loadYourCoins() {
    try {
        // Load from Personal Edition
        let personalHoldings = [];
        if (window.personalCoins && window.personalCoins.hasCoins()) {
            personalHoldings = window.personalCoins.getHoldings();
        }
        
        // Always include BTC and ETH as baseline
        const baseCoinIds = ['bitcoin', 'ethereum'];
        const personalCoinIds = personalHoldings.map(c => c.id);
        const allCoinIds = [...new Set([...baseCoinIds, ...personalCoinIds])];
        
        const coinIds = allCoinIds.join(',');
        const coinsResponse = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`);
        
        // Fetch market data for baseline
        const globalResponse = await fetch('https://api.coingecko.com/api/v3/global');
        
        if (!coinsResponse.ok) return;
        
        const coins = await coinsResponse.json();
        
        // Sort: BTC first, ETH second, then user's coins by their order
        const sortedCoins = coins.sort((a, b) => {
            if (a.id === 'bitcoin') return -1;
            if (b.id === 'bitcoin') return 1;
            if (a.id === 'ethereum') return -1;
            if (b.id === 'ethereum') return 1;
            
            // Personal coins in their original order
            const aIndex = personalCoinIds.indexOf(a.id);
            const bIndex = personalCoinIds.indexOf(b.id);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            
            return (a.market_cap_rank || 999) - (b.market_cap_rank || 999);
        });
        
        // Get market 24h change
        let marketChange = 0;
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            marketChange = globalData.data?.market_cap_change_percentage_24h_usd || 0;
        }
        
        renderRelativePerformance(sortedCoins, marketChange);
        
        // Show link to Personal Edition if no personal coins
        if (personalHoldings.length === 0) {
            showPersonalEditionPrompt();
        }
        
    } catch (error) {
        console.error('Error loading your coins:', error);
    }
}

// Show prompt to set up Personal Edition
function showPersonalEditionPrompt() {
    const container = document.getElementById('relative-performance');
    if (!container) return;
    
    const existingPrompt = container.querySelector('.personal-prompt');
    if (existingPrompt) return;
    
    const prompt = document.createElement('div');
    prompt.className = 'personal-prompt';
    prompt.innerHTML = `
        <p style="font-family: var(--sans); font-size: 0.8rem; color: var(--ink-tertiary); margin-top: var(--md); text-align: center;">
            <a href="personal.html" style="color: var(--teal);">Set up your coins</a> in Personal Edition to track your holdings vs market
        </p>
    `;
    container.appendChild(prompt);
}
