/**
 * Weekend Magazine - The Litmus
 * Handles content loading, section navigation, and interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
    init();
});

// Store loaded content
let magazineData = null;

async function init() {
    console.log('[Weekend] Initializing...');
    
    // Set date
    setMagazineDate();
    
    // Load magazine content
    await loadMagazineContent();
    
    // Setup index card navigation
    setupIndexNavigation();
    
    // Setup sector expand/collapse
    setupSectorToggle();
    
    // Load relative performance
    loadRelativePerformance();
}

function setMagazineDate() {
    const dateEl = document.getElementById('magazine-date');
    const timestampEl = document.getElementById('reading-timestamp');
    
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = now.toLocaleDateString('en-US', options);
    
    if (dateEl) dateEl.textContent = formatted;
    if (timestampEl) timestampEl.textContent = formatted;
}

async function loadMagazineContent() {
    try {
        const response = await fetch('content/weekend/magazine.json');
        
        if (!response.ok) {
            console.warn('[Weekend] No magazine.json found, using defaults');
            return;
        }
        
        magazineData = await response.json();
        console.log('[Weekend] Magazine loaded:', magazineData);
        
        // Populate hero
        if (magazineData.hero) {
            setText('hero-headline', magazineData.hero.headline);
            setText('hero-subtitle', magazineData.hero.subtitle);
            
            // Set hero image from curated library
            if (magazineData.hero.image_url) {
                const heroImg = document.getElementById('hero-image-src');
                if (heroImg) {
                    heroImg.src = magazineData.hero.image_url;
                }
            }
        }
        
        // Populate index card headlines
        if (magazineData.week_in_review) {
            setText('card-week-review', magazineData.week_in_review.title || 'The Week in Review');
        }
        if (magazineData.apac) {
            setText('card-apac', magazineData.apac.title || 'Asia-Pacific');
        }
        if (magazineData.emea) {
            setText('card-emea', magazineData.emea.title || 'Europe & Middle East');
        }
        if (magazineData.americas) {
            setText('card-americas', magazineData.americas.title || 'Americas');
        }
        if (magazineData.capital_flows) {
            setText('card-flows', magazineData.capital_flows.title || 'Capital Flows');
        }
        if (magazineData.corporate) {
            setText('card-corporate', magazineData.corporate.title || 'Corporate Moves');
        }
        if (magazineData.week_ahead) {
            setText('card-outlook', magazineData.week_ahead.title || 'Week Ahead');
        }
        if (magazineData.mechanism) {
            setText('card-mechanism', magazineData.mechanism.topic || 'The Mechanism');
        }
        
        // Load default section (week_review)
        loadSection('week_review');
        
        // Populate key dates if available
        if (magazineData.key_dates) {
            renderKeyDates(magazineData.key_dates);
        }
        
        // Populate sectors if available
        if (magazineData.sectors) {
            renderSectors(magazineData.sectors);
        }
        
    } catch (error) {
        console.error('[Weekend] Error loading magazine:', error);
    }
}

function setupIndexNavigation() {
    const indexCards = document.querySelectorAll('.index-card');
    
    indexCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active from all
            indexCards.forEach(c => c.classList.remove('active'));
            // Add active to clicked
            card.classList.add('active');
            
            // Load the section
            const section = card.dataset.section;
            loadSection(section);
        });
    });
}

function loadSection(sectionKey) {
    if (!magazineData) {
        console.warn('[Weekend] No magazine data loaded');
        return;
    }
    
    const labelEl = document.getElementById('reading-label');
    const headlineEl = document.getElementById('reading-headline');
    const bodyEl = document.getElementById('reading-body');
    const mechanismSection = document.getElementById('mechanism-section');
    
    // Hide mechanism section by default
    if (mechanismSection) {
        mechanismSection.style.display = 'none';
    }
    
    // Map section keys to data and labels
    const sectionMap = {
        'week_review': { data: magazineData.week_in_review, label: 'THE WEEK IN REVIEW' },
        'apac': { data: magazineData.apac, label: 'ASIA-PACIFIC' },
        'emea': { data: magazineData.emea, label: 'EUROPE & MIDDLE EAST' },
        'americas': { data: magazineData.americas, label: 'AMERICAS' },
        'flows': { data: magazineData.capital_flows, label: 'CAPITAL FLOWS' },
        'corporate': { data: magazineData.corporate, label: 'CORPORATE MOVES' },
        'outlook': { data: magazineData.week_ahead, label: 'THE WEEK AHEAD' },
        'mechanism': { data: magazineData.mechanism, label: 'THE MECHANISM' }
    };
    
    const section = sectionMap[sectionKey];
    
    if (!section || !section.data) {
        console.warn('[Weekend] Section not found:', sectionKey);
        return;
    }
    
    // Handle mechanism differently
    if (sectionKey === 'mechanism') {
        loadMechanismSection(section.data);
        return;
    }
    
    // Update label
    if (labelEl) {
        labelEl.textContent = section.label;
        labelEl.style.color = ''; // Reset color
        // Reset classes and add region class if applicable
        labelEl.className = 'article-label';
        if (sectionKey === 'apac') labelEl.classList.add('region-apac');
        if (sectionKey === 'emea') labelEl.classList.add('region-emea');
        if (sectionKey === 'americas') labelEl.classList.add('region-americas');
    }
    
    // Update headline
    if (headlineEl) {
        headlineEl.textContent = section.data.title || section.label;
    }
    
    // Update body content
    if (bodyEl && section.data.content) {
        const paragraphs = section.data.content.split('\n\n').filter(p => p.trim());
        bodyEl.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    }
    
    // Scroll to top of reading pane
    const readingPane = document.querySelector('.reading-pane');
    if (readingPane) {
        readingPane.scrollTop = 0;
    }
}

/**
 * Load The Mechanism section - SIMPLIFIED
 * No duplication: header shows label + topic, colored box shows timing + content
 */
function loadMechanismSection(mechanism) {
    const labelEl = document.getElementById('reading-label');
    const headlineEl = document.getElementById('reading-headline');
    const bodyEl = document.getElementById('reading-body');
    const mechanismSection = document.getElementById('mechanism-section');
    
    // Update the article header (above the colored box)
    if (labelEl) {
        labelEl.textContent = 'THE MECHANISM';
        labelEl.className = 'article-label';
        labelEl.style.color = 'var(--teal)';
    }
    
    if (headlineEl) {
        headlineEl.textContent = mechanism.topic || 'How It Actually Works';
    }
    
    // Clear the body - mechanism content goes in the colored section below
    if (bodyEl) {
        bodyEl.innerHTML = '';
    }
    
    // Show and populate mechanism section (the colored box)
    if (mechanismSection) {
        mechanismSection.style.display = 'block';
        
        // Show the timing as the header of the box
        const timingEl = document.getElementById('mechanism-timing');
        if (timingEl && mechanism.timing) {
            timingEl.textContent = 'Why now: ' + mechanism.timing;
        }
        
        // Populate the content
        const contentEl = document.getElementById('mechanism-content');
        if (contentEl && mechanism.content) {
            contentEl.innerHTML = formatMechanismContent(mechanism.content);
        }
    }
    
    // Scroll to top
    const readingPane = document.querySelector('.reading-pane');
    if (readingPane) {
        readingPane.scrollTop = 0;
    }
}

function formatMechanismContent(content) {
    let html = '';
    const lines = content.split('\n');
    let currentParagraph = '';
    let inWatchSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for bold headers like **The Dollar Channel**
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
            // Flush current paragraph
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
            
            const headerText = trimmed.replace(/\*\*/g, '');
            
            // Check if this is the "What to Watch" section
            if (headerText.toLowerCase().includes('what to watch')) {
                html += `<div class="watch-box"><h4>${escapeHtml(headerText)}</h4>`;
                inWatchSection = true;
            } else {
                html += `<h4>${escapeHtml(headerText)}</h4>`;
            }
        } else if (trimmed === '') {
            // Empty line = paragraph break
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
        } else {
            // Regular text - handle inline bold
            currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
        }
    }
    
    // Flush remaining paragraph
    if (currentParagraph) {
        html += `<p>${escapeHtml(currentParagraph)}</p>`;
    }
    
    // Close watch box if opened
    if (inWatchSection) {
        html += '</div>';
    }
    
    return html;
}

function renderKeyDates(dates) {
    const listEl = document.getElementById('key-dates-list');
    if (!listEl || !Array.isArray(dates)) return;
    
    listEl.innerHTML = dates.map(date => `
        <div class="key-date">
            <span class="date-day">${escapeHtml(date.day)}</span>
            <span class="date-event">${escapeHtml(date.event)}</span>
        </div>
    `).join('');
}

function renderSectors(sectors) {
    if (!sectors) return;
    
    // Handle new structure where sectors contain AI commentary strings
    // Maps JSON keys to HTML element IDs
    const sectorMap = {
        'payment': 'payment',
        'stablecoin': 'stablecoin',
        'infrastructure': 'infrastructure',
        'defi': 'defi',
        'utility': 'utility',
        'entertainment': 'entertainment',
        'ai': 'ai'
    };
    
    for (const [key, value] of Object.entries(sectors)) {
        const htmlKey = sectorMap[key] || key;
        const weeklyEl = document.getElementById(`sector-${htmlKey}-weekly`);
        
        if (weeklyEl) {
            // Handle both old structure {weekly: "..."} and new structure "..."
            const commentary = typeof value === 'string' ? value : (value.weekly || '');
            if (commentary) {
                weeklyEl.textContent = commentary;
                weeklyEl.style.display = 'block';
            }
        }
        
        // Also handle change if provided in old format
        if (typeof value === 'object' && value.change !== undefined) {
            const changeEl = document.getElementById(`sector-${htmlKey}-change`);
            if (changeEl) {
                const change = value.change;
                const sign = change >= 0 ? '+' : '';
                changeEl.textContent = `${sign}${change.toFixed(1)}%`;
                changeEl.className = 'sector-change ' + (change > 0.5 ? 'positive' : change < -0.5 ? 'negative' : 'neutral');
            }
        }
    }
}

function setupSectorToggle() {
    const sectorItems = document.querySelectorAll('.sector-item');
    
    sectorItems.forEach(item => {
        item.addEventListener('click', () => {
            // Toggle expanded state
            const wasExpanded = item.classList.contains('expanded');
            
            // Close all others
            sectorItems.forEach(s => s.classList.remove('expanded'));
            
            // Toggle clicked one
            if (!wasExpanded) {
                item.classList.add('expanded');
            }
        });
    });
}

async function loadRelativePerformance() {
    const chartEl = document.getElementById('relative-chart-7d');
    const marketChangeEl = document.getElementById('market-7d-change');
    
    if (!chartEl) return;
    
    try {
        // Fetch market data
        const response = await fetch('/api/market-data');
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Update market baseline
        if (marketChangeEl && data.market_change_7d !== undefined) {
            const change = data.market_change_7d;
            const sign = change >= 0 ? '+' : '';
            marketChangeEl.textContent = `${sign}${change.toFixed(1)}%`;
        }
        
        // Get user's focus coins from localStorage
        const focusCoins = JSON.parse(localStorage.getItem('focusCoins') || '["bitcoin","ethereum"]');
        
        // Render coin rows
        if (data.coins && focusCoins.length > 0) {
            const existingRows = chartEl.querySelectorAll('.relative-row:not(.market-row)');
            existingRows.forEach(row => row.remove());
            
            const marketChange = data.market_change_7d || 0;
            
            focusCoins.forEach(coinId => {
                const coin = data.coins.find(c => c.id === coinId);
                if (coin) {
                    const row = createRelativeRow(coin, marketChange);
                    chartEl.appendChild(row);
                }
            });
        }
        
    } catch (error) {
        console.warn('[Weekend] Could not load relative performance:', error);
    }
}

function createRelativeRow(coin, marketChange) {
    const change = coin.price_change_7d || 0;
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

// ========== HELPERS ==========

function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Track events for analytics
function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
}
