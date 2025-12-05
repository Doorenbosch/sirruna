#!/usr/bin/env python3
"""
Weekend Magazine Generator - The Litmus
Generates comprehensive weekly crypto analysis
Runs: Saturday 07:00 SGT/GMT+8

Sections:
1. The Week in Review - Market thesis
2. APAC Region - Asia-Pacific developments  
3. EMEA Region - Europe & Middle East developments
4. Americas Region - US & Latin America developments
5. Capital Flows - Institutional movements
6. Corporate Moves - Company news
7. Week Ahead - Key dates and catalysts
8. The Mechanism - Educational deep-dive
"""

import os
import json
import re
from datetime import datetime, timedelta
import requests

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
COINGECKO_API = "https://api.coingecko.com/api/v3"

# ============================================
# CURATED HERO IMAGE LIBRARY
# High-quality Unsplash photos mapped to themes
# ============================================

HERO_IMAGES = {
    # Market conditions
    "rally": "photo-1451187580459-43490279c0fa",       # Blue globe network
    "consolidation": "photo-1507003211169-0a1dd7228f2d", # Calm lake reflection
    "volatility": "photo-1534088568595-a066f410bcda",   # Storm clouds
    "uncertainty": "photo-1489549132488-d00b7eee80f1",  # Fog over water
    "breakout": "photo-1504384308090-c894fdcc538d",     # Light through clouds
    "correction": "photo-1516912481808-3406841bd33c",   # Mountain descent path
    
    # Macro themes
    "fed_macro": "photo-1526304640581-d334cdbbf45e",    # Abstract financial lines
    "institutional": "photo-1486406146926-c627a92ad1ab", # Modern glass building
    "regulation": "photo-1589829545856-d10d557cf95f",   # Scales of justice
    "adoption": "photo-1551288049-bebda4e38f71",        # Network connections
    
    # Regional
    "asia": "photo-1536599018102-9f803c979b5e",         # Hong Kong skyline night
    "europe": "photo-1467269204594-9661b134dd2b",       # European architecture
    "americas": "photo-1534430480872-3498386e7856",     # NYC skyline
    "global": "photo-1446776811953-b23d57bd21aa",       # Earth from space
    
    # Flow/movement themes
    "flows": "photo-1509023464722-18d996393ca8",        # Light trails movement
    "accumulation": "photo-1502101872923-d48509bff386", # Sunrise over mountains
    "distribution": "photo-1517483000871-1dbf64a6e1c6", # Sunset water reflection
    
    # Abstract/editorial
    "analysis": "photo-1551288049-bebda4e38f71",        # Data visualization
    "conviction": "photo-1507090960745-b32f65d3113a",   # Mountain peak clear sky
    "caution": "photo-1489549132488-d00b7eee80f1",      # Misty morning
    "opportunity": "photo-1470071459604-3b5ec3a7fe05",  # Forest path light
    
    # Default fallback
    "default": "photo-1639762681485-074b7f938ba0"       # Abstract crypto-friendly
}

def get_hero_image_url(theme: str) -> str:
    """Get Unsplash URL for the selected theme"""
    photo_id = HERO_IMAGES.get(theme, HERO_IMAGES["default"])
    return f"https://images.unsplash.com/{photo_id}?w=1400&h=500&fit=crop&q=80"


# ============================================
# THE MECHANISM - 26 Week Editorial Calendar
# ============================================

MECHANISM_CALENDAR = {
    "2024-12-07": {
        "topic": "How Fed Rate Decisions Actually Flow Into Crypto",
        "timing": "FOMC meeting December 9-10, CPI data December 11"
    },
    "2024-12-14": {
        "topic": "The Mechanics of Bitcoin ETF Creation and Redemption",
        "timing": "Year-end ETF flow analysis, institutional rebalancing"
    },
    "2024-12-21": {
        "topic": "What Funding Rates Actually Signal",
        "timing": "Holiday volatility period, thin liquidity"
    },
    "2024-12-28": {
        "topic": "Year-End Tax Loss Harvesting Dynamics",
        "timing": "December 31 tax deadline for US investors"
    },
    "2025-01-04": {
        "topic": "How January Effect Works in Crypto",
        "timing": "New year positioning, fresh institutional allocations"
    },
    "2025-01-11": {
        "topic": "The Mechanics Behind Token Unlocks",
        "timing": "Major unlock schedule for Q1"
    },
    "2025-01-18": {
        "topic": "How Stablecoin Reserves Actually Work",
        "timing": "Tether Q4 attestation, regulatory focus"
    },
    "2025-01-25": {
        "topic": "Miner Economics and Selling Pressure Cycles",
        "timing": "Difficulty adjustment period, hash rate analysis"
    },
    "2025-02-01": {
        "topic": "How Liquidation Cascades Happen",
        "timing": "Post-FOMC volatility, leverage buildup"
    },
    "2025-02-08": {
        "topic": "The Basis Trade: Who's Doing It and Why",
        "timing": "Quarterly futures expiry cycle"
    },
    "2025-02-15": {
        "topic": "How On-Chain Whale Tracking Actually Works",
        "timing": "Market structure education, whale activity"
    },
    "2025-02-22": {
        "topic": "Options Expiry Dynamics and Max Pain",
        "timing": "Monthly options expiry"
    },
    "2025-03-01": {
        "topic": "How Exchange Reserves Signal Market Moves",
        "timing": "Exchange flow analysis, withdrawal trends"
    },
    "2025-03-08": {
        "topic": "DeFi Yield: Where Does the Money Actually Come From?",
        "timing": "DeFi season dynamics, TVL movements"
    },
    "2025-03-15": {
        "topic": "The Mechanics of a Protocol Upgrade",
        "timing": "Network upgrade education"
    },
    "2025-03-22": {
        "topic": "How Regulatory News Moves Markets",
        "timing": "Q1 regulatory calendar, SEC activity"
    },
    "2025-03-29": {
        "topic": "Quarter-End Rebalancing Effects",
        "timing": "Q1 close, institutional portfolio adjustments"
    },
    "2025-04-05": {
        "topic": "Halving Aftermath: What Actually Changed",
        "timing": "Post-halving analysis"
    },
    "2025-04-12": {
        "topic": "How MiCA Affects Different Crypto Businesses",
        "timing": "MiCA implementation phase"
    },
    "2025-04-19": {
        "topic": "The Mechanics of a Bank Run (Crypto Edition)",
        "timing": "Historical education, risk awareness"
    },
    "2025-04-26": {
        "topic": "How Airdrop Farming Distorts Metrics",
        "timing": "Airdrop season, protocol launches"
    },
    "2025-05-03": {
        "topic": "Grayscale Premium/Discount Dynamics",
        "timing": "Trust mechanics, ETF comparison"
    },
    "2025-05-10": {
        "topic": "How Correlation Regimes Shift",
        "timing": "Macro correlation analysis, risk-on/off"
    },
    "2025-05-17": {
        "topic": "The Mechanics of a Short Squeeze",
        "timing": "Volatility education, leverage analysis"
    },
    "2025-05-24": {
        "topic": "How Market Makers Actually Work",
        "timing": "Market structure, liquidity provision"
    },
    "2025-05-31": {
        "topic": "Summer Liquidity Dynamics",
        "timing": "Pre-summer positioning, volume patterns"
    }
}


def get_mechanism_topic():
    """Get the mechanism topic for this Saturday"""
    today = datetime.now()
    # Find this Saturday
    days_until_saturday = (5 - today.weekday()) % 7
    if days_until_saturday == 0 and today.hour >= 12:
        days_until_saturday = 7
    this_saturday = today + timedelta(days=days_until_saturday)
    date_str = this_saturday.strftime("%Y-%m-%d")
    
    if date_str in MECHANISM_CALENDAR:
        return MECHANISM_CALENDAR[date_str]
    
    # Fallback
    return {
        "topic": "How Market Sentiment Indicators Actually Work",
        "timing": "Evergreen market education"
    }


def fetch_weekly_market_data():
    """Fetch 7-day market data from CoinGecko"""
    data = {
        "top_coins": [],
        "total_market_cap": 0,
        "btc_dominance": 0,
        "eth_dominance": 0,
        "market_cap_change_24h": 0,
        "segments": {}
    }
    
    try:
        # Global data
        global_resp = requests.get(f"{COINGECKO_API}/global", timeout=10)
        if global_resp.ok:
            global_data = global_resp.json().get("data", {})
            data["total_market_cap"] = global_data.get("total_market_cap", {}).get("usd", 0)
            data["btc_dominance"] = global_data.get("market_cap_percentage", {}).get("btc", 0)
            data["eth_dominance"] = global_data.get("market_cap_percentage", {}).get("eth", 0)
            data["market_cap_change_24h"] = global_data.get("market_cap_change_percentage_24h_usd", 0)
        
        # Top coins with 7d and 30d data
        coins_resp = requests.get(
            f"{COINGECKO_API}/coins/markets",
            params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": 20,
                "sparkline": False,
                "price_change_percentage": "24h,7d,30d"
            },
            timeout=10
        )
        if coins_resp.ok:
            for coin in coins_resp.json():
                data["top_coins"].append({
                    "id": coin.get("id"),
                    "symbol": coin.get("symbol", "").upper(),
                    "name": coin.get("name"),
                    "price": coin.get("current_price", 0),
                    "market_cap": coin.get("market_cap", 0),
                    "change_24h": coin.get("price_change_percentage_24h", 0),
                    "change_7d": coin.get("price_change_percentage_7d_in_currency", 0),
                    "change_30d": coin.get("price_change_percentage_30d_in_currency", 0)
                })
        
        # Segment performance (simplified categories)
        segments = {
            "layer1": ["ethereum", "solana", "cardano", "avalanche-2"],
            "defi": ["uniswap", "aave", "chainlink", "maker"],
            "infrastructure": ["polygon", "arbitrum", "optimism"],
            "ai": ["render-token", "fetch-ai", "akash-network"]
        }
        
        for segment, coin_ids in segments.items():
            segment_coins = [c for c in data["top_coins"] if c["id"] in coin_ids]
            if segment_coins:
                avg_change = sum(c.get("change_7d", 0) for c in segment_coins) / len(segment_coins)
                data["segments"][segment] = {
                    "change": round(avg_change, 1),
                    "coins": len(segment_coins)
                }
    
    except Exception as e:
        print(f"Warning: Error fetching market data: {e}")
    
    return data


def get_key_dates_for_week():
    """Generate key dates for the coming week"""
    # This could be enhanced to pull from a calendar API or database
    # For now, return static example - in production, you'd populate this dynamically
    return [
        {"day": "Mon", "event": "Market Open"},
        {"day": "Wed", "event": "Fed Minutes"},
        {"day": "Fri", "event": "Options Expiry"}
    ]


def get_magazine_prompt(market_data, mechanism):
    """Generate the prompt for Claude to write the magazine"""
    
    # Build market context
    btc = next((c for c in market_data.get("top_coins", []) if c["id"] == "bitcoin"), {})
    eth = next((c for c in market_data.get("top_coins", []) if c["id"] == "ethereum"), {})
    sol = next((c for c in market_data.get("top_coins", []) if c["id"] == "solana"), {})
    
    market_context = f"""
CURRENT MARKET DATA:
- Bitcoin: ${btc.get('price', 0):,.0f} (7d: {btc.get('change_7d', 0):+.1f}%, 30d: {btc.get('change_30d', 0):+.1f}%)
- Ethereum: ${eth.get('price', 0):,.0f} (7d: {eth.get('change_7d', 0):+.1f}%)
- Solana: ${sol.get('price', 0):,.0f} (7d: {sol.get('change_7d', 0):+.1f}%)
- Total Market Cap: ${market_data.get('total_market_cap', 0)/1e12:.2f}T
- BTC Dominance: {market_data.get('btc_dominance', 0):.1f}%

SEGMENT PERFORMANCE (7-day):
"""
    
    for segment, seg_data in market_data.get("segments", {}).items():
        market_context += f"- {segment.upper()}: {seg_data['change']:+.1f}%\n"

    # Available themes for image selection
    theme_list = ", ".join(HERO_IMAGES.keys())

    return f"""You are the editorial team at The Litmus, a premium crypto intelligence publication combining Financial Times editorial quality with behavioral economics insight.

Today is Saturday. You are writing the Weekend Magazine - our flagship weekly analysis that provides depth and perspective that daily coverage cannot. This is the piece sophisticated investors save for their weekend reading.

{market_context}

Write a comprehensive Weekend Magazine with these sections. Each section should be substantive, insightful, and written for intelligent readers who want understanding, not hype.

SECTIONS TO WRITE:

1. THE WEEK IN REVIEW (300-400 words)
Start with your thesis about what this week revealed about the market's character. Not just what happened, but what it means. Connect flows, sentiment, and price action into a coherent narrative.

2. ASIA-PACIFIC (250-300 words)
What happened in APAC that matters? Hong Kong, Singapore, Japan, Korea, Australia. Regulatory developments, institutional moves, retail sentiment. Write this so an APAC reader feels you understand their market.

3. EMEA (250-300 words)  
European and Middle Eastern developments. MiCA implementation, UK regulatory stance, Dubai positioning, European institutional adoption. The sophisticated European perspective.

4. AMERICAS (250-300 words)
US developments: ETF flows, SEC activity, institutional moves, political developments. Also cover Latin American adoption stories. The dominant market narrative.

5. CAPITAL FLOWS (250-300 words)
Where is money moving? ETF flows, exchange reserves, stablecoin movements, whale activity. Be specific with numbers where possible. This is the plumbing that sophisticated investors track.

6. CORPORATE MOVES (200-250 words)
What are the key corporate players doing? MicroStrategy, miners, exchanges, publicly traded crypto companies. Actions speak louder than prices.

7. WEEK AHEAD (200-250 words)
What should readers watch in the coming week? Key dates, potential catalysts, levels that matter. Be specific and actionable.

8. THE MECHANISM (400-500 words)

This week's topic: {mechanism['topic']}
Timing context: {mechanism['timing']}

Write an educational piece explaining HOW this mechanism works in crypto markets. This is not a primer for beginners—assume readers understand basic crypto concepts. Instead, explain the sophisticated plumbing that even informed investors often misunderstand.

Structure your explanation:
- Open with why this matters RIGHT NOW (connect to the timing context)
- Explain the mechanism in clear, precise language with specific details
- Include 2-3 insider details that demonstrate genuine market knowledge
- Reference how institutional players think about this
- End with a "What to Watch" subsection - 3-4 concrete, observable things readers can monitor

Tone: Authoritative but accessible. Think FT Alphaville explaining bond market plumbing. No hype, no predictions—just clear explanation of how things work.

---

EDITORIAL STANDARDS:
- Write with conviction but intellectual humility
- No hedge-fund jargon, no moon-talk, no "to the moon"
- Each paragraph earns its place or gets cut
- Specific numbers and examples over vague generalizations
- The FT reader should feel at home

HERO IMAGE THEME:
Select ONE theme from this list that best captures the week's dominant narrative:
{theme_list}

Choose based on the market's mood and your headline. For example:
- Market testing highs with conviction → "conviction" or "rally"
- Fed decision looming, uncertainty → "fed_macro" or "uncertainty"  
- Strong institutional flows → "institutional" or "flows"
- Asia leading the narrative → "asia"
- Volatility and liquidations → "volatility"
- Consolidation, waiting → "consolidation" or "caution"

Return as JSON with this structure:
{{
    "hero": {{
        "headline": "Main magazine headline (compelling, FT-style)",
        "subtitle": "Supporting context (one sentence)",
        "theme": "ONE theme from the list above",
        "author": "The Litmus Editorial"
    }},
    "week_in_review": {{
        "title": "The Week in Review",
        "content": "Full content here..."
    }},
    "apac": {{
        "title": "Asia-Pacific",
        "content": "Full content here..."
    }},
    "emea": {{
        "title": "Europe & Middle East",
        "content": "Full content here..."
    }},
    "americas": {{
        "title": "Americas",
        "content": "Full content here..."
    }},
    "capital_flows": {{
        "title": "Capital Flows",
        "content": "Full content here..."
    }},
    "corporate": {{
        "title": "Corporate Moves",
        "content": "Full content here..."
    }},
    "week_ahead": {{
        "title": "The Week Ahead",
        "content": "Full content here..."
    }},
    "mechanism": {{
        "title": "The Mechanism",
        "topic": "{mechanism['topic']}",
        "timing": "{mechanism['timing']}",
        "content": "Full educational content here..."
    }}
}}
"""


def call_anthropic_api(prompt):
    """Call Anthropic API to generate magazine content"""
    
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 8000,
        "temperature": 0.55,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    
    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload,
            timeout=120
        )
        
        if response.ok:
            content = response.json()["content"][0]["text"]
            
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
            else:
                print("Warning: Could not extract JSON from response")
                return {"error": "Could not parse response"}
        else:
            print(f"API Error: {response.status_code} - {response.text}")
            return {"error": f"API error: {response.status_code}"}
            
    except Exception as e:
        print(f"Error calling Anthropic API: {e}")
        return {"error": str(e)}


def generate_weekend_magazine():
    """Generate the complete weekend magazine"""
    print("=" * 60)
    print("THE LITMUS - WEEKEND MAGAZINE GENERATOR")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Get mechanism topic for this week
    mechanism = get_mechanism_topic()
    print(f"\n📐 This week's Mechanism: {mechanism['topic']}")
    print(f"   Timing: {mechanism['timing']}")
    
    # Fetch market data
    print("\n📊 Fetching market data...")
    market_data = fetch_weekly_market_data()
    
    # Generate magazine content
    print("\n📝 Generating magazine content...")
    prompt = get_magazine_prompt(market_data, mechanism)
    magazine_content = call_anthropic_api(prompt)
    
    if "error" in magazine_content:
        print(f"❌ Generation failed: {magazine_content['error']}")
        return None
    
    # Process hero image
    hero_theme = magazine_content.get("hero", {}).get("theme", "default")
    hero_image_url = get_hero_image_url(hero_theme)
    magazine_content["hero"]["image_url"] = hero_image_url
    print(f"\n🖼️  Hero image theme: {hero_theme}")
    
    # Add key dates
    print("\n📅 Adding key dates...")
    magazine_content["key_dates"] = get_key_dates_for_week()
    
    # Add segment data
    magazine_content["segments"] = market_data.get("segments", {})
    
    # Add metadata
    magazine_content["generated_at"] = datetime.now().isoformat()
    magazine_content["market_data"] = {
        "btc_price": next((c["price"] for c in market_data.get("top_coins", []) if c["id"] == "bitcoin"), 0),
        "eth_price": next((c["price"] for c in market_data.get("top_coins", []) if c["id"] == "ethereum"), 0),
        "total_market_cap": market_data.get("total_market_cap", 0),
        "btc_dominance": market_data.get("btc_dominance", 0)
    }
    
    # Save to file
    output_dir = "content/weekend"
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "magazine.json")
    with open(output_path, "w") as f:
        json.dump(magazine_content, f, indent=2)
    
    print(f"\n✅ Magazine saved to {output_path}")
    print(f"   Hero: {magazine_content.get('hero', {}).get('headline', 'N/A')}")
    print(f"   Theme: {hero_theme}")
    print(f"   Mechanism: {magazine_content.get('mechanism', {}).get('topic', 'N/A')}")
    
    return magazine_content


if __name__ == "__main__":
    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        exit(1)
    
    generate_weekend_magazine()
