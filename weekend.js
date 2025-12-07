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
    
    // Initialize sticky header
    initStickyHeader();
    
    // Load magazine content
    await loadMagazineContent();
    
    // Setup index card navigation
    setupIndexNavigation();
    
    // Setup sector expand/collapse
    setupSectorToggle();
    
    // Load relative performance
    loadRelativePerformance();
}

// Sticky Header
function initStickyHeader() {
    const stickyHeader = document.getElementById('sticky-header');
    const sectionNav = document.querySelector('.section-nav');
    
    if (!stickyHeader) return;
    
    // Get threshold
    let threshold = sectionNav ? sectionNav.offsetTop + sectionNav.offsetHeight : 150;
    
    // Update threshold on resize
    window.addEventListener('resize', () => {
        if (sectionNav) {
            threshold = sectionNav.offsetTop + sectionNav.offsetHeight;
        }
    });
    
    // Show/hide on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > threshold) {
            stickyHeader.classList.add('visible');
        } else {
            stickyHeader.classList.remove('visible');
        }
    });
    
    // Load sticky prices
    loadStickyPrices();
}

async function loadStickyPrices() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&order=market_cap_desc&sparkline=false&price_change_percentage=7d');
        if (!response.ok) return;
        
        const coins = await response.json();
        const btc = coins.find(c => c.id === 'bitcoin');
        const eth = coins.find(c => c.id === 'ethereum');
        
        if (btc) {
            const btcPrice = document.getElementById('sticky-btc-price');
            const btcChange = document.getElementById('sticky-btc-change');
            if (btcPrice) btcPrice.textContent = `$${(btc.current_price / 1000).toFixed(1)}k`;
            if (btcChange) {
                const change = btc.price_change_percentage_7d_in_currency || 0;
                btcChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
                btcChange.className = `sticky-change ${change >= 0 ? 'positive' : 'negative'}`;
            }
        }
        
        if (eth) {
            const ethPrice = document.getElementById('sticky-eth-price');
            const ethChange = document.getElementById('sticky-eth-change');
            if (ethPrice) ethPrice.textContent = `$${(eth.current_price / 1000).toFixed(1)}k`;
            if (ethChange) {
                const change = eth.price_change_percentage_7d_in_currency || 0;
                ethChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
                ethChange.className = `sticky-change ${change >= 0 ? 'positive' : 'negative'}`;
            }
        }
        
        // Market = average of BTC + ETH
        const marketEl = document.getElementById('sticky-market');
        if (marketEl && btc && eth) {
            const btcChange = btc.price_change_percentage_7d_in_currency || 0;
            const ethChange = eth.price_change_percentage_7d_in_currency || 0;
            const avgChange = (btcChange + ethChange) / 2;
            marketEl.textContent = `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%`;
        }
    } catch (e) {
        console.warn('[Weekend] Could not load sticky prices:', e);
    }
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
    // Update sector data if provided in magazine.json
    for (const [key, data] of Object.entries(sectors)) {
        const changeEl = document.getElementById(`sector-${key}-change`);
        const weeklyEl = document.getElementById(`sector-${key}-weekly`);
        
        if (changeEl && data.change !== undefined) {
            const change = data.change;
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change.toFixed(1)}%`;
            changeEl.className = 'sector-change ' + (change > 0.5 ? 'positive' : change < -0.5 ? 'negative' : 'neutral');
        }
        
        if (weeklyEl && data.weekly) {
            weeklyEl.textContent = data.weekly;
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
        // Get user's coins from Personal Edition first
        let personalCoinIds = [];
        const personalSaved = localStorage.getItem('litmus_personal_coins');
        if (personalSaved) {
            try {
                const personalCoins = JSON.parse(personalSaved);
                const holdings = personalCoins.filter(c => c.weight !== 'watching');
                personalCoinIds = holdings.map(c => c.id);
            } catch (e) {
                console.warn('Failed to parse Personal Edition coins');
            }
        }
        
        // Fallback to focusCoins if no Personal Edition
        if (personalCoinIds.length === 0) {
            const focusCoins = JSON.parse(localStorage.getItem('focusCoins') || '[]');
            personalCoinIds = focusCoins;
        }
        
        // Always include BTC and ETH
        const allCoinIds = [...new Set(['bitcoin', 'ethereum', ...personalCoinIds])];
        
        // Fetch directly from CoinGecko with 7d data
        const coinIds = allCoinIds.join(',');
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=7d`);
        
        if (!response.ok) return;
        
        const coins = await response.json();
        
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
        
        // Render coin rows in order
        allCoinIds.forEach(coinId => {
            const coin = coins.find(c => c.id === coinId);
            if (coin) {
                const row = createRelativeRow7d(coin, marketChange);
                chartEl.appendChild(row);
            }
        });
        
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
