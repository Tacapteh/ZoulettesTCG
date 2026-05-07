#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json

# Parse both SVG files
namespaces = {"svg": "http://www.w3.org/2000/svg"}

print("=" * 60)
print("ANALYZING Carte_Vierge.svg")
print("=" * 60)

try:
    tree = ET.parse("public/Carte_Vierge.svg")
    root = tree.getroot()

    # Get viewBox
    viewbox = root.get("viewBox")
    print(f"\nViewBox: {viewbox}")

    # Find all rect elements with their positions
    for rect in root.findall(".//svg:rect", namespaces):
        x = rect.get("x", "0")
        y = rect.get("y", "0")
        width = rect.get("width", "?")
        height = rect.get("height", "?")
        fill = rect.get("fill", "none")
        rid = rect.get("id", "")

        if rid or fill != "none":
            print(
                f"RECT: x={x:8} y={y:8} w={width:8} h={height:8} | fill={fill:10} | id={rid}"
            )

    # Find all text elements
    print("\nTEXT ELEMENTS:")
    for text in root.findall(".//svg:text", namespaces):
        x = text.get("x", "?")
        y = text.get("y", "?")
        content = "".join(text.itertext())
        tid = text.get("id", "")
        print(f"  x={x:8} y={y:8} | {content[:40]:40} | id={tid}")

    # Find all g elements with transform
    print("\nGROUPS with transform:")
    for g in root.findall(".//svg:g", namespaces):
        transform = g.get("transform", "")
        gid = g.get("id", "")
        if transform or gid:
            print(f"  transform={transform[:60]:60} | id={gid}")

except Exception as e:
    print(f"Error parsing: {e}")

print("\n" + "=" * 60)
print("ANALYZING Carte de base.svg")
print("=" * 60)

try:
    tree2 = ET.parse("public/Carte de base.svg")
    root2 = tree2.getroot()

    # Get viewBox
    viewbox2 = root2.get("viewBox")
    print(f"\nViewBox: {viewbox2}")

    # Find all rect elements
    print("\nRECT ELEMENTS:")
    for rect in root2.findall(".//svg:rect", namespaces):
        x = rect.get("x", "0")
        y = rect.get("y", "0")
        width = rect.get("width", "?")
        height = rect.get("height", "?")
        fill = rect.get("fill", "none")
        rid = rect.get("id", "")

        if rid or (fill != "none" and fill != ""):
            print(
                f"RECT: x={x:8} y={y:8} w={width:8} h={height:8} | fill={fill:10} | id={rid}"
            )

    # Find text with tspan
    print("\nTEXT CONTENT:")
    for text in root2.findall(".//svg:text", namespaces):
        x = text.get("x", "?")
        y = text.get("y", "?")
        for tspan in text.findall(".//svg:tspan", namespaces):
            content = tspan.text or ""
            if content.strip():
                print(f"  x={x:8} y={y:8} | {content.strip()[:40]:40}")

except Exception as e:
    print(f"Error parsing: {e}")
