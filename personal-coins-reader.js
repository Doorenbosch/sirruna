/**
 * Personal Coins Reader
 * Reads user's coins from Personal Edition localStorage
 * Include this in index.html and weekend.html to use personal coins in "Your Coins vs Market"
 */

const PERSONAL_STORAGE_KEY = 'litmus_personal_coins';

function getPersonalCoins() {
    try {
        const saved = localStorage.getItem(PERSONAL_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load personal coins:', e);
    }
    return [];
}

function getPersonalCoinIds() {
    const coins = getPersonalCoins();
    return coins.map(c => c.id);
}

function getPersonalCoinSymbols() {
    const coins = getPersonalCoins();
    return coins.map(c => c.symbol);
}

function hasPersonalCoins() {
    return getPersonalCoins().length > 0;
}

// Get holdings only (exclude watching)
function getPersonalHoldings() {
    return getPersonalCoins().filter(c => c.weight !== 'watching');
}

// Get coin IDs for API calls
function getPersonalHoldingIds() {
    return getPersonalHoldings().map(c => c.id);
}

// Export for use in other scripts
window.personalCoins = {
    getCoins: getPersonalCoins,
    getIds: getPersonalCoinIds,
    getSymbols: getPersonalCoinSymbols,
    hasCoins: hasPersonalCoins,
    getHoldings: getPersonalHoldings,
    getHoldingIds: getPersonalHoldingIds
};

/**
 * Usage in app.js or weekend.js:
 * 
 * // Check if user has personal coins
 * if (window.personalCoins && window.personalCoins.hasCoins()) {
 *     const holdings = window.personalCoins.getHoldings();
 *     const coinIds = window.personalCoins.getHoldingIds();
 *     
 *     // Fetch price data for these coins
 *     // Then render in "Your Coins vs Market" section
 * }
 */
