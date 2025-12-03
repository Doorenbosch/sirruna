// Market Mood API - Calculates 9-box positioning from CoinGecko data

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Fetch global market data
        const globalRes = await fetch('https://api.coingecko.com/api/v3/global');
        if (!globalRes.ok) throw new Error('Failed to fetch global data');
        const globalData = await globalRes.json();
        
        // Fetch top 100 coins for breadth calculation
        const coinsRes = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h'
        );
        if (!coinsRes.ok) throw new Error('Failed to fetch coins data');
        const coins = await coinsRes.json();
        
        // Calculate breadth (% of top 100 coins that are green in 24h)
        const greenCoins = coins.filter(c => c.price_change_percentage_24h > 0).length;
        const breadth = (greenCoins / coins.length) * 100;
        
        // Get total market cap and 24h volume
        const totalMarketCap = globalData.data?.total_market_cap?.usd || 0;
        const totalVolume24h = globalData.data?.total_volume?.usd || 0;
        
        // Calculate M/V ratio (Market Cap / Volume)
        // Lower ratio = more volume activity = "frenzied"
        // Higher ratio = less volume activity = "quiet"
        const mvRatio24h = totalVolume24h > 0 ? totalMarketCap / totalVolume24h : 0;
        
        // For 7-day average, we'd need historical data
        // For now, estimate based on typical weekend drop-off
        // In production, this should come from stored historical data
        const mvRatio7d = mvRatio24h * 1.15; // Typically ~15% higher due to weekend lulls
        
        // Generate mock trail data (in production, store and retrieve actual historical data)
        // Trail shows movement over last 24 hours
        const trail = generateMockTrail(breadth, mvRatio24h);
        
        // Calculate average breadth from trail (in production, use actual 24h data)
        const breadthAvg24h = trail.reduce((sum, p) => sum + p.breadth, 0) / trail.length;
        
        // M/V range for visualization
        // These bounds should be calibrated based on historical data
        // Typical crypto M/V ratios range from ~10x (frenzied) to ~40x (quiet)
        const mvRange = { low: 10, high: 45 };
        
        return res.status(200).json({
            success: true,
            lastUpdated: new Date().toISOString(),
            breadth: Math.round(breadth * 10) / 10,
            breadthAvg24h: Math.round(breadthAvg24h * 10) / 10,
            mvRatio24h: Math.round(mvRatio24h * 10) / 10,
            mvRatio7d: Math.round(mvRatio7d * 10) / 10,
            trail,
            mvRange,
            raw: {
                totalMarketCap,
                totalVolume24h,
                greenCoins,
                totalCoins: coins.length
            }
        });
        
    } catch (error) {
        console.error('Market mood error:', error);
        
        // Return fallback data
        return res.status(200).json({
            success: false,
            error: error.message,
            // Fallback values
            breadth: 55,
            breadthAvg24h: 52,
            mvRatio24h: 22,
            mvRatio7d: 25,
            trail: [
                { breadth: 50, mv: 26 },
                { breadth: 52, mv: 24 },
                { breadth: 54, mv: 23 },
                { breadth: 55, mv: 22 }
            ],
            mvRange: { low: 10, high: 45 }
        });
    }
}

// Generate mock trail data
// In production, this should be actual stored historical data points
function generateMockTrail(currentBreadth, currentMv) {
    const points = [];
    const numPoints = 5;
    
    // Work backwards from current position
    for (let i = 0; i < numPoints; i++) {
        const progress = i / (numPoints - 1);
        
        // Add some variation to simulate real movement
        const variation = Math.sin(i * 1.5) * 5;
        const breadthOffset = (1 - progress) * 10 + variation;
        const mvOffset = (1 - progress) * 3 + (Math.cos(i * 1.2) * 2);
        
        points.push({
            breadth: Math.max(0, Math.min(100, currentBreadth - breadthOffset)),
            mv: Math.max(10, currentMv + mvOffset)
        });
    }
    
    // Ensure current position is at the end
    points.push({
        breadth: currentBreadth,
        mv: currentMv
    });
    
    return points;
}
