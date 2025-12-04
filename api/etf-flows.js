// ETF Flows API - Scrapes Bitbo.io (no API key required)
// Source: https://bitbo.io/treasuries/etf-flows/
// Data originally from Farside Investors

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    // Cache for 4 hours - ETF data updates once daily after US market close
    res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=3600');
    
    try {
        const response = await fetch('https://bitbo.io/treasuries/etf-flows/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LitmusDaily/1.0)',
                'Accept': 'text/html'
            }
        });
        
        if (!response.ok) {
            console.error('Bitbo fetch error:', response.status);
            return res.status(200).json(getMockData());
        }
        
        const html = await response.text();
        const data = parseETFData(html);
        
        if (!data || data.week.length === 0) {
            console.log('Failed to parse Bitbo data');
            return res.status(200).json(getMockData());
        }
        
        return res.status(200).json(data);
        
    } catch (error) {
        console.error('ETF Flows API error:', error);
        return res.status(200).json({
            ...getMockData(),
            debug: { error: error.message }
        });
    }
}

function parseETFData(html) {
    try {
        // Find the table data - looking for rows with dates and totals
        // Format: "Nov 13, 2025 | -35.0 | ... | -315.4"
        const rows = [];
        
        // Match table rows with date pattern
        const rowRegex = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s*\|([^|]+\|){11,12}\s*([-\d.,]+)\s*\|/g;
        let match;
        
        while ((match = rowRegex.exec(html)) !== null) {
            const dateStr = match[1].trim();
            const totalStr = match[3].trim().replace(/,/g, '');
            const total = parseFloat(totalStr);
            
            if (!isNaN(total)) {
                rows.push({
                    date: dateStr,
                    total: total
                });
            }
        }
        
        // Alternative parsing if regex didn't work
        if (rows.length === 0) {
            // Try simpler pattern matching
            const lines = html.split('\n');
            for (const line of lines) {
                // Look for lines with date pattern and numbers
                const dateMatch = line.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/);
                if (dateMatch) {
                    // Extract the last number (totals column)
                    const numbers = line.match(/-?\d+\.?\d*/g);
                    if (numbers && numbers.length > 5) {
                        const total = parseFloat(numbers[numbers.length - 1]);
                        if (!isNaN(total) && Math.abs(total) < 10000) { // Sanity check
                            rows.push({
                                date: dateMatch[1],
                                total: total
                            });
                        }
                    }
                }
            }
        }
        
        if (rows.length === 0) {
            console.log('No rows parsed from HTML');
            return null;
        }
        
        // Sort by date (most recent first)
        rows.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Get yesterday (most recent)
        const latest = rows[0];
        const yesterdayAmount = Math.round(latest.total);
        
        // Get last 5 trading days
        const last5 = rows.slice(0, 5).reverse();
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        
        const week = last5.map((day, i) => {
            const date = new Date(day.date);
            const dayOfWeek = date.getDay();
            const dayName = dayOfWeek >= 1 && dayOfWeek <= 5 
                ? dayNames[dayOfWeek - 1] 
                : dayNames[i % 5];
            
            return {
                day: dayName,
                amount: Math.round(day.total),
                date: day.date
            };
        });
        
        // Generate insight
        const insight = generateInsight(yesterdayAmount, week);
        
        // Format date for display
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
            source: 'bitbo',
            updated: new Date().toISOString()
        };
        
    } catch (e) {
        console.error('Parse error:', e);
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
