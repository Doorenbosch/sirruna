// The Litmus - Editorial App

const CONFIG = {
    contentPath: './content',
    defaultRegion: 'americas',
    breakdownAPI: '/api/breakdown',
    coinGeckoAPI: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&order=market_cap_desc&sparkline=false&price_change_percentage=24h',
    globalAPI: 'https://api.coingecko.com/api/v3/global',
    marketUpdateInterval: 60000 // 1 minute
};

// Data store
let briefData = null;
let currentSection = 'lead';
let currentRegion = CONFIG.defaultRegion;

// Audio player state
let audioElement = null;
let isPlaying = false;
let currentEpisode = null;

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
    initAudioPlayer();
    loadContent(currentRegion);
    loadBreakdownPodcast();
    
    // Load live market data
    loadMarketData();
    
    // Update market data every minute
    setInterval(loadMarketData, CONFIG.marketUpdateInterval);
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
        
        renderIndexCards(briefData);
        renderReadingPane(currentSection);
        renderTimestamp(briefData);
        
        // Load week ahead
        loadWeekAhead(region);
        
    } catch (error) {
        console.error('Error loading content:', error);
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
        }
        
        if (eth) {
            setText('eth-price', formatPrice(eth.current_price));
            updateChangeElement('eth-change', eth.price_change_percentage_24h);
        }
        
        // Fetch global market data
        const globalResponse = await fetch(CONFIG.globalAPI);
        if (globalResponse.ok) {
            const globalData = await globalResponse.json();
            const totalMarketCap = globalData.data?.total_market_cap?.usd;
            const marketCapChange = globalData.data?.market_cap_change_percentage_24h_usd;
            
            if (totalMarketCap) {
                setText('total-market', formatMarketCap(totalMarketCap));
            }
            
            if (marketCapChange !== undefined) {
                updateChangeElement('market-change', marketCapChange);
            }
        }
        
    } catch (error) {
        console.error('Error loading market data:', error);
    }
}

// Update change element with color
function updateChangeElement(elementId, change) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.textContent = formatChange(change);
    el.className = `ticker-change ${change >= 0 ? 'up' : 'down'}`;
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
    } else {
        audioElement.play().catch(err => {
            console.error('Playback error:', err);
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
