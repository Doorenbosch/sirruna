#!/usr/bin/env python3
"""
The Litmus - Premium Crypto Intelligence Brief Generator
Generates FT-quality editorial briefs using Claude Opus 4.5

6 briefs daily: Morning + Evening for Americas, EMEA, APAC
Target: Institutional-grade analysis that sophisticated investors would pay for

v2.0 - Improved JSON handling and error recovery
"""

import json
import os
import sys
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
import urllib.request
import urllib.error
import urllib.parse
import time
import random

# Configuration
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-opus-4-5-20251101"  # Opus 4.5 for premium editorial quality
TEMPERATURE = 0.55  # Slightly lower for more consistent JSON output
MAX_RETRIES = 2  # Retry on JSON parse failures

# API endpoints
COINGECKO_GLOBAL = "https://api.coingecko.com/api/v3/global"
COINGECKO_COINS = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h,7d"

# Paths
SCRIPT_DIR = Path(__file__).parent
CONTENT_DIR = SCRIPT_DIR.parent / "content"

# ============================================
# DYNAMIC HERO IMAGES - Keyword-based with curated fallbacks  
# ============================================

# Curated high-quality images mapped to moods/themes
CURATED_IMAGES = {
    # Calm/reflection moods
    "calm": "photo-1507003211169-0a1dd7228f2d",
    "still": "photo-1507003211169-0a1dd7228f2d",
    "reflection": "photo-1502101872923-d48509bff386",
    "water": "photo-1507003211169-0a1dd7228f2d",
    "quiet": "photo-1507003211169-0a1dd7228f2d",
    "serene": "photo-1507003211169-0a1dd7228f2d",
    
    # Optimistic/sunrise moods  
    "sunrise": "photo-1470252649378-9c29740c9fa8",
    "dawn": "photo-1470252649378-9c29740c9fa8",
    "morning": "photo-1470252649378-9c29740c9fa8",
    "mountain": "photo-1519681393784-d120267933ba",
    "peak": "photo-1507090960745-b32f65d3113a",
    "horizon": "photo-1502101872923-d48509bff386",
    "clear": "photo-1507090960745-b32f65d3113a",
    "rising": "photo-1470252649378-9c29740c9fa8",
    "bright": "photo-1470252649378-9c29740c9fa8",
    "light": "photo-1470252649378-9c29740c9fa8",
    
    # Ocean/harbor moods
    "ocean": "photo-1505142468610-359e7d316be0",
    "sea": "photo-1505142468610-359e7d316be0",
    "harbor": "photo-1505142468610-359e7d316be0",
    "harbour": "photo-1505142468610-359e7d316be0",
    "tide": "photo-1505142468610-359e7d316be0",
    "waves": "photo-1505142468610-359e7d316be0",
    "coast": "photo-1505142468610-359e7d316be0",
    
    # Uncertainty/fog moods
    "fog": "photo-1489549132488-d00b7eee80f1",
    "mist": "photo-1489549132488-d00b7eee80f1",
    "uncertainty": "photo-1489549132488-d00b7eee80f1",
    "clouds": "photo-1534088568595-a066f410bcda",
    "haze": "photo-1489549132488-d00b7eee80f1",
    "unclear": "photo-1489549132488-d00b7eee80f1",
    
    # Storm/dramatic moods
    "storm": "photo-1534088568595-a066f410bcda",
    "dramatic": "photo-1534274988757-a28bf1a57c17",
    "tension": "photo-1534274988757-a28bf1a57c17",
    "dark": "photo-1534088568595-a066f410bcda",
    "thunder": "photo-1534088568595-a066f410bcda",
    "turbulent": "photo-1534088568595-a066f410bcda",
    
    # Urban/city moods
    "city": "photo-1480714378408-67cf0d13bc1b",
    "skyline": "photo-1534430480872-3498386e7856",
    "urban": "photo-1486406146926-c627a92ad1ab",
    "buildings": "photo-1486406146926-c627a92ad1ab",
    "night": "photo-1480714378408-67cf0d13bc1b",
    
    # Architecture/office moods
    "architecture": "photo-1464082354059-27db6ce50048",
    "office": "photo-1486406146926-c627a92ad1ab",
    "skyscraper": "photo-1486406146926-c627a92ad1ab",
    "tower": "photo-1486406146926-c627a92ad1ab",
    "glass": "photo-1464082354059-27db6ce50048",
    "modern": "photo-1464082354059-27db6ce50048",
    "financial": "photo-1449157291145-7efd050a4d0e",
    "district": "photo-1449157291145-7efd050a4d0e",
    
    # Evening/sunset moods
    "sunset": "photo-1472120435266-53107fd0c44a",
    "evening": "photo-1472120435266-53107fd0c44a",
    "dusk": "photo-1472120435266-53107fd0c44a",
    "golden": "photo-1472120435266-53107fd0c44a",
    
    # Flow/movement moods
    "flow": "photo-1509023464722-18d996393ca8",
    "movement": "photo-1509023464722-18d996393ca8",
    "lights": "photo-1509023464722-18d996393ca8",
    "motion": "photo-1509023464722-18d996393ca8",
    
    # Path/journey moods
    "path": "photo-1501785888041-af3ef285b470",
    "road": "photo-1501785888041-af3ef285b470",
    "journey": "photo-1501785888041-af3ef285b470",
    "crossroads": "photo-1501785888041-af3ef285b470",
    
    # Forest/nature moods
    "forest": "photo-1448375240586-882707db888b",
    "trees": "photo-1448375240586-882707db888b",
    "nature": "photo-1448375240586-882707db888b",
    "green": "photo-1448375240586-882707db888b",
    
    # Default
    "default": "photo-1470252649378-9c29740c9fa8"
}

# Fallback images by time of day (used if API fails)
FALLBACK_IMAGES = {
    "default": "photo-1470252649378-9c29740c9fa8",  # Sunrise/optimism
    "morning": "photo-1470252649378-9c29740c9fa8",  # Sunrise
    "evening": "photo-1472120435266-53107fd0c44a",  # Sunset
}

# Unsplash API configuration
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")
UNSPLASH_API_URL = "https://api.unsplash.com/search/photos"

import random

def fetch_unsplash_image(keywords: str, region: str = "", brief_type: str = "morning") -> str:
    """Fetch image from Unsplash API with variety and regional context"""
    
    if not UNSPLASH_ACCESS_KEY:
        print("  Warning: UNSPLASH_ACCESS_KEY not set, using fallback")
        return None
    
    # Parse keywords
    query_parts = [k.strip() for k in keywords.split(",") if k.strip()]
    
    if not query_parts:
        print("  Warning: No keywords provided")
        return None
    
    # Strategy: Try location-focused search first, then broaden if needed
    # Unsplash works better with 2-3 keywords than 5+
    
    # Identify location keywords (most important for editorial feel)
    location_keywords = []
    mood_keywords = []
    
    location_terms = [
        "canary wharf", "london", "city of london", "frankfurt", "dubai", "paris",
        "hong kong", "singapore", "tokyo", "sydney", "victoria harbour", "marina bay",
        "manhattan", "wall street", "new york", "chicago", "san francisco",
        "financial district", "skyline", "tower", "skyscraper"
    ]
    
    mood_terms = [
        "dawn", "sunrise", "morning", "sunset", "dusk", "evening", "night",
        "golden hour", "light", "fog", "mist", "dramatic", "calm", "quiet"
    ]
    
    for kw in query_parts:
        kw_lower = kw.lower()
        if any(loc in kw_lower for loc in location_terms):
            location_keywords.append(kw)
        elif any(mood in kw_lower for mood in mood_terms):
            mood_keywords.append(kw)
        else:
            mood_keywords.append(kw)
    
    # Build search query: prioritize 1-2 location + 1 mood keyword
    search_parts = []
    if location_keywords:
        search_parts.extend(location_keywords[:2])
    if mood_keywords:
        search_parts.append(mood_keywords[0])
    
    # Fallback: just use first 2-3 keywords
    if not search_parts:
        search_parts = query_parts[:3]
    
    search_query = " ".join(search_parts[:3])
    print(f"  Unsplash search: '{search_query}'")
    
    try:
        # Call Unsplash API
        params = urllib.parse.urlencode({
            "query": search_query,
            "per_page": 10,
            "orientation": "landscape",
            "content_filter": "high"
        })
        
        url = f"{UNSPLASH_API_URL}?{params}"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}",
            "User-Agent": "TheLitmus/1.0"
        })
        
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        
        results = data.get("results", [])
        
        if not results:
            print(f"  No Unsplash results for: {search_query}")
            # Try a broader search with just the first keyword
            if len(query_parts) > 1:
                print(f"  Retrying with broader search: '{query_parts[0]}'")
                params = urllib.parse.urlencode({
                    "query": query_parts[0],
                    "per_page": 10,
                    "orientation": "landscape"
                })
                url = f"{UNSPLASH_API_URL}?{params}"
                req = urllib.request.Request(url, headers={
                    "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}",
                    "User-Agent": "TheLitmus/1.0"
                })
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode())
                results = data.get("results", [])
            
            if not results:
                return None
        
        print(f"  Found {len(results)} images")
        
        # Pick randomly from top results (weighted toward higher quality)
        if len(results) >= 5:
            weights = [3, 3, 2, 2, 1, 1, 1, 1, 1, 1][:len(results)]
            selected = random.choices(results, weights=weights, k=1)[0]
        else:
            selected = random.choice(results)
        
        # Safely get the image URL
        if not selected:
            print("  Error: No image selected")
            return None
            
        urls = selected.get("urls")
        if not urls:
            print("  Error: No URLs in selected image")
            return None
            
        raw_url = urls.get("raw", "")
        if raw_url:
            # Add Unsplash parameters for consistent sizing
            image_url = f"{raw_url}&w=1400&h=500&fit=crop&q=80"
            desc = selected.get('description') or selected.get('alt_description') or 'No description'
            print(f"  Selected: {desc[:60]}...")
            return image_url
        
        print("  Error: No raw URL found")
        return None
        
    except Exception as e:
        print(f"  Unsplash API error: {e}")
        return None


def build_image_url(keywords: str, fallback: str = "default", region: str = "", brief_type: str = "morning") -> str:
    """Build image URL - tries Unsplash API first, falls back to curated images"""
    
    # Try Unsplash API first
    api_url = fetch_unsplash_image(keywords, region, brief_type)
    if api_url:
        return api_url
    
    # Fallback to curated images
    if not keywords:
        photo_id = FALLBACK_IMAGES.get(fallback, FALLBACK_IMAGES["default"])
        return f"https://images.unsplash.com/{photo_id}?w=1400&h=500&fit=crop&q=80"
    
    # Clean keywords
    keyword_list = [k.strip().lower() for k in keywords.split(",")]
    
    # Find first matching curated image
    for keyword in keyword_list:
        # Check each word in multi-word keywords
        for word in keyword.split():
            if word in CURATED_IMAGES:
                photo_id = CURATED_IMAGES[word]
                return f"https://images.unsplash.com/{photo_id}?w=1400&h=500&fit=crop&q=80"
    
    # No match found, use fallback
    photo_id = FALLBACK_IMAGES.get(fallback, FALLBACK_IMAGES["default"])
    return f"https://images.unsplash.com/{photo_id}?w=1400&h=500&fit=crop&q=80"


def fetch_market_data() -> dict:
    """Fetch live market data from CoinGecko"""
    try:
        # Global data
        req = urllib.request.Request(COINGECKO_GLOBAL, headers={"User-Agent": "TheLitmus/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            global_data = json.loads(resp.read().decode())
        
        # Top coins
        req = urllib.request.Request(COINGECKO_COINS, headers={"User-Agent": "TheLitmus/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            coins = json.loads(resp.read().decode())
        
        btc = next((c for c in coins if c["id"] == "bitcoin"), {})
        eth = next((c for c in coins if c["id"] == "ethereum"), {})
        sol = next((c for c in coins if c["id"] == "solana"), {})
        
        return {
            "btc_price": btc.get("current_price", 0),
            "btc_24h_change": btc.get("price_change_percentage_24h", 0),
            "btc_7d_change": btc.get("price_change_percentage_7d_in_currency", 0),
            "btc_volume": btc.get("total_volume", 0),
            "eth_price": eth.get("current_price", 0),
            "eth_24h_change": eth.get("price_change_percentage_24h", 0),
            "eth_7d_change": eth.get("price_change_percentage_7d_in_currency", 0),
            "sol_price": sol.get("current_price", 0),
            "sol_24h_change": sol.get("price_change_percentage_24h", 0),
            "total_market_cap": global_data.get("data", {}).get("total_market_cap", {}).get("usd", 0),
            "total_volume": global_data.get("data", {}).get("total_volume", {}).get("usd", 0),
            "market_cap_change_24h": global_data.get("data", {}).get("market_cap_change_percentage_24h_usd", 0),
            "btc_dominance": global_data.get("data", {}).get("market_cap_percentage", {}).get("btc", 0),
        }
    except Exception as e:
        print(f"  Warning: Could not fetch market data: {e}")
        return {
            "btc_price": 95000, "btc_24h_change": 0, "btc_7d_change": 0, "btc_volume": 0,
            "eth_price": 3200, "eth_24h_change": 0, "eth_7d_change": 0,
            "sol_price": 180, "sol_24h_change": 0,
            "total_market_cap": 3200000000000, "total_volume": 150000000000,
            "market_cap_change_24h": 0, "btc_dominance": 52
        }


# ============================================================================
# ROBUST JSON EXTRACTION
# ============================================================================

def clean_json_string(json_str: str) -> str:
    """Clean common JSON issues from AI-generated content"""
    
    # Remove markdown code blocks if present
    json_str = re.sub(r'^```json\s*', '', json_str)
    json_str = re.sub(r'^```\s*', '', json_str)
    json_str = re.sub(r'\s*```$', '', json_str)
    
    # Fix common issues inside string values
    # This is tricky - we need to handle quotes inside JSON string values
    
    # Remove control characters except newlines and tabs
    json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', json_str)
    
    # Fix trailing commas before closing brackets (common AI mistake)
    json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    
    return json_str


def extract_json_from_response(text: str) -> dict:
    """Safely extract JSON from AI response with multiple fallback strategies"""
    
    if not text or not text.strip():
        raise ValueError("Empty response from API")
    
    # Strategy 1: Try direct parse (response might be pure JSON)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: Find JSON object in response
    json_match = re.search(r'\{[\s\S]*\}', text)
    if not json_match:
        raise ValueError("No JSON object found in response")
    
    json_str = json_match.group()
    
    # Strategy 3: Try parsing the extracted JSON
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"  JSON parse attempt 1 failed: {e}")
    
    # Strategy 4: Clean the JSON and try again
    cleaned = clean_json_string(json_str)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"  JSON parse attempt 2 failed: {e}")
    
    # Strategy 5: Try to fix unescaped quotes in string values
    # This is a more aggressive approach
    try:
        # Find all string values and escape internal quotes
        fixed = fix_unescaped_quotes(cleaned)
        return json.loads(fixed)
    except (json.JSONDecodeError, Exception) as e:
        print(f"  JSON parse attempt 3 failed: {e}")
    
    # Strategy 6: Extract just the essential fields manually
    try:
        return extract_essential_fields(text)
    except Exception as e:
        print(f"  Essential field extraction failed: {e}")
    
    raise ValueError(f"Could not parse JSON after all attempts. First 500 chars: {text[:500]}")


def fix_unescaped_quotes(json_str: str) -> str:
    """Attempt to fix unescaped quotes inside JSON string values"""
    result = []
    in_string = False
    escape_next = False
    
    for i, char in enumerate(json_str):
        if escape_next:
            result.append(char)
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            result.append(char)
            continue
        
        if char == '"':
            if not in_string:
                in_string = True
                result.append(char)
            else:
                # Check if this quote ends the string
                # Look ahead for : , } ] which would indicate end of string
                rest = json_str[i+1:i+20].lstrip()
                if rest and rest[0] in ':,}]\n':
                    in_string = False
                    result.append(char)
                else:
                    # This might be an unescaped quote inside string
                    result.append('\\"')
                    continue
        else:
            result.append(char)
    
    return ''.join(result)


def extract_essential_fields(text: str) -> dict:
    """Last resort: extract essential fields using regex"""
    
    # Try to extract headline
    headline_match = re.search(r'"headline"\s*:\s*"([^"]*(?:\\.[^"]*)*)"', text)
    headline = headline_match.group(1) if headline_match else "Market Intelligence Brief"
    
    # Try to extract image_keywords
    keywords_match = re.search(r'"image_keywords"\s*:\s*"([^"]*)"', text)
    keywords = keywords_match.group(1) if keywords_match else ""
    
    # Try to extract sections
    sections = {}
    section_pattern = r'"(the_\w+)"\s*:\s*\{[^}]*"content"\s*:\s*"([^"]*(?:\\.[^"]*)*)"'
    
    for match in re.finditer(section_pattern, text):
        section_name = match.group(1)
        content = match.group(2)
        # Unescape the content
        content = content.replace('\\n', '\n').replace('\\"', '"')
        sections[section_name] = content
    
    if not sections:
        raise ValueError("Could not extract any sections")
    
    return {
        "headline": headline.replace('\\n', ' ').replace('\\"', '"'),
        "sections": sections,
        "image_keywords": keywords
    }



# ============================================================================
# MORNING BRIEF PROMPT - Premium Editorial Quality
# ============================================================================

def get_morning_prompt(region: str, market_data: dict) -> str:
    """Generate the morning brief prompt - FT quality editorial"""
    
    region_context = {
        "apac": {
            "name": "Asia-Pacific",
            "timezone": "SGT/HKT",
            "overnight": "US close and European session",
            "readers": "institutional investors in Singapore, Hong Kong, Tokyo, Sydney",
            "local_factors": "Hong Kong regulatory developments, Japan institutional flows, Korean retail sentiment, Australian macro policy, Chinese economic signals",
            "trading_hours": "Asian trading hours with US and European markets closed",
            "overnight_window": "18:00 SGT yesterday to 06:00 SGT today",
            "landmarks": "Hong Kong skyline, Singapore Marina Bay, Tokyo Marunouchi, Sydney CBD, Victoria Harbour"
        },
        "emea": {
            "name": "Europe, Middle East & Africa", 
            "timezone": "GMT/CET",
            "overnight": "US close and Asian session",
            "readers": "institutional investors in London, Frankfurt, Zurich, Dubai",
            "local_factors": "ECB monetary policy, MiCA regulatory implementation, UK regulatory stance, European institutional positioning, Middle Eastern sovereign wealth activity",
            "trading_hours": "European trading hours with overlap into US open",
            "overnight_window": "18:00 GMT yesterday to 06:00 GMT today",
            "landmarks": "Canary Wharf, City of London, Frankfurt skyline, Dubai Marina, La Défense Paris, Swiss Alps"
        },
        "americas": {
            "name": "Americas",
            "timezone": "EST",
            "overnight": "Asian and European sessions",
            "readers": "institutional investors in New York, Chicago, San Francisco, Toronto",
            "local_factors": "Federal Reserve policy signals, SEC regulatory actions, ETF flow data, US macro indicators, institutional positioning",
            "trading_hours": "US trading hours driving global price discovery",
            "overnight_window": "18:00 EST yesterday to 06:00 EST today",
            "landmarks": "Manhattan skyline, Wall Street, One World Trade, Chicago Loop, San Francisco Bay"
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    return f"""You are the Chief Markets Editor at The Litmus, the publication that sophisticated crypto investors read instead of Bloomberg Terminal alerts. Your readers are {ctx['readers']} who need institutional-grade analysis, not retail noise.

PUBLICATION IDENTITY:
The Litmus combines the editorial authority of the Financial Times, the analytical depth of The Economist, and the psychological insight of Rory Sutherland. We don't report markets—we decode them.

Your readers cancelled their crypto news subscriptions because most "analysis" is just data with adjectives. They kept The Litmus because you give them what no algorithm can: a framework for understanding.

REGIONAL CONTEXT - {ctx['name']} ({ctx['timezone']}):
Your reader slept through the {ctx['overnight']} ({ctx['overnight_window']}). They're preparing for {ctx['trading_hours']}.
Critical regional factors to weave in: {ctx['local_factors']}.

CURRENT MARKET DATA:
• Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h, {market_data['btc_7d_change']:+.1f}% 7d)
• Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
• Solana: ${market_data['sol_price']:,.0f} ({market_data['sol_24h_change']:+.1f}% 24h)
• Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)
• 24H Volume: ${market_data['total_volume']/1e9:.0f}B
• BTC Dominance: {market_data['btc_dominance']:.1f}%

YOUR MANDATE:
Write a morning intelligence brief that sophisticated investors would forward to colleagues. This is The Litmus's shop window — the quality must convert readers.

THE STRUCTURE:

1. THE LEAD (200 words)
The Lead does three jobs in one flowing narrative:
• THE OVERNIGHT: What happened while your reader slept (18:00-06:00)? Not a list — weave the key moves into your narrative.
• THE SETUP: Where do we start today? What are the dynamics and tensions in play?
• THE HINGE: What's the one thing that matters most today? "Today hinges on..."

Regional context must be woven throughout — this is the {ctx['name']} morning brief, not a generic global summary. Reference {ctx['local_factors']} where relevant.

Write this as editorial prose, not bullet points. A reader should feel oriented to the day after reading this single section.

2. THE ANGLE (60-80 words)
Pure Rory Sutherland energy. This is where The Litmus earns its reputation.

Take the obvious overnight story and show why the consensus read is wrong or incomplete. "Everyone's talking about X. Here's what they're missing."

This is opinion. This is edge. This is why people pay.

3. THE DRIVER (3-4 editorial bullets)
What's actually moving markets right now?

CRITICAL: These are NOT PowerPoint bullets. Each bullet is 1-2 complete sentences containing:
• The fact (what happened)
• The context (why it matters)
• The insight (what it suggests)

Example of what we want:
"Spot ETF inflows hit $420m on Monday, the strongest single day since March — notable because it happened on declining volume, suggesting conviction rather than momentum."

Example of what we DON'T want:
"ETF inflows strong. BTC up. Sentiment positive."

Write like an FT journalist, not a data terminal.

4. THE SIGNAL (3 data points)
The numbers that matter today. Each signal is one sentence connecting data to meaning.

Format: "[Data point] — [What it tells us]"

Examples:
• "Fear & Greed at 74 (Greed) — elevated but not extreme, suggesting room for continuation rather than imminent reversal."
• "ETH/BTC ratio at 0.034 — compressing toward cycle lows, watch for mean reversion catalyst."
• "Funding rates +0.01% — neutral positioning, no overcrowded trades to unwind."

Choose the three most decision-relevant metrics for today.

5. THE TAKEAWAY (One sentence)
A Rory Sutherland-style quote. Thought-provoking, quotable, crystallizes the insight.

Not a summary. Not a prediction. A perspective that makes smart people pause and think.

Examples of the tone:
• "The most dangerous moment in markets isn't when everyone is fearful—it's when everyone is cautiously optimistic in exactly the same way."
• "Bitcoin's weekend price action tells you less about Bitcoin than about who's no longer in the market to sell it."

VOICE PRINCIPLES:
• Write like a senior FT editor who respects readers' intelligence
• Direct because you've done the work
• Opinionated because you've earned it
• Human, not algorithmic — no AI tells, no corporate speak
• Confident word choices, occasional wit, zero fluff

ABSOLUTELY PROHIBITED:
• Bullish/bearish, moon, pump, dump, FOMO, FUD, rekt, ape
• "Skyrockets," "plummets," "explodes," "crashes," "massive," "huge"
• Certainty about unpredictable outcomes
• Exclamation marks
• Phrases like "It's worth noting," "Interestingly," "It remains to be seen"
• Starting sentences with "This" without clear antecedent

HERO IMAGE KEYWORDS:
Generate 4-5 keywords for the hero image using EDITORIAL + MOOD approach (70/30 balance).

EDITORIAL (primary): What/where is the story happening?
- Regional landmarks for {ctx['name']}: {ctx['landmarks']}
- Scenes: financial district, trading floor, institutional office, glass towers
- Named entities if story-relevant: BlackRock, SEC building, specific companies

MOOD (secondary): How should it feel?
- Light conditions: soft morning light, bright, golden hour, clear sky, blue hour
- Atmosphere: quiet streets, calm, open, spacious, airy
- PREFER: Light, bright, optimistic imagery. Avoid dark, moody, dramatic images.

FORMAT: "Canary Wharf, soft morning light, glass towers, bright" or "Hong Kong skyline, clear sky, harbor"

✗ NEVER use: crypto, bitcoin, trading, chart, money, stock, market, coin, currency, generic, dark, dramatic, storm

CRITICAL JSON FORMATTING RULES:
• All string values must have quotes escaped as \\"
• No literal newlines inside strings - use \\n instead
• No trailing commas
• Keep headlines under 80 characters
• Avoid special characters like curly quotes

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{{
    "headline": "Main 5-8 word headline capturing your core thesis",
    "image_keywords": "3-4 visual keywords, comma separated",
    "sections": {{
        "the_lead": {{
            "title": "4-8 word headline",
            "content": "200 words — overnight + setup + hinge as flowing editorial prose"
        }},
        "the_angle": {{
            "title": "4-8 word provocative headline",
            "content": "60-80 words — the Rory Sutherland reframe"
        }},
        "the_driver": {{
            "title": "4-8 word headline",
            "content": "3-4 editorial bullets, each 1-2 sentences with fact + context + insight"
        }},
        "the_signal": {{
            "title": "4-8 word headline",
            "content": "3 data points, each one sentence: [metric] — [meaning]"
        }},
        "the_takeaway": {{
            "title": "The Bottom Line",
            "content": "One quotable Rory-style sentence"
        }}
    }}
}}

Return ONLY the JSON object, no other text."""


# ============================================================================
# EVENING BRIEF PROMPT - Regional News-Wire Editorial
# ============================================================================

def get_evening_prompt(region: str, market_data: dict) -> str:
    """Generate the evening brief prompt - scannable but editorial quality"""
    
    region_context = {
        "apac": {
            "name": "Asia-Pacific",
            "session_reviewed": "Asian trading session",
            "handoff_to": "European markets",
            "key_hours": "Hong Kong and Singapore close",
            "sub_regions": ["East Asia", "Southeast Asia", "Oceania"],
            "landmarks": "Hong Kong skyline, Singapore Marina Bay, Tokyo Tower, Sydney Opera House, Victoria Harbour",
            "sub_region_factors": {
                "East Asia": "China economic policy, Hong Kong regulatory moves, Japan institutional activity, Korean exchange developments, Taiwan semiconductor links to crypto mining",
                "Southeast Asia": "Singapore as crypto hub, Thai regulatory stance, Vietnamese retail activity, Philippine remittance corridors, Indonesian adoption trends",
                "Oceania": "Australian regulatory framework, New Zealand institutional positioning, regional mining operations, AUD correlation plays"
            }
        },
        "emea": {
            "name": "Europe, Middle East & Africa",
            "session_reviewed": "European trading session",
            "handoff_to": "US afternoon session",
            "key_hours": "London close and US mid-day",
            "sub_regions": ["Europe", "Middle East", "Africa"],
            "landmarks": "Canary Wharf, Tower Bridge, Frankfurt skyline, Dubai Marina, Big Ben, Thames",
            "sub_region_factors": {
                "Europe": "ECB policy signals, MiCA implementation updates, UK FCA stance, Swiss institutional flows, German regulatory developments, EU stablecoin rules",
                "Middle East": "UAE crypto hub status, Saudi Vision 2030 digital assets, Bahrain regulatory framework, sovereign wealth positioning, regional exchange launches",
                "Africa": "Nigerian adoption despite restrictions, South African regulatory clarity, Kenyan mobile money integration, remittance corridor growth, mining operations"
            }
        },
        "americas": {
            "name": "Americas",
            "session_reviewed": "US trading session",
            "handoff_to": "Asian open",
            "key_hours": "NYSE close approaching",
            "sub_regions": ["North America", "Central America", "South America"],
            "landmarks": "Manhattan skyline, Wall Street, Statue of Liberty, Brooklyn Bridge, Hudson River, sunset",
            "sub_region_factors": {
                "North America": "SEC enforcement actions, ETF flow dynamics, Fed policy impact, Canadian regulatory updates, institutional custody developments, mining energy debates",
                "Central America": "El Salvador Bitcoin developments, Panama regulatory progress, Guatemala remittance adoption, regional dollarization dynamics",
                "South America": "Brazil regulatory framework, Argentine peso hedge demand, Colombian exchange growth, Venezuelan adoption patterns, regional stablecoin usage"
            }
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    # Build sub-region JSON structure
    sub_region_json = ""
    for i, sub in enumerate(ctx['sub_regions']):
        sub_key = sub.lower().replace(" ", "_")
        comma = "," if i < len(ctx['sub_regions']) - 1 else ""
        sub_region_json += f"""
                "{sub_key}": {{
                    "name": "{sub}",
                    "content": "3-5 editorial bullets covering political, financial, and crypto developments"
                }}{comma}"""
    
    # Add ETF section only for Americas
    etf_section = ""
    etf_json = ""
    if region == "americas":
        etf_section = """

ETF FLOWS DATA:
Include specific ETF flow data in The Session. Research or estimate today's flows:
- Today's total net flow (positive = inflows, negative = outflows)
- Major ETFs: IBIT (BlackRock), FBTC (Fidelity), GBTC (Grayscale), ARKB (Ark)
- Week-to-date flow pattern"""
        
        etf_json = """,
        "etf_flows": {{
            "latest": {{
                "amount": 0,
                "date": "today's date"
            }},
            "week": [
                {{"day": "Mon", "amount": 0}},
                {{"day": "Tue", "amount": 0}},
                {{"day": "Wed", "amount": 0}},
                {{"day": "Thu", "amount": 0}},
                {{"day": "Fri", "amount": 0}}
            ],
            "insight": "One sentence on this week's ETF flow pattern"
        }}"""
    
    return f"""You are the Chief Markets Editor at The Litmus writing the evening brief. Your {ctx['name']} readers are ending their trading day and want a clear picture of what happened in the last 12 hours.

PUBLICATION IDENTITY - EVENING EDITION:
The evening brief is different from morning. Morning is opinionated and thought-provoking. Evening is authoritative and informative.

Think: FT news desk, not FT opinion page.
Tone: Informed, not opinionated. Crisp, not cold.

Your readers want to scan quickly but read quality prose. They're tired. Respect their time while respecting their intelligence.

MARKET DATA:
• Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
• Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
• Solana: ${market_data['sol_price']:,.0f} ({market_data['sol_24h_change']:+.1f}% 24h)
• Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)
• BTC Dominance: {market_data['btc_dominance']:.1f}%{etf_section}

SESSION CONTEXT: {ctx['session_reviewed']} review, {ctx['key_hours']}

THE STRUCTURE:

1. THE SESSION (3-5 editorial bullets)
Global crypto: What happened to BTC and ETH in the last 12 hours?

Cover:
• BTC and ETH price action and the narrative driving it
• Notable altcoin moves if significant (not routine noise)
• Market sentiment shift (Fear & Greed, liquidations, volume patterns)
• Any structural market events (large trades, exchange flows)

CRITICAL: These are NOT PowerPoint bullets. Each bullet is 1-2 complete sentences containing:
• The fact (what happened)
• The context (why it matters)  
• The insight (what it suggests)

Example of what we want:
"Bitcoin tested $98,000 resistance three times during London hours before settling at $97,400 — the kind of patient accumulation that preceded the November breakout, though this time on notably thinner volume."

Example of what we DON'T want:
"BTC tested $98K. Volume was low. Sentiment neutral."

2. THE MACRO (3-5 editorial bullets)
Global finance and politics impacting crypto.

Cover:
• Central bank actions or statements affecting risk assets
• Regulatory news (SEC, EU policy, Asian regulatory moves)
• Traditional finance crossover (ETF flows, institutional announcements)
• Geopolitical events with crypto implications
• Macro data releases that moved markets

Same editorial bullet standard: fact + context + insight in each.

3. THE REGION (3-5 bullets per sub-region)
This is where the evening brief earns its regional value.

Three sub-regions for {ctx['name']}:
{chr(10).join([f"• {sub}: {ctx['sub_region_factors'][sub]}" for sub in ctx['sub_regions']])}

For EACH sub-region, provide 3-5 editorial bullets covering:
• Political or regulatory developments affecting crypto
• Company news (exchanges, miners, projects headquartered there)
• Financial or banking news affecting crypto access/adoption
• Any regional-specific market dynamics

Variable depth: If one sub-region has major news, give it more coverage. If another is quiet, fewer bullets is fine. Follow the news, don't force balance.

Sub-region headers must be clear for easy scanning: "Europe", "Middle East", "Africa" etc.

VOICE PRINCIPLES - EVENING EDITION:
• Authoritative, states what happened (not what you think about it)
• Shorter sentences, more declarative than morning
• Confident word choices, occasional wit in phrasing
• Fundamentally reporting, not editorialising
• Human — a tired reader should feel informed, not lectured

Example of evening voice:
"Brazil's central bank held rates at 13.75%, defying expectations of a cut. Local exchanges reported a 12% spike in stablecoin volume within hours — the familiar flight-to-dollar pattern when rate relief fails to materialise."

ABSOLUTELY PROHIBITED:
• Bullish/bearish, moon, pump, dump, FOMO, FUD
• "Skyrockets," "plummets," "explodes," "crashes"
• Opinion or prediction (save that for morning)
• Exclamation marks
• "It's worth noting," "Interestingly," "It remains to be seen"

HERO IMAGE KEYWORDS:
Generate 4-5 keywords for the hero image using EDITORIAL + MOOD approach (70/30 balance).

EDITORIAL (primary): What/where is the story happening?
- Regional landmarks for {ctx['name']}: {ctx['landmarks']}
- Scenes: financial district, evening cityscape, office buildings, harbor
- Named entities if story-relevant: specific exchanges, institutions

MOOD (secondary): How should it feel?
- Light conditions: golden sunset, warm light, golden hour, soft evening glow
- Atmosphere: calm end of day, peaceful, reflective, warm tones
- PREFER: Warm, golden, inviting imagery. Avoid dark, harsh, cold images.

FORMAT: "Manhattan skyline, golden sunset, warm light" or "Singapore Marina Bay, golden hour, harbor"

✗ NEVER use: crypto, bitcoin, trading, chart, money, stock, market, coin, currency, generic, dark, cold, harsh

CRITICAL JSON FORMATTING RULES:
• All string values must have quotes escaped as \\"
• No literal newlines inside strings - use \\n instead  
• No trailing commas
• Avoid special characters
• the_region MUST contain sub-region objects with "name" and "content" fields

OUTPUT FORMAT:
Return ONLY valid JSON:
{{
    "headline": "5-8 word headline capturing today's session story",
    "image_keywords": "3-4 visual keywords, comma separated",
    "sections": {{
        "the_session": {{
            "title": "4-8 word headline",
            "content": "3-5 editorial bullets starting with • on global crypto action"
        }},
        "the_macro": {{
            "title": "4-8 word headline",
            "content": "3-5 editorial bullets starting with • on global finance/politics"
        }},
        "the_region": {{
            "title": "What Moved in {ctx['name']}",{sub_region_json}
        }}
    }}{etf_json}
}}

IMPORTANT: Each sub-region in the_region MUST have this structure:
"sub_region_key": {{
    "name": "Sub-Region Name",
    "content": "• Bullet one with fact, context, insight.\\n\\n• Bullet two..."
}}

Return ONLY the JSON object, no other text."""


def get_publication_timestamp(region: str, brief_type: str) -> str:
    """Generate intended publication timestamp with regional timezone"""
    tz_offsets = {
        "apac": ("+08:00", 8),
        "emea": ("+00:00", 0),
        "americas": ("-05:00", -5)
    }
    
    pub_hours = {"morning": 6, "evening": 18}
    
    tz_str, tz_hours = tz_offsets.get(region, ("+00:00", 0))
    pub_hour = pub_hours.get(brief_type, 6)
    
    now_utc = datetime.now(timezone.utc)
    target_local = now_utc.replace(
        hour=(pub_hour - tz_hours) % 24,
        minute=0, second=0, microsecond=0
    )
    
    return target_local.strftime(f"%Y-%m-%dT{pub_hour:02d}:00:00{tz_str}")


def call_anthropic_api(prompt: str, attempt: int = 1) -> dict:
    """Call Claude Opus 4.5 API with retry logic"""
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set")
    
    # Add stronger JSON instruction on retries
    if attempt > 1:
        prompt += "\n\nIMPORTANT: Previous attempt failed JSON parsing. Please ensure valid JSON with properly escaped quotes."
    
    request_body = json.dumps({
        "model": MODEL,
        "max_tokens": 4096,
        "temperature": TEMPERATURE,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()
    
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
        }
    )
    
    with urllib.request.urlopen(req, timeout=120) as resp:
        response = json.loads(resp.read().decode())
    
    content = response.get("content", [{}])[0].get("text", "")
    
    # Use robust JSON extraction
    return extract_json_from_response(content)


# ============================================
# WEEK AHEAD - Weekly Strategic Outlook
# ============================================

def get_week_ahead_prompt(market_data: dict) -> str:
    """Generate prompt for Week Ahead brief - published once per week"""
    
    # Calculate the week dates
    today = datetime.now(timezone.utc)
    # Find next Monday (or today if it's Monday)
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0 and today.hour < 12:
        week_start = today
    else:
        week_start = today + timedelta(days=days_until_monday)
    week_end = week_start + timedelta(days=6)
    
    week_range = f"{week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}"
    
    return f"""You are the senior strategist at The Litmus, a premium crypto intelligence publication. 
Write the WEEK AHEAD outlook covering {week_range}.

This is NOT a daily brief. This is a strategic weekly preview that helps sophisticated investors 
prepare for the week's key events, levels, and opportunities.

CURRENT MARKET CONTEXT:
• BTC: ${market_data.get('btc_price', 0):,.0f} ({market_data.get('btc_24h_change', 0):+.1f}% 24h, {market_data.get('btc_7d_change', 0):+.1f}% 7d)
• ETH: ${market_data.get('eth_price', 0):,.0f} ({market_data.get('eth_24h_change', 0):+.1f}% 24h, {market_data.get('eth_7d_change', 0):+.1f}% 7d)
• Total Market Cap: ${market_data.get('total_market_cap', 0)/1e12:.2f}T
• BTC Dominance: {market_data.get('btc_dominance', 0):.1f}%

WEEK AHEAD STRUCTURE (4 sections):

1. THE FULCRUM (200-250 words)
The single most important event/catalyst of the coming week. This is the hinge point that everything else revolves around.
- What is it? (Fed meeting, jobs report, ETF deadline, options expiry, etc.)
- When exactly? (day and time if applicable)
- What are the scenarios? (if X happens → Y, if A happens → B)
- Why does it matter for crypto specifically?

2. THE LEVELS (150-200 words)  
The key price levels to watch this week. Be specific and explain WHY these levels matter.
- BTC: Support and resistance with reasoning (not just "50-day MA" but why it matters NOW)
- ETH: Key levels and the ETH/BTC ratio context
- What would a break of each level signal?

3. THE UNPRICED (150-200 words)
What the market is missing. The contrarian or underappreciated angle that sophisticated investors should consider.
- What data or signal is being ignored?
- What's the historical analog or pattern?
- What's your differentiated take?

4. THE UNDERESTIMATED (150-200 words)
The risk or opportunity the market is underestimating.
- What could surprise to the upside or downside?
- What's the tail risk or asymmetric opportunity?
- What should investors prepare for that few are discussing?

VOICE & STYLE:
• Write like a senior strategist briefing institutional clients
• Confident but not arrogant - show your reasoning
• Specific numbers, dates, and levels - no vague handwaving
• The reader has money on the line - respect that
• FT editorial quality - sophisticated, measured, insightful

ABSOLUTELY PROHIBITED:
• "Crypto twitter" language - no moon, WAGMI, bearish/bullish
• Vague statements like "things could go either way"
• Exclamation marks
• "It's worth noting" or "Interestingly"
• Hedging every statement into meaninglessness

HEADLINE:
Write a 5-8 word headline that captures the week's dominant theme.

OUTPUT FORMAT:
Return ONLY valid JSON:
{{
    "headline": "5-8 word headline for the week",
    "sections": {{
        "fulcrum": {{
            "title": "4-8 word title for the key event",
            "content": "200-250 words on the week's fulcrum event"
        }},
        "levels": {{
            "title": "4-8 word title about key levels",
            "content": "150-200 words on price levels to watch"
        }},
        "unpriced": {{
            "title": "4-8 word title on the contrarian angle",
            "content": "150-200 words on what the market is missing"
        }},
        "underestimated": {{
            "title": "4-8 word title on the underappreciated risk/opportunity",
            "content": "150-200 words on what's being underestimated"
        }}
    }}
}}

Return ONLY the JSON object, no other text."""


def generate_week_ahead() -> dict:
    """Generate the Week Ahead brief"""
    print("  Fetching market data...")
    market_data = fetch_market_data()
    
    prompt = get_week_ahead_prompt(market_data)
    
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"  Generating Week Ahead using {MODEL}... (attempt {attempt})")
            brief_data = call_anthropic_api(prompt, attempt)
            
            # Transform nested structure to flat
            transformed = transform_week_ahead_structure(brief_data)
            
            # Add metadata
            transformed["region"] = "global"
            transformed["type"] = "week-ahead"
            transformed["generated_at"] = datetime.now(timezone.utc).isoformat()
            transformed["btc_price"] = market_data.get("btc_price", 0)
            transformed["eth_price"] = market_data.get("eth_price", 0)
            transformed["total_market_cap"] = market_data.get("total_market_cap", 0)
            transformed["btc_24h_change"] = market_data.get("btc_24h_change", 0)
            
            return transformed
            
        except Exception as e:
            last_error = e
            print(f"  Attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2)
    
    raise last_error


def transform_week_ahead_structure(brief_data: dict) -> dict:
    """Transform nested Week Ahead structure to flat format"""
    flat_sections = {}
    
    for key, value in brief_data.get("sections", {}).items():
        if isinstance(value, dict):
            flat_sections[key] = {
                "title": value.get("title", ""),
                "content": value.get("content", "")
            }
        else:
            flat_sections[key] = value
    
    return {
        "headline": brief_data.get("headline", ""),
        "sections": flat_sections
    }


def transform_to_flat_structure(brief_data: dict) -> dict:
    """Transform nested section structure to flat for backward compatibility"""
    flat_sections = {}
    etf_flows = None
    
    for key, value in brief_data.get("sections", {}).items():
        # Preserve ETF flows as-is (not flattened)
        if key == "etf_flows":
            etf_flows = value
            continue
        
        # Preserve the_region structure with sub-regions (don't flatten)
        if key == "the_region":
            if isinstance(value, dict):
                # Keep the full structure including sub-regions
                flat_sections[key] = value
                flat_sections[f"{key}_title"] = value.get("title", "What Moved Locally")
            else:
                flat_sections[key] = value
            continue
            
        if isinstance(value, dict):
            flat_sections[key] = value.get("content", "")
            flat_sections[f"{key}_title"] = value.get("title", "")
        else:
            flat_sections[key] = value
    
    result = {
        "headline": brief_data.get("headline", ""),
        "sections": flat_sections,
        "image_keywords": brief_data.get("image_keywords", "")
    }
    
    # Add ETF flows at root level if present
    if etf_flows:
        result["etf_flows"] = etf_flows
    
    return result


def generate_brief(region: str, brief_type: str) -> dict:
    """Generate a complete brief with retry logic"""
    print(f"  Fetching market data...")
    market_data = fetch_market_data()
    
    if brief_type == "evening":
        prompt = get_evening_prompt(region, market_data)
    else:
        prompt = get_morning_prompt(region, market_data)
    
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"  Generating {brief_type} brief for {region.upper()} using {MODEL}... (attempt {attempt})")
            brief_data = call_anthropic_api(prompt, attempt)
            
            # Transform structure
            transformed = transform_to_flat_structure(brief_data)
            
            # Build hero image URL from keywords (using Unsplash API with regional context)
            keywords = transformed.get("image_keywords", "")
            fallback = "morning" if brief_type == "morning" else "evening"
            transformed["image_url"] = build_image_url(keywords, fallback, region, brief_type)
            print(f"  Image keywords: {keywords}")
            
            # Add metadata
            transformed["region"] = region
            transformed["type"] = brief_type
            transformed["generated_at"] = get_publication_timestamp(region, brief_type)
            transformed["btc_price"] = market_data["btc_price"]
            transformed["eth_price"] = market_data["eth_price"]
            transformed["total_market_cap"] = market_data["total_market_cap"]
            transformed["btc_24h_change"] = market_data["btc_24h_change"]
            
            return transformed
            
        except Exception as e:
            last_error = e
            print(f"  Attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                print(f"  Retrying in 5 seconds...")
                time.sleep(5)
    
    # All retries failed
    raise last_error


def save_brief(brief: dict, region: str, brief_type: str):
    """Save brief to content directory"""
    if brief_type == "week-ahead":
        # Week Ahead is global - save to content root
        output_file = CONTENT_DIR / "week-ahead.json"
    else:
        region_dir = CONTENT_DIR / region
        region_dir.mkdir(parents=True, exist_ok=True)
        output_file = region_dir / f"{brief_type}.json"
    
    with open(output_file, "w") as f:
        json.dump(brief, f, indent=2)
    
    print(f"  Saved to {output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_brief.py <region> <type>")
        print("  region: apac, emea, americas, global")
        print("  type: morning, evening, week-ahead")
        print("")
        print("For week-ahead: python generate_brief.py global week-ahead")
        sys.exit(1)
    
    region = sys.argv[1].lower()
    brief_type = sys.argv[2].lower() if len(sys.argv) > 2 else "morning"
    
    # Handle week-ahead special case
    if brief_type == "week-ahead":
        region = "global"  # Week ahead is always global
    elif region not in ["apac", "emea", "americas"]:
        print(f"Invalid region: {region}")
        sys.exit(1)
    
    if brief_type not in ["morning", "evening", "week-ahead"]:
        print(f"Invalid brief type: {brief_type}")
        sys.exit(1)
    
    print(f"\n[{datetime.now(timezone.utc).isoformat()}] Generating {region.upper()} {brief_type} brief")
    
    try:
        if brief_type == "week-ahead":
            brief = generate_week_ahead()
        else:
            brief = generate_brief(region, brief_type)
        save_brief(brief, region, brief_type)
        print(f"  ✓ Complete: {brief['headline']}")
        return 0
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
