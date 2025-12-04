// ETF Flows API - Uses SoSoValue API
// Add SOSOVALUE_API_KEY to your Vercel environment variables
// 
// CONFIGURATION - Update these based on SoSoValue API docs:
const SOSOVALUE_BASE_URL = 'https://api.sosovalue.com';  // Update if different
const ETF_ENDPOINT = '/etf/v1/us-btc-spot';              // Update based on docs
const AUTH_TYPE = 'bearer';                               // 'bearer' or 'header'

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // 5 min cache
    
    const apiKey = process.env.SOSOVALUE_API_KEY;
    
    if (!apiKey) {
        console.log('No SoSoValue API key configured, using mock data');
        return res.status(200).json(getMockData());
    }
    
    try {
        // Build headers based on auth type
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (AUTH_TYPE === 'bearer') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        } else {
            headers['X-API-Key'] = apiKey;
        }
        
        // Try multiple potential endpoint patterns
        const endpoints = [
            `${SOSOVALUE_BASE_URL}${ETF_ENDPOINT}`,
            `${SOSOVALUE_BASE_URL}/api/v1/etf/btc/flows`,
            `${SOSOVALUE_BASE_URL}/v1/etf/us-btc-spot/flows`,
            `${SOSOVALUE_BASE_URL}/etf/bitcoin/daily`
        ];
        
        let data = null;
        let successEndpoint = null;
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, { headers });
                if (response.ok) {
                    data = await response.json();
                    successEndpoint = endpoint;
                    console.log('SoSoValue API success:', endpoint);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!data) {
            console.log('All SoSoValue endpoints failed, using mock data');
            return res.status(200).json(getMockData());
        }
        
        // Transform SoSoValue response to our format
        const transformed = transformSoSoValueData(data);
        transformed.endpoint = successEndpoint;
        
        return res.status(200).json(transformed);
        
    } catch (error) {
        console.error('ETF Flows API error:', error);
        return res.status(200).json(getMockData());
    }
}

// Transform SoSoValue data to our app format
// Adjust field names based on actual API response
function transformSoSoValueData(data) {
    try {
        // Common field patterns from ETF APIs:
        // - data.dailyNetInflow / data.daily_net_inflow / data.netFlow
        // - data.flows / data.historicalFlows / data.history
        
        const rawData = data.data || data;
        
        // Extract yesterday's flow
        let yesterdayAmount = 0;
        if (rawData.dailyNetInflow !== undefined) {
            yesterdayAmount = rawData.dailyNetInflow;
        } else if (rawData.daily_net_inflow !== undefined) {
            yesterdayAmount = rawData.daily_net_inflow;
        } else if (rawData.netFlow !== undefined) {
            yesterdayAmount = rawData.netFlow;
        } else if (rawData.totalDailyNetflow !== undefined) {
            yesterdayAmount = rawData.totalDailyNetflow;
        } else if (Array.isArray(rawData) && rawData.length > 0) {
            // If array, get most recent
            const latest = rawData[rawData.length - 1];
            yesterdayAmount = latest.netInflow || latest.net_inflow || latest.flow || 0;
        }
        
        // Extract weekly data
        let weekData = [];
        const historyFields = ['flows', 'historicalFlows', 'history', 'dailyFlows'];
        for (const field of historyFields) {
            if (rawData[field] && Array.isArray(rawData[field])) {
                weekData = rawData[field].slice(-5);
                break;
            }
        }
        
        // If rawData is already an array
        if (Array.isArray(rawData)) {
            weekData = rawData.slice(-5);
        }
        
        // Format week data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const week = weekData.map((day, i) => ({
            day: days[i] || `Day ${i + 1}`,
            amount: Math.round((day.netInflow || day.net_inflow || day.flow || day.amount || 0) / 1000000)
        }));
        
        // Convert to millions
        const yesterdayMillions = Math.round(yesterdayAmount / 1000000);
        
        // Generate insight
        const insight = generateInsight(yesterdayMillions, week);
        
        return {
            yesterday: {
                amount: yesterdayMillions,
                date: 'Yesterday'
            },
            week: week.length >= 5 ? week : getMockData().week,
            insight: insight,
            source: 'sosovalue',
            updated: new Date().toISOString()
        };
    } catch (e) {
        console.error('Transform error:', e);
        return getMockData();
    }
}

// Generate editorial insight from data
function generateInsight(yesterday, week) {
    const isInflow = yesterday > 0;
    const consecutiveDays = countConsecutive(week, isInflow);
    const weekTotal = week.reduce((sum, d) => sum + (d.amount || 0), 0);
    
    if (consecutiveDays >= 3) {
        return `${consecutiveDays} consecutive days of net ${isInflow ? 'inflows' : 'outflows'}`;
    } else if (Math.abs(yesterday) > 400) {
        return `Significant ${isInflow ? 'institutional buying' : 'redemptions'} yesterday`;
    } else if (weekTotal > 500) {
        return `Strong weekly accumulation: +$${Math.round(weekTotal)}M net`;
    } else if (weekTotal < -500) {
        return `Weekly outflows signal caution: $${Math.abs(Math.round(weekTotal))}M out`;
    } else {
        return isInflow ? 'Steady institutional interest continues' : 'Mixed signals from institutional flows';
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

// Mock data fallback
function getMockData() {
    return {
        yesterday: {
            amount: 438,
            date: 'Yesterday'
        },
        week: [
            { day: 'Mon', amount: 215 },
            { day: 'Tue', amount: 380 },
            { day: 'Wed', amount: -120 },
            { day: 'Thu', amount: 290 },
            { day: 'Fri', amount: 438 }
        ],
        insight: 'Third consecutive day of net inflows',
        source: 'mock',
        updated: new Date().toISOString()
    };
}
