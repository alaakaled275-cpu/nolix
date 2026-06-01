import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

# Check page CSS
page_css = re.findall(r'\.page\s*\{[^}]*\}', content)
page_active_css = re.findall(r'\.page\.active\s*\{[^}]*\}', content)
print('=== PAGE CSS ===')
for css in page_css:
    print(css.strip()[:200])

print()
print('=== PAGE.ACTIVE CSS ===')
for css in page_active_css:
    print(css.strip()[:200])

# Check which pages have active class - fixed quote handling
active_pages = [m.group(0) for m in re.finditer(r'class="page active" id="[^"]+"', content)]
pages_all = [m.group(0) for m in re.finditer(r'class="page" id="[^"]+"', content)]
print()
print('=== ACTIVE PAGES ===')
for p in active_pages:
    print(p)
print()
print('=== ALL PAGES (first 5) ===')
for p in pages_all[:5]:
    print(p)

# Check nav buttons
nav_buttons = [m.group(0) for m in re.finditer(r'id="nav-[^"]+"', content)]
print()
print('=== NAV BUTTON IDS ===')
for n in nav_buttons:
    print(n)

# Check stat-icon presence
stat_icons = content.count('stat-icon')
print()
print(f'stat-icon remaining: {stat_icons}')

# Check activities tbody
if 'No results' in content:
    print('Recent Activities: EMPTY (No results text found)')
else:
    print('Recent Activities: still has data')

# Check session stats
print()
print('4m 22s present:', '4m 22s' in content)
print('64% AVG scroll present:', '>64%<' in content)
print('423 Revenue Leak present:', '>423<' in content)
