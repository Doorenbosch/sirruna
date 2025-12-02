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
            "market_cap_change_24h": global_data.get("data", {}).get("market_cap_change_percentage_24h_usd", 0)
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
Write a 500-650 word morning brief that does what the Financial Times does at its best - not merely report, but illuminate. Your reader should finish this brief with a changed mental model, not just updated information.

You are not summarizing the market. You are making an argument about what the market is telling us.

THE L/TMUS'S EDITORIAL APPROACH:
We believe markets are systems of human behavior dressed up as mathematics. Price is the scoreboard; positioning, narrative, and structural flows are the game. Your job is to see the game.

Every brief should answer one core question that the reader didn't know they should be asking. Not "what happened?" but "what does this reveal about the underlying game?"

THE STRUCTURE OF INSIGHT (500-700 words):

1. THE LEAD (40-60 words)
Open with your thesis - the interpretive frame that makes sense of the noise. This is not a headline restatement. This is your *take*.

Strong: "The market is lying about what it wants. Bitcoin's drift toward $110,000 amid record ETF inflows suggests not momentum but exhaustion - capital arriving without conviction, filling positions that earlier buyers are quietly vacating."

Weak: "Bitcoin approached $110,000 this week as ETF inflows continued, though traders remain cautious about macro headwinds."

2. THE MECHANISM (120-150 words)
Explain WHY this is happening at the structural level. This is where you earn trust. Don't describe the pattern - explain the machinery producing it.

What's driving the flows? Who is positioned where? What changed in the last 2-4 weeks that created this setup? Connect the surface to the plumbing.

This is the Rory Sutherland move: look beneath the obvious explanation. If everyone says "it's because of the Fed," ask what else it could be. If the data says one thing but price does another, that divergence IS the story.

3. THE COMPLICATION (100-130 words)
Here's where you earn intellectual respect: acknowledge what doesn't fit. The FT never pretends markets are simple. Neither do you.

What contradicts your thesis? What would make you wrong? Where is the market showing internal conflict? This isn't hedging - it's honesty, and your readers can smell the difference.

"However" is the most important word in financial journalism. Use it.

4. THE BEHAVIORAL LAYER (80-100 words)
This is The L/tmus's distinctive edge. What psychological or structural dynamic explains why the market is behaving this way?

Is this herding? Anchoring? Liquidity-seeking behavior? Narrative exhaustion? The shift from speculation to allocation?

Simon Sinek asks "why" until he reaches the human motivation. Rory Sutherland looks for the hidden logic in apparently irrational behavior. Channel both.

5. THE FORWARD VIEW (80-100 words)
What would confirm your thesis? What would refute it? What should readers watch?

Not predictions - decision frameworks. Give them the "if X, then probably Y" structure that lets them think ahead. This is where you become valuable: you're not telling them what will happen, you're showing them how to evaluate what happens next.

6. THE CLOSING LINE (15-25 words)
One sentence that crystallizes the insight. Something quotable. The line they remember when they're in a meeting later.

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
        "the_lead": "Your 40-60 word opening thesis",
        "the_mechanism": "Your 120-150 word structural explanation",
        "the_complication": "Your 100-130 word counterpoint",
        "the_behavioral_layer": "Your 80-100 word psychological insight",
        "the_forward_view": "Your 80-100 word decision framework",
        "the_closing_line": "Your 15-25 word crystallizing statement"
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


def generate_brief(region: str, brief_type: str):
    """Generate a brief using Claude API"""
    
    # Get market data
    market_data = get_market_data()
    
    # Get appropriate prompt
    if brief_type == "morning":
        prompt = get_morning_prompt(region, market_data)
    else:
        prompt = get_evening_prompt(region, market_data)
    
    # Call Claude API
    client = Anthropic()
    
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
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
    
    # Add metadata
    brief_data["region"] = region
    brief_data["type"] = brief_type
    brief_data["generated_at"] = datetime.now(timezone.utc).isoformat()
    brief_data["btc_price"] = market_data["btc_price"]
    brief_data["eth_price"] = market_data["eth_price"]
    brief_data["total_market_cap"] = market_data["total_market_cap"]
    brief_data["btc_24h_change"] = market_data["btc_24h_change"]
    
    return brief_data


def save_brief(brief_data: dict, region: str, brief_type: str):
    """Save brief to JSON file"""
    
    output_path = f"content/{region}/{brief_type}.json"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(brief_data, f, indent=2)
    
    print(f"Saved {region} {brief_type} brief to {output_path}")


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
