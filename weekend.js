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
    
    // Initialize audio player
    initAudioPlayer();
    
    // Load magazine content
    await loadMagazineContent();
    
    // Setup index card navigation
    setupIndexNavigation();
    
    // Setup sector expand/collapse
    setupSectorToggle();
    
    // Load relative performance
    loadRelativePerformance();
    
    // Load market mood
    loadMarketMood();
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

// ========== AUDIO EDITION PLAYER ==========

function initAudioPlayer() {
    const audioEdition = document.getElementById('audio-edition');
    const audioElement = document.getElementById('audio-element');
    const audioSource = document.getElementById('audio-source');
    const playBtn = document.getElementById('audio-play-btn');
    const playIcon = playBtn?.querySelector('.play-icon');
    const pauseIcon = playBtn?.querySelector('.pause-icon');
    const progressBar = document.getElementById('audio-progress-bar');
    const progressHandle = document.getElementById('audio-progress-handle');
    const progress = document.getElementById('audio-progress');
    const currentTime = document.getElementById('audio-time-current');
    const totalTime = document.getElementById('audio-time-total');
    const durationDisplay = document.getElementById('audio-duration');
    const speedBtn = document.getElementById('audio-speed-btn');
    const volumeBtn = document.getElementById('audio-volume-btn');
    const player = document.getElementById('audio-player');
    
    if (!audioEdition || !audioElement) return;
    
    // Try to load audio file
    loadWeekInReviewAudio();
    
    let isSeeking = false;
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    let speedIndex = 0;
    
    // Play/Pause
    playBtn?.addEventListener('click', () => {
        if (audioElement.paused) {
            audioElement.play();
        } else {
            audioElement.pause();
        }
    });
    
    // Update UI on play
    audioElement.addEventListener('play', () => {
        player?.classList.add('playing');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
    });
    
    // Update UI on pause
    audioElement.addEventListener('pause', () => {
        player?.classList.remove('playing');
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
    });
    
    // Update progress bar
    audioElement.addEventListener('timeupdate', () => {
        if (isSeeking) return;
        
        const percent = (audioElement.currentTime / audioElement.duration) * 100 || 0;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressHandle) progressHandle.style.left = `${percent}%`;
        if (currentTime) currentTime.textContent = formatTime(audioElement.currentTime);
    });
    
    // Set duration when loaded
    audioElement.addEventListener('loadedmetadata', () => {
        const duration = audioElement.duration;
        if (totalTime) totalTime.textContent = formatTime(duration);
        
        // Update duration display
        const minutes = Math.round(duration / 60);
        if (durationDisplay) durationDisplay.textContent = `${minutes} min listen`;
    });
    
    // Click on progress bar to seek
    progress?.addEventListener('click', (e) => {
        const rect = progress.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioElement.currentTime = percent * audioElement.duration;
    });
    
    // Drag progress handle
    progressHandle?.addEventListener('mousedown', () => {
        isSeeking = true;
        document.addEventListener('mousemove', handleSeek);
        document.addEventListener('mouseup', () => {
            isSeeking = false;
            document.removeEventListener('mousemove', handleSeek);
        }, { once: true });
    });
    
    function handleSeek(e) {
        if (!progress) return;
        const rect = progress.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        audioElement.currentTime = percent * audioElement.duration;
        if (progressBar) progressBar.style.width = `${percent * 100}%`;
        if (progressHandle) progressHandle.style.left = `${percent * 100}%`;
    }
    
    // Speed control
    speedBtn?.addEventListener('click', () => {
        speedIndex = (speedIndex + 1) % speeds.length;
        audioElement.playbackRate = speeds[speedIndex];
        speedBtn.textContent = `${speeds[speedIndex]}×`;
    });
    
    // Volume toggle (mute/unmute)
    volumeBtn?.addEventListener('click', () => {
        audioElement.muted = !audioElement.muted;
        volumeBtn.style.opacity = audioElement.muted ? '0.5' : '1';
    });
    
    // Loading state
    audioElement.addEventListener('waiting', () => {
        player?.classList.add('loading');
    });
    
    audioElement.addEventListener('canplay', () => {
        player?.classList.remove('loading');
    });
    
    // Error handling
    audioElement.addEventListener('error', () => {
        console.warn('[Weekend] Audio failed to load');
        audioEdition.classList.add('hidden');
    });
}

async function loadWeekInReviewAudio() {
    const audioEdition = document.getElementById('audio-edition');
    const audioSource = document.getElementById('audio-source');
    const audioElement = document.getElementById('audio-element');
    
    if (!audioEdition || !audioSource || !audioElement) return;
    
    // Try to load from magazine.json or direct path
    try {
        // First try magazine.json for audio URL
        const response = await fetch('content/weekend/magazine.json');
        if (response.ok) {
            const data = await response.json();
            if (data.audio_url) {
                audioSource.src = data.audio_url;
                audioElement.load();
                audioEdition.classList.remove('hidden');
                return;
            }
        }
    } catch (e) {
        console.log('[Weekend] No magazine.json audio URL');
    }
    
    // Fallback: try standard path
    const weekDate = getWeekendDate();
    const fallbackPath = `content/weekend/audio/week-in-review-${weekDate}.mp3`;
    
    // Check if file exists
    try {
        const headResponse = await fetch(fallbackPath, { method: 'HEAD' });
        if (headResponse.ok) {
            audioSource.src = fallbackPath;
            audioElement.load();
            audioEdition.classList.remove('hidden');
            return;
        }
    } catch (e) {
        console.log('[Weekend] No audio file found at:', fallbackPath);
    }
    
    // No audio available - hide the player
    audioEdition.classList.add('hidden');
}

function getWeekendDate() {
    const now = new Date();
    // Get most recent Saturday
    const day = now.getDay();
    const diff = day === 0 ? 1 : day; // Sunday = 1 day back, others = day number
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - diff + 6);
    
    const year = saturday.getFullYear();
    const month = String(saturday.getMonth() + 1).padStart(2, '0');
    const date = String(saturday.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${date}`;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ========== MARKET MOOD 9-BOX (Weekend Edition) ==========

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

async function loadMarketMood() {
    try {
        const response = await fetch('/api/market-mood');
        if (!response.ok) {
            console.log('[Weekend] Market mood API not available');
            return;
        }
        
        const data = await response.json();
        renderMarketMood(data);
        
    } catch (error) {
        console.log('[Weekend] Market mood API error:', error);
    }
}

function renderMarketMood(data) {
    // Use weekend-specific grid ID
    const grid = document.getElementById('nine-box-grid-weekend');
    if (!grid) return;
    
    const { breadth, breadthAvg24h, mvRatio24h, mvRatio7d, trail, mvRange } = data;
    
    const avgBreadth = breadthAvg24h !== undefined ? breadthAvg24h : breadth;
    
    // Calculate zone
    const zone = getMarketZone(breadth, mvRatio24h, mvRange);
    
    // Update title and description
    const titleEl = document.getElementById('mood-title-weekend');
    const descEl = document.getElementById('mood-description-weekend');
    const breadthEl = document.getElementById('breadth-value-weekend');
    
    if (titleEl) titleEl.textContent = MOOD_ZONES[zone]?.label || 'Market Mood';
    if (descEl) descEl.textContent = MOOD_DESCRIPTIONS[zone] || '';
    if (breadthEl) breadthEl.textContent = `${Math.round(breadth)}% of coins are green`;
    
    // Map coordinates
    const mapX = (b) => (b / 100) * 100;
    const mapY = (mv) => {
        const normalized = (mv - mvRange.low) / (mvRange.high - mvRange.low);
        return Math.max(0, Math.min(100, normalized * 100));
    };
    
    // Position teal dot (current breadth, 24h M/V)
    const tealDot = document.getElementById('mood-dot-teal-weekend');
    if (tealDot) {
        tealDot.style.left = `${mapX(breadth)}%`;
        tealDot.style.top = `${mapY(mvRatio24h)}%`;
    }
    
    // Position burgundy dot (average breadth 24h, 7d avg M/V)
    const burgundyDot = document.getElementById('mood-dot-burgundy-weekend');
    if (burgundyDot) {
        burgundyDot.style.left = `${mapX(avgBreadth)}%`;
        burgundyDot.style.top = `${mapY(mvRatio7d)}%`;
    }
    
    // Draw trail
    if (trail && trail.length > 1) {
        const trailPath = document.getElementById('trail-path-weekend');
        const startDot = document.getElementById('mood-dot-start-weekend');
        
        const points = trail.map(p => ({
            x: mapX(p.breadth),
            y: mapY(p.mv)
        }));
        
        if (trailPath && points.length > 0) {
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
        
        if (startDot) {
            startDot.style.left = `${mapX(trail[0].breadth)}%`;
            startDot.style.top = `${mapY(trail[0].mv)}%`;
        }
    }
    
    // Highlight active zone
    grid.querySelectorAll('.box').forEach(box => {
        box.classList.remove('active-zone');
        if (box.dataset.zone === zone) {
            box.classList.add('active-zone');
        }
    });
}

function getMarketZone(breadth, mv, mvRange) {
    const col = breadth < 33 ? 0 : breadth < 66 ? 1 : 2;
    const mvNormalized = (mv - mvRange.low) / (mvRange.high - mvRange.low);
    const row = mvNormalized < 0.33 ? 0 : mvNormalized < 0.66 ? 1 : 2;
    
    const zones = [
        ['concentration', 'leadership', 'strong-rally'],
        ['rotation', 'consolidation', 'steady-advance'],
        ['capitulation', 'drift', 'weak-rally']
    ];
    
    return zones[row][col];
}
