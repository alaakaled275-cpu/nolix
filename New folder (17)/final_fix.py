import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

# =========================================================
# Remove ALL remaining stat-icon divs (8 remaining)
# They contain the ugly empty circle SVG icons
# =========================================================
before = content.count('stat-icon')
content = re.sub(r'<div class="stat-icon">.*?</div>', '', content, flags=re.DOTALL)
after = content.count('stat-icon')
print(f"stat-icon: {before} -> {after}")

# =========================================================
# Check nav buttons have onclick="navigate(...)"
# =========================================================
nav_with_onclick = re.findall(r'id="nav-[^"]+"\s+onclick="navigate', content)
nav_without_onclick = re.findall(r'id="nav-[^"]+"\s+(?!onclick)', content)
print(f"Nav buttons WITH onclick navigate: {len(nav_with_onclick)}")

# Find all nav-icon-btn elements to check their onclick
nav_btns = re.findall(r'<[^>]+class="nav-icon-btn[^"]*"[^>]*>', content)
print(f"\n=== NAV BUTTON HTML (first 3) ===")
for btn in nav_btns[:3]:
    print(btn[:200])

# =========================================================
# Ensure every nav button calls navigate()
# Fix pattern: id="nav-X" but missing onclick
# =========================================================
# Find nav buttons without onclick
def fix_nav_btn(m):
    btn_html = m.group(0)
    # Extract the page id
    id_match = re.search(r'id="nav-([^"]+)"', btn_html)
    if not id_match:
        return btn_html
    page = id_match.group(1)
    # Check if it already has onclick
    if 'onclick' in btn_html:
        return btn_html
    # Add onclick before the closing >
    btn_html = btn_html.rstrip('>')
    btn_html += f' onclick="navigate(\'{page}\')">'
    return btn_html

content = re.sub(r'<(?:div|button)[^>]+class="nav-icon-btn[^"]*"[^>]*>', fix_nav_btn, content)

# =========================================================
# Zero out remaining inline numbers that are not yet 0
# =========================================================
# Hero wallet total balance display (if still showing values)
content = re.sub(r'(<div[^>]*class="[^"]*balance-total[^"]*"[^>]*>)\s*[\$\€\£]?[0-9,\.]+\s*(</div>)', r'\g<1>$0.00\g<2>', content)

# Payout amount input value
content = re.sub(r'(id="payout-amount"[^>]*value=")[\d,\.]+(")', r'\g<1>0.00\g<2>', content)

# Monthly spending limit bar — set to 0
content = re.sub(r'style="width:\s*[\d\.]+%[^"]*"(.*?monthly.*?bar)', lambda m: m.group(0).replace(m.group(0).split('"')[1], '0%'), content)

# Any remaining inline font-size values showing numbers
# Remove "38.2%" open rate, "12.4%" conv rate (Klaviyo section - should be 0)
content = content.replace('>38.2%<', '>0.0%<')
content = content.replace('>12.4%<', '>0.0%<')

# Emails today "342" -> 0
content = content.replace('>342<', '>0<')

# Products synced "3,421" -> 0
content = re.sub(r'Products synced</span><span style="font-weight:500;">[\d,]+</span>', 
                 'Products synced</span><span style="font-weight:500;">0</span>', content)

# Events today "8,847" -> 0
content = re.sub(r'Events today</span><span style="font-weight:500;">[\d,]+</span>', 
                 'Events today</span><span style="font-weight:500;">0</span>', content)

# =========================================================
# SAVE
# =========================================================
with open('opspulse-fixed (1).html', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone! All fixes applied.")
print("Final stat-icon count:", content.count('stat-icon'))
