/**
 * Weekend Magazine - The Litmus
 * In-depth weekly crypto analysis
 */

// Configuration
const CONFIG = {
    contentPath: './content/weekend',
    moodHistoryPath: './data/mood-history.json',
    marketMoodAPI: '/api/market-mood',  // Same as Today page
    segmentsPath: './data/segments.json'
};

// Magazine sections structure
const MAGAZINE_SECTIONS = {
    week_review: { 
        label: 'THE WEEK IN REVIEW',
        color: 'var(--burgundy)'
    },
    apac: { 
        label: 'ASIA-PACIFIC',
        color: '#D4A017'
    },
    emea: { 
        label: 'EUROPE & MIDDLE EAST',
        color: '#2E7D32'
    },
    americas: { 
        label: 'AMERICAS',
        color: '#1565C0'
    },
    flows: { 
        label: 'CAPITAL FLOWS',
        color: 'var(--burgundy)'
    },
    corporate: { 
        label: 'CORPORATE MOVES',
        color: 'var(--burgundy)'
    },
    outlook: { 
        label: 'THE WEEK AHEAD',
        color: 'var(--teal)'
    }
};

// State
let magazineData = null;
let moodHistory = [];
let liveMood = null;  // Real-time mood data (same as Today page)
let segmentsData = null;
let currentSection = 'week_review';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Weekend] Initializing...');
    
    // Set current date
    setMagazineDate();
    
    // Load content
    await loadMagazineContent();
    await loadMoodHistory();
    await loadLiveMood();  // Fetch real-time data for current dot
    await loadSegmentsData();
    
    // Initialize UI
    initIndexCards();
    renderMoodTrail();
    renderSegments();
    
    console.log('[Weekend] Ready');
});

// Set magazine date
function setMagazineDate() {
    const now = new Date();
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    
    const dateEl = document.getElementById('magazine-date');
    if (dateEl) dateEl.textContent = dateStr;
    
    const timestampEl = document.getElementById('reading-timestamp');
    if (timestampEl) timestampEl.textContent = dateStr;
    
    // Set week range for key dates
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + (8 - now.getDay()) % 7); // Next Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // Friday
    
    const weekStr = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${weekEnd.getDate()}`;
    const weekEl = document.getElementById('key-dates-week');
    if (weekEl) weekEl.textContent = weekStr;
}

// Load magazine content
async function loadMagazineContent() {
    try {
        const response = await fetch(`${CONFIG.contentPath}/magazine.json`);
        if (!response.ok) {
            console.log('[Weekend] Using default content');
            return;
        }
        
        magazineData = await response.json();
        
        // Update hero
        if (magazineData.hero) {
            setText('hero-headline', magazineData.hero.headline);
            setText('hero-subtitle', magazineData.hero.subtitle);
            if (magazineData.hero.image) {
                const heroImg = document.getElementById('hero-image-src');
                if (heroImg) heroImg.src = magazineData.hero.image;
            }
        }
        
        // Update key dates
        if (magazineData.key_dates) {
            renderKeyDates(magazineData.key_dates);
        }
        
        // Update index cards
        if (magazineData.sections) {
            Object.keys(magazineData.sections).forEach(key => {
                const section = magazineData.sections[key];
                const cardEl = document.getElementById(`card-${key.replace('_', '-')}`);
                if (cardEl && section.headline) {
                    cardEl.textContent = section.headline;
                }
            });
        }
        
        // Render initial section
        renderSection('week_review');
        
    } catch (error) {
        console.error('[Weekend] Content load error:', error);
    }
}

// Render key dates
function renderKeyDates(dates) {
    const container = document.getElementById('key-dates-list');
    if (!container || !dates.length) return;
    
    container.innerHTML = dates.map(date => `
        <div class="key-date">
            <span class="date-day">${date.day}</span>
            <span class="date-event">${date.event}</span>
        </div>
    `).join('');
}

// Load mood history
async function loadMoodHistory() {
    try {
        const response = await fetch(CONFIG.moodHistoryPath);
        if (!response.ok) throw new Error('Not found');
        
        const data = await response.json();
        // Get last 7 days from daily data
        moodHistory = (data.daily || []).slice(-7);
        
    } catch (error) {
        console.error('[Weekend] Mood history error:', error);
        // Generate mock data for demo
        moodHistory = generateMockMoodHistory();
    }
}

// Generate mock mood history for demo
function generateMockMoodHistory() {
    const history = [];
    // Generate 7 days of plausible data
    let breadth = 60 + Math.random() * 20;
    let mv = 15 + Math.random() * 10;
    
    for (let i = 6; i >= 0; i--) {
        // Random walk with some momentum
        breadth += (Math.random() - 0.4) * 8;
        breadth = Math.max(20, Math.min(90, breadth));
        mv += (Math.random() - 0.5) * 5;
        mv = Math.max(5, Math.min(35, mv));
        
        history.push({
            breadth: breadth,
            mv: mv
        });
    }
    return history;
}

// Load live mood data (same source as Today page)
async function loadLiveMood() {
    try {
        const response = await fetch(CONFIG.marketMoodAPI);
        if (!response.ok) throw new Error('API not available');
        
        liveMood = await response.json();
        console.log('[Weekend] Live mood loaded:', liveMood);
        
    } catch (error) {
        console.log('[Weekend] Live mood API not available, using historical data');
        // Fall back to last hourly data point if available
        liveMood = null;
    }
}

// Zone labels for mood
const MOOD_ZONES = {
    'strong-rally': { label: 'Strong Rally' },
    'leadership': { label: 'Leadership' },
    'concentration': { label: 'Concentration' },
    'steady-advance': { label: 'Steady Advance' },
    'consolidation': { label: 'Consolidation' },
    'rotation': { label: 'Rotation' },
    'weak-rally': { label: 'Weak Rally' },
    'drift': { label: 'Drift' },
    'capitulation': { label: 'Capitulation' }
};

const MOOD_DESCRIPTIONS = {
    'strong-rally': 'Broad participation with high conviction. The market is moving decisively higher with strong volume confirmation.',
    'leadership': 'Concentrated gains in leading assets. Strong momentum but watch for breadth expansion or contraction.',
    'concentration': 'Narrow market with high activity. A few assets leading while most lag behind.',
    'steady-advance': 'Healthy breadth with measured gains. Sustainable advance with balanced participation.',
    'consolidation': 'Balanced market digesting gains. Neither buyers nor sellers in clear control.',
    'rotation': 'Active repositioning across sectors. Money moving but direction unclear.',
    'weak-rally': 'Gains on low conviction. Price rises lack volume confirmation.',
    'drift': 'Quiet market with slight negative bias. Neither strong buying nor selling pressure.',
    'capitulation': 'High volume selling pressure. Potential exhaustion point worth monitoring.'
};

// Render 7-day mood trail
function renderMoodTrail() {
    const grid = document.getElementById('nine-box-grid-weekend');
    const trailPath = document.getElementById('trail-path-7day');
    const currentDot = document.getElementById('mood-dot-weekend');
    
    if (!grid || !moodHistory.length) {
        console.log('[Weekend] No grid or mood history');
        return;
    }
    
    // M/V range for mapping (same as Today page)
    const mvRange = { low: 5, high: 35 };
    
    // Map coordinates (breadth: 0-100 → 0-100%, mv: low→bottom, high→top)
    const mapX = (b) => Math.max(0, Math.min(100, (b / 100) * 100));
    const mapY = (mv) => {
        // High MV = top (0%), Low MV = bottom (100%)
        const normalized = (mv - mvRange.low) / (mvRange.high - mvRange.low);
        return Math.max(0, Math.min(100, (1 - normalized) * 100));
    };
    
    // Convert mood history to coordinates
    const points = moodHistory.map(point => ({
        x: mapX(point.breadth),
        y: mapY(point.mv)
    }));
    
    // Draw 7-day trail path
    if (trailPath && points.length > 1) {
        // Create smooth path using Catmull-Rom spline
        let d = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1] || curr;
            const prevPrev = points[i - 2] || prev;
            
            const tension = 0.3;
            const cp1x = prev.x + (curr.x - prevPrev.x) * tension;
            const cp1y = prev.y + (curr.y - prevPrev.y) * tension;
            const cp2x = curr.x - (next.x - prev.x) * tension;
            const cp2y = curr.y - (next.y - prev.y) * tension;
            
            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
        }
        
        trailPath.setAttribute('d', d);
    }
    
    // Position current dot - use LIVE data if available, otherwise last historical point
    // This ensures Weekend shows the same current position as Today page
    let current;
    if (liveMood && liveMood.breadth !== undefined) {
        // Use real-time data from /api/market-mood (same as Today)
        current = {
            breadth: liveMood.breadth,
            mv: liveMood.mvRatio24h || liveMood.mv || 18
        };
        console.log('[Weekend] Using live mood data for current dot');
    } else {
        // Fall back to last historical data point
        current = moodHistory[moodHistory.length - 1];
        console.log('[Weekend] Using historical data for current dot');
    }
    
    if (currentDot && current) {
        currentDot.style.left = `${mapX(current.breadth)}%`;
        currentDot.style.top = `${mapY(current.mv)}%`;
    }
    
    // Determine current zone
    const zone = getMarketZone(current.breadth, current.mv, mvRange);
    
    // Update title and description
    setText('mood-title-weekend', MOOD_ZONES[zone]?.label || 'Market Mood');
    setText('mood-description-weekend', MOOD_DESCRIPTIONS[zone] || '');
    setText('breadth-value-weekend', `${Math.round(current.breadth)}% of coins are green`);
    
    // Highlight active zone
    document.querySelectorAll('#nine-box-grid-weekend .box').forEach(box => {
        box.classList.remove('active-zone');
        if (box.dataset.zone === zone) {
            box.classList.add('active-zone');
        }
    });
    
    console.log('[Weekend] Mood trail rendered:', { zone, current, points: points.length });
}

// Get market zone based on breadth and M/V ratio
function getMarketZone(breadth, mv, mvRange) {
    const mvNorm = (mv - mvRange.low) / (mvRange.high - mvRange.low);
    
    // Determine column (breadth)
    let col;
    if (breadth < 33) col = 0;
    else if (breadth < 67) col = 1;
    else col = 2;
    
    // Determine row (M/V - lower value = frenzied = top)
    let row;
    if (mvNorm < 0.33) row = 0;  // Frenzied
    else if (mvNorm < 0.67) row = 1;  // Normal
    else row = 2;  // Quiet
    
    const zones = [
        ['concentration', 'leadership', 'strong-rally'],
        ['rotation', 'consolidation', 'steady-advance'],
        ['capitulation', 'drift', 'weak-rally']
    ];
    
    return zones[row][col];
}


// Load segments data
async function loadSegmentsData() {
    try {
        const response = await fetch(CONFIG.segmentsPath);
        if (!response.ok) return;
        
        segmentsData = await response.json();
        
    } catch (error) {
        console.error('[Weekend] Segments data error:', error);
    }
}

// Render segments with real data
function renderSegments() {
    if (!segmentsData) return;
    
    const container = document.getElementById('segments-list');
    if (!container) return;
    
    Object.entries(segmentsData.segments || {}).forEach(([key, data]) => {
        const item = container.querySelector(`[data-segment="${key}"]`);
        if (!item) return;
        
        const changeEl = item.querySelector('.segment-change');
        const fillEl = item.querySelector('.segment-fill');
        
        if (changeEl && data.change !== undefined) {
            const isPositive = data.change >= 0;
            const isNeutral = Math.abs(data.change) < 0.5;
            
            changeEl.textContent = `${isPositive ? '+' : ''}${data.change.toFixed(1)}%`;
            changeEl.className = `segment-change ${isNeutral ? 'neutral' : (isPositive ? 'positive' : 'negative')}`;
            
            if (fillEl) {
                // Normalize change to bar width (0-100%)
                const width = Math.min(Math.abs(data.change) * 5 + 20, 100);
                fillEl.style.width = `${width}%`;
                fillEl.className = `segment-fill ${isNeutral ? 'neutral' : (isPositive ? 'positive' : 'negative')}`;
            }
        }
    });
}

// Initialize index card clicks
function initIndexCards() {
    const cards = document.querySelectorAll('.index-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const sectionKey = card.dataset.section;
            
            // Update active state
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Render section
            currentSection = sectionKey;
            renderSection(sectionKey);
            
            // Track
            trackEvent('magazine_section_view', { section: sectionKey });
        });
    });
}

// Render section in reading pane
function renderSection(sectionKey) {
    const section = MAGAZINE_SECTIONS[sectionKey];
    if (!section) return;
    
    const labelEl = document.getElementById('reading-label');
    if (labelEl) {
        labelEl.textContent = section.label;
        labelEl.style.color = section.color;
    }
    
    // If we have magazine data, render content
    if (magazineData && magazineData.sections && magazineData.sections[sectionKey]) {
        const data = magazineData.sections[sectionKey];
        
        setText('reading-headline', data.headline || '');
        
        // Render body
        const bodyEl = document.getElementById('reading-body');
        if (bodyEl && data.content) {
            const paragraphs = data.content.split('\n\n').filter(p => p.trim());
            bodyEl.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
        }
    }
}

// Helper: Set text content
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Helper: Track events
function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
    console.log('[Weekend] Event:', name, params);
}

// Handle window resize for mood trail
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        renderMoodTrail();
    }, 250);
});
