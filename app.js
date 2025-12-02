// The Litmus - Editorial App

const CONFIG = {
    contentPath: './content',
    defaultRegion: 'americas'
};

// Data store
let briefData = null;
let currentSection = 'lead';
let currentRegion = CONFIG.defaultRegion;

// Section definitions with display names and headlines
const SECTIONS = {
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
    },
    takeaway: {
        label: 'THE TAKEAWAY',
        field: 'the_closing_line',
        defaultHeadline: 'The Bottom Line'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEditionPicker();
    initIndexCards();
    loadContent(currentRegion);
});

// Edition (Region) Picker
function initEditionPicker() {
    const buttons = document.querySelectorAll('.edition');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRegion = btn.dataset.region;
            loadContent(currentRegion);
        });
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
    
    // Update card active states
    document.querySelectorAll('.index-card').forEach(card => {
        card.classList.toggle('active', card.dataset.section === sectionKey);
    });
    
    // Update reading pane
    if (briefData) {
        renderReadingPane(sectionKey);
    }
}

// Load Content
async function loadContent(region) {
    try {
        const response = await fetch(`${CONFIG.contentPath}/${region}/morning.json`);
        if (!response.ok) throw new Error('Failed to load brief');
        
        briefData = await response.json();
        
        renderMarketData(briefData);
        renderIndexCards(briefData);
        renderReadingPane(currentSection);
        renderTimestamp(briefData);
        
        // Load week ahead
        loadWeekAhead(region);
        
    } catch (error) {
        console.error('Error loading content:', error);
    }
}

// Load Week Ahead
async function loadWeekAhead(region) {
    try {
        const response = await fetch(`${CONFIG.contentPath}/${region}/week-ahead.json`);
        if (!response.ok) return;
        
        const weekData = await response.json();
        renderWeekAhead(weekData);
        
    } catch (error) {
        console.log('Week ahead not available');
    }
}

// Render Market Data
function renderMarketData(data) {
    if (data.btc_price) {
        setText('btc-price', formatPrice(data.btc_price));
    }
    if (data.btc_24h_change !== undefined) {
        const el = document.getElementById('btc-change');
        if (el) {
            el.textContent = formatChange(data.btc_24h_change);
            el.className = `ticker-change ${data.btc_24h_change >= 0 ? 'up' : 'down'}`;
        }
    }
    if (data.eth_price) {
        setText('eth-price', formatPrice(data.eth_price));
    }
    if (data.eth_24h_change !== undefined) {
        const el = document.getElementById('eth-change');
        if (el) {
            el.textContent = formatChange(data.eth_24h_change);
            el.className = `ticker-change ${data.eth_24h_change >= 0 ? 'up' : 'down'}`;
        }
    }
    if (data.total_market_cap) {
        setText('total-market', formatMarketCap(data.total_market_cap));
    }
}

// Render Index Cards
function renderIndexCards(data) {
    if (!data.sections) return;
    
    Object.keys(SECTIONS).forEach(key => {
        const section = SECTIONS[key];
        const content = data.sections[section.field] || '';
        
        // Generate a headline from the content (first few words or use default)
        const headline = generateHeadline(content, section.defaultHeadline);
        const excerpt = truncate(content, 100);
        
        setText(`index-${key}-headline`, headline);
        setText(`index-${key}-excerpt`, excerpt);
    });
}

// Render Reading Pane
function renderReadingPane(sectionKey) {
    if (!briefData || !briefData.sections) return;
    
    const section = SECTIONS[sectionKey];
    const content = briefData.sections[section.field] || '';
    
    // Update label
    setText('reading-label', section.label);
    
    // Update headline (use main brief headline for lead, generate for others)
    if (sectionKey === 'lead') {
        setText('reading-headline', briefData.headline || 'Morning Brief');
    } else {
        setText('reading-headline', generateHeadline(content, section.defaultHeadline));
    }
    
    // Update body - split into paragraphs for better reading
    const bodyEl = document.getElementById('reading-body');
    if (bodyEl) {
        // For longer sections, split by sentence groups; for short, keep as one
        const paragraphs = splitIntoParagraphs(content);
        bodyEl.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
    }
}

// Render Week Ahead
function renderWeekAhead(data) {
    if (!data.sections) return;
    
    const items = [
        { id: 'week-1', content: data.sections.fulcrum },
        { id: 'week-2', content: data.sections.levels },
        { id: 'week-3', content: data.sections.unpriced },
        { id: 'week-4', content: data.sections.wildcard }
    ];
    
    items.forEach((item, i) => {
        if (item.content) {
            const headline = generateHeadline(item.content, `Watch Point ${i + 1}`);
            setText(`${item.id}-headline`, headline);
            setText(`${item.id}-excerpt`, truncate(item.content, 60));
        }
    });
}

// Render Timestamp
function renderTimestamp(data) {
    if (data.generated_at) {
        const date = new Date(data.generated_at);
        setText('brief-date', formatDate(date));
        setText('last-updated', formatTime(date));
        setText('reading-timestamp', `${formatDate(date)} · ${formatTime(date)}`);
    }
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
    
    // Split by sentences, group into paragraphs of 2-3 sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    const paragraphs = [];
    
    for (let i = 0; i < sentences.length; i += 2) {
        const para = sentences.slice(i, i + 2).join(' ').trim();
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
