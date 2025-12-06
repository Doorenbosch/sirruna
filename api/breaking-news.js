/**
 * Breaking News API Endpoint
 * Returns current breaking news if any, or null
 * 
 * Frontend polls this every 60 seconds
 */

// In production, use Vercel KV:
// import { kv } from '@vercel/kv';

// For demo/development: in-memory store (resets on deploy)
// Replace with Vercel KV in production
let breakingNewsStore = null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    
    // POST: Update breaking news (called by cron job)
    if (req.method === 'POST') {
        // Verify internal call (add auth in production)
        // if (req.headers.authorization !== `Bearer ${process.env.BREAKING_NEWS_SECRET}`) {
        //     return res.status(401).json({ error: 'Unauthorized' });
        // }
        
        try {
            const data = req.body;
            
            if (data.breaking) {
                breakingNewsStore = data.breaking;
                console.log('[Breaking API] Stored:', data.breaking.headline);
            } else if (data.clear) {
                breakingNewsStore = null;
                console.log('[Breaking API] Cleared breaking news');
            }
            
            // In production with Vercel KV:
            // if (data.breaking) {
            //     await kv.set('breaking-news', data.breaking, { 
            //         ex: 4 * 3600  // 4 hour expiry
            //     });
            // } else if (data.clear) {
            //     await kv.del('breaking-news');
            // }
            
            return res.status(200).json({ status: 'ok' });
            
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
    // GET: Return current breaking news
    try {
        // In production with Vercel KV:
        // const breaking = await kv.get('breaking-news');
        
        const breaking = breakingNewsStore;
        
        // Check if expired
        if (breaking && breaking.expires_at) {
            const expiresAt = new Date(breaking.expires_at);
            if (expiresAt < new Date()) {
                // Expired - clear it
                breakingNewsStore = null;
                return res.status(200).json({
                    breaking: null,
                    checked_at: new Date().toISOString()
                });
            }
        }
        
        return res.status(200).json({
            breaking: breaking || null,
            checked_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Breaking API] Error:', error);
        return res.status(200).json({
            breaking: null,
            error: error.message
        });
    }
}
