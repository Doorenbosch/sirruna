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
import time

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
        "image_keywords": "market analysis trading"
    }


# ============================================================================
# MORNING BRIEF PROMPT - Premium Editorial Quality
# ============================================================================

def get_morning_prompt(region: str, market_data: dict) -> str:
    """Generate the morning brief prompt - FT quality, 1000+ words"""
    
    region_context = {
        "apac": {
            "name": "Asia-Pacific",
            "timezone": "SGT/HKT",
            "overnight": "US session",
            "readers": "institutional investors in Singapore, Hong Kong, Tokyo, Sydney",
            "local_factors": "Hong Kong regulatory developments, Japan institutional flows, Korean retail sentiment, Australian macro policy, Chinese economic signals",
            "trading_hours": "Asian trading hours with US and European markets closed"
        },
        "emea": {
            "name": "Europe, Middle East & Africa", 
            "timezone": "GMT/CET",
            "overnight": "US close and Asian session",
            "readers": "institutional investors in London, Frankfurt, Zurich, Dubai",
            "local_factors": "ECB monetary policy, MiCA regulatory implementation, UK regulatory stance, European institutional positioning, Middle Eastern sovereign wealth activity",
            "trading_hours": "European trading hours with overlap into US open"
        },
        "americas": {
            "name": "Americas",
            "timezone": "EST",
            "overnight": "Asian and European sessions",
            "readers": "institutional investors in New York, Chicago, San Francisco, Toronto",
            "local_factors": "Federal Reserve policy signals, SEC regulatory actions, ETF flow data, US macro indicators, institutional positioning",
            "trading_hours": "US trading hours driving global price discovery"
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    return f"""You are the Chief Markets Editor at The Litmus, the publication that sophisticated crypto investors read instead of Bloomberg Terminal alerts. Your readers are {ctx['readers']} who need institutional-grade analysis, not retail noise.

PUBLICATION IDENTITY:
The Litmus combines the editorial authority of the Financial Times, the analytical depth of The Economist, the psychological insight of Rory Sutherland, and the purpose-driven clarity of Simon Sinek. We don't report markets—we decode them.

Your readers cancelled their crypto news subscriptions because most "analysis" is just data with adjectives. They kept The Litmus because you give them what no algorithm can: a framework for understanding.

REGIONAL CONTEXT - {ctx['name']} ({ctx['timezone']}):
Your reader slept through the {ctx['overnight']}. They're preparing for {ctx['trading_hours']}.
Critical regional factors: {ctx['local_factors']}.

CURRENT MARKET DATA:
• Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h, {market_data['btc_7d_change']:+.1f}% 7d)
• Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
• Solana: ${market_data['sol_price']:,.0f} ({market_data['sol_24h_change']:+.1f}% 24h)
• Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)
• 24H Volume: ${market_data['total_volume']/1e9:.0f}B
• BTC Dominance: {market_data['btc_dominance']:.1f}%

YOUR MANDATE:
Write a 1000-1200 word morning intelligence brief. This is not market commentary—it's a thesis about what the market is revealing. Every section must pass this test: "Would a sophisticated investor forward this to a colleague with 'interesting take'?"

THE STRUCTURE (each section needs its own compelling headline):

1. THE LEAD (100-130 words)
Your opening thesis. Not what happened, but what it means. This is your argument about the underlying game.

2. THE MECHANISM (160-200 words)
How is this happening? What's the structural, flow-based, or behavioral explanation? Connect the dots: ETF flows → market maker positioning → price impact.

3. THE COMPLICATION (140-170 words)
What doesn't fit? Every good thesis has a counterpoint. This is where you demonstrate intellectual honesty.

4. THE BEHAVIORAL ANGLE (140-170 words)
The Litmus's distinctive edge. What psychological or structural dynamic explains market behavior? Channel Rory Sutherland: look for the hidden logic.

5. LOOKING AHEAD (140-170 words)
Not predictions—decision frameworks. Give readers "if X, then probably Y" structures.

6. THE TAKEAWAY (30-50 words)
One or two sentences that crystallize the insight. Something quotable.

VOICE PRINCIPLES:
Write like a senior FT editor who respects readers' intelligence. Direct because you've done the work. Opinionated because you've earned it.

ABSOLUTELY PROHIBITED:
• Bullish/bearish, moon, pump, dump, FOMO, FUD, rekt, ape
• "Skyrockets," "plummets," "explodes," "crashes," "massive," "huge"
• Certainty about unpredictable outcomes
• Exclamation marks

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
    "sections": {{
        "the_lead": {{
            "title": "4-8 word headline",
            "content": "100-130 words of content"
        }},
        "the_mechanism": {{
            "title": "4-8 word headline",
            "content": "160-200 words of content"
        }},
        "the_complication": {{
            "title": "4-8 word headline", 
            "content": "140-170 words of content"
        }},
        "the_behavioral_angle": {{
            "title": "4-8 word headline",
            "content": "140-170 words of content"
        }},
        "looking_ahead": {{
            "title": "4-8 word headline",
            "content": "140-170 words of content"
        }},
        "the_takeaway": {{
            "title": "The Bottom Line",
            "content": "30-50 words"
        }}
    }},
    "image_keywords": "3-5 evocative keywords for editorial image"
}}

Return ONLY the JSON object, no other text."""


# ============================================================================
# EVENING BRIEF PROMPT - Retrospective Analysis
# ============================================================================

def get_evening_prompt(region: str, market_data: dict) -> str:
    """Generate the evening brief prompt - session review and overnight setup"""
    
    region_context = {
        "apac": {
            "name": "Asia-Pacific",
            "session_reviewed": "Asian trading session",
            "handoff_to": "European markets",
            "key_hours": "Hong Kong and Singapore close"
        },
        "emea": {
            "name": "Europe, Middle East & Africa",
            "session_reviewed": "European trading session",
            "handoff_to": "US afternoon session",
            "key_hours": "London close and US mid-day"
        },
        "americas": {
            "name": "Americas",
            "session_reviewed": "US trading session",
            "handoff_to": "Asian open",
            "key_hours": "NYSE close approaching"
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    return f"""You are the Chief Markets Editor at The Litmus writing the evening brief. Your {ctx['name']} readers are wrapping up their trading day and preparing for the {ctx['handoff_to']}.

MARKET DATA:
• Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
• Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
• Solana: ${market_data['sol_price']:,.0f} ({market_data['sol_24h_change']:+.1f}% 24h)
• Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)
• BTC Dominance: {market_data['btc_dominance']:.1f}%

SESSION CONTEXT: {ctx['session_reviewed']} review, {ctx['key_hours']}

Write a 700-900 word evening brief analyzing today's session and setting up overnight positioning:

1. THE SESSION (100-130 words)
What defined today's {ctx['session_reviewed']}? The dominant narrative and key price action.

2. THE FLOWS (150-180 words)
Where did capital move? ETF flows, exchange dynamics, on-chain signals, institutional footprints.

3. THE DIVERGENCE (130-160 words)
What moved differently than expected? Which correlations broke? Where's the interesting signal?

4. THE REGIME CHECK (110-140 words)
Are we still in the same market regime as yesterday? Any structural shifts worth noting?

5. THE OVERNIGHT SETUP (110-140 words)
What should readers watch as markets hand off to {ctx['handoff_to']}? Key levels, potential catalysts.

6. THE TAKEAWAY (30-50 words)
One crystallizing insight about what today revealed.

VOICE: FT editorial quality. Direct, authoritative, intellectually honest.

CRITICAL JSON FORMATTING RULES:
• All string values must have quotes escaped as \\"
• No literal newlines inside strings - use \\n instead
• No trailing commas
• Avoid special characters

OUTPUT FORMAT:
Return ONLY valid JSON:
{{
    "headline": "5-8 word headline capturing today's story",
    "sections": {{
        "the_session": {{
            "title": "4-8 word headline",
            "content": "100-130 words"
        }},
        "the_flows": {{
            "title": "4-8 word headline",
            "content": "150-180 words"
        }},
        "the_divergence": {{
            "title": "4-8 word headline", 
            "content": "130-160 words"
        }},
        "the_regime_check": {{
            "title": "4-8 word headline",
            "content": "110-140 words"
        }},
        "the_overnight_setup": {{
            "title": "4-8 word headline",
            "content": "110-140 words"
        }},
        "the_takeaway": {{
            "title": "The Bottom Line",
            "content": "30-50 words"
        }}
    }},
    "image_keywords": "3-5 evocative keywords for editorial image"
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


def transform_to_flat_structure(brief_data: dict) -> dict:
    """Transform nested section structure to flat for backward compatibility"""
    flat_sections = {}
    for key, value in brief_data.get("sections", {}).items():
        if isinstance(value, dict):
            flat_sections[key] = value.get("content", "")
            flat_sections[f"{key}_title"] = value.get("title", "")
        else:
            flat_sections[key] = value
    
    return {
        "headline": brief_data.get("headline", ""),
        "sections": flat_sections,
        "image_keywords": brief_data.get("image_keywords", "")
    }


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
    region_dir = CONTENT_DIR / region
    region_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = region_dir / f"{brief_type}.json"
    with open(output_file, "w") as f:
        json.dump(brief, f, indent=2)
    
    print(f"  Saved to {output_file}")


def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_brief.py <region> <type>")
        print("  region: apac, emea, americas")
        print("  type: morning, evening")
        sys.exit(1)
    
    region = sys.argv[1].lower()
    brief_type = sys.argv[2].lower()
    
    if region not in ["apac", "emea", "americas"]:
        print(f"Invalid region: {region}")
        sys.exit(1)
    
    if brief_type not in ["morning", "evening"]:
        print(f"Invalid brief type: {brief_type}")
        sys.exit(1)
    
    print(f"\n[{datetime.now(timezone.utc).isoformat()}] Generating {region.upper()} {brief_type} brief")
    
    try:
        brief = generate_brief(region, brief_type)
        save_brief(brief, region, brief_type)
        print(f"  ✓ Complete: {brief['headline']}")
        return 0
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
