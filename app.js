// Sirruna - Editorial App

const CONFIG = {
    contentPath: './content',
    defaultRegion: 'americas',
    breakdownAPI: '/api/breakdown',
    marketMoodAPI: '/api/market-mood',
    coinGeckoAPI: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&order=market_cap_desc&sparkline=false&price_change_percentage=24h',
    topCoinsAPI: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h',
    globalAPI: 'https://api.coingecko.com/api/v3/global',
    marketUpdateInterval: 60000 // 1 minute
};

// Default coins (always included)
const DEFAULT_COINS = ['bitcoin', 'ethereum'];
const MAX_USER_COINS = 4;

// Data store
let briefData = null;
let currentSection = 'lead';
let currentRegion = CONFIG.defaultRegion;
let currentBriefType = 'morning';

// User coins
let userCoins = [];
let allCoins = [];

// Audio player state
let audioElement = null;
let isPlaying = false;
let currentEpisode = null;

// Section definitions - Morning Brief
const SECTIONS_MORNING = {
    lead: {
        label: 'THE LEAD',
        field: 'the_lead',
        defaultHeadline: 'The Opening Take'
    },
    angle: {
        label: 'THE ANGLE',
        field: 'the_angle',
        defaultHeadline: 'What Everyone\'s Missing'
    },
    driver: {
        label: 'THE DRIVER',
        field: 'the_driver',
        defaultHeadline: 'What\'s Moving Markets'
    },
    signal: {
        label: 'THE SIGNAL',
        field: 'the_signal',
        defaultHeadline: 'The Numbers That Matter'
    }
    // THE TAKEAWAY is a separate quote box, not in the index
};

// Section definitions - Evening Brief
const SECTIONS_EVENING = {
    session: {
        label: 'THE SESSION',
        field: 'the_session',
        defaultHeadline: 'Global Crypto Today'
    },
    macro: {
        label: 'THE MACRO',
        field: 'the_macro',
        defaultHeadline: 'Finance & Politics'
    },
    region: {
        label: 'THE REGION',
        field: 'the_region',
        defaultHeadline: 'What Moved Locally'
    }
    // No takeaway in evening - it's news-wire style
};

// Get current sections based on brief type
function getCurrentSections() {
    return currentBriefType === 'evening' ? SECTIONS_EVENING : SECTIONS_MORNING;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEditionPicker();
    initBriefSelector();
    initIndexCards();
    initAudioPlayer();
    initSettings();
    initStickyHeader();
    loadUserCoins();
    
    // Check brief availability first, then load content
    checkBriefAvailability(currentRegion).then(() => {
        loadContent(currentRegion, currentBriefType);
    });
    
    loadBreakdownPodcast();
    
    // Load live market data
    loadMarketData();
    loadMarketMood();
    loadETFFlows();
    loadTheNumber();
    loadYourCoins();
    
    // Update market data every minute
    setInterval(loadMarketData, CONFIG.marketUpdateInterval);
    setInterval(loadMarketMood, CONFIG.marketUpdateInterval);
    setInterval(loadYourCoins, CONFIG.marketUpdateInterval);
});

// Listen for user data loaded from cloud (handles signed-in users)
window.addEventListener('userDataLoaded', (e) => {
    const userData = e.detail;
    if (userData?.region && userData.region !== currentRegion) {
        // Update to cloud-synced region
        currentRegion = userData.region;
        
        // Update UI
        const buttons = document.querySelectorAll('.edition');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.region === currentRegion);
        });
        updateStickyRegion();
        
        // Reload content for correct region
        checkBriefAvailability(currentRegion).then(() => {
            loadContent(currentRegion, currentBriefType);
        });
    }
    
    // Show edition badge instead of picker for logged-in users
    showEditionBadge(userData?.region || currentRegion);
});

// Edition badge display names
const editionNames = {
    americas: 'Americas · New York',
    emea: 'EMEA · London',
    apac: 'APAC · Singapore'
};

// Show edition badge (for logged-in users)
function showEditionBadge(region) {
    const picker = document.getElementById('edition-picker');
    const badge = document.getElementById('edition-badge');
    const badgeText = document.getElementById('edition-badge-text');
    
    if (picker && badge && badgeText) {
        picker.style.display = 'none';
        badge.style.display = 'flex';
        badgeText.textContent = editionNames[region] || editionNames.americas;
    }
}

// Hide edition badge (for logged-out users)
function hideEditionBadge() {
    const picker = document.getElementById('edition-picker');
    const badge = document.getElementById('edition-badge');
    
    if (picker && badge) {
        picker.style.display = 'flex';
        badge.style.display = 'none';
    }
}

// Listen for user signed out
window.addEventListener('userSignedOut', () => {
    hideEditionBadge();
});

// Initialize Sticky Header
function initStickyHeader() {
    const stickyHeader = document.getElementById('sticky-header');
    const sectionNav = document.querySelector('.section-nav');
    
    if (!stickyHeader || !sectionNav) return;
    
    // Get the bottom of section nav as threshold
    let threshold = sectionNav.offsetTop + sectionNav.offsetHeight;
    
    // Update threshold on resize
    window.addEventListener('resize', () => {
        threshold = sectionNav.offsetTop + sectionNav.offsetHeight;
    });
    
    // Show/hide on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > threshold) {
            stickyHeader.classList.add('visible');
        } else {
            stickyHeader.classList.remove('visible');
        }
    });
    
    // Update region display
    updateStickyRegion();
}

// Edition (Region) Picker
function initEditionPicker() {
    const buttons = document.querySelectorAll('.edition');
    
    // Load saved region from localStorage
    const savedRegion = localStorage.getItem('litmus_region');
    if (savedRegion && ['americas', 'emea', 'apac'].includes(savedRegion)) {
        currentRegion = savedRegion;
        // Update button active states
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.region === savedRegion);
        });
        // Update sticky header region
        updateStickyRegion();
    }
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRegion = btn.dataset.region;
            
            // Save to localStorage
            localStorage.setItem('litmus_region', currentRegion);
            
            // Track region change in GA4
            trackEvent('region_change', { region: currentRegion });
            
            // Update sticky header region
            updateStickyRegion();
            
            // Reset to morning brief when switching regions
            currentBriefType = 'morning';
            const morningTab = document.querySelector('.brief-tab[data-brief="morning"]');
            const eveningTab = document.querySelector('.brief-tab[data-brief="evening"]');
            if (morningTab) morningTab.classList.add('active');
            if (eveningTab) eveningTab.classList.remove('active');
            
            // Check availability for new region, then load content
            checkBriefAvailability(currentRegion).then(() => {
                loadContent(currentRegion, currentBriefType);
            });
        });
    });
}

// Brief Selector (Morning/Evening)
function initBriefSelector() {
    const tabs = document.querySelectorAll('.brief-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Don't allow clicking unavailable tabs
            if (tab.classList.contains('unavailable')) {
                return;
            }
            
            const briefType = tab.dataset.brief;
            
            // Track brief type change in GA4
            trackEvent('brief_type_change', { 
                brief_type: briefType,
                region: currentRegion 
            });
            
            // Update active state
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update current brief type
            currentBriefType = briefType;
            
            // Reset to first section
            currentSection = briefType === 'evening' ? 'session' : 'lead';
            
            // Rebuild index cards for new brief type
            rebuildIndexCards();
            
            // Load new content
            loadContent(currentRegion, currentBriefType);
        });
    });
}

// Check which briefs are available for a region and update tabs
async function checkBriefAvailability(region) {
    const morningTab = document.querySelector('.brief-tab[data-brief="morning"]');
    const eveningTab = document.querySelector('.brief-tab[data-brief="evening"]');
    
    let morningTimestamp = null;
    let eveningTimestamp = null;
    
    // Check morning brief
    try {
        const morningResponse = await fetch(`${CONFIG.contentPath}/${region}/morning.json`);
        if (morningResponse.ok) {
            const morningData = await morningResponse.json();
            morningTimestamp = morningData.generated_at ? new Date(morningData.generated_at) : null;
            
            if (morningTab) {
                morningTab.classList.remove('unavailable');
                const timeEl = morningTab.querySelector('.brief-tab-time');
                if (timeEl && morningData.generated_at) {
                    timeEl.textContent = formatBriefTime(morningData.generated_at);
                }
            }
        } else {
            if (morningTab) morningTab.classList.add('unavailable');
        }
    } catch (e) {
        if (morningTab) morningTab.classList.add('unavailable');
    }
    
    // Check evening brief
    try {
        const eveningResponse = await fetch(`${CONFIG.contentPath}/${region}/evening.json`);
        if (eveningResponse.ok) {
            const eveningData = await eveningResponse.json();
            eveningTimestamp = eveningData.generated_at ? new Date(eveningData.generated_at) : null;
            
            // Evening brief is only valid if it's AFTER the morning brief
            // This prevents showing yesterday's evening brief after today's morning brief
            const eveningIsValid = eveningTimestamp && morningTimestamp && (eveningTimestamp > morningTimestamp);
            
            if (eveningIsValid) {
                if (eveningTab) {
                    eveningTab.classList.remove('unavailable');
                    const timeEl = eveningTab.querySelector('.brief-tab-time');
                    if (timeEl && eveningData.generated_at) {
                        timeEl.textContent = formatBriefTime(eveningData.generated_at);
                    }
                }
            } else {
                // Evening exists but is older than morning - mark as unavailable
                if (eveningTab) {
                    eveningTab.classList.add('unavailable');
                    const timeEl = eveningTab.querySelector('.brief-tab-time');
                    if (timeEl) {
                        timeEl.textContent = '18:00 · Soon';
                    }
                }
            }
        } else {
            // No evening brief file exists
            if (eveningTab) {
                eveningTab.classList.add('unavailable');
                const timeEl = eveningTab.querySelector('.brief-tab-time');
                if (timeEl) {
                    timeEl.textContent = '18:00 · Soon';
                }
            }
        }
    } catch (e) {
        if (eveningTab) {
            eveningTab.classList.add('unavailable');
            const timeEl = eveningTab.querySelector('.brief-tab-time');
            if (timeEl) {
                timeEl.textContent = '18:00 · Soon';
            }
        }
    }
    
    // If current tab is unavailable, switch to available one
    const activeTab = document.querySelector('.brief-tab.active');
    if (activeTab && activeTab.classList.contains('unavailable')) {
        const availableTab = document.querySelector('.brief-tab:not(.unavailable)');
        if (availableTab) {
            availableTab.click();
        }
    }
}

// Format brief time with timezone indicator
function formatBriefTime(isoString) {
    if (!isoString) return '';
    
    try {
        // Extract time from ISO string
        // e.g., "2025-12-03T06:00:00+08:00" → "06:00"
        const timeMatch = isoString.match(/T(\d{2}):(\d{2})/);
        
        if (!timeMatch) return '';
        
        const hours = timeMatch[1];
        const minutes = timeMatch[2];
        
        return `${hours}:${minutes}`;
    } catch (e) {
        console.error('Error formatting brief time:', e);
        return '';
    }
}

// Rebuild Index Cards for Brief Type
function rebuildIndexCards() {
    const indexList = document.querySelector('.index-list');
    if (!indexList) return;
    
    const sections = getCurrentSections();
    
    // Clear existing cards
    indexList.innerHTML = '';
    
    // Create new cards
    Object.keys(sections).forEach((key, index) => {
        const section = sections[key];
        const card = document.createElement('article');
        card.className = 'index-card' + (index === 0 ? ' active' : '');
        card.dataset.section = key;
        
        card.innerHTML = `
            <span class="card-label">${section.label}</span>
            <h3 class="card-headline" id="index-${key}-headline">${section.defaultHeadline}</h3>
            <p class="card-excerpt" id="index-${key}-excerpt">Loading...</p>
        `;
        
        card.addEventListener('click', () => setActiveSection(key));
        indexList.appendChild(card);
    });
    
    // Scroll index content to top
    const indexContent = document.getElementById('index-content');
    if (indexContent) {
        indexContent.scrollTop = 0;
    }
}

// Index Card Click Handlers
function initIndexCards() {
    // Index cards are now dynamically generated in renderIndexCards()
    // with click handlers attached at creation time
}

// Set Active Section
function setActiveSection(sectionKey) {
    currentSection = sectionKey;
    
    // Track section view in GA4
    const sections = getCurrentSections();
    trackEvent('section_view', {
        section: sectionKey,
        section_label: sections[sectionKey]?.label || sectionKey,
        brief_type: currentBriefType,
        region: currentRegion
    });
    
    // Update card active states
    document.querySelectorAll('.index-card').forEach(card => {
        card.classList.toggle('active', card.dataset.section === sectionKey);
    });
    
    // Deactivate week cards
    document.querySelectorAll('.week-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Reset label color to burgundy
    const labelEl = document.getElementById('reading-label');
    if (labelEl) {
        labelEl.style.color = 'var(--burgundy)';
    }
    
    // Update reading pane
    if (briefData) {
        renderReadingPane(sectionKey);
    }
    
    // Open mobile reader on phones
    openMobileReader();
}

// Load Content
async function loadContent(region, briefType = 'morning') {
    try {
        const response = await fetch(`${CONFIG.contentPath}/${region}/${briefType}.json`);
        
        if (!response.ok) {
            // Brief not available yet
            if (response.status === 404) {
                showBriefUnavailable(briefType);
                return;
            }
            throw new Error('Failed to load brief');
        }
        
        briefData = await response.json();
        
        renderIndexCards(briefData);
        renderReadingPane(currentSection);
        renderTimestamp(briefData);
        
        // Load week ahead (global - same for all editions)
        if (briefType === 'morning') {
            loadWeekAhead();
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        showBriefUnavailable(briefType);
    }
}

// Show brief unavailable message
function showBriefUnavailable(briefType) {
    const bodyEl = document.getElementById('reading-body');
    const headlineEl = document.getElementById('reading-headline');
    const labelEl = document.getElementById('reading-label');
    
    if (headlineEl) {
        headlineEl.textContent = briefType === 'evening' 
            ? 'Evening Brief Coming Soon' 
            : 'Morning Brief Unavailable';
    }
    
    if (labelEl) {
        labelEl.textContent = briefType.toUpperCase() + ' BRIEF';
    }
    
    if (bodyEl) {
        const time = briefType === 'evening' ? '18:00' : '06:00';
        bodyEl.innerHTML = `<p>The ${briefType} brief will be published at ${time} local time. Check back soon for today's analysis.</p>`;
    }
}

// Load Live Market Data from CoinGecko
async function loadMarketData() {
    try {
        // Use cached market data endpoint for stability
        const response = await fetch('/api/market-cache');
        
        if (!response.ok) {
            // Fallback to direct CoinGecko if cache fails
            return loadMarketDataDirect();
        }
        
        const data = await response.json();
        
        // Update BTC
        if (data.btc) {
            setText('btc-price', formatPrice(data.btc.price));
            updateChangeElement('btc-change', data.btc.change24h);
            setText('sticky-btc-price', formatPriceCompact(data.btc.price));
            updateStickyChange('sticky-btc-change', data.btc.change24h);
        }
        
        // Update ETH
        if (data.eth) {
            setText('eth-price', formatPrice(data.eth.price));
            updateChangeElement('eth-change', data.eth.change24h);
            setText('sticky-eth-price', formatPriceCompact(data.eth.price));
            updateStickyChange('sticky-eth-change', data.eth.change24h);
        }
        
        // Update total market
        if (data.market) {
            setText('total-market', formatMarketCap(data.market.totalMarketCap));
            setText('sticky-market', formatMarketCap(data.market.totalMarketCap));
            updateChangeElement('market-change', data.market.marketCapChange24h);
        }
        
        // Update last refresh timestamp
        updateMarketTimestamp(data.updated, data.cached);
        
    } catch (error) {
        console.error('Error loading market data:', error);
        // Try direct API as fallback
        loadMarketDataDirect();
    }
}

// Fallback: direct CoinGecko fetch
async function loadMarketDataDirect() {
    try {
        const coinsResponse = await fetch(CONFIG.coinGeckoAPI);
        if (!coinsResponse.ok) throw new Error('Failed to fetch coin data');
        
        const coins = await coinsResponse.json();
        const btc = coins.find(c => c.id === 'bitcoin');
        const eth = coins.find(c => c.id === 'ethereum');
        
        if (btc) {
            setText('btc-price', formatPrice(btc.current_price));
            updateChangeElement('btc-change', btc.price_change_percentage_24h);
            setText('sticky-btc-price', formatPriceCompact(btc.current_price));
            updateStickyChange('sticky-btc-change', btc.price_change_percentage_24h);
        }
        
        if (eth) {
            setText('eth-price', formatPrice(eth.current_price));
            updateChangeElement('eth-change', eth.price_change_percentage_24h);
            setText('sticky-eth-price', formatPriceCompact(eth.current_price));
            updateStickyChange('sticky-eth-change', eth.price_change_percentage_24h);
        }
        
        const globalResponse = await fetch(CONFIG.globalAPI);
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            const totalMarketCap = globalData.data?.total_market_cap?.usd;
            const marketCapChange = globalData.data?.market_cap_change_percentage_24h_usd;
            
            if (totalMarketCap) {
                setText('total-market', formatMarketCap(totalMarketCap));
                setText('sticky-market', formatMarketCap(totalMarketCap));
            }
            if (marketCapChange !== undefined) {
                updateChangeElement('market-change', marketCapChange);
            }
        }
        
        updateMarketTimestamp(new Date().toISOString(), false);
        
    } catch (error) {
        console.error('Error loading market data (direct):', error);
    }
}

// Update the market data timestamp display
function updateMarketTimestamp(isoString, cached) {
    const el = document.getElementById('market-updated');
    if (!el) return;
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    let text;
    if (diffMins < 1) {
        text = 'just now';
    } else if (diffMins < 60) {
        text = `${diffMins}m ago`;
    } else {
        text = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    el.textContent = text;
    el.title = `Last updated: ${date.toLocaleString()}${cached ? ' (cached)' : ''}`;
}

// Format price compact (e.g., $92.1K)
function formatPriceCompact(price) {
    if (price >= 1000) {
        return '$' + (price / 1000).toFixed(1) + 'K';
    }
    return '$' + price.toFixed(0);
}

// Update sticky change element
function updateStickyChange(elementId, change) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.textContent = formatChange(change);
    el.className = `sticky-change ${change >= 0 ? 'up' : 'down'}`;
}

// Update sticky region display
function updateStickyRegion() {
    const el = document.getElementById('sticky-region');
    if (el) {
        el.textContent = currentRegion.toUpperCase();
    }
}

// Update change element with color
function updateChangeElement(elementId, change) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.textContent = formatChange(change);
    el.className = `ticker-change ${change >= 0 ? 'up' : 'down'}`;
}

// ========== MARKET MOOD 9-BOX ==========

// Zone definitions for the 9-box
const MOOD_ZONES = {
    'concentration':   { row: 0, col: 0, label: 'Concentration' },
    'leadership':      { row: 0, col: 1, label: 'Leadership' },
    'strong-rally':    { row: 0, col: 2, label: 'Strong Rally' },
    'rotation':        { row: 1, col: 0, label: 'Rotation' },
    'consolidation':   { row: 1, col: 1, label: 'Consolidation' },
    'steady-advance':  { row: 1, col: 2, label: 'Steady Advance' },
    'capitulation':    { row: 2, col: 0, label: 'Capitulation' },
    'drift':           { row: 2, col: 1, label: 'Drift' },
    'weak-rally':      { row: 2, col: 2, label: 'Weak Rally' }
};

// Zone descriptions
const MOOD_DESCRIPTIONS = {
    'strong-rally': 'Broad participation with high conviction. The market is moving decisively higher with strong volume confirmation.',
    'leadership': 'Select leaders driving gains on elevated volume. Watch for rotation or broadening participation.',
    'steady-advance': 'Healthy breadth with moderate volume. Measured advance with sustainable participation.',
    'consolidation': 'Mixed breadth on quiet volume. The market is digesting recent moves and awaiting direction.',
    'concentration': 'Narrow leadership with frenzied activity. Gains concentrated in few names—fragile setup.',
    'rotation': 'Sector rotation underway with elevated volume. Capital is moving, but direction is unclear.',
    'weak-rally': 'Broad gains but lacking volume conviction. Advance may stall without renewed participation.',
    'drift': 'Indecisive action on low volume. The market lacks catalyst and conviction.',
    'capitulation': 'Widespread selling on high volume. Potential washout—watch for exhaustion signals.'
};

// Load Market Mood data
async function loadMarketMood() {
    try {
        const response = await fetch(CONFIG.marketMoodAPI);
        if (!response.ok) {
            console.log('Market mood API not available');
            renderMarketMoodUnavailable();
            return;
        }
        
        const data = await response.json();
        renderMarketMood(data);
        
    } catch (error) {
        console.log('Market mood API error:', error);
        renderMarketMoodUnavailable();
    }
}

function renderMarketMoodUnavailable() {
    setText('mood-title', '—');
    setText('mood-description', 'Data temporarily unavailable');
    setText('breadth-value', '—');
    setText('legend-teal', '—');
    setText('legend-burgundy', '—');
}

// Render Market Mood
function renderMarketMood(data) {
    const grid = document.getElementById('nine-box-grid');
    if (!grid) return;
    
    const { breadth, breadthAvg24h, mvRatio24h, mvRatio7d, trail, mvRange } = data;
    
    // Use average breadth if available, otherwise fall back to current
    const avgBreadth = breadthAvg24h !== undefined ? breadthAvg24h : breadth;
    
    // Calculate zone based on current position (teal dot)
    const zone = getMarketZone(breadth, mvRatio24h, mvRange);
    
    // Update title and description
    setText('mood-title', MOOD_ZONES[zone]?.label || 'Market Mood');
    setText('mood-description', MOOD_DESCRIPTIONS[zone] || '');
    
    // Update breadth display
    setText('breadth-value', `${Math.round(breadth)}% of coins are green`);
    
    // Update legend
    setText('legend-teal', `${mvRatio24h.toFixed(1)}x · Active 24H volumes & 24H trail`);
    setText('legend-burgundy', `${mvRatio7d.toFixed(1)}x · Active @ avg last 7day volumes`);
    
    // Update Market Activity in header (uses 7d avg M/V - same as burgundy dot)
    updateMarketActivity(mvRatio7d, mvRange);
    
    // Position dots
    const gridRect = grid.getBoundingClientRect();
    const gridSize = gridRect.width;
    
    // Map coordinates (breadth: 0-100 → 0-100%, mv: low→top, high→bottom)
    const mapX = (b) => (b / 100) * 100;
    const mapY = (mv) => {
        // Low M/V = high activity = frenzied = top (0%)
        // High M/V = low activity = quiet = bottom (100%)
        const normalized = (mv - mvRange.low) / (mvRange.high - mvRange.low);
        return Math.max(0, Math.min(100, normalized * 100));
    };
    
    // Position teal dot (current breadth, 24h M/V)
    const tealDot = document.getElementById('mood-dot-teal');
    if (tealDot) {
        tealDot.style.left = `${mapX(breadth)}%`;
        tealDot.style.top = `${mapY(mvRatio24h)}%`;
    }
    
    // Position burgundy dot (average breadth 24h, 7d avg M/V)
    const burgundyDot = document.getElementById('mood-dot-burgundy');
    if (burgundyDot) {
        burgundyDot.style.left = `${mapX(avgBreadth)}%`;
        burgundyDot.style.top = `${mapY(mvRatio7d)}%`;
    }
    
    // Draw trail
    if (trail && trail.length > 1) {
        const trailPath = document.getElementById('trail-path');
        const startDot = document.getElementById('mood-dot-start');
        
        const points = trail.map(p => ({
            x: mapX(p.breadth),
            y: mapY(p.mv)
        }));
        
        if (trailPath && points.length > 0) {
            // Create smooth path using SVG
            let d = `M ${points[0].x} ${points[0].y}`;
            
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const next = points[i + 1] || curr;
                const prevPrev = points[i - 2] || prev;
                
                // Catmull-Rom to Bezier conversion
                const tension = 0.3;
                const cp1x = prev.x + (curr.x - prevPrev.x) * tension;
                const cp1y = prev.y + (curr.y - prevPrev.y) * tension;
                const cp2x = curr.x - (next.x - prev.x) * tension;
                const cp2y = curr.y - (next.y - prev.y) * tension;
                
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
            }
            
            trailPath.setAttribute('d', d);
        }
        
        // Position start dot
        if (startDot) {
            startDot.style.left = `${mapX(trail[0].breadth)}%`;
            startDot.style.top = `${mapY(trail[0].mv)}%`;
        }
    }
    
    // Highlight active zone
    document.querySelectorAll('.box').forEach(box => {
        box.classList.remove('active-zone');
        if (box.dataset.zone === zone) {
            box.classList.add('active-zone');
        }
    });
}

// Determine which zone based on breadth and M/V
function getMarketZone(breadth, mv, mvRange) {
    // Breadth: 0-33% = low, 33-66% = mid, 66-100% = high
    // M/V: map to rows (0=frenzied/low M/V, 1=normal, 2=quiet/high M/V)
    
    const col = breadth < 33 ? 0 : breadth < 66 ? 1 : 2;
    
    // M/V thresholds (lower M/V = more frenzied)
    const mvNormalized = (mv - mvRange.low) / (mvRange.high - mvRange.low);
    const row = mvNormalized < 0.33 ? 0 : mvNormalized < 0.66 ? 1 : 2;
    
    const zones = [
        ['concentration', 'leadership', 'strong-rally'],
        ['rotation', 'consolidation', 'steady-advance'],
        ['capitulation', 'drift', 'weak-rally']
    ];
    
    return zones[row][col];
}

// Update Market Activity indicator in header
function updateMarketActivity(mvRatio, mvRange) {
    const el = document.getElementById('market-activity');
    const stickyEl = document.getElementById('sticky-activity');
    
    // Calculate activity level based on M/V ratio
    // Lower M/V = more volume relative to market cap = more active
    const mvNormalized = (mvRatio - mvRange.low) / (mvRange.high - mvRange.low);
    
    let activity, cssClass;
    if (mvNormalized < 0.25) {
        activity = 'Frenzied';
        cssClass = 'frenzied';
    } else if (mvNormalized < 0.45) {
        activity = 'Active';
        cssClass = 'active';
    } else if (mvNormalized < 0.70) {
        activity = 'Moderate';
        cssClass = 'moderate';
    } else {
        activity = 'Quiet';
        cssClass = 'quiet';
    }
    
    if (el) {
        el.textContent = activity;
        el.className = 'ticker-value ticker-activity ' + cssClass;
    }
    
    if (stickyEl) {
        stickyEl.textContent = activity;
        stickyEl.className = 'sticky-activity ' + cssClass;
    }
}

// ===== ETF Flows Section =====
async function loadETFFlows() {
    try {
        // Try live API first (SoSoValue)
        const apiResponse = await fetch('/api/etf-flows');
        
        if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (data && data.yesterday) {
                renderETFFlows(data);
                console.log('ETF Flows: Live data loaded');
                return;
            }
        }
        
        // Fallback to brief data
        const region = currentRegion || 'emea';
        const briefResponse = await fetch(`./content/${region}/morning.json`);
        
        if (briefResponse.ok) {
            const brief = await briefResponse.json();
            if (brief.etf_flows && brief.etf_flows.yesterday) {
                renderETFFlows(brief.etf_flows);
                return;
            }
        }
        
        // No data available - show placeholder
        renderETFFlowsUnavailable();
        
    } catch (error) {
        console.log('ETF flows not available');
        renderETFFlowsUnavailable();
    }
}

function renderETFFlowsUnavailable() {
    const amountEl = document.getElementById('etf-amount');
    const barEl = document.getElementById('etf-bar');
    const insightEl = document.getElementById('etf-insight');
    const dateEl = document.getElementById('etf-date');
    const weekContainer = document.getElementById('etf-week');
    
    if (amountEl) {
        amountEl.textContent = '—';
        amountEl.className = 'etf-amount';
    }
    if (barEl) barEl.style.width = '0%';
    if (insightEl) insightEl.textContent = '';
    if (dateEl) dateEl.textContent = '';
    if (weekContainer) weekContainer.innerHTML = '';
}

function renderETFFlows(data) {
    if (!data) return;
    
    const { yesterday, week, insight } = data;
    
    // Update yesterday's flow
    const amountEl = document.getElementById('etf-amount');
    const barEl = document.getElementById('etf-bar');
    const insightEl = document.getElementById('etf-insight');
    const dateEl = document.getElementById('etf-date');
    
    if (amountEl && yesterday) {
        const isInflow = yesterday.amount >= 0;
        const sign = isInflow ? '+' : '';
        amountEl.textContent = `${sign}$${Math.abs(yesterday.amount)}M`;
        amountEl.className = `etf-amount ${isInflow ? 'positive' : 'negative'}`;
    }
    
    if (barEl && yesterday) {
        // Scale bar: $500M = 100%
        const maxFlow = 500;
        const width = Math.min(Math.abs(yesterday.amount) / maxFlow * 100, 100);
        barEl.style.width = `${width}%`;
        barEl.className = `etf-bar ${yesterday.amount >= 0 ? 'etf-inflow' : 'etf-outflow'}`;
    }
    
    if (dateEl && yesterday.date) {
        dateEl.textContent = yesterday.date;
    }
    
    // Update week bars
    if (week && week.length > 0) {
        const weekContainer = document.getElementById('etf-week');
        if (weekContainer) {
            weekContainer.innerHTML = week.map(day => {
                const isInflow = day.amount >= 0;
                const isStrong = Math.abs(day.amount) > 300;
                const sign = isInflow ? '+' : '';
                return `<div class="etf-day ${isInflow ? 'inflow' : 'outflow'}${isStrong ? ' strong' : ''}" 
                             data-day="${day.day.toLowerCase()}" 
                             title="${day.day}: ${sign}$${Math.abs(day.amount)}M"></div>`;
            }).join('');
        }
    }
    
    if (insightEl && insight) {
        insightEl.textContent = `→ ${insight}`;
    }
}

// ===== The Number Section =====
async function loadTheNumber() {
    try {
        // Try live API first (rotates by day)
        const apiResponse = await fetch('/api/the-number');
        
        if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (data.value) {
                renderTheNumber(data);
                console.log('The Number: Data loaded', data.source || 'live');
                return;
            }
        }
        
        // Fallback to brief data
        const region = currentRegion || 'emea';
        const briefResponse = await fetch(`./content/${region}/morning.json`);
        
        if (briefResponse.ok) {
            const brief = await briefResponse.json();
            if (brief.the_number && brief.the_number.value) {
                renderTheNumber(brief.the_number);
                return;
            }
        }
        
        // No data available - show placeholder
        renderTheNumber(null);
        
    } catch (error) {
        console.log('The Number not available');
        renderTheNumber(null);
    }
}

function renderTheNumber(data) {
    const valueEl = document.getElementById('number-value');
    const metricEl = document.getElementById('number-metric');
    const changeEl = document.getElementById('number-change');
    const contextEl = document.getElementById('number-context');
    
    if (valueEl) {
        if (!data || !data.value) {
            // No data - show placeholder
            valueEl.innerHTML = '—';
        } else {
            const value = String(data.value);
            const unit = data.unit || '';
            
            // Detect format and render appropriately
            if (value.includes('$') || value.includes('B') || value.includes('T') || value.includes('M') || value.includes('K')) {
                // Already formatted - no suffix needed
                valueEl.innerHTML = value;
            } else if (value.includes('%')) {
                // Percentage format - no suffix needed
                valueEl.innerHTML = value;
            } else if (unit === '%') {
                // Add % suffix
                valueEl.innerHTML = `${value}<span class="number-suffix">%</span>`;
            } else if (unit === 'B') {
                // Billions with $ prefix
                valueEl.innerHTML = `$${value}<span class="number-suffix">B</span>`;
            } else if (unit === 'K') {
                // Thousands
                valueEl.innerHTML = `${value}<span class="number-suffix">K</span>`;
            } else if (unit === '/100') {
                // Index out of 100 (Fear & Greed)
                valueEl.innerHTML = `${value}<span class="number-suffix">/100</span>`;
            } else if (/^\d+(\.\d+)?$/.test(value) && !unit) {
                // Plain number with no unit - assume index /100
                valueEl.innerHTML = `${value}<span class="number-suffix">/100</span>`;
            } else {
                // Unknown format - display as-is
                valueEl.innerHTML = value;
            }
        }
    }
    
    // Display metric name label (e.g., "BTC DOMINANCE", "FEAR & GREED")
    if (metricEl) {
        if (data && data.label) {
            metricEl.textContent = data.label;
            metricEl.style.display = 'block';
        } else {
            metricEl.style.display = 'none';
        }
    }
    
    // Display change/delta (e.g., "+5 vs last week")
    if (changeEl) {
        if (data && data.change) {
            changeEl.textContent = data.change;
            changeEl.style.display = 'block';
            // Color code based on direction
            if (data.change.startsWith('+')) {
                changeEl.classList.add('positive');
                changeEl.classList.remove('negative');
            } else if (data.change.startsWith('-')) {
                changeEl.classList.add('negative');
                changeEl.classList.remove('positive');
            } else {
                changeEl.classList.remove('positive', 'negative');
            }
        } else {
            changeEl.style.display = 'none';
        }
    }
    
    if (contextEl) {
        if (!data || !data.context) {
            contextEl.textContent = '';
        } else {
            contextEl.textContent = data.context;
        }
    }
}

// Load Week Ahead
// Week Ahead data store
let weekAheadData = null;

async function loadWeekAhead() {
    try {
        // Week ahead is global - same for all editions
        const response = await fetch(`${CONFIG.contentPath}/week-ahead.json`);
        if (!response.ok) return;
        
        weekAheadData = await response.json();
        renderWeekAhead(weekAheadData);
        initWeekCards();
        initFocusCards();
        
    } catch (error) {
        console.log('Week ahead not available');
    }
}

// Render Market Data
// Render Index Cards
function renderIndexCards(data) {
    if (!data.sections) return;
    
    const sections = getCurrentSections();
    const firstSectionKey = currentBriefType === 'evening' ? 'session' : 'lead';
    const indexList = document.querySelector('.index-list');
    
    if (!indexList) return;
    
    // Clear existing cards and rebuild based on current brief type
    indexList.innerHTML = '';
    
    Object.keys(sections).forEach((key, index) => {
        const section = sections[key];
        const content = data.sections[section.field] || '';
        
        // Get section-specific title if available
        let headline;
        const sectionTitle = data.sections[`${section.field}_title`];
        
        if (key === firstSectionKey && data.headline) {
            headline = data.headline;
        } else if (sectionTitle) {
            headline = sectionTitle;
        } else {
            headline = section.defaultHeadline;
        }
        
        // Create card element
        const card = document.createElement('article');
        card.className = `index-card${index === 0 ? ' active' : ''}`;
        card.dataset.section = key;
        
        // Build card HTML
        let cardHTML = `
            <span class="card-label">${section.label}</span>
            <h3 class="card-headline" id="index-${key}-headline">${headline}</h3>
        `;
        
        // Only show excerpt for first section (THE LEAD or THE SESSION)
        if (key === firstSectionKey && content) {
            cardHTML += `<p class="card-excerpt" id="index-${key}-excerpt">${truncate(content, 100)}</p>`;
        }
        
        card.innerHTML = cardHTML;
        
        // Add click handler
        card.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.index-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Update current section and render
            currentSection = key;
            renderReadingPane(key);
            
            // Mobile: show reading pane
            const readingPane = document.querySelector('.reading-pane');
            if (readingPane && window.innerWidth <= 768) {
                readingPane.classList.add('active');
            }
            
            trackEvent('section_selected', { section: key });
        });
        
        indexList.appendChild(card);
    });
    
    // Scroll index content to top
    const indexContent = document.getElementById('index-content');
    if (indexContent) {
        indexContent.scrollTop = 0;
    }
    
    // Render THE TAKEAWAY quote box (Morning only)
    renderTakeawayQuote(data);
}

// Render THE TAKEAWAY as a stylish quote box
function renderTakeawayQuote(data) {
    const takeawayContent = data.sections?.the_closing_line || data.sections?.the_takeaway || '';
    const quoteBox = document.getElementById('takeaway-quote');
    const quoteText = document.getElementById('takeaway-text');
    
    if (quoteBox && quoteText && takeawayContent) {
        quoteText.textContent = takeawayContent;
        quoteBox.style.display = 'block';
    } else if (quoteBox) {
        quoteBox.style.display = 'none';
    }
}

// Render Reading Pane
function renderReadingPane(sectionKey) {
    if (!briefData || !briefData.sections) return;
    
    // Scroll reading pane to top
    const readingPane = document.querySelector('.reading-pane');
    if (readingPane) {
        readingPane.scrollTop = 0;
    }
    
    const sections = getCurrentSections();
    const section = sections[sectionKey];
    
    if (!section) return;
    
    const content = briefData.sections[section.field] || '';
    
    // Update label (reset to burgundy)
    const labelEl = document.getElementById('reading-label');
    if (labelEl) {
        labelEl.textContent = section.label;
        labelEl.style.color = 'var(--burgundy)';
    }
    
    // Get headline: section title (new) > main headline (lead) > default
    const isFirstSection = (currentBriefType === 'morning' && sectionKey === 'lead') ||
                           (currentBriefType === 'evening' && sectionKey === 'session');
    const sectionTitle = briefData.sections[`${section.field}_title`];
    
    let headline;
    if (isFirstSection && briefData.headline) {
        headline = briefData.headline;
    } else if (sectionTitle) {
        headline = sectionTitle;
    } else {
        headline = section.defaultHeadline;
    }
    
    setText('reading-headline', headline);
    
    // Reset byline color
    const bylineAuthor = document.querySelector('.byline-author');
    if (bylineAuthor) {
        bylineAuthor.style.color = 'var(--burgundy)';
    }
    
    // Handle lead image (for lead section only)
    const imageContainer = document.getElementById('reading-image');
    const imageEl = document.getElementById('reading-image-src');
    const imageLabelEl = document.getElementById('image-label');
    const imageHeadlineEl = document.getElementById('image-headline');
    const articleLabel = document.getElementById('reading-label');
    const articleHeadline = document.getElementById('reading-headline');
    const articleHeader = document.querySelector('.article-header');
    
    if (imageContainer && imageEl) {
        if (isFirstSection) {
            // Always show image for THE LEAD section
            imageEl.classList.add('loading');
            
            // Curated Unsplash fallback images (editorial - architectural and landscape)
            const unsplashFallbacks = [
                'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200&h=600&fit=crop&q=80', // Sunrise mountain
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&h=600&fit=crop&q=80', // Calm water reflection
                'https://images.unsplash.com/photo-1489549132488-d00b7eee80f1?w=1200&h=600&fit=crop&q=80', // Fog forest
                'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&h=600&fit=crop&q=80', // City skyline night
                'https://images.unsplash.com/photo-1472120435266-53107fd0c44a?w=1200&h=600&fit=crop&q=80', // Sunset
                'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=600&fit=crop&q=80', // Office skyscraper
                'https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=1200&h=600&fit=crop&q=80', // Modern architecture
                'https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?w=1200&h=600&fit=crop&q=80', // Financial district buildings
            ];
            
            // Choose image source - prioritize the pre-generated image_url from backend
            let imageUrl;
            if (briefData.image_url) {
                // Use the curated image URL generated by the AI
                imageUrl = briefData.image_url;
            } else if (briefData.image_keywords) {
                // Fallback: Use Unsplash search if only keywords provided
                const keywords = encodeURIComponent(briefData.image_keywords);
                imageUrl = `https://source.unsplash.com/1200x600/?${keywords}`;
            } else {
                // Final fallback: Use random curated image based on headline hash
                const hash = headline.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                imageUrl = unsplashFallbacks[hash % unsplashFallbacks.length];
            }
            
            // Try to load the image with fallback chain
            const loadImage = (url, fallbackIndex = 0) => {
                const tempImg = new Image();
                tempImg.onload = function() {
                    imageEl.src = this.src;
                    imageEl.classList.remove('loading');
                };
                tempImg.onerror = function() {
                    // Try next fallback
                    if (fallbackIndex < unsplashFallbacks.length) {
                        loadImage(unsplashFallbacks[fallbackIndex], fallbackIndex + 1);
                    } else {
                        // No image available - hide container
                        imageContainer.style.display = 'none';
                        if (articleLabel) articleLabel.style.display = 'block';
                        if (articleHeadline) articleHeadline.style.display = 'block';
                        if (articleHeader) articleHeader.classList.remove('with-image');
                    }
                };
                tempImg.src = url;
            };
            
            loadImage(imageUrl);
            
            // Update overlay text
            if (imageLabelEl) imageLabelEl.textContent = section.label;
            if (imageHeadlineEl) imageHeadlineEl.textContent = headline;
            
            imageContainer.style.display = 'block';
            
            // Hide label and headline in header (shown in image overlay instead)
            if (articleLabel) articleLabel.style.display = 'none';
            if (articleHeadline) articleHeadline.style.display = 'none';
            if (articleHeader) articleHeader.classList.add('with-image');
            
            // Track image view
            trackEvent('lead_image_view', { 
                has_keywords: !!briefData.image_keywords,
                keywords: briefData.image_keywords || 'fallback'
            });
        } else {
            imageContainer.style.display = 'none';
            // Show regular header for non-lead sections
            if (articleLabel) articleLabel.style.display = 'block';
            if (articleHeadline) articleHeadline.style.display = 'block';
            if (articleHeader) articleHeader.classList.remove('with-image');
        }
    }
    
    // Update body - split into paragraphs for better reading
    const bodyEl = document.getElementById('reading-body');
    if (bodyEl) {
        // Special handling for The Region section with sub-regions (evening brief)
        if (sectionKey === 'region' && currentBriefType === 'evening') {
            const regionData = briefData.sections.the_region;
            
            // Check if regionData is a proper object with sub-regions
            if (regionData && typeof regionData === 'object' && !Array.isArray(regionData)) {
                let html = '';
                
                // Iterate through sub-regions (skip 'title' and 'name' fields)
                const subRegionKeys = Object.keys(regionData).filter(k => k !== 'title' && k !== 'name');
                
                if (subRegionKeys.length > 0) {
                    for (const subKey of subRegionKeys) {
                        const subRegion = regionData[subKey];
                        if (subRegion && subRegion.name) {
                            html += `<h3 class="sub-region-header">${subRegion.name}</h3>`;
                            if (subRegion.content) {
                                const paragraphs = splitIntoParagraphs(subRegion.content);
                                html += paragraphs.map(p => {
                                    // Don't wrap if already HTML (e.g., bullet list)
                                    if (p.startsWith('<ul') || p.startsWith('<ol')) return p;
                                    return `<p>${p}</p>`;
                                }).join('');
                            }
                        }
                    }
                }
                
                bodyEl.innerHTML = html || '<p>Regional updates are being prepared. Check back shortly.</p>';
            } else if (regionData && typeof regionData === 'string' && regionData.length > 0) {
                // Fallback: regionData is a string (old format)
                const paragraphs = splitIntoParagraphs(regionData);
                bodyEl.innerHTML = paragraphs.map(p => {
                    if (p.startsWith('<ul') || p.startsWith('<ol')) return p;
                    return `<p>${p}</p>`;
                }).join('');
            } else {
                // No region data available
                bodyEl.innerHTML = '<p>Regional updates are being prepared. Check back shortly.</p>';
            }
        } else {
            // Standard paragraph rendering
            const paragraphs = splitIntoParagraphs(content);
            bodyEl.innerHTML = paragraphs.map(p => {
                // Don't wrap if already HTML (e.g., bullet list)
                if (p.startsWith('<ul') || p.startsWith('<ol')) return p;
                return `<p>${p}</p>`;
            }).join('');
        }
    }
    
    // Show/update article ending with analyst persona
    const articleEnding = document.getElementById('article-ending');
    if (articleEnding) {
        articleEnding.style.display = 'block';
        
        // Editorial team personas
        const analysts = {
            lead: {
                name: 'Marcus',
                role: 'Senior Market Analyst',
                photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face&q=80'
            },
            session: {
                name: 'Marcus',
                role: 'Senior Market Analyst', 
                photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face&q=80'
            },
            angle: {
                name: 'Hakima',
                role: 'Market Strategist',
                photo: 'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=96&h=96&fit=crop&crop=face&q=80'
            },
            driver: {
                name: 'Hakima',
                role: 'Market Strategist',
                photo: 'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=96&h=96&fit=crop&crop=face&q=80'
            },
            signal: {
                name: 'Hakima',
                role: 'Market Strategist',
                photo: 'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=96&h=96&fit=crop&crop=face&q=80'
            },
            weekahead: {
                name: 'James',
                role: 'Chief Strategist',
                photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=96&h=96&fit=crop&crop=face&q=80'
            }
        };
        
        // Set analyst for current section
        const analyst = analysts[sectionKey] || analysts.lead;
        const photoEl = document.getElementById('analyst-photo');
        const nameEl = document.getElementById('analyst-name');
        const roleEl = document.getElementById('analyst-role');
        
        if (photoEl) photoEl.src = analyst.photo;
        if (nameEl) nameEl.textContent = `${analyst.name} · Sirruna`;
        if (roleEl) roleEl.textContent = analyst.role;
        
        // Generate a one-sentence editorial insight from content
        const isLead = (currentBriefType === 'morning' && sectionKey === 'lead') ||
                       (currentBriefType === 'evening' && sectionKey === 'session');
        
        // Use different source content based on section
        let sourceContent = content;
        if (isLead) {
            const angleContent = briefData.sections.the_angle || briefData.sections.angle || '';
            sourceContent = angleContent || content;
        }
        
        if (sourceContent) {
            // Extract key insight sentence
            const sentences = sourceContent.match(/[^.!?]+[.!?]+/g) || [];
            let summaryQuote = '';
            
            // Find a sentence with editorial insight
            const insightPatterns = /matter|signal|suggest|reveal|indicate|mean|imply|show|tell|point|watch|key|critical|important|question|real|actual|beneath/i;
            
            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i].trim();
                if (sentence.length > 50 && sentence.length < 180) {
                    if (insightPatterns.test(sentence)) {
                        summaryQuote = sentence;
                        break;
                    }
                }
            }
            
            // Fallback to first substantial sentence
            if (!summaryQuote && sentences.length > 0) {
                for (const sentence of sentences) {
                    if (sentence.trim().length > 50 && sentence.trim().length < 180) {
                        summaryQuote = sentence.trim();
                        break;
                    }
                }
            }
            
            if (summaryQuote) {
                setText('ending-quote-text', summaryQuote);
            }
        }
        
        // Populate related reading with other sections
        const relatedLinks = document.getElementById('related-links');
        if (relatedLinks) {
            const otherSections = Object.keys(sections)
                .filter(k => k !== sectionKey && k !== 'takeaway')
                .slice(0, 3);
            
            relatedLinks.innerHTML = otherSections.map(key => {
                const sec = sections[key];
                const title = briefData.sections[`${sec.field}_title`] || sec.defaultHeadline;
                return `<a href="#" class="related-link" data-section="${key}">${title}</a>`;
            }).join('');
            
            // Add click handlers
            relatedLinks.querySelectorAll('.related-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetSection = link.dataset.section;
                    renderReadingPane(targetSection);
                    // Update index card active state
                    document.querySelectorAll('.index-card').forEach(c => {
                        c.classList.toggle('active', c.dataset.section === targetSection);
                    });
                });
            });
        }
    }
}

// Render Week Ahead
function renderWeekAhead(data) {
    if (!data.sections) return;
    
    // Update date in sidebar
    console.log('renderWeekAhead called with data:', data);
    
    // Update title with date
    if (data.generated_at) {
        const date = new Date(data.generated_at);
        const titleEl = document.getElementById('week-focus-title');
        if (titleEl) {
            titleEl.textContent = `The Week of ${formatShortDate(date)} Focus`;
        }
    }
    
    // Render each section
    const sectionKeys = ['fulcrum', 'levels', 'unpriced', 'underestimated'];
    
    sectionKeys.forEach(key => {
        const section = data.sections[key];
        if (section) {
            // Top focus cards - headline
            const focusEl = document.getElementById(`focus-${key}-headline`);
            console.log(`Focus card ${key}:`, focusEl, 'Title:', section.title);
            
            if (focusEl) {
                focusEl.textContent = section.title || key;
            }
            
            // Top focus cards - excerpt
            const excerptEl = document.getElementById(`focus-${key}-excerpt`);
            if (excerptEl && section.content) {
                excerptEl.textContent = truncate(section.content, 80);
            }
        }
    });
}

// Initialize Focus Cards (top) clicks
function initFocusCards() {
    const cards = document.querySelectorAll('.focus-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const sectionKey = card.dataset.weekSection;
            
            // Update active state for focus cards
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Also update sidebar week cards
            document.querySelectorAll('.week-card').forEach(c => {
                c.classList.toggle('active', c.dataset.weekSection === sectionKey);
            });
            
            // Deactivate brief cards
            document.querySelectorAll('.index-card').forEach(c => c.classList.remove('active'));
            
            // Show in reading pane
            renderWeekAheadPane(sectionKey);
            
            // Open mobile reader on phones
            openMobileReader();
        });
    });
}

// Initialize Week Card Clicks
function initWeekCards() {
    const cards = document.querySelectorAll('.week-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const sectionKey = card.dataset.weekSection;
            
            // Update active state
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Also deactivate brief cards
            document.querySelectorAll('.index-card').forEach(c => c.classList.remove('active'));
            
            // Show in reading pane
            renderWeekAheadPane(sectionKey);
            
            // Open mobile reader on phones
            openMobileReader();
        });
    });
}

// Render Week Ahead in Reading Pane
function renderWeekAheadPane(sectionKey) {
    if (!weekAheadData || !weekAheadData.sections) return;
    
    const section = weekAheadData.sections[sectionKey];
    if (!section) return;
    
    // Hide lead image (Week Ahead doesn't have images)
    const imageContainer = document.getElementById('reading-image');
    const articleLabel = document.getElementById('reading-label');
    const articleHeadline = document.getElementById('reading-headline');
    const articleHeader = document.querySelector('.article-header');
    
    if (imageContainer) imageContainer.style.display = 'none';
    if (articleLabel) articleLabel.style.display = 'block';
    if (articleHeadline) articleHeadline.style.display = 'block';
    if (articleHeader) articleHeader.classList.remove('with-image');
    
    const labelMap = {
        fulcrum: "THIS WEEK'S FULCRUM",
        levels: "LEVELS WORTH KNOWING",
        unpriced: "THE UNPRICED STORY",
        underestimated: "THE UNDERESTIMATED"
    };
    
    // Update label with teal color indicator
    if (articleLabel) {
        articleLabel.textContent = labelMap[sectionKey] || sectionKey.toUpperCase();
        articleLabel.style.color = 'var(--teal)';
    }
    
    // Update headline
    setText('reading-headline', section.title);
    
    // Update byline
    const byline = document.querySelector('.reading-byline');
    if (byline) {
        const date = weekAheadData.generated_at ? new Date(weekAheadData.generated_at) : new Date();
        byline.innerHTML = `<span class="byline-author" style="color: var(--teal)">L/tmus Intelligence</span><time class="byline-time" id="reading-timestamp">${formatDate(date)} · 12:00 GMT</time>`;
    }
    
    // Update body
    const bodyEl = document.getElementById('reading-body');
    if (bodyEl) {
        const paragraphs = splitIntoParagraphs(section.content);
        bodyEl.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
    }
}

// Helper: Format short date
function formatShortDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Render Timestamp - show date in regional time
function renderTimestamp(data) {
    if (data.generated_at) {
        const isoString = data.generated_at;
        
        // Check if timestamp has timezone offset
        const tzMatch = isoString.match(/([+-])(\d{2}):?(\d{2})$/);
        const isUTC = isoString.endsWith('Z') || !tzMatch;
        
        let displayDate;
        
        if (isUTC) {
            // UTC timestamp - convert to regional time
            const utcDate = new Date(isoString);
            
            // Get offset for current region
            const regionOffsets = {
                'apac': 8,    // SGT +8
                'emea': 1,    // CET +1  
                'americas': -5 // EST -5
            };
            
            const offsetHours = regionOffsets[currentRegion] || 0;
            displayDate = new Date(utcDate.getTime() + (offsetHours * 60 * 60 * 1000));
        } else {
            // Timestamp already includes timezone - parse the date from the string
            // Format: "2025-12-03T06:00:00+08:00"
            const dateMatch = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            if (dateMatch) {
                const [, year, month, day, hour, minute] = dateMatch;
                displayDate = new Date(year, month - 1, day, hour, minute);
            } else {
                displayDate = new Date(isoString);
            }
        }
        
        // Format date
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const dateStr = `${monthNames[displayDate.getMonth()]} ${displayDate.getDate()}, ${displayDate.getFullYear()}`;
        
        // Format time
        const hour = String(displayDate.getHours()).padStart(2, '0');
        const minute = String(displayDate.getMinutes()).padStart(2, '0');
        const tzAbbrev = getTimezoneAbbrev(isoString) || getRegionTimezone(currentRegion);
        const timeStr = `${hour}:${minute} ${tzAbbrev}`;
        
        setText('brief-date', dateStr);
        setText('reading-timestamp', `${dateStr} · ${timeStr}`);
    }
}

// Get timezone abbreviation for a region
function getRegionTimezone(region) {
    const tzMap = {
        'apac': 'SGT',
        'emea': 'CET',
        'americas': 'EST'
    };
    return tzMap[region] || 'UTC';
}

// Get timezone abbreviation from ISO string
function getTimezoneAbbrev(isoString) {
    const tzMatch = isoString.match(/([+-]\d{2}):?(\d{2})$/);
    if (!tzMatch) return '';
    
    const offsetHours = parseInt(tzMatch[1]);
    const tzMap = {
        '-05': 'EST',
        '-04': 'EDT', 
        '+00': 'GMT',
        '+01': 'CET',
        '+08': 'SGT',
        '+09': 'JST',
        '+10': 'AEST',
        '+11': 'AEDT'
    };
    return tzMap[tzMatch[1]] || `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;
}

// Helper: Set text content
function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
}

// Helper: Generate headline from content
function generateHeadline(content, fallback) {
    if (!content) return fallback;
    
    // Take first sentence or phrase, max ~6 words
    const firstSentence = content.split(/[.!?]/)[0];
    const words = firstSentence.split(' ').slice(0, 6);
    
    // If it's a good length, use it
    if (words.length >= 3 && words.length <= 6) {
        return words.join(' ');
    }
    
    return fallback;
}

// Helper: Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// Helper: Split content into paragraphs or bullet list
function splitIntoParagraphs(content) {
    if (!content) return [];
    
    // Check if content contains bullet points (• or - at start of items)
    const hasBullets = content.includes('•') || content.match(/^[-–—]\s/m);
    
    if (hasBullets) {
        // Split on bullet characters and format as proper list
        // Handle both "• item" and "item • item" patterns
        let bullets = content.split(/\s*•\s*/).filter(b => b.trim());
        
        // If first item doesn't look like a bullet (might be intro text), handle separately
        if (bullets.length > 0) {
            // Return as formatted bullet list HTML
            const listItems = bullets.map(b => `<li>${b.trim()}</li>`).join('');
            return [`<ul class="editorial-bullets">${listItems}</ul>`];
        }
    }
    
    // If content is short, return as single paragraph
    if (content.length < 300) return [content];
    
    // Split by sentences, but protect decimal numbers (e.g., 6.5%, $3.2T)
    // Replace decimal points temporarily with a placeholder
    const placeholder = '<<<DECIMAL>>>';
    const protectedContent = content.replace(/(\d)\.(\d)/g, `$1${placeholder}$2`);
    
    // Split on sentence endings (. ! ?) followed by space
    const sentences = protectedContent.match(/[^.!?]+[.!?]+/g) || [protectedContent];
    
    // Restore decimal points
    const restoredSentences = sentences.map(s => s.replace(new RegExp(placeholder, 'g'), '.'));
    
    // Group into paragraphs of 2-3 sentences
    const paragraphs = [];
    for (let i = 0; i < restoredSentences.length; i += 2) {
        const para = restoredSentences.slice(i, i + 2).join(' ').trim();
        if (para) paragraphs.push(para);
    }
    
    return paragraphs.length ? paragraphs : [content];
}

// Helper: Format price
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Helper: Format change percentage
function formatChange(change) {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
}

// Helper: Format market cap
function formatMarketCap(cap) {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}B`;
    return `$${cap}`;
}

// Helper: Format date
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

// Helper: Format time
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
    });
}

// ========== PODCAST / AUDIO PLAYER ==========

// Initialize Audio Player
function initAudioPlayer() {
    audioElement = document.getElementById('audio-element');
    const playBtn = document.getElementById('audio-play-btn');
    const progressBar = document.querySelector('.audio-progress-bar');
    
    if (!audioElement || !playBtn) return;
    
    // Play/Pause button
    playBtn.addEventListener('click', togglePlayPause);
    
    // Progress bar click to seek
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            if (!audioElement.duration) return;
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audioElement.currentTime = percent * audioElement.duration;
        });
    }
    
    // Audio element events
    audioElement.addEventListener('timeupdate', updateProgress);
    audioElement.addEventListener('loadedmetadata', updateDuration);
    audioElement.addEventListener('ended', onAudioEnded);
    audioElement.addEventListener('play', () => setPlayingState(true));
    audioElement.addEventListener('pause', () => setPlayingState(false));
}

// Toggle Play/Pause
function togglePlayPause() {
    if (!audioElement || !currentEpisode) return;
    
    // Lazy load audio source on first play
    if (!audioElement.src && currentEpisode.audioUrl) {
        audioElement.src = currentEpisode.audioUrl;
        audioElement.load();
    }
    
    if (isPlaying) {
        audioElement.pause();
        trackEvent('audio_pause', { 
            episode_title: currentEpisode.title,
            current_time: Math.floor(audioElement.currentTime)
        });
    } else {
        audioElement.play().catch(err => {
            console.error('Playback error:', err);
        });
        trackEvent('audio_play', { 
            episode_title: currentEpisode.title,
            current_time: Math.floor(audioElement.currentTime || 0)
        });
    }
}

// Set Playing State
function setPlayingState(playing) {
    isPlaying = playing;
    const playBtn = document.getElementById('audio-play-btn');
    
    if (playBtn) {
        if (playing) {
            playBtn.classList.add('playing');
        } else {
            playBtn.classList.remove('playing');
        }
    }
}

// Update Progress Bar
function updateProgress() {
    if (!audioElement || !audioElement.duration) return;
    
    const percent = (audioElement.currentTime / audioElement.duration) * 100;
    const progressEl = document.getElementById('audio-progress');
    const currentTimeEl = document.getElementById('audio-current-time');
    
    if (progressEl) {
        progressEl.style.width = percent + '%';
    }
    
    if (currentTimeEl) {
        currentTimeEl.textContent = formatAudioTime(audioElement.currentTime);
    }
}

// Update Duration Display
function updateDuration() {
    if (!audioElement || !audioElement.duration) return;
    
    const totalTimeEl = document.getElementById('audio-total-time');
    const durationEl = document.getElementById('audio-duration');
    
    if (totalTimeEl) {
        totalTimeEl.textContent = formatAudioTime(audioElement.duration);
    }
    
    if (durationEl) {
        const mins = Math.round(audioElement.duration / 60);
        durationEl.textContent = mins + ' MIN';
    }
}

// On Audio Ended
function onAudioEnded() {
    setPlayingState(false);
    const progressEl = document.getElementById('audio-progress');
    if (progressEl) {
        progressEl.style.width = '0%';
    }
}

// Format Audio Time (mm:ss)
function formatAudioTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
}

// Load The Breakdown Podcast via API
async function loadBreakdownPodcast() {
    const titleEl = document.getElementById('audio-title');
    
    try {
        const response = await fetch(CONFIG.breakdownAPI);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.episodes || data.episodes.length === 0) {
            throw new Error('No episodes in response');
        }
        
        // Get latest episode
        const episode = data.episodes[0];
        
        currentEpisode = {
            title: episode.title,
            audioUrl: episode.audioUrl,
            pubDate: episode.pubDateISO ? new Date(episode.pubDateISO) : new Date(),
            durationSec: episode.durationSec,
            durationFormatted: episode.durationFormatted,
            artwork: episode.imageUrl || data.show?.image || null,
            summary: episode.summary
        };
        
        renderPodcastEpisode(currentEpisode);
        
    } catch (error) {
        console.error('Error loading podcast:', error);
        
        // Show error state
        if (titleEl) {
            titleEl.textContent = 'Podcast temporarily unavailable';
        }
        
        // Retry after 30 seconds
        setTimeout(loadBreakdownPodcast, 30000);
    }
}

// Render Podcast Episode
function renderPodcastEpisode(episode) {
    // Update title
    const titleEl = document.getElementById('audio-title');
    if (titleEl) {
        titleEl.textContent = episode.title;
    }
    
    // Update artwork
    const artworkEl = document.querySelector('.audio-artwork img');
    if (artworkEl && episode.artwork) {
        artworkEl.src = episode.artwork;
        artworkEl.onerror = () => {
            artworkEl.src = 'https://megaphone.imgix.net/podcasts/bcb63e62-d56f-11eb-9e47-43b3c17dbba3/image/The_Breakdown_Show_Art.jpg';
        };
    }
    
    // Update recency
    const recencyEl = document.getElementById('audio-recency');
    if (recencyEl && episode.pubDate) {
        recencyEl.textContent = getRelativeTime(episode.pubDate);
    }
    
    // Update duration header
    const durationEl = document.getElementById('audio-duration');
    if (durationEl && episode.durationSec) {
        const mins = Math.round(episode.durationSec / 60);
        durationEl.textContent = mins + ' MIN';
    }
    
    // Update total time display
    const totalTimeEl = document.getElementById('audio-total-time');
    if (totalTimeEl) {
        if (episode.durationFormatted) {
            totalTimeEl.textContent = episode.durationFormatted;
        } else if (episode.durationSec) {
            totalTimeEl.textContent = formatAudioTime(episode.durationSec);
        }
    }
    
    // Don't set audio src yet - wait for user click (preload="none" approach)
    // This avoids eager downloads
}

// Get Relative Time (e.g., "3 h ago")
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 2) return 'just now';
    if (diffMins < 60) return diffMins + ' m ago';
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return diffHours + ' h ago';
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return diffDays + ' d ago';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Parse Duration to Seconds (kept for backward compatibility)
function parseDurationSeconds(duration) {
    if (!duration) return 0;
    
    if (/^\d+$/.test(duration)) {
        return parseInt(duration);
    }
    
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    
    return 0;
}

// ========== USER SETTINGS & COINS ==========

// Load user coins from localStorage - Personal Edition takes priority
function loadUserCoins() {
    // Try Personal Edition first
    const personalSaved = localStorage.getItem('litmus_personal_coins');
    if (personalSaved) {
        try {
            const personalCoins = JSON.parse(personalSaved);
            // Get holdings only (exclude watching)
            const holdings = personalCoins.filter(c => c.weight !== 'watching');
            if (holdings.length > 0) {
                userCoins = holdings.map(c => c.id);
                return;
            }
        } catch (e) {
            console.warn('Failed to parse Personal Edition coins');
        }
    }
    
    // Fallback to old storage
    const saved = localStorage.getItem('litmus_user_coins');
    if (saved) {
        try {
            userCoins = JSON.parse(saved);
        } catch (e) {
            userCoins = [];
        }
    }
}

// Save user coins to localStorage and Firestore (if signed in)
function saveUserCoins() {
    // Always save to localStorage
    localStorage.setItem('litmus_user_coins', JSON.stringify(userCoins));
    
    // Sync to Firestore if signed in
    if (window.LitmusAuth && window.LitmusAuth.isSignedIn()) {
        window.LitmusAuth.saveUserPreferences({
            selectedCoins: userCoins,
            defaultRegion: currentRegion
        });
    }
}

// Initialize settings modal
function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('cancel-settings');
    const saveBtn = document.getElementById('save-settings');
    const searchInput = document.getElementById('coin-search');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openSettingsModal();
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSettingsModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeSettingsModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSettingsModal();
            }
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            // Save region
            const activeRegionBtn = document.querySelector('#region-options .region-btn.active');
            if (activeRegionBtn) {
                const newRegion = activeRegionBtn.dataset.region;
                localStorage.setItem('litmus_region', newRegion);
                
                // Update the region picker buttons in header
                if (newRegion !== currentRegion) {
                    currentRegion = newRegion;
                    document.querySelectorAll('.edition').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.region === newRegion);
                    });
                    updateStickyRegion();
                    await checkBriefAvailability(newRegion);
                    await loadContent(newRegion, currentBriefType);
                }
                
                // Sync to cloud if signed in
                if (typeof userSync !== 'undefined' && userSync.saveRegion) {
                    await userSync.saveRegion(newRegion);
                }
            }
            
            // Save coins
            saveUserCoins();
            loadYourCoins();
            closeSettingsModal();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterCoinList(e.target.value);
        });
    }
    
    // Region button click handlers
    document.querySelectorAll('#region-options .region-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#region-options .region-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// Open settings modal
async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        // Close user menu if open
        const userMenu = document.getElementById('user-menu');
        if (userMenu) userMenu.classList.remove('active');
        
        // Load current region selection
        const currentRegion = localStorage.getItem('litmus_region') || 'americas';
        document.querySelectorAll('#region-options .region-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.region === currentRegion);
        });
        
        modal.classList.add('active');
        await loadCoinList();
        renderCoinList();
        updateCoinCount();
    }
}

// Close settings modal
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load all coins from static file (faster, no API rate limits)
async function loadCoinList() {
    if (allCoins.length > 0) return; // Already loaded
    
    try {
        const response = await fetch('./data/coins.json');
        if (response.ok) {
            allCoins = await response.json();
            // Sort alphabetically by symbol
            allCoins.sort((a, b) => a.symbol.localeCompare(b.symbol));
        }
    } catch (error) {
        console.error('Error loading coin list:', error);
    }
}

// Render coin list in modal
function renderCoinList(filter = '') {
    const container = document.getElementById('coin-list');
    if (!container) return;
    
    const filterLower = filter.toLowerCase();
    const filteredCoins = allCoins.filter(coin => 
        coin.name.toLowerCase().includes(filterLower) ||
        coin.symbol.toLowerCase().includes(filterLower)
    );
    
    container.innerHTML = filteredCoins.map(coin => {
        const isDefault = DEFAULT_COINS.includes(coin.id);
        const isSelected = isDefault || userCoins.includes(coin.id);
        const isLocked = isDefault;
        
        return `
            <div class="coin-item ${isLocked ? 'locked' : ''}" data-coin-id="${coin.id}" ${isLocked ? '' : 'onclick="toggleCoin(\'' + coin.id + '\')"'}>
                <img class="coin-icon" src="${coin.image}" alt="${coin.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%23ccc%22/></svg>'">
                <div class="coin-info">
                    <div class="coin-name">${coin.name}</div>
                    <div class="coin-symbol">${coin.symbol}</div>
                </div>
                <div class="coin-check ${isLocked ? 'locked' : isSelected ? 'selected' : 'unselected'}">
                    ${isSelected ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20,6 9,17 4,12"/></svg>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Toggle coin selection
function toggleCoin(coinId) {
    const index = userCoins.indexOf(coinId);
    
    if (index > -1) {
        // Deselect
        userCoins.splice(index, 1);
    } else {
        // Select (if under max)
        if (userCoins.length < MAX_USER_COINS) {
            userCoins.push(coinId);
        } else {
            // Show feedback that max is reached
            alert(`Maximum ${MAX_USER_COINS} additional coins allowed.`);
            return;
        }
    }
    
    renderCoinList(document.getElementById('coin-search')?.value || '');
    updateCoinCount();
}

// Filter coin list by search
function filterCoinList(query) {
    renderCoinList(query);
}

// Update coin count display
function updateCoinCount() {
    const countEl = document.getElementById('coin-count');
    const listEl = document.getElementById('coins-selected-list');
    
    if (countEl) {
        countEl.textContent = userCoins.length;
    }
    
    if (listEl) {
        const allSelected = [...DEFAULT_COINS.map(id => id === 'bitcoin' ? 'BTC' : 'ETH'), ...userCoins.map(id => {
            const coin = allCoins.find(c => c.id === id);
            return coin ? coin.symbol.toUpperCase() : id.toUpperCase();
        })];
        listEl.textContent = allSelected.join(', ');
    }
}

// ========== YOUR COINS DISPLAY ==========

// Load and display user's coins
async function loadYourCoins() {
    try {
        // Always include BTC and ETH, plus user's coins
        const baseCoinIds = ['bitcoin', 'ethereum'];
        const allCoinIds = [...new Set([...baseCoinIds, ...userCoins])]; // Dedupe
        
        const coinIds = allCoinIds.join(',');
        const coinsResponse = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`);
        
        // Fetch market data for baseline
        const globalResponse = await fetch('https://api.coingecko.com/api/v3/global');
        
        if (!coinsResponse.ok) return;
        
        const coins = await coinsResponse.json();
        
        // Sort: BTC first, ETH second, then rest by market cap
        const sortedCoins = coins.sort((a, b) => {
            if (a.id === 'bitcoin') return -1;
            if (b.id === 'bitcoin') return 1;
            if (a.id === 'ethereum') return -1;
            if (b.id === 'ethereum') return 1;
            return (a.market_cap_rank || 999) - (b.market_cap_rank || 999);
        });
        
        // Get market 24h change (fallback to 0 if unavailable)
        let marketChange = 0;
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            marketChange = globalData.data?.market_cap_change_percentage_24h_usd || 0;
        }
        
        renderRelativePerformance(sortedCoins, marketChange);
        
    } catch (error) {
        console.error('Error loading your coins:', error);
    }
}

// Render Relative Performance section
function renderRelativePerformance(coins, marketChange) {
    const container = document.getElementById('relative-performance');
    const chartContainer = document.getElementById('relative-chart');
    
    if (!container || !chartContainer) return;
    
    container.style.display = 'block';
    
    // Update market change display
    const marketChangeEl = document.getElementById('market-24h-change');
    if (marketChangeEl) {
        const sign = marketChange >= 0 ? '+' : '';
        marketChangeEl.textContent = `${sign}${marketChange.toFixed(1)}%`;
    }
    
    // Build coin rows
    const coinRows = coins.map(coin => {
        const coinChange = coin.price_change_percentage_24h || 0;
        const relativeChange = coinChange - marketChange;
        const isOutperforming = relativeChange >= 0;
        
        // Bar width: scale relative change to percentage of half the container
        // Max bar = 50% of container (full one side)
        // Scale: 5% relative = 50% bar width (adjust as needed)
        const maxRelative = 5; // ±5% relative = full bar
        const barWidth = Math.min(Math.abs(relativeChange) / maxRelative * 50, 50);
        
        const sign = coinChange >= 0 ? '+' : '';
        const relSign = relativeChange >= 0 ? '+' : '';
        
        return `
            <div class="relative-row">
                <span class="rel-name">${coin.symbol.toUpperCase()}</span>
                <span class="rel-change">${sign}${coinChange.toFixed(1)}%</span>
                <div class="rel-bar-container">
                    <div class="rel-baseline"></div>
                    <div class="rel-bar ${isOutperforming ? 'outperform' : 'underperform'}" 
                         style="width: ${barWidth}%"></div>
                </div>
                <span class="rel-vs ${isOutperforming ? 'positive' : 'negative'}">${relSign}${relativeChange.toFixed(1)}%</span>
            </div>
        `;
    }).join('');
    
    // Keep market row, add coin rows after
    const marketRow = chartContainer.querySelector('.market-row');
    if (marketRow) {
        // Remove old coin rows
        chartContainer.querySelectorAll('.relative-row:not(.market-row)').forEach(el => el.remove());
        // Add new coin rows
        marketRow.insertAdjacentHTML('afterend', coinRows);
    }
}

// Format coin price (smart decimals)
function formatCoinPrice(price) {
    if (price >= 1000) {
        return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else if (price >= 1) {
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 0.01) {
        return price.toFixed(4);
    } else {
        return price.toFixed(6);
    }
}

// Export functions for auth module
window.loadYourCoins = loadYourCoins;
window.setRegion = function(region) {
    if (['americas', 'emea', 'apac'].includes(region)) {
        currentRegion = region;
        document.querySelectorAll('.edition').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.region === region);
        });
        loadBrief();
    }
};

// ========== MOBILE READER FUNCTIONS ==========

// Check if we're on mobile
function isMobileView() {
    return window.innerWidth < 768;
}

// Check if we're on tablet
function isTabletView() {
    return window.innerWidth >= 768 && window.innerWidth <= 1200;
}

// Open mobile reader overlay (and scroll to top on tablet)
function openMobileReader() {
    const readingPane = document.getElementById('reading-pane');
    
    if (isMobileView()) {
        // Phone: show overlay
        if (readingPane) {
            readingPane.classList.add('active');
            document.body.classList.add('reader-open');
            readingPane.scrollTop = 0;
        }
    } else if (isTabletView() || window.innerWidth > 1200) {
        // Tablet/Desktop: just scroll reading pane to top
        if (readingPane) {
            readingPane.scrollTop = 0;
        }
    }
}

// Close mobile reader overlay
function closeMobileReader() {
    const readingPane = document.getElementById('reading-pane');
    if (readingPane) {
        readingPane.classList.remove('active');
        document.body.classList.remove('reader-open');
    }
}

// Make closeMobileReader available globally
window.closeMobileReader = closeMobileReader;

// ========== GOOGLE ANALYTICS 4 TRACKING ==========
// Helper function to track custom events
function trackEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, params);
        console.log('[GA4] Event:', eventName, params);
    }
}

// Track initial page load with region
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for everything to load
    setTimeout(() => {
        trackEvent('page_view_enhanced', {
            initial_region: currentRegion,
            initial_brief_type: currentBriefType
        });
    }, 1000);
});

// Export for use in other modules
window.trackEvent = trackEvent;
