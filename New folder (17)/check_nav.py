import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

# Get all page IDs
page_ids = re.findall(r'id="page-([^"]+)"', content)
print("=== ALL PAGE IDs ===")
for pid in page_ids:
    print(f"  page-{pid}")

print()

# Get all nav button IDs
nav_ids = re.findall(r'id="nav-([^"]+)"', content)
print("=== ALL NAV BUTTON IDs ===")
for nid in nav_ids:
    print(f"  nav-{nid}")

print()

# Check matching
page_set = set(page_ids)
nav_set = set(nav_ids)
print("=== MATCHING CHECK ===")
print("Nav buttons WITHOUT matching page:", nav_set - page_set)
print("Pages WITHOUT matching nav button:", page_set - nav_set)

# Check pageData keys
pagedata_match = re.search(r'const pageData\s*=\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}', content)
if pagedata_match:
    keys = re.findall(r"'([^']+)':", pagedata_match.group(1))
    print()
    print("=== pageData KEYS ===")
    for k in keys:
        print(f"  {k}")

# Final zero-check
print()
print("=== ZERO STATE CHECKS ===")
print("4m 22s:", '4m 22s' in content)
print("423 Revenue Leak:", '>423<' in content)
print("64% Scroll:", '>64%<' in content)
print("stat-icon HTML divs remaining:", len(re.findall(r'<div class="stat-icon">', content)))
print("Activities No results:", 'No results' in content)
print("58 decisions:", '>58<' in content)
print("247 decisions:", '>247<' in content)
print("189 auto-approved:", '>189<' in content)
