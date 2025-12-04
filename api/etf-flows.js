// ETF Flows API - Uses SoSoValue API
// Add SOSOVALUE_API_KEY to your Vercel environment variables
//
// SoSoValue API docs show two URLs:
// - https://api.sosovalue.xyz (from examples)
// - https://openapi.sosovalue.com (from auth page)

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    // Cache for 24 hours - ETF data updates once daily after US market close
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    
    const apiKey = process.env.SOSOVALUE_API_KEY;
    
    if (!apiKey) {
        console.log('No SoSoValue API key configured');
        return res.status(200).json({
            ...getMockData(),
            debug: { error: 'No API key configured' }
        });
    }
    
    // Try both base URLs from their documentation
    const baseUrls = [
        'https://api.sosovalue.xyz',
        'https://openapi.sosovalue.com'
    ];
    
    const endpoint = '/openapi/v2/etf/historicalInflowChart';
    const errors = [];
    
    for (const baseUrl of baseUrls) {
        try {
            const url = `${baseUrl}${endpoint}`;
            console.log('Trying SoSoValue URL:', url);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-soso-api-key': apiKey
                },
                body: JSON.stringify({ type: 'us-btc-spot' })
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                errors.push(`${baseUrl}: ${response.status} - ${errorText}`);
                continue;
            }
            
            const data = await response.json();
            
            if (data.code !== 0) {
                errors.push(`${baseUrl}: API code ${data.code} - ${data.msg}`);
                continue;
            }
            
            // Success!
            const transformed = transformSoSoValueData(data);
            transformed.apiUrl = baseUrl;
            return res.status(200).json(transformed);
            
        } catch (error) {
            errors.push(`${baseUrl}: ${error.name} - ${error.message}`);
            console.error('Fetch error for', baseUrl, error);
        }
    }
    
    // All attempts failed
    console.error('All SoSoValue endpoints failed:', errors);
    return res.status(200).json({
        ...getMockData(),
        debug: { 
            errors: errors,
            apiKeyPresent: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0
        }
    });
}

function transformSoSoValueData(data) {
    try {
        const list = data.data?.list || [];
        
        if (!list.length) {
            console.log('No ETF data in response');
            return getMockData();
        }
        
        // Sort by date descending (most recent first)
        const sorted = [...list].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        // Get most recent day (yesterday's data)
        const latest = sorted[0];
        const yesterdayAmount = Math.round((latest.totalNetInflow || 0) / 1000000); // Convert to millions
        
        // Get last 5 trading days for the week chart
        const last5Days = sorted.slice(0, 5).reverse(); // Reverse to get chronological order
        
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const week = last5Days.map((day, i) => {
            const date = new Date(day.date);
            const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc.
            const dayName = dayOfWeek >= 1 && dayOfWeek <= 5 
                ? dayNames[dayOfWeek - 1] 
                : dayNames[i];
            
            return {
                day: dayName,
                amount: Math.round((day.totalNetInflow || 0) / 1000000),
                date: day.date
            };
        });
        
        // Generate insight
        const insight = generateInsight(yesterdayAmount, week);
        
        // Format the date for display
        const latestDate = new Date(latest.date);
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
            updated: new Date().toISOString(),
            rawDate: latest.date
        };
        
    } catch (e) {
        console.error('Transform error:', e);
        return getMockData();
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

function getMockData() {
    return {
        yesterday: {
            amount: 1,
            date: 'Yesterday'
        },
        week: [
            { day: 'Mon', amount: 1 },
            { day: 'Tue', amount: 2 },
            { day: 'Wed', amount: 3 },
            { day: 'Thu', amount: 4 },
            { day: 'Fri', amount: 1 }
        ],
        insight: 'No catch of data yet, we are working on it',
        source: 'mock',
        updated: new Date().toISOString()
    };
}
