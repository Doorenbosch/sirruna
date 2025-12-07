#!/usr/bin/env python3
"""
generate_audio.py - Generate Week in Review audio using ElevenLabs
Place in: scripts/generate_audio.py

Required environment variables:
- ELEVENLABS_API_KEY
- ELEVENLABS_VOICE_ID (optional, defaults to Adam)

Run: python scripts/generate_audio.py
"""

import os
import json
import re
import requests
from datetime import datetime
from pathlib import Path

# Configuration
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')
ELEVENLABS_VOICE_ID = os.environ.get('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM')  # Adam
CONTENT_DIR = Path('content/weekend')
AUDIO_DIR = CONTENT_DIR / 'audio'

# Voice settings for FT-quality narration
VOICE_SETTINGS = {
    "stability": 0.50,          # More expressive
    "similarity_boost": 0.75,   # Clear but natural
    "style": 0.30,              # Subtle emotional variation
    "use_speaker_boost": True
}

def get_week_in_review_text():
    """Load the Week in Review content from magazine.json"""
    magazine_path = CONTENT_DIR / 'magazine.json'
    
    try:
        with open(magazine_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Try different possible structures
        content = None
        headline = "The Week in Review"
        
        if 'week_in_review' in data:
            content = data['week_in_review'].get('content', '')
            headline = data['week_in_review'].get('headline', headline)
        elif 'articles' in data:
            # Find week in review article
            for article in data['articles']:
                if 'week' in article.get('label', '').lower():
                    content = article.get('content', '')
                    headline = article.get('headline', headline)
                    break
        
        return headline, content
        
    except FileNotFoundError:
        print(f"❌ No magazine.json found at {magazine_path}")
        return None, None
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in magazine.json: {e}")
        return None, None

def clean_text_for_speech(text):
    """Prepare text for TTS - make it sound natural when spoken"""
    
    # Remove markdown formatting
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # Bold
    text = re.sub(r'\*([^*]+)\*', r'\1', text)  # Italic
    text = re.sub(r'_([^_]+)_', r'\1', text)  # Underscore italic
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # Links
    text = re.sub(r'#{1,6}\s*', '', text)  # Headers
    
    # Handle HTML entities
    text = text.replace('&amp;', 'and')
    text = text.replace('&nbsp;', ' ')
    text = text.replace('—', ' — ')
    text = text.replace('–', ' - ')
    
    # Handle currency - make it speakable
    text = re.sub(r'\$(\d{1,3}),(\d{3}),(\d{3})', r'\1 point \2 billion dollars', text)
    text = re.sub(r'\$(\d{1,3}),(\d{3})', r'\1 thousand dollars', text)
    text = re.sub(r'\$(\d+)b', r'\1 billion dollars', text, flags=re.IGNORECASE)
    text = re.sub(r'\$(\d+)m', r'\1 million dollars', text, flags=re.IGNORECASE)
    text = re.sub(r'\$(\d+)k', r'\1 thousand dollars', text, flags=re.IGNORECASE)
    text = re.sub(r'\$(\d+)', r'\1 dollars', text)
    
    # Handle percentages
    text = re.sub(r'(\d+\.?\d*)%', r'\1 percent', text)
    
    # Handle crypto terms pronunciation hints
    crypto_pronunciations = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'DeFi': 'DeFi',
        'NFT': 'N F T',
        'TVL': 'total value locked',
        'ATH': 'all-time high',
        'HODL': 'hodl',
    }
    
    for abbr, full in crypto_pronunciations.items():
        text = re.sub(rf'\b{abbr}\b', full, text)
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

def generate_audio(text, output_path):
    """Generate audio using ElevenLabs API"""
    
    if not ELEVENLABS_API_KEY:
        print("❌ ELEVENLABS_API_KEY not set")
        return False
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": VOICE_SETTINGS
    }
    
    print(f"🎙️ Generating audio ({len(text)} characters)...")
    
    try:
        response = requests.post(url, json=data, headers=headers, timeout=120)
        
        if response.status_code == 200:
            # Ensure directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            size_mb = len(response.content) / (1024 * 1024)
            print(f"✅ Audio saved: {output_path} ({size_mb:.1f} MB)")
            return True
        else:
            print(f"❌ ElevenLabs error: {response.status_code}")
            print(response.text)
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

def update_magazine_json(audio_url):
    """Update magazine.json with the audio URL"""
    magazine_path = CONTENT_DIR / 'magazine.json'
    
    try:
        with open(magazine_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['audio_url'] = str(audio_url)
        
        with open(magazine_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Updated magazine.json with audio_url")
        return True
        
    except Exception as e:
        print(f"⚠️ Could not update magazine.json: {e}")
        return False

def main():
    print("=" * 50)
    print("🎙️ Litmus Weekend Audio Generator")
    print("=" * 50)
    
    # Get content
    headline, content = get_week_in_review_text()
    
    if not content:
        print("❌ No Week in Review content found")
        return False
    
    print(f"📄 Found: {headline}")
    
    # Clean text for speech
    cleaned_text = clean_text_for_speech(content)
    
    # Add intro and outro
    intro = f"This is The Week in Review from Litmus Daily. {headline}. "
    outro = " This has been The Week in Review from Litmus Daily. Thank you for listening."
    
    full_text = intro + cleaned_text + outro
    
    print(f"📝 Text length: {len(full_text)} characters")
    print(f"⏱️ Estimated duration: ~{len(full_text) // 150} minutes")
    
    # Generate filename with date
    date_str = datetime.now().strftime('%Y-%m-%d')
    output_path = AUDIO_DIR / f'week-in-review-{date_str}.mp3'
    
    # Generate audio
    if generate_audio(full_text, output_path):
        # Update magazine.json
        relative_path = str(output_path).replace('\\', '/')
        update_magazine_json(relative_path)
        
        print("=" * 50)
        print("✅ Audio generation complete!")
        print(f"📁 File: {output_path}")
        print("=" * 50)
        return True
    else:
        print("❌ Audio generation failed")
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
