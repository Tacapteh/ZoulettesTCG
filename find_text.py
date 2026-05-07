#!/usr/bin/env python3
import re

with open("public/Carte de base.svg", "r", encoding="utf-8") as f:
    svg_text = f.read()

print("=" * 80)
print("SEARCHING FOR TEXT POSITIONS IN Carte de base.svg")
print("=" * 80)

# Look for g elements with x/y attributes (common in SVG text)
g_with_xy = re.findall(
    r'<g[^>]*(?:x="([^"]*)"[^>]*y="([^"]*)"[^>]*|y="([^"]*)"[^>]*x="([^"]*)")', svg_text
)
print(f"\nFound {len(g_with_xy)} g elements with x/y")

# Look for text elements
text_pattern = r'<text[^>]*(?:x="([^"]*)"[^>]*y="([^"]*)"[^>]*|y="([^"]*)"[^>]*x="([^"]*)")([^<]*)</text>'
text_matches = re.findall(text_pattern, svg_text)

if text_matches:
    print(f"\nFound {len(text_matches)} text elements:")
    for match in text_matches[:30]:
        x = match[0] or match[3]
        y = match[1] or match[2]
        content = match[4][:40]
        print(f"  x={x:10} y={y:10} | {content}")

# Search for ALL coordinates mentioned
print("\n" + "=" * 80)
print("SEARCHING FOR COORDINATE PATTERNS")
print("=" * 80)

# Extract numbers that look like coordinates
coords = re.findall(r'(?:x|y)="([0-9.]+)"', svg_text)
unique_coords = sorted(set(float(c) for c in coords if c))

print(f"\nUnique coordinates found: {len(unique_coords)}")
print("Coordinates (first 50):")
for coord in unique_coords[:50]:
    print(f"  {coord}")

# Look for text content in tspan
print("\n" + "=" * 80)
print("SEARCHING FOR TEXT CONTENT")
print("=" * 80)

# Very aggressive pattern for any text-like content
text_content = re.findall(r'>([A-Za-z0-9\s\-\+/\.,:()\'""]+)<', svg_text)
unique_texts = []
for text in text_content:
    if len(text.strip()) > 1 and text.strip() not in unique_texts:
        unique_texts.append(text.strip())
        if len(unique_texts) <= 50:
            print(f"  {text.strip()[:60]}")

print(f"\nTotal unique texts: {len(unique_texts)}")
