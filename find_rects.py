#!/usr/bin/env python3
import re

# Read Carte_Vierge.svg as raw text
with open("public/Carte_Vierge.svg", "r", encoding="utf-8") as f:
    svg_text = f.read()

print("=" * 80)
print("SEARCHING FOR RECT ELEMENTS IN Carte_Vierge.svg")
print("=" * 80)

# Find all <rect elements
rect_pattern = r"<rect[^>]*>"
rect_matches = re.findall(rect_pattern, svg_text)

print(f"\nFound {len(rect_matches)} rect elements:\n")
for i, rect in enumerate(rect_matches[:30]):  # Show first 30
    # Extract attributes
    x_match = re.search(r'x="([^"]*)"', rect)
    y_match = re.search(r'y="([^"]*)"', rect)
    w_match = re.search(r'width="([^"]*)"', rect)
    h_match = re.search(r'height="([^"]*)"', rect)
    fill_match = re.search(r'fill="([^"]*)"', rect)
    id_match = re.search(r'id="([^"]*)"', rect)

    x = x_match.group(1) if x_match else "?"
    y = y_match.group(1) if y_match else "?"
    w = w_match.group(1) if w_match else "?"
    h = h_match.group(1) if h_match else "?"
    fill = fill_match.group(1) if fill_match else "none"
    rid = id_match.group(1) if id_match else ""

    print(f"[{i}] x={x:10} y={y:10} w={w:10} h={h:10} | fill={fill:10} | id={rid}")

# Search for g elements with IDs
print("\n" + "=" * 80)
print("SEARCHING FOR NAMED GROUPS (g elements with id)")
print("=" * 80)

g_pattern = r'<g[^>]*id="([^"]*)"[^>]*>'
g_matches = re.findall(g_pattern, svg_text)

print(f"\nFound {len(g_matches)} named groups:")
for gid in g_matches[:20]:
    print(f"  - {gid}")

# Search for any text content with coordinates
print("\n" + "=" * 80)
print("SEARCHING FOR TEXT/TSPAN WITH CONTENT")
print("=" * 80)

tspan_pattern = r"<tspan[^>]*>([^<]*)</tspan>"
tspan_matches = re.findall(tspan_pattern, svg_text)

if tspan_matches:
    print(f"\nFound {len(tspan_matches)} text spans:")
    for text in tspan_matches[:20]:
        if text.strip():
            print(f"  {text[:60]}")
else:
    print("No tspan elements found")
