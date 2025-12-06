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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
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
        const rows = [];
        
        // The Bitbo table is markdown-style with pipe separators
        // Format: | Dec 04, 2025 | 41.1 | 0.0 | -19.8 | ... | -15.2 |
        
        // Split by lines and look for date patterns
        const lines = html.split('\n');
        
        for (const line of lines) {
            // Skip header rows and separator rows
            if (line.includes('Date') || line.includes('---') || 
                line.includes('Total') || line.includes('Average') ||
                line.includes('Maximum') || line.includes('Minimum')) {
                continue;
            }
            
            // Match lines with date pattern: "Dec 04, 2025" or "Nov 27, 2025"
            const dateMatch = line.match(/\|\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s*\|/);
            
            if (dateMatch) {
                // Split by pipe and get all values
                const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
                
                if (parts.length >= 13) {
                    // Last column is Totals
                    const totalStr = parts[parts.length - 1].replace(/,/g, '');
                    const total = parseFloat(totalStr);
                    
                    // Capture individual ETF data (column positions from table header)
                    // | Date | IBIT | FBTC | GBTC | BTC | BITB | ARKB | HODL | ... | Totals |
                    //    0      1      2      3     4     5      6      7           13
                    const etfData = {
                        IBIT: parseFloat(parts[1]) || 0,  // BlackRock
                        FBTC: parseFloat(parts[2]) || 0,  // Fidelity
                        GBTC: parseFloat(parts[3]) || 0,  // Grayscale
                        ARKB: parseFloat(parts[6]) || 0,  // Ark
                    };
                    
                    if (!isNaN(total)) {
                        rows.push({
                            date: dateMatch[1],
                            total: total,
                            etfs: etfData
                        });
                    }
                }
            }
        }
        
        // If pipe parsing didn't work, try alternative approach
        if (rows.length === 0) {
            console.log('Pipe parsing failed, trying regex approach');
            
            // Look for date followed by numbers pattern
            const rowRegex = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})[^\n]*?([-]?\d+\.?\d*)\s*\|?\s*$/gm;
            let match;
            
            while ((match = rowRegex.exec(html)) !== null) {
                const total = parseFloat(match[2]);
                if (!isNaN(total) && Math.abs(total) < 5000) {
                    rows.push({
                        date: match[1].trim(),
                        total: total,
                        etfs: {}
                    });
                }
            }
        }
        
        // Still no data? Try looking for the table differently
        if (rows.length === 0) {
            console.log('Regex failed, trying table cell approach');
            
            // Match any date followed by numbers in the same context
            const dateRegex = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/g;
            const dates = [...html.matchAll(dateRegex)];
            
            for (const dateMatch of dates) {
                // Get context around the date (next 500 chars)
                const startIdx = dateMatch.index;
                const context = html.substring(startIdx, startIdx + 500);
                
                // Find the last number before a newline or end of row
                const numbers = context.match(/-?\d+\.?\d*/g);
                if (numbers && numbers.length >= 10) {
                    // The total should be the last significant number
                    const total = parseFloat(numbers[numbers.length - 1]);
                    if (!isNaN(total) && Math.abs(total) < 5000) {
                        // Avoid duplicates
                        if (!rows.find(r => r.date === dateMatch[1])) {
                            rows.push({
                                date: dateMatch[1],
                                total: total,
                                etfs: {}
                            });
                        }
                    }
                }
            }
        }
        
        if (rows.length === 0) {
            console.log('All parsing methods failed');
            return null;
        }
        
        console.log(`Parsed ${rows.length} ETF flow rows`);
        
        // Sort by date (most recent first)
        rows.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Get latest (most recent trading day)
        const latest = rows[0];
        const latestAmount = Math.round(latest.total);
        
        // Get last 5 trading days
        const last5 = rows.slice(0, 5).reverse();
        
        const week = last5.map((day) => {
            const date = new Date(day.date);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = dayNames[date.getDay()];
            
            return {
                day: dayName,
                amount: Math.round(day.total),
                date: day.date,
                etfs: day.etfs || {}
            };
        });
        
        // Calculate week total
        const weekTotal = week.reduce((sum, d) => sum + d.amount, 0);
        
        // Generate insight
        const insight = generateInsight(latestAmount, week, weekTotal);
        
        // Format date for display
        const latestDate = new Date(latest.date);
        const dateStr = latestDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        
        return {
            latest: {
                amount: latestAmount,
                date: dateStr,
                fullDate: latest.date,
                etfs: latest.etfs || {}
            },
            week: week,
            weekTotal: weekTotal,
            insight: insight,
            source: 'bitbo',
            updated: new Date().toISOString(),
            debug: {
                rowsParsed: rows.length
            }
        };
        
    } catch (e) {
        console.error('Parse error:', e);
        return null;
    }
}

function generateInsight(latest, week, weekTotal) {
    const isInflow = latest > 0;
    const consecutiveDays = countConsecutive(week, isInflow);
    
    if (consecutiveDays >= 4) {
        return `${consecutiveDays} consecutive days of net ${isInflow ? 'inflows' : 'outflows'}`;
    } else if (consecutiveDays === 3) {
        return `Third straight day of ${isInflow ? 'inflows' : 'outflows'}`;
    } else if (Math.abs(latest) > 500) {
        return `Heavy ${isInflow ? 'institutional buying' : 'redemptions'}: ${isInflow ? '+' : ''}$${latest}M`;
    } else if (Math.abs(latest) > 300) {
        return `Notable ${isInflow ? 'inflows' : 'outflows'}: ${isInflow ? '+' : ''}$${latest}M`;
    } else if (Math.abs(weekTotal) > 500) {
        if (weekTotal > 0) {
            return `Strong weekly accumulation: +$${Math.round(weekTotal)}M`;
        } else {
            return `Significant weekly outflows: -$${Math.abs(Math.round(weekTotal))}M`;
        }
    } else if (weekTotal > 0) {
        return `Net positive week: +$${Math.round(weekTotal)}M total`;
    } else if (weekTotal < 0) {
        return `Net outflows this week: -$${Math.abs(Math.round(weekTotal))}M`;
    } else {
        return `Mixed flows, roughly flat this week`;
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
    // Return realistic recent data as fallback
    return {
        latest: {
            amount: -15,
            date: 'Dec 4',
            fullDate: 'Dec 04, 2025',
            etfs: { IBIT: 41, FBTC: 0, GBTC: -20, ARKB: -36 }
        },
        week: [
            { day: 'Wed', amount: 4, date: 'Nov 26, 2025' },
            { day: 'Thu', amount: -28, date: 'Nov 27, 2025' },
            { day: 'Mon', amount: 116, date: 'Dec 01, 2025' },
            { day: 'Wed', amount: 57, date: 'Dec 03, 2025' },
            { day: 'Thu', amount: -15, date: 'Dec 04, 2025' }
        ],
        weekTotal: 134,
        insight: 'Net positive week: +$134M total',
        source: 'fallback',
        updated: new Date().toISOString()
    };
}
