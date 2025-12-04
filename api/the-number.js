// The Number API - Stablecoin Market Cap from CoinGecko
// Free tier, no API key required

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200'); // 10 min cache
    
    try {
        // Use categories endpoint for stablecoin market cap
        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/categories',
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
        
        const categories = await response.json();
        
        // Find stablecoins category
        const stablecoinCategory = categories.find(c => 
            c.id === 'stablecoins' || 
            c.name?.toLowerCase() === 'stablecoins'
        );
        
        let stablecoinMarketCap = stablecoinCategory?.market_cap || 0;
        
        // If category not found, use fallback
        if (!stablecoinMarketCap) {
            console.log('Stablecoin category not found, using fallback');
            return res.status(200).json(getFallbackNumber());
        }
        
        // Format the number
        const formatted = formatMarketCap(stablecoinMarketCap);
        
        // Generate contextual insight
        const insight = generateStablecoinInsight(stablecoinMarketCap);
        
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

function generateStablecoinInsight(stableCap) {
    if (stableCap > 310e9) {
        return 'Stablecoin supply at all-time high—dry powder on sidelines';
    } else if (stableCap > 280e9) {
        return 'Elevated stablecoin reserves signal potential buying pressure';
    } else if (stableCap > 250e9) {
        return 'Strong stablecoin liquidity available for deployment';
    } else {
        return 'Stablecoin liquidity remains robust for market activity';
    }
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
