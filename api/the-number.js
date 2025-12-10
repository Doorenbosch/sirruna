/**
 * The Number - Daily Rotating Market Metric
 * 
 * Monday:    Fear & Greed Index
 * Tuesday:   BTC Dominance
 * Wednesday: Active Addresses (30d change)
 * Thursday:  Open Interest
 * Friday:    Stablecoin Supply
 * Weekend:   Stablecoin Supply
 * 
 * Cached for 24 hours - only fetches fresh data once per day
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Cache for 24 hours (86400 seconds)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    
    try {
        const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        
        let data;
        switch (dayOfWeek) {
            case 1: // Monday
                data = await getFearAndGreed();
                break;
            case 2: // Tuesday
                data = await getBTCDominance();
                break;
            case 3: // Wednesday
                data = await getActiveAddresses();
                break;
            case 4: // Thursday
                data = await getOpenInterest();
                break;
            case 5: // Friday
            case 6: // Saturday
            case 0: // Sunday
            default:
                data = await getStablecoinSupply();
                break;
        }
        
        return res.status(200).json({
            ...data,
            dayOfWeek,
            updated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[The Number] Error:', error);
        return res.status(200).json({
            metric: 'stablecoin_supply',
            label: 'STABLECOIN SUPPLY',
            value: '$150B',
            numericValue: 150,
            unit: 'B',
            context: 'Dry powder on the sidelines',
            interpretation: 'neutral',
            change: null,
            history: [],
            source: 'fallback',
            error: error.message
        });
    }
}

// ============================================
// MONDAY: Fear & Greed Index
// ============================================

async function getFearAndGreed() {
    try {
        // Get current value + 180 days of history
        const response = await fetch(
            'https://api.alternative.me/fng/?limit=180',
            { headers: { 'User-Agent': 'TheLitmus/1.0' } }
        );
        
        if (!response.ok) throw new Error('Fear & Greed API failed');
        
        const json = await response.json();
        const data = json.data || [];
        
        if (data.length === 0) throw new Error('No Fear & Greed data');
        
        const current = parseInt(data[0].value);
        const classification = data[0].value_classification;
        
        // Build 6-month history (sample weekly for chart)
        const history = [];
        for (let i = 0; i < data.length; i += 7) {
            if (history.length >= 26) break; // ~6 months of weekly data
            history.push({
                value: parseInt(data[i].value),
                date: new Date(parseInt(data[i].timestamp) * 1000).toISOString()
            });
        }
        history.reverse();
        
        // Calculate 7-day change (since this metric shows once per week)
        const sevenDaysAgo = data[6] ? parseInt(data[6].value) : current;
        const change7d = current - sevenDaysAgo;
        
        // Determine interpretation
        let interpretation = 'neutral';
        let context = '';
        
        if (current <= 20) {
            interpretation = 'extreme-fear';
            context = 'Extreme fear often precedes reversals - historically a buying opportunity';
        } else if (current <= 40) {
            interpretation = 'cautious';
            context = 'Fear dominates - crowd is nervous, but not panicking';
        } else if (current <= 60) {
            interpretation = 'neutral';
            context = 'Neither fear nor greed dominates - market in equilibrium';
        } else if (current <= 80) {
            interpretation = 'optimistic';
            context = 'Greed is building - momentum favors continuation, watch for overextension';
        } else {
            interpretation = 'extreme-greed';
            context = 'Extreme greed - historically precedes corrections. Caution warranted';
        }
        
        return {
            metric: 'fear_greed',
            label: 'FEAR & GREED',
            value: current.toString(),
            numericValue: current,
            unit: '/100',
            subtitle: classification,
            context,
            interpretation,
            change: change7d !== 0 ? (change7d > 0 ? `+${change7d}` : `${change7d}`) + ' vs last week' : 'unchanged',
            history,
            historyLabel: '6 months',
            source: 'alternative.me'
        };
        
    } catch (error) {
        console.error('[Fear & Greed]', error.message);
        return getFallbackFearGreed();
    }
}

function getFallbackFearGreed() {
    return {
        metric: 'fear_greed',
        label: 'FEAR & GREED',
        value: '65',
        numericValue: 65,
        unit: '/100',
        subtitle: 'Greed',
        context: 'Greed is building - momentum favors bulls, but watch for overextension',
        interpretation: 'optimistic',
        change: null,
        history: [],
        historyLabel: '6 months',
        source: 'fallback'
    };
}

// ============================================
// TUESDAY: BTC Dominance
// ============================================

async function getBTCDominance() {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/global',
            { headers: { 'User-Agent': 'TheLitmus/1.0' } }
        );
        
        if (!response.ok) throw new Error('CoinGecko API failed');
        
        const json = await response.json();
        const dominance = json.data?.market_cap_percentage?.btc || 0;
        const ethDominance = json.data?.market_cap_percentage?.eth || 0;
        const marketCapChange24h = json.data?.market_cap_change_percentage_24h_usd || 0;
        
        // Determine interpretation
        let interpretation = 'neutral';
        let context = '';
        
        if (dominance >= 55) {
            interpretation = 'risk-off';
            context = 'Capital favoring Bitcoin over alts - flight to quality, risk-off positioning';
        } else if (dominance >= 50) {
            interpretation = 'balanced';
            context = 'Healthy Bitcoin leadership - alts following, not leading';
        } else if (dominance >= 45) {
            interpretation = 'risk-on';
            context = 'Capital rotating to alts - risk appetite increasing';
        } else {
            interpretation = 'alt-season';
            context = 'Alt season signals - historically unsustainable, late-cycle behavior';
        }
        
        return {
            metric: 'btc_dominance',
            label: 'BTC DOMINANCE',
            value: dominance.toFixed(1),
            numericValue: dominance,
            unit: '%',
            subtitle: `ETH: ${ethDominance.toFixed(1)}%`,
            context,
            interpretation,
            change: `Market ${marketCapChange24h >= 0 ? '+' : ''}${marketCapChange24h.toFixed(1)}% 24h`,
            history: [],
            historyLabel: '6 months',
            source: 'coingecko'
        };
        
    } catch (error) {
        console.error('[BTC Dominance]', error.message);
        return {
            metric: 'btc_dominance',
            label: 'BTC DOMINANCE',
            value: '52.0',
            numericValue: 52,
            unit: '%',
            subtitle: 'ETH: 18.5%',
            context: 'Healthy Bitcoin leadership - alts following, not leading',
            interpretation: 'balanced',
            change: null,
            history: [],
            historyLabel: '6 months',
            source: 'fallback'
        };
    }
}

// ============================================
// WEDNESDAY: Active Addresses (30d Change)
// ============================================

async function getActiveAddresses() {
    try {
        // Blockchain.com API - free, no auth required
        // Get BTC active addresses for today and 30 days ago
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const formatDate = (d) => d.toISOString().split('T')[0];
        
        // Fetch current active addresses (uses chart endpoint with recent data)
        const response = await fetch(
            'https://api.blockchain.info/charts/n-unique-addresses?timespan=60days&format=json',
            { headers: { 'User-Agent': 'Sirruna/1.0' } }
        );
        
        if (!response.ok) {
            return getFallbackActiveAddresses();
        }
        
        const json = await response.json();
        const values = json.values || [];
        
        if (values.length < 30) {
            return getFallbackActiveAddresses();
        }
        
        // Get latest value and value from ~30 days ago
        const current = values[values.length - 1]?.y || 0;
        const thirtyDaysAgoValue = values[values.length - 30]?.y || current;
        
        // Calculate 30-day change
        const change30d = ((current - thirtyDaysAgoValue) / thirtyDaysAgoValue * 100);
        const displayValue = (current / 1000).toFixed(0); // Show in thousands (K)
        
        // Build mini history for sparkline (weekly samples)
        const history = [];
        for (let i = 0; i < values.length; i += 7) {
            history.push({
                value: values[i].y,
                date: new Date(values[i].x * 1000).toISOString()
            });
        }
        
        let interpretation = 'neutral';
        let context = '';
        
        if change30d > 10:
            interpretation = 'strong-growth';
            context = 'Network activity surging - strong adoption signal, fundamentally constructive';
        } else if (change30d > 3) {
            interpretation = 'growing';
            context = 'Healthy network growth - more users engaging with Bitcoin';
        } else if (change30d > -3) {
            interpretation = 'stable';
            context = 'Network activity stable - neither expansion nor contraction';
        } else if (change30d > -10) {
            interpretation = 'declining';
            context = 'Network usage declining - fewer active users, monitor for trend reversal';
        } else {
            interpretation = 'contracting';
            context = 'Significant drop in network activity - a cautionary fundamental signal';
        }
        
        return {
            metric: 'active_addresses',
            label: 'ACTIVE ADDRESSES',
            value: displayValue,
            numericValue: current,
            unit: 'K',
            subtitle: `BTC 24h unique`,
            context,
            interpretation,
            change: `${change30d >= 0 ? '+' : ''}${change30d.toFixed(1)}% vs 30d ago`,
            history,
            historyLabel: '60 days',
            source: 'blockchain.info'
        };
        
    } catch (error) {
        console.error('[Active Addresses]', error.message);
        return getFallbackActiveAddresses();
    }
}

function getFallbackActiveAddresses() {
    return {
        metric: 'active_addresses',
        label: 'ACTIVE ADDRESSES',
        value: '850',
        numericValue: 850000,
        unit: 'K',
        subtitle: 'BTC 24h unique',
        context: 'Network activity stable - neither expansion nor contraction',
        interpretation: 'stable',
        change: '+2.5% vs 30d ago',
        history: [],
        historyLabel: '60 days',
        source: 'fallback'
    };
}

// ============================================
// THURSDAY: Open Interest
// ============================================

async function getOpenInterest() {
    try {
        // CoinGlass public endpoint for open interest
        const response = await fetch(
            'https://open-api.coinglass.com/public/v2/open_interest',
            { headers: { 'User-Agent': 'TheLitmus/1.0' } }
        );
        
        if (!response.ok) {
            return getFallbackOpenInterest();
        }
        
        const json = await response.json();
        const btcData = json.data?.find(d => d.symbol === 'BTC');
        
        if (!btcData) {
            return getFallbackOpenInterest();
        }
        
        const totalOI = btcData.openInterest || 0; // in USD
        const displayValue = (totalOI / 1e9).toFixed(1); // Convert to billions
        const change24h = btcData.h24Change || 0;
        
        let interpretation = 'neutral';
        let context = '';
        
        // OI interpretation depends on price action context
        // High OI = more leverage = potential for violent moves
        if (totalOI > 20e9) { // > $20B
            interpretation = 'elevated-risk';
            context = 'Leverage extended - high OI means violent moves possible on liquidations';
        } else if (totalOI > 15e9) {
            interpretation = 'normal';
            context = 'Healthy leverage levels - normal market structure';
        } else {
            interpretation = 'low-leverage';
            context = 'Low leverage - market less prone to cascading liquidations';
        }
        
        return {
            metric: 'open_interest',
            label: 'OPEN INTEREST',
            value: displayValue,
            numericValue: parseFloat(displayValue),
            unit: 'B',
            subtitle: `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}% 24h`,
            context,
            interpretation,
            change: null,
            history: [],
            historyLabel: '6 months',
            source: 'coinglass'
        };
        
    } catch (error) {
        console.error('[Open Interest]', error.message);
        return getFallbackOpenInterest();
    }
}

function getFallbackOpenInterest() {
    return {
        metric: 'open_interest',
        label: 'OPEN INTEREST',
        value: '18.5',
        numericValue: 18.5,
        unit: 'B',
        subtitle: '+2.3% 24h',
        context: 'Healthy leverage levels - normal market structure',
        interpretation: 'normal',
        change: null,
        history: [],
        historyLabel: '6 months',
        source: 'fallback'
    };
}

// ============================================
// FRIDAY + WEEKEND: Stablecoin Supply
// ============================================

async function getStablecoinSupply() {
    try {
        // Get top stablecoins market data
        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=10&page=1',
            { headers: { 'User-Agent': 'TheLitmus/1.0' } }
        );
        
        if (!response.ok) throw new Error('CoinGecko stablecoin API failed');
        
        const coins = await response.json();
        
        // Sum total stablecoin market cap
        const totalSupply = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
        const displayValue = (totalSupply / 1e9).toFixed(0);
        
        // Get USDT and USDC specifically
        const usdt = coins.find(c => c.symbol === 'usdt');
        const usdc = coins.find(c => c.symbol === 'usdc');
        
        const usdtCap = usdt ? (usdt.market_cap / 1e9).toFixed(0) : '?';
        const usdcCap = usdc ? (usdc.market_cap / 1e9).toFixed(0) : '?';
        
        // 24h change
        const avgChange = coins.reduce((sum, c) => sum + (c.market_cap_change_percentage_24h || 0), 0) / coins.length;
        
        let interpretation = 'neutral';
        let context = '';
        
        if (avgChange > 0.5) {
            interpretation = 'accumulating';
            context = 'Fresh capital entering - stablecoin minting signals buying preparation';
        } else if (avgChange > -0.5) {
            interpretation = 'neutral';
            context = 'Dry powder stable - capital waiting on sidelines for opportunity';
        } else {
            interpretation = 'deploying';
            context = 'Stablecoins converting to crypto - capital being deployed';
        }
        
        return {
            metric: 'stablecoin_supply',
            label: 'STABLECOIN SUPPLY',
            value: displayValue,
            numericValue: parseFloat(displayValue),
            unit: 'B',
            subtitle: `USDT: $${usdtCap}B · USDC: $${usdcCap}B`,
            context,
            interpretation,
            change: avgChange !== 0 ? `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}% 24h` : null,
            history: [], // Would need historical API
            historyLabel: '12 months',
            source: 'coingecko'
        };
        
    } catch (error) {
        console.error('[Stablecoin Supply]', error.message);
        return {
            metric: 'stablecoin_supply',
            label: 'STABLECOIN SUPPLY',
            value: '150',
            numericValue: 150,
            unit: 'B',
            subtitle: 'USDT: $83B · USDC: $42B',
            context: 'Dry powder stable - capital waiting on sidelines for opportunity',
            interpretation: 'neutral',
            change: null,
            history: [],
            historyLabel: '12 months',
            source: 'fallback'
        };
    }
}
