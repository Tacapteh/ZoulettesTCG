#!/usr/bin/env python3
import re

# Read the SVG with text
with open("public/Carte de base.svg", "r", encoding="utf-8") as f:
    svg_text = f.read()

# Find all tspan elements which contain the actual text content
tspan_pattern = r"<tspan[^>]*>([^<]*)</tspan>"
tspans = re.findall(tspan_pattern, svg_text)

print("=== ALL TEXT CONTENT ===")
for i, text in enumerate(tspans[:50]):
    if text.strip():
        print(f"[{i}] {text}")

# Look for parent g elements with IDs or specific attributes
print("\n=== Looking for g elements with IDs ===")
g_pattern = r'<g[^>]*id="([^"]*)"[^>]*>'
g_ids = re.findall(g_pattern, svg_text)
for gid in g_ids[:20]:
    print(f"  {gid}")

# Extract viewBox information
viewbox_pattern = r'viewBox="([^"]*)"'
viewbox = re.search(viewbox_pattern, svg_text)
if viewbox:
    print(f"\nViewBox: {viewbox.group(1)}")

# Check for named slots or areas
slots = ["slot-nom", "slot-pv", "slot-atk", "slot-def", "slot-famille", "slot-textbox"]
print("\n=== Searching for slot references ===")
for slot in slots:
    if slot in svg_text:
        print(f"  Found: {slot}")
