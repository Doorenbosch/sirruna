/**
 * Breaking News Detection - Cron Job
 * Runs every 5 minutes via Vercel Cron
 * 
 * Flow: RSS Feeds → Score → Threshold → Claude Editorial → Publish
 * 
 * Cost: ~$0.02 per breaking story (only when triggered)
 */

// Use Vercel KV for storage (or fallback to edge config)
// import { kv } from '@vercel/kv';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    scoreThreshold: 75,           // Minimum score to trigger breaking news
    maxAgeHours: 2,               // Only consider articles from last 2 hours
    breakingExpiryHours: 4,       // Breaking news expires after 4 hours
    maxBreakingStories: 1,        // Only show 1 breaking story at a time
    checkIntervalMinutes: 5       // How often cron runs
};

// RSS feeds to monitor
const RSS_FEEDS = [
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', weight: 1.3 },
    { url: 'https://www.theblock.co/rss.xml', source: 'The Block', weight: 1.3 },
    { url: 'https://decrypt.co/feed', source: 'Decrypt', weight: 1.1 },
    { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', weight: 1.0 },
];

// Scoring keywords
const BREAKING_SIGNALS = {
    // Critical - immediate market impact (40 points each)
    critical: [
        'SEC charges', 'SEC sues', 'DOJ charges', 'DOJ indicts',
        'hacked', 'exploit', 'stolen', 'drained',
        'emergency', 'halts trading', 'suspends',
        'Fed rate', 'FOMC', 'rate cut', 'rate hike',
        'ETF approved', 'ETF rejected', 'ETF denied',
        'arrested', 'indicted', 'fraud charges',
        'bank run', 'insolvency', 'bankruptcy files'
    ],
    
    // High - significant news (25 points each)
    high: [
        'SEC', 'CFTC', 'DOJ', 'Treasury',
        'billion', '$1B', '$500M',
        'Binance', 'Coinbase', 'Kraken', 'FTX',
        'Tether', 'USDC', 'stablecoin',
        'BlackRock', 'Fidelity', 'Grayscale',
        'China', 'US government', 'regulation',
        'hack', 'breach', 'vulnerability',
        'delisted', 'banned', 'prohibited'
    ],
    
    // Medium - notable but not urgent (15 points each)
    medium: [
        'breaking', 'just in', 'developing',
        'surge', 'plunge', 'crash', 'soars',
        'whale', 'institutional',
        'Ethereum', 'Bitcoin', 'Solana',
        'all-time high', 'ATH', 'record'
    ],
    
    // Negative signals - reduce score (subtract points)
    negative: [
        'opinion', 'analysis', 'weekly', 'recap',
        'podcast', 'interview', 'preview',
        'guide', 'how to', 'tutorial',
        'sponsored', 'partner', 'advertisement'
    ]
};

// ============================================
// RSS PARSING
// ============================================

async function fetchRSSFeed(feedConfig) {
    try {
        const response = await fetch(feedConfig.url, {
            headers: {
                'User-Agent': 'TheLitmus/1.0 Breaking News Monitor'
            }
        });
        
        if (!response.ok) {
            console.log(`[Breaking] Failed to fetch ${feedConfig.source}: ${response.status}`);
            return [];
        }
        
        const xml = await response.text();
        return parseRSSItems(xml, feedConfig);
        
    } catch (error) {
        console.error(`[Breaking] Error fetching ${feedConfig.source}:`, error.message);
        return [];
    }
}

function parseRSSItems(xml, feedConfig) {
    const items = [];
    
    // Simple regex-based RSS parsing (works in edge runtime)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/i;
    const linkRegex = /<link>(.*?)<\/link>/i;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/i;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/i;
    
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        
        const titleMatch = itemXml.match(titleRegex);
        const linkMatch = itemXml.match(linkRegex);
        const pubDateMatch = itemXml.match(pubDateRegex);
        const descMatch = itemXml.match(descRegex);
        
        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
        const link = (linkMatch?.[1] || '').trim();
        const pubDate = pubDateMatch?.[1] ? new Date(pubDateMatch[1]) : new Date();
        const description = (descMatch?.[1] || descMatch?.[2] || '').trim();
        
        if (title && link) {
            items.push({
                title,
                link,
                pubDate,
                description: description.replace(/<[^>]*>/g, '').substring(0, 300),
                source: feedConfig.source,
                weight: feedConfig.weight
            });
        }
    }
    
    return items;
}

// ============================================
// SCORING
// ============================================

function scoreArticle(article) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    let score = 0;
    const matchedSignals = [];
    
    // Check critical keywords (40 points each)
    for (const keyword of BREAKING_SIGNALS.critical) {
        if (text.includes(keyword.toLowerCase())) {
            score += 40;
            matchedSignals.push(`critical:${keyword}`);
        }
    }
    
    // Check high keywords (25 points each)
    for (const keyword of BREAKING_SIGNALS.high) {
        if (text.includes(keyword.toLowerCase())) {
            score += 25;
            matchedSignals.push(`high:${keyword}`);
        }
    }
    
    // Check medium keywords (15 points each)
    for (const keyword of BREAKING_SIGNALS.medium) {
        if (text.includes(keyword.toLowerCase())) {
            score += 15;
            matchedSignals.push(`medium:${keyword}`);
        }
    }
    
    // Check negative signals (subtract 20 each)
    for (const keyword of BREAKING_SIGNALS.negative) {
        if (text.includes(keyword.toLowerCase())) {
            score -= 20;
            matchedSignals.push(`negative:${keyword}`);
        }
    }
    
    // Apply source weight multiplier
    score = Math.round(score * article.weight);
    
    // Recency boost: articles from last 30 min get +20
    const ageMinutes = (Date.now() - article.pubDate.getTime()) / 1000 / 60;
    if (ageMinutes < 30) {
        score += 20;
        matchedSignals.push('recency:30min');
    } else if (ageMinutes < 60) {
        score += 10;
        matchedSignals.push('recency:60min');
    }
    
    return { score, matchedSignals };
}

function filterRecentArticles(articles) {
    const maxAge = CONFIG.maxAgeHours * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    
    return articles.filter(article => article.pubDate.getTime() > cutoff);
}

// ============================================
// CLAUDE EDITORIAL
// ============================================

async function generateEditorial(article) {
    if (!ANTHROPIC_API_KEY) {
        console.error('[Breaking] No Anthropic API key');
        return null;
    }
    
    const prompt = `You are the breaking news editor at The Litmus, a premium crypto intelligence publication with FT-quality editorial standards.

A significant story just broke. Write a brief, authoritative breaking news alert.

ORIGINAL HEADLINE: ${article.title}
SOURCE: ${article.source}
SUMMARY: ${article.description}

Write a breaking news alert with:
1. HEADLINE: Rewrite in our editorial voice (8-12 words, authoritative, no hype)
2. SUMMARY: 2-3 sentences explaining what happened and why it matters (50-80 words)
3. IMPLICATION: One sentence on what sophisticated investors should consider

VOICE: FT breaking news style. Urgent but measured. No exclamation marks, no "BREAKING:", no hype words like "massive" or "huge". State facts with authority.

Return as JSON:
{
    "headline": "Your rewritten headline",
    "summary": "2-3 sentence summary",
    "implication": "What this means for investors",
    "severity": "high|medium" 
}

Return ONLY the JSON object.`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',  // Use Sonnet for speed + cost
                max_tokens: 500,
                temperature: 0.3,  // Low temp for consistency
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        if (!response.ok) {
            console.error('[Breaking] Claude API error:', response.status);
            return null;
        }
        
        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        
        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return null;
        
    } catch (error) {
        console.error('[Breaking] Editorial generation error:', error.message);
        return null;
    }
}

// ============================================
// STORAGE (Vercel KV or Edge Config)
// ============================================

// For now, we'll return the data and let the caller handle storage
// In production, use Vercel KV:
// await kv.set('breaking-news', data, { ex: CONFIG.breakingExpiryHours * 3600 });

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
    // Verify cron secret (optional but recommended)
    // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return res.status(401).json({ error: 'Unauthorized' });
    // }
    
    console.log('[Breaking] Starting news check...');
    
    try {
        // 1. Fetch all RSS feeds in parallel
        const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
        const feedResults = await Promise.all(feedPromises);
        const allArticles = feedResults.flat();
        
        console.log(`[Breaking] Fetched ${allArticles.length} articles from ${RSS_FEEDS.length} feeds`);
        
        // 2. Filter to recent articles only
        const recentArticles = filterRecentArticles(allArticles);
        console.log(`[Breaking] ${recentArticles.length} articles within ${CONFIG.maxAgeHours}h window`);
        
        // 3. Score each article
        const scoredArticles = recentArticles.map(article => ({
            ...article,
            ...scoreArticle(article)
        }));
        
        // 4. Sort by score and get top candidates
        scoredArticles.sort((a, b) => b.score - a.score);
        
        const topArticles = scoredArticles.slice(0, 5);
        console.log('[Breaking] Top 5 scores:', topArticles.map(a => `${a.score}: ${a.title.substring(0, 50)}`));
        
        // 5. Check if any exceed threshold
        const breakingCandidates = scoredArticles.filter(a => a.score >= CONFIG.scoreThreshold);
        
        if (breakingCandidates.length === 0) {
            console.log('[Breaking] No breaking news detected');
            return res.status(200).json({
                status: 'checked',
                breaking: null,
                checked_at: new Date().toISOString(),
                articles_checked: allArticles.length,
                top_score: topArticles[0]?.score || 0
            });
        }
        
        // 6. Generate editorial for top breaking story
        const topBreaking = breakingCandidates[0];
        console.log(`[Breaking] BREAKING DETECTED (score ${topBreaking.score}): ${topBreaking.title}`);
        
        const editorial = await generateEditorial(topBreaking);
        
        if (!editorial) {
            console.log('[Breaking] Failed to generate editorial');
            return res.status(200).json({
                status: 'error',
                message: 'Editorial generation failed',
                candidate: topBreaking.title
            });
        }
        
        // 7. Build breaking news object
        const breakingNews = {
            id: `breaking-${Date.now()}`,
            headline: editorial.headline,
            summary: editorial.summary,
            implication: editorial.implication,
            severity: editorial.severity || 'medium',
            source: {
                name: topBreaking.source,
                url: topBreaking.link,
                originalTitle: topBreaking.title
            },
            score: topBreaking.score,
            matchedSignals: topBreaking.matchedSignals,
            published_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CONFIG.breakingExpiryHours * 3600000).toISOString()
        };
        
        console.log('[Breaking] Published:', breakingNews.headline);
        
        // In production with Vercel KV:
        // await kv.set('breaking-news', breakingNews, { ex: CONFIG.breakingExpiryHours * 3600 });
        
        return res.status(200).json({
            status: 'published',
            breaking: breakingNews,
            checked_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Breaking] Check error:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
}

// Vercel Cron config (add to vercel.json)
export const config = {
    runtime: 'edge',  // Use edge for faster cold starts
};
