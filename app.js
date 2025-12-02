// The Litmus - App Logic

// Configuration
const CONFIG = {
    contentPath: './content',
    defaultRegion: 'americas',
    refreshInterval: 300000 // 5 minutes
};

// State
let currentRegion = CONFIG.defaultRegion;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initRegionSelector();
    loadContent(currentRegion);
    startAutoRefresh();
});

// Region Selector
function initRegionSelector() {
    const buttons = document.querySelectorAll('.region-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const region = btn.dataset.region;
            
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load new content
            currentRegion = region;
            loadContent(region);
        });
    });
}

// Load Content
async function loadContent(region) {
    const briefContainer = document.querySelector('.brief-content');
    const weekContainer = document.querySelector('.week-content');
    
    // Add loading state
    briefContainer?.classList.add('loading');
    weekContainer?.classList.add('loading');
    
    try {
        // Load morning brief
        const morningData = await fetchJSON(`${CONFIG.contentPath}/${region}/morning.json`);
        if (morningData) {
            renderMorningBrief(morningData);
        }
        
        // Load week ahead (optional - may not exist for all regions)
        try {
            const weekData = await fetchJSON(`${CONFIG.contentPath}/${region}/week-ahead.json`);
            if (weekData) {
                renderWeekAhead(weekData);
            }
        } catch (e) {
            // Week ahead is optional
            console.log('Week ahead data not available');
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        showError('Unable to load latest intelligence. Please refresh.');
    } finally {
        // Remove loading state
        briefContainer?.classList.remove('loading');
        weekContainer?.classList.remove('loading');
    }
}

// Fetch JSON helper
async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Render Morning Brief
function renderMorningBrief(data) {
    // Update headline
    const headline = document.getElementById('brief-headline');
    if (headline && data.headline) {
        headline.textContent = data.headline;
    }
    
    // Update timestamp
    const timestamp = document.getElementById('brief-timestamp');
    if (timestamp && data.generated_at) {
        timestamp.textContent = formatTime(data.generated_at);
    }
    
    // Update date
    const dateEl = document.getElementById('brief-date');
    if (dateEl && data.generated_at) {
        dateEl.textContent = formatDate(data.generated_at);
    }
    
    // Update sections
    if (data.sections) {
        updateSection('section-overnight', data.sections.overnight);
        updateSection('section-setup', data.sections.the_setup);
        updateSection('section-matters', data.sections.what_matters);
        updateSection('section-take', data.sections.the_take);
    }
    
    // Update market data
    if (data.btc_price) {
        const btcPrice = document.getElementById('btc-price');
        if (btcPrice) {
            btcPrice.textContent = formatPrice(data.btc_price);
        }
    }
    
    if (data.total_market_cap) {
        const marketCap = document.getElementById('total-market');
        if (marketCap) {
            marketCap.textContent = formatMarketCap(data.total_market_cap);
        }
    }
}

// Render Week Ahead
function renderWeekAhead(data) {
    if (data.sections) {
        updateSection('week-fulcrum', data.sections.fulcrum);
        updateSection('week-levels', data.sections.levels);
        updateSection('week-unpriced', data.sections.unpriced);
    }
}

// Update section helper
function updateSection(id, content) {
    const element = document.getElementById(id);
    if (element && content) {
        element.textContent = content;
    }
}

// Format helpers
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
    });
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

function formatMarketCap(cap) {
    if (cap >= 1e12) {
        return `$${(cap / 1e12).toFixed(1)}T`;
    }
    if (cap >= 1e9) {
        return `$${(cap / 1e9).toFixed(0)}B`;
    }
    return `$${cap}`;
}

// Error display
function showError(message) {
    // Could enhance this with a proper toast/notification
    console.error(message);
}

// Auto-refresh
function startAutoRefresh() {
    setInterval(() => {
        loadContent(currentRegion);
    }, CONFIG.refreshInterval);
}
