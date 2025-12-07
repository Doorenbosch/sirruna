// ETF Flows API - Uses SoSoValue API
// Source: https://sosovalue.com/assets/etf/us-btc-spot

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    // Cache for 4 hours - ETF data updates once daily after US market close
    res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=3600');
    
    try {
        // Try SoSoValue API first
        const data = await fetchSoSoValue();
        
        if (data && data.week && data.week.length > 0) {
            return res.status(200).json(data);
        }
        
        // Fallback to unavailable state if API fails
        console.log('SoSoValue API failed, using fallback');
        return res.status(200).json(getFallbackData());
        
    } catch (error) {
        console.error('ETF Flows API error:', error.message);
        return res.status(200).json({
            ...getFallbackData(),
            debug: { error: error.message }
        });
    }
}

async function fetchSoSoValue() {
    try {
        // SoSoValue public API endpoint for BTC ETF flows
        const response = await fetch('https://api.sosovalue.xyz/common/v1/etf/flowHistory?currency=USD&etfType=btc_spot', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://sosovalue.com',
                'Referer': 'https://sosovalue.com/'
            }
        });
        
        if (!response.ok) {
            console.log('SoSoValue API status:', response.status);
            return null;
        }
        
        const json = await response.json();
        return parseSoSoValueData(json);
        
    } catch (error) {
        console.log('SoSoValue fetch error:', error.message);
        return null;
    }
}

function parseSoSoValueData(data) {
    try {
        // SoSoValue returns { code: 0, data: { list: [...] } }
        let flows = [];
        
        if (data?.data?.list && Array.isArray(data.data.list)) {
            flows = data.data.list;
        } else if (Array.isArray(data?.data)) {
            flows = data.data;
        } else if (Array.isArray(data)) {
            flows = data;
        }
        
        if (flows.length === 0) {
            console.log('No flows in response');
            return null;
        }
        
        // Sort by date (most recent first) - SoSoValue uses 'tradingDate'
        flows.sort((a, b) => {
            const dateA = new Date(a.tradingDate || a.date || a.reportDate);
            const dateB = new Date(b.tradingDate || b.date || b.reportDate);
            return dateB - dateA;
        });
        
        // Get the most recent trading day
        const latest = flows[0];
        // SoSoValue uses 'totalNetInflow' in millions
        const yesterdayAmount = Math.round(
            parseFloat(latest.totalNetInflow || latest.netFlow || 0)
        );
        
        // Get last 5 trading days
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const last5 = flows.slice(0, 5).reverse();
        
        const week = last5.map(day => {
            const dateStr = day.tradingDate || day.date;
            const date = new Date(dateStr);
            const amount = Math.round(
                parseFloat(day.totalNetInflow || day.netFlow || 0)
            );
            
            return {
                day: dayNames[date.getDay()],
                amount: amount,
                date: dateStr
            };
        });
        
        // Generate insight
        const insight = generateInsight(yesterdayAmount, week);
        
        // Format date for display
        const latestDate = new Date(latest.tradingDate || latest.date);
        const dateStr = latestDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        
        return {
            yesterday: {
                amount: yesterdayAmount,
                date: dateStr
            },
            week: week,
            insight: insight,
            source: 'sosovalue',
            updated: new Date().toISOString()
        };
        
    } catch (e) {
        console.error('Parse error:', e.message);
        return null;
    }
}

function generateInsight(yesterday, week) {
    const isInflow = yesterday > 0;
    const consecutiveDays = countConsecutive(week, isInflow);
    const weekTotal = week.reduce((sum, d) => sum + (d.amount || 0), 0);
    
    if (consecutiveDays >= 4) {
        return `${consecutiveDays} consecutive days of net ${isInflow ? 'inflows' : 'outflows'}`;
    } else if (consecutiveDays === 3) {
        return `Third straight day of ${isInflow ? 'inflows' : 'outflows'}`;
    } else if (Math.abs(yesterday) > 500) {
        return `Heavy ${isInflow ? 'institutional buying' : 'redemptions'}: ${isInflow ? '+' : ''}$${yesterday}M`;
    } else if (Math.abs(yesterday) > 300) {
        return `Notable ${isInflow ? 'inflows' : 'outflows'}: ${isInflow ? '+' : ''}$${yesterday}M`;
    } else if (weekTotal > 1000) {
        return `Strong weekly accumulation: +$${Math.round(weekTotal)}M`;
    } else if (weekTotal < -1000) {
        return `Significant weekly outflows: $${Math.abs(Math.round(weekTotal))}M`;
    } else if (weekTotal > 0) {
        return `Net positive week: +$${Math.round(weekTotal)}M total`;
    } else {
        return `Net outflows this week: $${Math.abs(Math.round(weekTotal))}M`;
    }
}

function countConsecutive(week, isInflow) {
    let count = 0;
    for (let i = week.length - 1; i >= 0; i--) {
        const dayIsInflow = (week[i].amount || 0) > 0;
        if (dayIsInflow === isInflow) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

function getFallbackData() {
    // Return unavailable state - no fake mock data
    return {
        yesterday: {
            amount: null,
            date: 'Unavailable'
        },
        week: [],
        insight: 'ETF flow data temporarily unavailable',
        source: 'fallback',
        updated: new Date().toISOString()
    };
}
