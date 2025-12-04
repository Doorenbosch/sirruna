// The Number API - Stablecoin Market Cap from CoinGecko
// Free tier, no API key required

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200'); // 10 min cache
    
    try {
        // CoinGecko global endpoint includes stablecoin market cap
        const response = await fetch(
            'https://api.coingecko.com/api/v3/global',
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            console.error('CoinGecko API error:', response.status);
            return res.status(200).json(getFallbackNumber());
        }
        
        const data = await response.json();
        
        // Extract stablecoin market cap
        const stablecoinCap = data.data?.total_market_cap?.usd || 0;
        const totalCap = data.data?.total_market_cap?.usd || 0;
        const btcDominance = data.data?.market_cap_percentage?.btc || 0;
        
        // Also get stablecoin-specific data
        const stablecoinResponse = await fetch(
            'https://api.coingecko.com/api/v3/global/decentralized_finance_defi',
            {
                headers: { 'Accept': 'application/json' }
            }
        );
        
        // Get stablecoins category for more accurate data
        const categoryResponse = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=10&sparkline=false',
            {
                headers: { 'Accept': 'application/json' }
            }
        );
        
        let stablecoinMarketCap = 0;
        
        if (categoryResponse.ok) {
            const stablecoins = await categoryResponse.json();
            stablecoinMarketCap = stablecoins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
        }
        
        // Format the number
        const formatted = formatMarketCap(stablecoinMarketCap);
        
        // Generate contextual insight
        const insight = generateStablecoinInsight(stablecoinMarketCap, totalCap, btcDominance);
        
        return res.status(200).json({
            value: formatted.value,
            raw: stablecoinMarketCap,
            context: insight,
            source: 'coingecko',
            updated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('The Number API error:', error);
        return res.status(200).json(getFallbackNumber());
    }
}

function formatMarketCap(value) {
    if (value >= 1e12) {
        return { value: `$${(value / 1e12).toFixed(1)}T`, unit: 'trillion' };
    } else if (value >= 1e9) {
        return { value: `$${(value / 1e9).toFixed(1)}B`, unit: 'billion' };
    } else if (value >= 1e6) {
        return { value: `$${(value / 1e6).toFixed(1)}M`, unit: 'million' };
    }
    return { value: `$${value.toLocaleString()}`, unit: '' };
}

function generateStablecoinInsight(stableCap, totalCap, btcDom) {
    const stableRatio = (stableCap / totalCap) * 100;
    
    // Various insight options based on market conditions
    const insights = [];
    
    if (stableCap > 300e9) {
        insights.push('Stablecoin supply at all-time high—dry powder waiting on sidelines');
    } else if (stableCap > 250e9) {
        insights.push('Elevated stablecoin reserves signal potential buying pressure');
    }
    
    if (stableRatio > 10) {
        insights.push('High stablecoin ratio suggests cautious positioning');
    } else if (stableRatio < 6) {
        insights.push('Low stablecoin ratio—most capital already deployed');
    }
    
    if (btcDom > 60) {
        insights.push('Bitcoin dominance elevated—altcoin rotation may follow');
    } else if (btcDom < 45) {
        insights.push('Low BTC dominance signals altcoin season conditions');
    }
    
    // Return the most relevant insight
    return insights[0] || 'Stablecoin liquidity remains robust for potential deployment';
}

function getFallbackNumber() {
    return {
        value: '$311B',
        raw: 311000000000,
        context: 'Stablecoin market cap—liquidity ready for deployment',
        source: 'fallback',
        updated: new Date().toISOString()
    };
}
