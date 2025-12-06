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
        
        // Populate sector AI commentary
        if (magazineData.sectors) {
            renderSectors(magazineData.sectors);
        }
        
        // Update sector percentages from API market data
        if (magazineData.segments) {
            updateSectorPercentages(magazineData.segments);
        }
        
        // Render market mood with 7-day trail
        if (magazineData.market_mood) {
            renderMarketMood(magazineData.market_mood);
        }
        
    } catch (error) {
        console.error('[Weekend] Error loading magazine:', error);
    }
}

function setupIndexNavigation() {
    const indexCards = document.querySelectorAll('.index-card');
    const readingPane = document.querySelector('.reading-pane');
    const backBtn = document.getElementById('mobile-back-btn');
    
    indexCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active from all
            indexCards.forEach(c => c.classList.remove('active'));
            // Add active to clicked
            card.classList.add('active');
            
            // Load the section
            const section = card.dataset.section;
            loadSection(section);
            
            // On mobile, show the reading pane
            if (window.innerWidth <= 600 && readingPane) {
                readingPane.classList.add('active');
                document.body.style.overflow = 'hidden'; // Prevent background scroll
            }
        });
    });
    
    // Mobile back button handler
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (readingPane) {
                readingPane.classList.remove('active');
                document.body.style.overflow = ''; // Restore scroll
            }
        });
    }
    
    // Handle resize - close mobile reader if switching to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 600 && readingPane) {
            readingPane.classList.remove('active');
            document.body.style.overflow = '';
        }
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
    // AI commentary is now shown in the detail panel when clicked
    // Store it for later use
    window.sectorCommentary = sectors || {};
}

/**
 * Update sector display with bar-vs-baseline style
 * Uses market average as baseline
 */
function updateSectorPercentages(segments) {
    if (!segments) return;
    
    // Calculate market average from all segments
    const segmentValues = Object.values(segments).filter(s => typeof s === 'object' && s.change !== undefined);
    const marketAvg = segmentValues.length > 0 
        ? segmentValues.reduce((sum, s) => sum + s.change, 0) / segmentValues.length 
        : 0;
    
    // Update header market percentage
    const marketHeaderEl = document.getElementById('sectors-market-change');
    
    if (marketHeaderEl) {
        const sign = marketAvg >= 0 ? '+' : '';
        marketHeaderEl.textContent = `${sign}${marketAvg.toFixed(1)}%`;
    }
    
    const sectorMap = {
        'payment': 'payment',
        'infrastructure': 'infrastructure',
        'defi': 'defi',
        'utility': 'utility',
        'entertainment': 'entertainment',
        'ai': 'ai'
    };
    
    for (const [key, data] of Object.entries(segments)) {
        const htmlKey = sectorMap[key] || key;
        
        if (typeof data === 'object' && data.change !== undefined) {
            const change = data.change;
            const relative = change - marketAvg;
            const isOutperform = relative >= 0;
            
            // Update change percentage
            const changeEl = document.getElementById(`sector-${htmlKey}-change`);
            if (changeEl) {
                const sign = change >= 0 ? '+' : '';
                changeEl.textContent = `${sign}${change.toFixed(1)}%`;
            }
            
            // Update bar
            const barEl = document.getElementById(`sector-${htmlKey}-bar`);
            if (barEl) {
                // Calculate bar width (max 50% of container for each direction)
                const barWidth = Math.min(Math.abs(relative) * 3, 50);
                barEl.style.width = `${barWidth}%`;
                barEl.className = `sector-bar ${isOutperform ? 'outperform' : 'underperform'}`;
            }
            
            // Update relative to market
            const vsEl = document.getElementById(`sector-${htmlKey}-vs`);
            if (vsEl) {
                const relSign = relative >= 0 ? '+' : '';
                vsEl.textContent = `${relSign}${relative.toFixed(1)}%`;
                vsEl.className = `sector-vs ${isOutperform ? 'positive' : 'negative'}`;
            }
        }
    }
    
    // Setup click handlers for detail panel
    setupSectorDetailPanel();
}

/**
 * Setup sector row click handlers to show detail panel
 */
function setupSectorDetailPanel() {
    const sectorRows = document.querySelectorAll('.sector-row:not(.market-row)');
    const detailPanel = document.getElementById('sector-detail-panel');
    const closeBtn = detailPanel?.querySelector('.sector-detail-close');
    
    // Sector info for detail panel
    const sectorInfo = {
        'payment': {
            name: 'Payment',
            drivers: 'Institutional adoption, ETF flows, macro hedging demand, regulatory clarity, halving cycles.',
            about: 'Digital currencies designed primarily for peer-to-peer transactions and store of value.'
        },
        'infrastructure': {
            name: 'Infrastructure', 
            drivers: 'Developer activity, TVL growth, transaction throughput, network upgrades, ecosystem expansion.',
            about: 'Layer 1 blockchains and scaling solutions that power decentralized applications.'
        },
        'defi': {
            name: 'DeFi',
            drivers: 'TVL trends, yield opportunities, protocol revenue, institutional DeFi adoption, regulatory signals.',
            about: 'Decentralized lending, trading, and yield protocols.'
        },
        'utility': {
            name: 'Utility',
            drivers: 'Enterprise adoption, network usage metrics, partnership announcements, real-world integration.',
            about: 'Tokens powering specific services: oracles, storage, compute.'
        },
        'entertainment': {
            name: 'Entertainment',
            drivers: 'Game launches, user metrics, NFT market sentiment, celebrity/brand partnerships.',
            about: 'Gaming, metaverse, and NFT-adjacent tokens.'
        },
        'ai': {
            name: 'AI & Compute',
            drivers: 'AI industry momentum, GPU demand, decentralized compute adoption, NVIDIA correlation.',
            about: 'Decentralized GPU networks and AI-focused protocols.'
        }
    };
    
    sectorRows.forEach(row => {
        row.addEventListener('click', () => {
            const sector = row.dataset.sector;
            const info = sectorInfo[sector];
            
            if (detailPanel && info) {
                document.getElementById('sector-detail-name').textContent = info.name;
                document.getElementById('sector-detail-drivers').innerHTML = `<strong>Key drivers:</strong> ${info.drivers}`;
                document.getElementById('sector-detail-about').textContent = info.about;
                
                // Add AI commentary if available
                const weeklyEl = document.getElementById('sector-detail-weekly');
                const commentary = window.sectorCommentary?.[sector];
                if (weeklyEl) {
                    if (commentary) {
                        weeklyEl.innerHTML = `<span style="display:block;font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--burgundy);margin-bottom:6px;font-style:normal;">THIS WEEK</span>${escapeHtml(typeof commentary === 'string' ? commentary : commentary.weekly || '')}`;
                        weeklyEl.style.display = 'block';
                    } else {
                        weeklyEl.style.display = 'none';
                    }
                }
                
                detailPanel.style.display = 'block';
            }
        });
    });
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            detailPanel.style.display = 'none';
        });
    }
}

/**
 * Render Market Mood 9-box grid with current position and 7-day trail
 * Fetches from /api/market-mood for real trail data
 */
async function renderMarketMood(fallbackData) {
    try {
        // Fetch real mood data from API
        const response = await fetch('/api/market-mood');
        const moodData = response.ok ? await response.json() : null;
        
        if (moodData && moodData.success !== false) {
            // Use API data
            const breadth = moodData.breadth || 50;
            const mvRatio = moodData.mvRatio7d || moodData.mvRatio24h || 25;
            const trail7d = moodData.trail7d || [];
            const mvRange = moodData.mvRange || { low: 10, high: 45 };
            
            // Convert M/V ratio to 0-100 scale for grid positioning
            const volumeRatio = ((mvRatio - mvRange.low) / (mvRange.high - mvRange.low)) * 100;
            const clampedVolume = Math.max(5, Math.min(95, volumeRatio));
            
            // Determine zone
            const zone = determineZone(breadth, clampedVolume);
            const zoneInfo = getZoneInfo(zone, breadth);
            
            // Update title
            const titleEl = document.getElementById('mood-title-weekend');
            if (titleEl) titleEl.textContent = zoneInfo.title;
            
            // Update description
            const descEl = document.getElementById('mood-description-weekend');
            if (descEl) descEl.textContent = zoneInfo.description;
            
            // Update breadth text
            const breadthEl = document.getElementById('breadth-value-weekend');
            if (breadthEl) breadthEl.textContent = `${Math.round(breadth)}% of coins are green`;
            
            // Position current dot (teal)
            const dotEl = document.getElementById('mood-dot-weekend');
            if (dotEl) {
                dotEl.style.left = `${breadth}%`;
                dotEl.style.bottom = `${clampedVolume}%`;
                dotEl.style.display = 'block';
            }
            
            // Draw 7-day trail (burgundy)
            if (trail7d.length > 0) {
                drawTrail7d(trail7d, mvRange, breadth, clampedVolume);
            }
            
            // Highlight current zone
            highlightCurrentZone(zone);
            
        } else if (fallbackData) {
            // Use fallback data from magazine.json
            renderMarketMoodFromFallback(fallbackData);
        }
        
    } catch (error) {
        console.warn('[Weekend] Market mood API error:', error);
        if (fallbackData) {
            renderMarketMoodFromFallback(fallbackData);
        }
    }
}

function drawTrail7d(trail7d, mvRange, currentBreadth, currentVolume) {
    const trailPath = document.getElementById('trail-path-7day');
    if (!trailPath || trail7d.length === 0) return;
    
    let pathD = '';
    
    trail7d.forEach((point, i) => {
        const x = point.breadth || 50;
        // Convert M/V to percentage
        const mv = point.mv || 25;
        const yRatio = ((mv - mvRange.low) / (mvRange.high - mvRange.low)) * 100;
        const y = 100 - Math.max(5, Math.min(95, yRatio)); // Invert for SVG
        
        if (i === 0) {
            pathD += `M ${x} ${y}`;
        } else {
            pathD += ` L ${x} ${y}`;
        }
    });
    
    // Connect to current position
    const currentY = 100 - currentVolume;
    pathD += ` L ${currentBreadth} ${currentY}`;
    
    trailPath.setAttribute('d', pathD);
}

function renderMarketMoodFromFallback(moodData) {
    if (!moodData) return;
    
    const { current, trail, title, description } = moodData;
    
    // Update title
    const titleEl = document.getElementById('mood-title-weekend');
    if (titleEl && title) titleEl.textContent = title;
    
    // Update description
    const descEl = document.getElementById('mood-description-weekend');
    if (descEl && description) descEl.textContent = description;
    
    // Update breadth text
    const breadthEl = document.getElementById('breadth-value-weekend');
    if (breadthEl && current) {
        breadthEl.textContent = `${Math.round(current.breadth)}% of coins are green`;
    }
    
    // Position dot
    const dotEl = document.getElementById('mood-dot-weekend');
    if (dotEl && current) {
        dotEl.style.left = `${current.breadth}%`;
        dotEl.style.bottom = `${current.volume_ratio}%`;
        dotEl.style.display = 'block';
    }
    
    // Draw trail from fallback
    const trailPath = document.getElementById('trail-path-7day');
    if (trailPath && trail && trail.length > 0) {
        let pathD = '';
        trail.forEach((point, i) => {
            const x = point.breadth;
            const y = 100 - point.volume_ratio;
            pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
        });
        if (current) {
            pathD += ` L ${current.breadth} ${100 - current.volume_ratio}`;
        }
        trailPath.setAttribute('d', pathD);
    }
    
    highlightCurrentZone(current?.zone);
}

function determineZone(breadth, volumeRatio) {
    if (volumeRatio >= 66) {
        if (breadth < 33) return 'concentration';
        if (breadth < 66) return 'leadership';
        return 'strong-rally';
    } else if (volumeRatio >= 33) {
        if (breadth < 33) return 'rotation';
        if (breadth < 66) return 'consolidation';
        return 'steady-advance';
    } else {
        if (breadth < 33) return 'capitulation';
        if (breadth < 66) return 'drift';
        return 'weak-rally';
    }
}

function getZoneInfo(zone, breadth) {
    const descriptions = {
        'strong-rally': { title: 'Strong Rally', description: 'Broad participation with high conviction. The market is moving decisively higher with strong volume confirmation.' },
        'leadership': { title: 'Leadership', description: `Large caps leading with elevated activity. ${Math.round(breadth)}% of coins positive, suggesting selective but powerful momentum.` },
        'concentration': { title: 'Concentration', description: 'High volume but narrow participation. Capital is concentrating in select assets.' },
        'steady-advance': { title: 'Steady Advance', description: `Healthy breadth at ${Math.round(breadth)}% with measured volume. Sustainable advance.` },
        'consolidation': { title: 'Consolidation', description: 'Mixed signals with moderate activity. Market digesting recent moves.' },
        'rotation': { title: 'Rotation', description: 'Sector rotation underway with elevated volume. Capital is moving, but direction unclear.' },
        'weak-rally': { title: 'Weak Rally', description: `Broad but unconvincing. ${Math.round(breadth)}% green but low volume suggests lack of conviction.` },
        'drift': { title: 'Drift', description: 'Quiet market with no clear direction. Low participation and activity.' },
        'capitulation': { title: 'Capitulation', description: 'Broad weakness with elevated selling pressure. Risk-off sentiment dominates.' }
    };
    return descriptions[zone] || { title: 'Unknown', description: 'Market conditions unclear.' };
}

/**
 * Highlight the current zone box
 */
function highlightCurrentZone(zone) {
    if (!zone) return;
    
    const gridEl = document.getElementById('nine-box-grid-weekend');
    if (!gridEl) return;
    
    // Remove previous highlights
    gridEl.querySelectorAll('.box').forEach(box => {
        box.classList.remove('current-zone');
    });
    
    // Add highlight to current zone
    const currentBox = gridEl.querySelector(`[data-zone="${zone}"]`);
    if (currentBox) {
        currentBox.classList.add('current-zone');
    }
}

async function loadRelativePerformance() {
    const chartEl = document.getElementById('relative-chart-7d');
    const marketChangeEl = document.getElementById('market-7d-change');
    
    if (!chartEl) return;
    
    try {
        // Get user's focus coins from localStorage
        const focusCoins = JSON.parse(localStorage.getItem('focusCoins') || '["bitcoin","ethereum","cardano","vechain","chiliz"]');
        
        let marketChange7d = 0;
        let coins = [];
        
        // Fetch specific coins + top 10 for market average
        const coinIds = [...new Set([...focusCoins, 'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'ripple', 'usd-coin', 'cardano', 'avalanche-2', 'dogecoin'])];
        
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds.join(',')}&sparkline=false&price_change_percentage=7d`);
            if (response.ok) {
                const apiCoins = await response.json();
                coins = apiCoins.map(c => ({
                    id: c.id,
                    symbol: c.symbol,
                    price_change_7d: c.price_change_percentage_7d_in_currency || 0
                }));
                
                // Calculate market average from top 10 by market cap (excluding user's specific picks)
                const top10Ids = ['bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'ripple', 'usd-coin', 'cardano', 'avalanche-2', 'dogecoin'];
                const marketCoins = coins.filter(c => top10Ids.includes(c.id));
                marketChange7d = marketCoins.length > 0
                    ? marketCoins.reduce((sum, c) => sum + (c.price_change_7d || 0), 0) / marketCoins.length
                    : 0;
            }
        } catch (apiError) {
            console.warn('[Weekend] CoinGecko API unavailable:', apiError);
            // Use magazine data as fallback
            if (magazineData?.market_data?.market_change_7d !== undefined) {
                marketChange7d = magazineData.market_data.market_change_7d;
            }
        }
        
        // Update market baseline
        if (marketChangeEl) {
            const sign = marketChange7d >= 0 ? '+' : '';
            marketChangeEl.textContent = `${sign}${marketChange7d.toFixed(1)}%`;
        }
        
        // Render coin rows
        if (coins.length > 0 && focusCoins.length > 0) {
            const existingRows = chartEl.querySelectorAll('.relative-row:not(.market-row)');
            existingRows.forEach(row => row.remove());
            
            focusCoins.forEach(coinId => {
                const coin = coins.find(c => c.id === coinId);
                if (coin) {
                    const row = createRelativeRow(coin, marketChange7d);
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
