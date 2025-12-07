// The Litmus - Editorial App

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
    mechanism: {
        label: 'THE MECHANISM',
        field: 'the_mechanism',
        defaultHeadline: 'What\'s Driving This'
    },
    complication: {
        label: 'THE COMPLICATION',
        field: 'the_complication',
        defaultHeadline: 'The Counterpoint'
    },
    behavior: {
        label: 'THE BEHAVIORAL ANGLE',
        field: 'the_behavioral_layer',
        defaultHeadline: 'The Psychology'
    },
    outlook: {
        label: 'LOOKING AHEAD',
        field: 'the_forward_view',
        defaultHeadline: 'What to Watch'
    }
    // THE TAKEAWAY is now a separate quote box, not clickable
};

// Section definitions - Evening Brief
const SECTIONS_EVENING = {
    session: {
        label: 'THE SESSION',
        field: 'the_session',
        defaultHeadline: 'Today\'s Character'
    },
    flows: {
        label: 'THE FLOWS',
        field: 'the_flows',
        defaultHeadline: 'Where Money Moved'
    },
    divergence: {
        label: 'THE DIVERGENCE',
        field: 'the_divergence',
        defaultHeadline: 'What Doesn\'t Fit'
    },
    regime: {
        label: 'THE REGIME CHECK',
        field: 'the_regime_check',
        defaultHeadline: 'Has Anything Changed?'
    },
    overnight: {
        label: 'THE OVERNIGHT SETUP',
        field: 'the_overnight_setup',
        defaultHeadline: 'What\'s Ahead'
    }
    // THE TAKEAWAY is now a separate quote box, not clickable
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
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRegion = btn.dataset.region;
            
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
        // Extract time and timezone from ISO string
        // e.g., "2025-12-03T06:00:00+08:00" → "06:00 SGT"
        const timeMatch = isoString.match(/T(\d{2}):(\d{2})/);
        const tzMatch = isoString.match(/([+-]\d{2}):?(\d{2})$/);
        
        if (!timeMatch) return '';
        
        const hours = timeMatch[1];
        const minutes = timeMatch[2];
        const timeStr = `${hours}:${minutes}`;
        
        if (!tzMatch) return timeStr;
        
        // Map timezone offset to abbreviation
        const offsetStr = tzMatch[1];
        const tzMap = {
            '-05': 'EST',
            '-04': 'EDT', 
            '+00': 'GMT',
            '+01': 'CET',
            '+02': 'EET',
            '+08': 'SGT',
            '+09': 'JST',
            '+10': 'AEST',
            '+11': 'AEDT'
        };
        
        const tzAbbrev = tzMap[offsetStr] || `UTC${offsetStr}`;
        
        return `${timeStr} ${tzAbbrev}`;
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
}

// Index Card Click Handlers
function initIndexCards() {
    const cards = document.querySelectorAll('.index-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            setActiveSection(section);
        });
    });
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
        // Fetch coin data (BTC, ETH)
        const coinsResponse = await fetch(CONFIG.coinGeckoAPI);
        if (!coinsResponse.ok) throw new Error('Failed to fetch coin data');
        
        const coins = await coinsResponse.json();
        
        // Find BTC and ETH
        const btc = coins.find(c => c.id === 'bitcoin');
        const eth = coins.find(c => c.id === 'ethereum');
        
        if (btc) {
            setText('btc-price', formatPrice(btc.current_price));
            updateChangeElement('btc-change', btc.price_change_percentage_24h);
            // Update sticky header
            setText('sticky-btc-price', formatPriceCompact(btc.current_price));
            updateStickyChange('sticky-btc-change', btc.price_change_percentage_24h);
        }
        
        if (eth) {
            setText('eth-price', formatPrice(eth.current_price));
            updateChangeElement('eth-change', eth.price_change_percentage_24h);
            // Update sticky header
            setText('sticky-eth-price', formatPriceCompact(eth.current_price));
            updateStickyChange('sticky-eth-change', eth.price_change_percentage_24h);
        }
        
        // Fetch global market data
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
        
    } catch (error) {
        console.error('Error loading market data:', error);
    }
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
            // Use fallback mock data if API not available
            renderMarketMood(getMockMarketMood());
            return;
        }
        
        const data = await response.json();
        renderMarketMood(data);
        
    } catch (error) {
        console.log('Market mood API not available, using mock data');
        renderMarketMood(getMockMarketMood());
    }
}

// Mock data for development
function getMockMarketMood() {
    return {
        breadth: 88,                // Current breadth (teal dot X)
        breadthAvg24h: 75,          // Average breadth over 24h (burgundy dot X)
        mvRatio24h: 18.7,           // M/V using 24h volume (teal dot Y)
        mvRatio7d: 22.0,            // M/V using 7d avg volume (burgundy dot Y)
        trail: [
            { breadth: 72, mv: 24.5 },
            { breadth: 75, mv: 21.2 },
            { breadth: 80, mv: 19.8 },
            { breadth: 85, mv: 18.2 },
            { breadth: 88, mv: 18.7 }
        ],
        mvRange: { low: 12, high: 39 }  // Y-axis bounds
    };
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
            renderETFFlows(data);
            
            // Show data source indicator if using live data
            if (data.source === 'sosovalue') {
                console.log('ETF Flows: Live data from SoSoValue');
            }
            return;
        }
        
        // Fallback to brief data
        const region = currentRegion || 'emea';
        const briefResponse = await fetch(`./content/${region}/morning.json`);
        
        if (briefResponse.ok) {
            const brief = await briefResponse.json();
            if (brief.etf_flows) {
                renderETFFlows(brief.etf_flows);
                return;
            }
        }
        
        // Final fallback to mock data
        renderETFFlows(getMockETFFlows());
        
    } catch (error) {
        console.log('ETF flows not available, using mock data');
        renderETFFlows(getMockETFFlows());
    }
}

function getMockETFFlows() {
    // Mock data - will be replaced with real data source
    return {
        yesterday: {
            amount: 438,
            date: 'Yesterday'
        },
        week: [
            { day: 'Mon', amount: 215 },
            { day: 'Tue', amount: 380 },
            { day: 'Wed', amount: -120 },
            { day: 'Thu', amount: 290 },
            { day: 'Fri', amount: 438 }
        ],
        insight: 'Third consecutive day of net inflows'
    };
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
        // Try live API first (CoinGecko stablecoin data)
        const apiResponse = await fetch('/api/the-number');
        
        if (apiResponse.ok) {
            const data = await apiResponse.json();
            renderTheNumber(data);
            
            if (data.source === 'coingecko') {
                console.log('The Number: Live data from CoinGecko');
            }
            return;
        }
        
        // Fallback to brief data
        const region = currentRegion || 'emea';
        const briefResponse = await fetch(`./content/${region}/morning.json`);
        
        if (briefResponse.ok) {
            const brief = await briefResponse.json();
            if (brief.the_number) {
                renderTheNumber(brief.the_number);
                return;
            }
        }
        
        // Final fallback to mock data
        renderTheNumber(getMockTheNumber());
        
    } catch (error) {
        console.log('The Number not available, using mock data');
        renderTheNumber(getMockTheNumber());
    }
}

function getMockTheNumber() {
    // Mock data - will be AI-generated
    return {
        value: '$311B',
        context: 'Stablecoin market cap—dry powder waiting on sidelines'
    };
}

function renderTheNumber(data) {
    if (!data) return;
    
    const valueEl = document.getElementById('number-value');
    const contextEl = document.getElementById('number-context');
    
    if (valueEl && data.value) {
        // Check if this is a dollar value (stablecoin) or index value (Fear & Greed)
        const value = String(data.value);
        const isDollarValue = value.includes('$') || value.includes('B') || value.includes('T');
        
        if (isDollarValue) {
            // Stablecoin market cap - no suffix
            valueEl.innerHTML = value;
        } else if (data.suffix) {
            // Index with explicit suffix (e.g., Fear & Greed)
            valueEl.innerHTML = `${value}<span class="number-suffix">${data.suffix}</span>`;
        } else {
            // Plain number - assume it's an index, add /100
            valueEl.innerHTML = `${value}<span class="number-suffix">/100</span>`;
        }
    }
    
    if (contextEl && data.context) {
        contextEl.textContent = data.context;
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
    
    Object.keys(sections).forEach(key => {
        const section = sections[key];
        const content = data.sections[section.field] || '';
        
        // Get section-specific title if available (new format)
        let headline;
        const sectionTitle = data.sections[`${section.field}_title`];
        
        if (key === firstSectionKey && data.headline) {
            headline = data.headline;
        } else if (sectionTitle) {
            headline = sectionTitle;
        } else {
            headline = section.defaultHeadline;
        }
        
        setText(`index-${key}-headline`, headline);
        
        // FT style: excerpt ONLY for THE LEAD
        const excerptEl = document.getElementById(`index-${key}-excerpt`);
        if (excerptEl) {
            if (key === firstSectionKey) {
                excerptEl.style.display = 'block';
                excerptEl.textContent = truncate(content, 100);
            } else {
                excerptEl.style.display = 'none';
            }
        }
    });
    
    // Render THE TAKEAWAY quote box
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
            
            // Local fallback image (place in root folder)
            // Dimensions: 1200x600px (2:1 aspect ratio)
            const localFallback = './images/lead-fallback.jpg';
            
            // Curated Unsplash fallback images (financial/crypto themed)
            const unsplashFallbacks = [
                'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=600&fit=crop', // Trading screens
                'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1200&h=600&fit=crop', // Crypto chart
                'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=1200&h=600&fit=crop', // Financial district
                'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&h=600&fit=crop', // City skyline
                'https://images.unsplash.com/photo-1559526324-593bc073d938?w=1200&h=600&fit=crop', // Abstract data
            ];
            
            // Choose image source
            let imageUrl;
            if (briefData.image_keywords) {
                // Use Unsplash search if keywords provided
                const keywords = encodeURIComponent(briefData.image_keywords);
                imageUrl = `https://source.unsplash.com/1200x600/?${keywords}`;
            } else {
                // Use random fallback based on headline hash for consistency
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
                        // Final fallback: local image or hide container
                        const localImg = new Image();
                        localImg.onload = function() {
                            imageEl.src = localFallback;
                            imageEl.classList.remove('loading');
                        };
                        localImg.onerror = function() {
                            // No image available - hide container
                            imageContainer.style.display = 'none';
                            if (articleLabel) articleLabel.style.display = 'block';
                            if (articleHeadline) articleHeadline.style.display = 'block';
                            if (articleHeader) articleHeader.classList.remove('with-image');
                        };
                        localImg.src = localFallback;
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
        const paragraphs = splitIntoParagraphs(content);
        bodyEl.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
    }
}

// Render Week Ahead
function renderWeekAhead(data) {
    if (!data.sections) return;
    
    // Update date
    if (data.generated_at) {
        const date = new Date(data.generated_at);
        setText('week-ahead-date', `Week of ${formatShortDate(date)}`);
    }
    
    // Render each section
    const sections = ['fulcrum', 'levels', 'unpriced', 'underestimated'];
    
    sections.forEach(key => {
        const section = data.sections[key];
        if (section) {
            setText(`week-${key}-headline`, section.title || key);
            setText(`week-${key}-excerpt`, truncate(section.content, 80));
        }
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

// Render Timestamp
function renderTimestamp(data) {
    if (data.generated_at) {
        const isoString = data.generated_at;
        
        // Parse date components directly from ISO string to avoid timezone conversion
        // Format: "2025-12-03T06:00:00+08:00"
        const dateMatch = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (dateMatch) {
            const [, year, month, day, hour, minute] = dateMatch;
            
            // Format date manually (month names)
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const dateStr = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
            
            // Format time with timezone
            const tzAbbrev = getTimezoneAbbrev(isoString);
            const timeStr = `${hour}:${minute} ${tzAbbrev}`;
            
            setText('brief-date', dateStr);
            setText('reading-timestamp', `${dateStr} · ${timeStr}`);
        }
    }
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

// Helper: Split content into paragraphs
function splitIntoParagraphs(content) {
    if (!content) return [];
    
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
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSettingsModal();
            }
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
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
}

// Open settings modal
async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
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
