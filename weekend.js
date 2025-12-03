/**
 * Weekend Magazine - The Litmus
 * In-depth weekly crypto analysis
 */

// Configuration
const CONFIG = {
    contentPath: './content/weekend',
    moodHistoryPath: './data/mood-history.json',
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
        if (!response.ok) return;
        
        const data = await response.json();
        // Get last 7 days
        moodHistory = (data.history || []).slice(-7);
        
    } catch (error) {
        console.error('[Weekend] Mood history error:', error);
        // Generate mock data for demo
        moodHistory = generateMockMoodHistory();
    }
}

// Generate mock mood history for demo
function generateMockMoodHistory() {
    const history = [];
    for (let i = 6; i >= 0; i--) {
        history.push({
            volume: 40 + Math.random() * 40,
            winners_pct: 30 + Math.random() * 50
        });
    }
    return history;
}

// Render mood trail on 9-box grid
function renderMoodTrail() {
    const grid = document.getElementById('mood-grid-weekend');
    const svg = document.getElementById('mood-trail-weekend');
    const dot = document.getElementById('mood-dot-weekend');
    
    if (!grid || !svg || !moodHistory.length) return;
    
    const gridRect = grid.getBoundingClientRect();
    const cellWidth = gridRect.width / 3;
    const cellHeight = gridRect.height / 3;
    
    // Convert mood data to coordinates
    const points = moodHistory.map(point => {
        // X: winners_pct (0-100) -> (0-100% of grid width)
        const x = (point.winners_pct / 100) * gridRect.width;
        // Y: volume (0-100) -> inverted (high volume = top)
        const y = (1 - point.volume / 100) * gridRect.height;
        return { x, y };
    });
    
    // Draw trail path
    if (points.length > 1) {
        const pathData = points.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ');
        
        svg.innerHTML = `
            <path class="mood-trail-path" d="${pathData}" />
        `;
    }
    
    // Position current dot (last point)
    const current = points[points.length - 1];
    if (current) {
        dot.style.left = `${current.x}px`;
        dot.style.top = `${current.y}px`;
    }
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
