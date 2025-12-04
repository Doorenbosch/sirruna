// ETF Flows API - Uses SoSoValue API
// Add SOSOVALUE_API_KEY to your Vercel environment variables
// 
// SoSoValue API Configuration:
const SOSOVALUE_BASE_URL = 'https://openapi.sosovalue.com';
const AUTH_HEADER = 'x-soso-api-key';

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
        // Build headers with SoSoValue auth
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            [AUTH_HEADER]: apiKey
        };
        
        // Try potential ETF endpoint patterns based on SoSoValue structure
        const endpoints = [
            '/etf/us-btc-spot',
            '/etf/btc',
            '/api/etf/us-btc-spot',
            '/v1/etf/us-btc-spot',
            '/etf/bitcoin-spot',
            '/etf/flow/btc'
        ];
        
        let data = null;
        let successEndpoint = null;
        let lastError = null;
        
        for (const endpoint of endpoints) {
            const url = `${SOSOVALUE_BASE_URL}${endpoint}`;
            try {
                console.log('Trying SoSoValue endpoint:', url);
                const response = await fetch(url, { 
                    headers,
                    method: 'GET'
                });
                
                console.log('Response status:', response.status);
                
                if (response.ok) {
                    data = await response.json();
                    successEndpoint = endpoint;
                    console.log('SoSoValue API success:', endpoint);
                    break;
                } else {
                    const errorText = await response.text();
                    lastError = `${response.status}: ${errorText}`;
                    console.log('Endpoint failed:', endpoint, lastError);
                }
            } catch (e) {
                lastError = e.message;
                console.log('Endpoint error:', endpoint, e.message);
                continue;
            }
        }
        
        if (!data) {
            console.log('All SoSoValue endpoints failed. Last error:', lastError);
            return res.status(200).json({
                ...getMockData(),
                debug: {
                    error: lastError,
                    triedEndpoints: endpoints.map(e => `${SOSOVALUE_BASE_URL}${e}`)
                }
            });
        }
        
        // Transform SoSoValue response to our format
        const transformed = transformSoSoValueData(data);
        transformed.endpoint = successEndpoint;
        
        return res.status(200).json(transformed);
        
    } catch (error) {
        console.error('ETF Flows API error:', error);
        return res.status(200).json({
            ...getMockData(),
            debug: { error: error.message }
        });
    }
}

// Transform SoSoValue data to our app format
function transformSoSoValueData(data) {
    try {
        console.log('Raw SoSoValue data:', JSON.stringify(data).substring(0, 500));
        
        const rawData = data.data || data;
        
        // Extract yesterday's flow - try various field names
        let yesterdayAmount = 0;
        const flowFields = [
            'dailyNetInflow', 'daily_net_inflow', 'netFlow', 'net_flow',
            'totalDailyNetflow', 'total_daily_netflow', 'dailyFlow', 'daily_flow',
            'netInflow', 'net_inflow', 'inflow', 'flow'
        ];
        
        for (const field of flowFields) {
            if (rawData[field] !== undefined) {
                yesterdayAmount = rawData[field];
                console.log('Found flow field:', field, yesterdayAmount);
                break;
            }
        }
        
        // If data is array, get most recent entry
        if (Array.isArray(rawData) && rawData.length > 0) {
            const latest = rawData[rawData.length - 1];
            for (const field of flowFields) {
                if (latest[field] !== undefined) {
                    yesterdayAmount = latest[field];
                    break;
                }
            }
        }
        
        // Extract weekly data
        let weekData = [];
        const historyFields = ['flows', 'historicalFlows', 'history', 'dailyFlows', 'data', 'list'];
        for (const field of historyFields) {
            if (rawData[field] && Array.isArray(rawData[field])) {
                weekData = rawData[field].slice(-5);
                break;
            }
        }
        
        // If rawData is already an array, use it
        if (Array.isArray(rawData)) {
            weekData = rawData.slice(-5);
        }
        
        // Format week data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const week = weekData.map((day, i) => {
            let amount = 0;
            for (const field of flowFields) {
                if (day[field] !== undefined) {
                    amount = day[field];
                    break;
                }
            }
            // Convert to millions if needed (if value > 10000, assume it's in dollars)
            if (Math.abs(amount) > 10000) {
                amount = Math.round(amount / 1000000);
            }
            return {
                day: days[i] || `Day ${i + 1}`,
                amount: amount
            };
        });
        
        // Convert yesterday to millions if needed
        let yesterdayMillions = yesterdayAmount;
        if (Math.abs(yesterdayAmount) > 10000) {
            yesterdayMillions = Math.round(yesterdayAmount / 1000000);
        }
        
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
