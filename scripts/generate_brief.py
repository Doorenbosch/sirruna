#!/usr/bin/env python3
"""
The Litmus - Brief Generator
Generates morning and evening briefs using Claude API
"""

import os
import json
import requests
from datetime import datetime, timezone
from anthropic import Anthropic

# Configuration
COINGECKO_API = "https://api.coingecko.com/api/v3"
MODEL = "claude-sonnet-4-5-20250929"  # Or claude-opus-4-5-20250101 for premium

def get_market_data():
    """Fetch current market data from CoinGecko"""
    try:
        # Get BTC and ETH prices
        prices = requests.get(
            f"{COINGECKO_API}/simple/price",
            params={
                "ids": "bitcoin,ethereum",
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_market_cap": "true"
            },
            timeout=10
        ).json()
        
        # Get global market data
        global_data = requests.get(
            f"{COINGECKO_API}/global",
            timeout=10
        ).json()
        
        return {
            "btc_price": prices.get("bitcoin", {}).get("usd", 0),
            "btc_24h_change": prices.get("bitcoin", {}).get("usd_24h_change", 0),
            "eth_price": prices.get("ethereum", {}).get("usd", 0),
            "eth_24h_change": prices.get("ethereum", {}).get("usd_24h_change", 0),
            "total_market_cap": global_data.get("data", {}).get("total_market_cap", {}).get("usd", 0),
            "market_cap_change_24h": global_data.get("data", {}).get("market_cap_change_percentage_24h_usd", 0),
            "btc_dominance": round(global_data.get("data", {}).get("market_cap_percentage", {}).get("btc", 0), 1)
        }
    except Exception as e:
        print(f"Error fetching market data: {e}")
        return {
            "btc_price": 0,
            "btc_24h_change": 0,
            "eth_price": 0,
            "eth_24h_change": 0,
            "total_market_cap": 0,
            "market_cap_change_24h": 0
        }


def get_week_ahead_prompt(market_data: dict) -> str:
    """Generate the Week Ahead prompt - global, published once daily at 12:00 GMT"""
    
    return f"""You are the forward-looking intelligence editor for The L/tmus, a premium crypto publication combining the editorial standards of the Financial Times with the behavioral insight of Rory Sutherland and the clarity-of-purpose thinking of Simon Sinek.

Generate a "The Week Ahead" section that tells sophisticated investors what deserves their attention in the coming days. This is anticipatory intelligence, not recap. Every word must earn its place.

CURRENT MARKET CONTEXT:
- Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
- Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
- Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)
- BTC Dominance: {market_data.get('btc_dominance', 54)}%

YOUR MANDATE:
Write forward-looking intelligence that helps investors position for the week ahead. Each section should answer "why should I care?" within the first two sentences. This is not a calendar recap—it's strategic preparation.

THE STRUCTURE (500-650 words total):

1. THIS WEEK'S FULCRUM (100-140 words)
The single most important event or decision point in the next 7 days. Be specific: the date, what it is, and WHY it matters for positioning. Think Sinek: start with why this deserves attention above all else. Connect the event to its market implications—not just "what happens" but "what changes in how money moves."

2. LEVELS WORTH KNOWING (120-160 words)
For BTC and ETH: specific price levels that matter this week. Not just the numbers—the psychology and positioning logic behind them. Think Sutherland: what do these levels mean to different market participants? What behavior triggers at these thresholds? Include both support and resistance, and explain what a break in either direction would signal about market structure.

3. THE UNPRICED STORY (120-160 words)
What narrative or development is building that the market hasn't fully absorbed? This is where behavioral edge lives—identify the gap between what IS happening and what the market BELIEVES is happening. This should be your highest-conviction contrarian insight. Name the narrative, explain why it's underappreciated, and suggest how it might manifest in price.

4. THE UNDERESTIMATED (100-130 words)
One risk or catalyst that deserves more attention than it's getting. Not fear-mongering—genuine contrarian intelligence. This could be a tail risk, an overlooked event, or a positioning imbalance that creates asymmetric outcomes. Be specific about why the market is underweighting this factor and what would cause a repricing.

EDITORIAL STANDARDS:
- Write with informed conviction, not hedged uncertainty
- Institutional terminology (rotation, distribution, positioning) not retail language (moon, pump, bullish)
- Each section must deliver actionable intelligence, not commentary
- Specific numbers, dates, and levels wherever possible
- Historical parallels where relevant ("similar setups in March led to...")
- No rhetorical questions—statements of informed opinion

VOICE:
Write like the senior strategist at a macro fund briefing the investment committee. You're not trying to impress—you're trying to prepare. Direct, specific, useful.

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{{
    "generated_at": "ISO timestamp",
    "headline": "5-7 word headline for the week ahead",
    "sections": {{
        "fulcrum": {{
            "title": "Short title for this week's key event (3-6 words)",
            "content": "100-140 word analysis of the week's most important event"
        }},
        "levels": {{
            "title": "Key technical title (3-6 words)",  
            "content": "120-160 word analysis of price levels that matter"
        }},
        "unpriced": {{
            "title": "The unpriced narrative title (3-6 words)",
            "content": "120-160 word analysis of the underappreciated story"
        }},
        "underestimated": {{
            "title": "The overlooked risk title (3-6 words)",
            "content": "100-130 word analysis of what deserves more attention"
        }}
    }}
}}

Return ONLY the JSON object, no other text."""


def get_evening_prompt(region: str, market_data: dict) -> str:
    """Generate the evening brief prompt - focused on what happened today"""
    
    region_context = {
        "apac": {
            "timezone": "Asia-Pacific",
            "session": "Asian trading session",
            "overnight": "European and US sessions ahead",
            "local_factors": "Hong Kong close, Japan institutional activity, Korea retail sentiment shifts"
        },
        "emea": {
            "timezone": "Europe and Middle East", 
            "session": "European trading session",
            "overnight": "US session wrapping, Asia opening",
            "local_factors": "European institutional close, London trading desk handoff, ECB commentary"
        },
        "americas": {
            "timezone": "North and South America",
            "session": "US trading session",
            "overnight": "Asia opening soon",
            "local_factors": "US market close, ETF final flows, institutional repositioning"
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    # Calculate intraday changes
    btc_intraday = market_data.get('btc_24h_change', 0)
    eth_intraday = market_data.get('eth_24h_change', 0)
    
    return f"""You are the Chief Markets Analyst for The L/tmus, writing the evening intelligence brief. This is the end-of-day debrief that sophisticated crypto investors read before dinner—a synthesis of what actually happened today and what it means for positioning.

REGIONAL CONTEXT ({ctx['timezone']}):
The {ctx['session']} is closing. Your reader needs to understand: What moved? Why? What changed about the setup since this morning? Looking ahead: {ctx['overnight']}.

TODAY'S MARKET ACTION:
- Bitcoin: ${market_data['btc_price']:,.0f} ({btc_intraday:+.1f}% in last 24h)
- Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% in last 24h)
- Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)
- BTC Dominance: {market_data.get('btc_dominance', 'N/A')}%

YOUR MANDATE:
Write a 550-700 word evening brief that answers: "What actually happened today, and what does it mean?" This is not a morning setup piece—it's a retrospective that earns its place by providing clarity on the day's action.

The evening brief is more empirical than the morning brief. You're explaining what happened, not what might happen. But you still need the interpretive frame—the "so what" that makes raw price action meaningful.

THE STRUCTURE OF THE EVENING BRIEF (550-700 words):

1. THE SESSION (70-100 words)
Lead with what happened. Not just price—the character of the session. Was it conviction or drift? Liquidation cascade or organic selling? Short squeeze or genuine demand? Give them the one-sentence summary they can repeat to a colleague, then expand on it.

2. THE FLOWS (130-170 words)
Where did the money move? ETF flows, perpetual funding rates, spot vs derivatives volume, stablecoin movements. This is the plumbing that explains the price action. If you don't know specific numbers, focus on the dynamics you can infer from price behavior.

3. THE DIVERGENCE (100-130 words)
What's the most interesting thing that doesn't fit the simple narrative? BTC up but ETH down? Price rising on falling volume? Funding negative despite the rally? This is where you show sophistication—the market is never one-dimensional.

4. THE REGIME CHECK (80-110 words)
Has anything changed about the broader setup? Is this session consistent with the prevailing trend or does it suggest a shift? Connect today to the larger picture. Reference this morning's brief if the thesis was confirmed or challenged.

5. THE OVERNIGHT SETUP (80-110 words)
What matters for the next 12 hours? Key levels to watch, events that could move markets, positioning dynamics. Not predictions—preparation. What would change your view?

6. THE TAKEAWAY (20-35 words)
One or two sentences crystallizing today's significance. The line they remember.

VOICE PRINCIPLES (same as morning):
Write like a senior editor who respects readers' intelligence. Direct because you've done the work.

Prohibited: bullish, bearish, moon, pump, FOMO, FUD, skyrockets, plummets, explodes, massive, altcoins, certainty about unpredictable outcomes.

Required: Specific numbers with context, structural language (rotation, distribution, accumulation), conditional framing, comparison to recent sessions ("unlike yesterday's drift, today showed conviction").

THE QUALITY TEST:
Before finishing: Does this help the reader understand what actually happened today better than they would from watching charts? If they could get the same insight from a price chart, rewrite.

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{{
    "headline": "5-7 word headline capturing today's story",
    "sections": {{
        "the_session": "70-100 word summary of today's character",
        "the_flows": "130-170 word analysis of money movement",
        "the_divergence": "100-130 word counterpoint or interesting anomaly",
        "the_regime_check": "80-110 word assessment of whether anything changed",
        "the_overnight_setup": "80-110 word preview of key levels and events",
        "the_takeaway": "20-35 word crystallizing statement"
    }}
}}

Return ONLY the JSON object, no other text."""


def get_morning_prompt(region: str, market_data: dict) -> str:
    """Generate the morning brief prompt using the full iOS editorial structure"""
    
    region_context = {
        "apac": {
            "timezone": "Asia-Pacific",
            "overnight": "US session",
            "local_factors": "Hong Kong regulatory, Japan institutional news, Australia macro, Korean retail sentiment"
        },
        "emea": {
            "timezone": "Europe and Middle East", 
            "overnight": "US close AND Asia session",
            "local_factors": "ECB policy, MiCA implementation, UK regulatory, European institutional flows"
        },
        "americas": {
            "timezone": "North and South America",
            "overnight": "Asia AND Europe sessions",
            "local_factors": "Fed policy, SEC regulatory, ETF flows, US institutional positioning"
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    return f"""You are the Chief Markets Analyst for The L/tmus, writing the morning intelligence brief that sophisticated crypto investors read before their first meeting. Your readers cancelled their Bloomberg Terminal subscriptions because they realized most "analysis" is just data with adjectives. They kept The L/tmus because you give them something rarer: a framework for understanding.

REGIONAL CONTEXT ({ctx['timezone']}):
Your reader slept through the {ctx['overnight']}. Local factors that matter: {ctx['local_factors']}.

CURRENT MARKET DATA:
- Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
- Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
- Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)

YOUR MANDATE:
Write a 650-850 word morning brief that does what the Financial Times does at its best - not merely report, but illuminate. Your reader should finish this brief with a changed mental model, not just updated information.

You are not summarizing the market. You are making an argument about what the market is telling us.

THE L/TMUS'S EDITORIAL APPROACH:
We believe markets are systems of human behavior dressed up as mathematics. Price is the scoreboard; positioning, narrative, and structural flows are the game. Your job is to see the game.

Every brief should answer one core question that the reader didn't know they should be asking. Not "what happened?" but "what does this reveal about the underlying game?"

THE STRUCTURE OF INSIGHT (650-850 words):

1. THE LEAD (60-90 words)
Open with your thesis - the interpretive frame that makes sense of the noise. This is not a headline restatement. This is your *take*.

Strong: "The market is lying about what it wants. Bitcoin's drift toward $110,000 amid record ETF inflows suggests not momentum but exhaustion - capital arriving without conviction, filling positions that earlier buyers are quietly vacating."

Weak: "Bitcoin approached $110,000 this week as ETF inflows continued, though traders remain cautious about macro headwinds."

2. THE MECHANISM (150-200 words)
Explain WHY this is happening at the structural level. This is where you earn trust. Don't describe the pattern - explain the machinery producing it.

What's driving the flows? Who is positioned where? What changed in the last 2-4 weeks that created this setup? Connect the surface to the plumbing.

This is the Rory Sutherland move: look beneath the obvious explanation. If everyone says "it's because of the Fed," ask what else it could be. If the data says one thing but price does another, that divergence IS the story.

3. THE COMPLICATION (120-160 words)
Here's where you earn intellectual respect: acknowledge what doesn't fit. The FT never pretends markets are simple. Neither do you.

What contradicts your thesis? What would make you wrong? Where is the market showing internal conflict? This isn't hedging - it's honesty, and your readers can smell the difference.

"However" is the most important word in financial journalism. Use it.

4. THE BEHAVIORAL LAYER (100-140 words)
This is The L/tmus's distinctive edge. What psychological or structural dynamic explains why the market is behaving this way?

Is this herding? Anchoring? Liquidity-seeking behavior? Narrative exhaustion? The shift from speculation to allocation?

Simon Sinek asks "why" until he reaches the human motivation. Rory Sutherland looks for the hidden logic in apparently irrational behavior. Channel both.

5. THE FORWARD VIEW (100-140 words)
What would confirm your thesis? What would refute it? What should readers watch?

Not predictions - decision frameworks. Give them the "if X, then probably Y" structure that lets them think ahead. This is where you become valuable: you're not telling them what will happen, you're showing them how to evaluate what happens next.

6. THE CLOSING LINE (20-35 words)
One or two sentences that crystallize the insight. Something quotable. The line they remember when they're in a meeting later.

VOICE PRINCIPLES:
Write like a senior editor who respects their readers' intelligence. You can be direct because you've done the work. You can be opinionated because you've earned it.

Prohibited (retail crypto, breathless finance):
- Bullish/bearish, moon, pump, dump, FOMO, FUD, rekt
- "Skyrockets," "plummets," "explodes," "massive"
- "Altcoins" (use specific names or "smaller-cap tokens")
- Certainty about unpredictable outcomes
- Anthropomorphizing ("Bitcoin wants to break out")
- Empty intensifiers ("very," "really," "extremely")

Required (institutional, editorial):
- Specific numbers with context ("up 3.2% against a flat equity session")
- Structural language: rotation, distribution, accumulation, positioning, conviction
- Conditional framing: "suggests," "indicates," "points toward," "consistent with"
- Historical reference: "reminiscent of," "unlike the October setup," "a pattern we last saw when..."

THE QUALITY TEST:
Before you finish, ask: Would the reader share this? Not because it's alarming or exciting, but because it made them think differently. If they wouldn't forward it to a colleague with "interesting take," rewrite.

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{{
    "headline": "Compelling 5-7 word headline that captures your thesis",
    "sections": {{
        "the_lead": "Your 60-90 word opening thesis",
        "the_mechanism": "Your 150-200 word structural explanation",
        "the_complication": "Your 120-160 word counterpoint",
        "the_behavioral_layer": "Your 100-140 word psychological insight",
        "the_forward_view": "Your 100-140 word decision framework",
        "the_closing_line": "Your 20-35 word crystallizing statement"
    }}
}}

Return ONLY the JSON object, no other text."""


def get_evening_prompt(region: str, market_data: dict) -> str:
    """Generate the evening brief prompt for a specific region"""
    
    return f"""You are the evening intelligence editor for The Litmus, a premium crypto publication with the editorial standards of the Financial Times and the behavioral insight of Rory Sutherland.

Generate the Evening Update for investors ending their day.

**PURPOSE:**
The morning brief said "here's what to watch." The evening update says "here's what happened." Close the loop.

**CURRENT MARKET DATA:**
- Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
- Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
- Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON with this exact structure:
{{
    "headline": "Compelling 4-6 word headline summarizing the day",
    "sections": {{
        "the_day": "3-4 sentences on what actually happened. Price action, catalysts, any surprises.",
        "the_move_explained": "2-3 sentences on WHY it happened. Causation where identifiable.",
        "into_tonight": "2 sentences on what carries into the overnight session."
    }}
}}

**EDITORIAL STANDARDS:**
- Maximum 150 words total
- Acknowledge when the day was uneventful - don't manufacture drama
- Write with conviction but intellectual honesty

Return ONLY the JSON object, no other text."""


def get_publication_timestamp(region: str, brief_type: str) -> str:
    """Generate the intended publication timestamp with correct regional timezone"""
    from datetime import datetime, timedelta
    
    # Timezone offsets for each region
    tz_offsets = {
        "apac": "+08:00",      # SGT/HKT
        "emea": "+00:00",      # GMT
        "americas": "-05:00"   # EST
    }
    
    # Publication hours
    pub_hours = {
        "morning": 6,
        "evening": 18
    }
    
    offset = tz_offsets.get(region, "+00:00")
    hour = pub_hours.get(brief_type, 6)
    
    # Get today's date in UTC
    now_utc = datetime.utcnow()
    
    # Parse offset to calculate local date
    offset_hours = int(offset[:3])
    local_now = now_utc + timedelta(hours=offset_hours)
    
    # Use local date with intended publication hour
    pub_time = local_now.replace(hour=hour, minute=0, second=0, microsecond=0)
    
    # Format as ISO string with timezone
    return f"{pub_time.strftime('%Y-%m-%dT%H:%M:%S')}{offset}"


def generate_brief(region: str, brief_type: str):
    """Generate a brief using Claude API"""
    
    # Get market data
    market_data = get_market_data()
    
    # Get appropriate prompt
    if brief_type == "morning":
        prompt = get_morning_prompt(region, market_data)
    elif brief_type == "evening":
        prompt = get_evening_prompt(region, market_data)
    elif brief_type == "week-ahead":
        prompt = get_week_ahead_prompt(market_data)
    else:
        prompt = get_morning_prompt(region, market_data)
    
    # Call Claude API
    client = Anthropic()
    
    message = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    # Parse response
    response_text = message.content[0].text
    
    # Clean up response (remove markdown if present)
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
    response_text = response_text.strip()
    
    brief_data = json.loads(response_text)
    
    # Add metadata with intended publication time (not actual generation time)
    brief_data["region"] = region if brief_type != "week-ahead" else "global"
    brief_data["type"] = brief_type
    
    if brief_type == "week-ahead":
        # Week ahead uses GMT 12:00
        now = datetime.utcnow()
        brief_data["generated_at"] = f"{now.strftime('%Y-%m-%dT')}12:00:00+00:00"
    else:
        brief_data["generated_at"] = get_publication_timestamp(region, brief_type)
    
    brief_data["btc_price"] = market_data["btc_price"]
    brief_data["eth_price"] = market_data["eth_price"]
    brief_data["total_market_cap"] = market_data["total_market_cap"]
    brief_data["btc_24h_change"] = market_data["btc_24h_change"]
    
    return brief_data


def save_brief(brief_data: dict, region: str, brief_type: str):
    """Save brief to JSON file"""
    
    # Week ahead goes to global content folder
    if brief_type == "week-ahead":
        output_path = "content/week-ahead.json"
    else:
        output_path = f"content/{region}/{brief_type}.json"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(brief_data, f, indent=2)
    
    print(f"Saved {brief_type} brief to {output_path}")


def main():
    """Main entry point"""
    
    region = os.environ.get("REGION", "americas")
    brief_type = os.environ.get("BRIEF_TYPE", "morning")
    
    print(f"Generating {region} {brief_type} brief...")
    
    try:
        brief_data = generate_brief(region, brief_type)
        save_brief(brief_data, region, brief_type)
        print("Success!")
    except Exception as e:
        print(f"Error generating brief: {e}")
        raise


if __name__ == "__main__":
    main()
