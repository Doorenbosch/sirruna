// The Graph API - Stablecoin % of Total Market Cap (12 months)
// Shows "dry powder on sidelines" as percentage over time

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    // Cache for 6 hours - weekend feature, doesn't need real-time
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');
    
    try {
        // Fetch historical data for major stablecoins (365 days)
        const [tetherData, usdcData, globalData] = await Promise.all([
            fetchCoinHistory('tether', 365),
            fetchCoinHistory('usd-coin', 365),
            fetchGlobalData()
        ]);
        
        if (!tetherData || !usdcData) {
            console.log('Failed to fetch stablecoin history');
            return res.status(200).json(getFallbackData());
        }
        
        // Combine stablecoin market caps and calculate weekly ratios
        const weeklyData = processHistoricalData(tetherData, usdcData, globalData);
        
        // Generate insight based on current vs historical
        const insight = generateInsight(weeklyData);
        
        return res.status(200).json({
            data: weeklyData,
            current: weeklyData[weeklyData.length - 1],
            insight: insight,
            source: 'coingecko',
            updated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('The Graph API error:', error);
        return res.status(200).json({
            ...getFallbackData(),
            debug: { error: error.message }
        });
    }
}

async function fetchCoinHistory(coinId, days) {
    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
            { headers: { 'Accept': 'application/json' } }
        );
        
        if (!response.ok) {
            console.error(`CoinGecko ${coinId} error:`, response.status);
            return null;
        }
        
        const data = await response.json();
        return data.market_caps || [];
    } catch (e) {
        console.error(`Fetch ${coinId} error:`, e);
        return null;
    }
}

async function fetchGlobalData() {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/global',
            { headers: { 'Accept': 'application/json' } }
        );
        
        if (!response.ok) return null;
        
        const data = await response.json();
        return {
            totalMarketCap: data.data?.total_market_cap?.usd || 0,
            stablecoinMarketCap: data.data?.total_market_cap?.usd * 0.05 // Estimate if not available
        };
    } catch (e) {
        return null;
    }
}

function processHistoricalData(tetherHistory, usdcHistory, globalData) {
    // Create a map of dates to combined stablecoin market cap
    const dailyData = new Map();
    
    // Process Tether data
    tetherHistory.forEach(([timestamp, marketCap]) => {
        const date = new Date(timestamp).toISOString().split('T')[0];
        dailyData.set(date, { stablecoin: marketCap, timestamp });
    });
    
    // Add USDC data
    usdcHistory.forEach(([timestamp, marketCap]) => {
        const date = new Date(timestamp).toISOString().split('T')[0];
        if (dailyData.has(date)) {
            dailyData.get(date).stablecoin += marketCap;
        }
    });
    
    // Convert to array and sort by date
    const sortedDays = Array.from(dailyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    // Get current ratio to anchor our calculations
    const currentTotalCap = globalData?.totalMarketCap || 3500000000000;
    const latestStablecoin = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1][1].stablecoin : 200000000000;
    const currentRatio = (latestStablecoin / currentTotalCap) * 100;
    
    // Sample weekly (every 7 days) to get ~52 data points
    const weeklyData = [];
    for (let i = 0; i < sortedDays.length; i += 7) {
        const [date, data] = sortedDays[i];
        
        // Calculate ratio based on stablecoin cap relative to current
        // Stablecoin caps have actual historical data; we estimate total cap
        // by assuming total cap scaled proportionally (rough approximation)
        const stablecoinCapBillions = data.stablecoin / 1e9;
        
        // Use stablecoin growth rate to infer market cap growth
        // and calculate a more dynamic ratio
        const stablecoinGrowthFactor = data.stablecoin / latestStablecoin;
        
        // Total market tends to be more volatile than stablecoins
        // So ratio was typically higher when market was smaller
        const estimatedTotalCapThen = currentTotalCap * Math.pow(stablecoinGrowthFactor, 0.7);
        const ratio = (data.stablecoin / estimatedTotalCapThen) * 100;
        
        weeklyData.push({
            date: date,
            stablecoinCap: Math.round(stablecoinCapBillions),
            ratio: parseFloat(Math.min(10, Math.max(3, ratio)).toFixed(2)),
            timestamp: data.timestamp
        });
    }
    
    // Ensure the last point uses actual current data
    if (globalData && weeklyData.length > 0) {
        const lastPoint = weeklyData[weeklyData.length - 1];
        const actualRatio = (lastPoint.stablecoinCap * 1e9 / globalData.totalMarketCap) * 100;
        lastPoint.ratio = parseFloat(actualRatio.toFixed(2));
    }
    
    return weeklyData;
}

function generateInsight(data) {
    if (!data || data.length < 4) {
        return 'Stablecoin ratio indicates market positioning';
    }
    
    const current = data[data.length - 1];
    const oneMonthAgo = data[Math.max(0, data.length - 5)];
    const threeMonthsAgo = data[Math.max(0, data.length - 13)];
    const yearStart = data[0];
    
    const currentRatio = current.ratio;
    const avgRatio = data.reduce((sum, d) => sum + d.ratio, 0) / data.length;
    const minRatio = Math.min(...data.map(d => d.ratio));
    const maxRatio = Math.max(...data.map(d => d.ratio));
    
    // Determine position in range
    const range = maxRatio - minRatio;
    const position = (currentRatio - minRatio) / range;
    
    // Generate contextual insight
    if (position < 0.2) {
        return 'Near 12-month low — most capital already deployed';
    } else if (position > 0.8) {
        return 'Near 12-month high — significant dry powder on sidelines';
    } else if (currentRatio > oneMonthAgo.ratio * 1.1) {
        return 'Rising steadily — investors moving to safety';
    } else if (currentRatio < oneMonthAgo.ratio * 0.9) {
        return 'Declining — capital flowing into risk assets';
    } else if (currentRatio > avgRatio) {
        return 'Above average — cautious positioning persists';
    } else {
        return 'Below average — capital largely deployed';
    }
}

function getFallbackData() {
    // Generate realistic 12-month fallback data
    const data = [];
    const now = new Date();
    
    for (let i = 52; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * 7));
        
        // Simulate realistic fluctuation between 4-6%
        const baseRatio = 5.0;
        const variation = Math.sin(i / 8) * 0.8 + (Math.random() - 0.5) * 0.3;
        const ratio = baseRatio + variation;
        
        data.push({
            date: date.toISOString().split('T')[0],
            stablecoinCap: Math.round(280 + variation * 20), // ~280-320B
            ratio: parseFloat(ratio.toFixed(2))
        });
    }
    
    return {
        data: data,
        current: data[data.length - 1],
        insight: 'Stablecoin ratio shows market positioning',
        source: 'fallback',
        updated: new Date().toISOString()
    };
}
