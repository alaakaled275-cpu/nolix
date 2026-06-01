import re

file_path = 'opspulse-fixed (1).html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print("Original size:", len(content))

# =========================================================
# 1. REMOVE .stat-icon divs (the circle/square icons inside stat cards)
#    These look like empty circles in the images e.g. the "O" shape
# =========================================================
# Remove any <div class="stat-icon">...</div> completely
content = re.sub(r'<div class="stat-icon">.*?</div>', '', content, flags=re.DOTALL)

# =========================================================
# 2. ZERO OUT stat badges (percentages like ↑ 7%, ↑ 8%, ↓ 4.5%, ↑ 6%, ↑ 5%)
# =========================================================
# Replace all stat-badge percentage contents to 0%
content = re.sub(r'(<span class="stat-badge[^"]*">)↑\s*[\d\.]+%', r'\g<1>↑ 0%', content)
content = re.sub(r'(<span class="stat-badge[^"]*">)↓\s*[\d\.]+%', r'\g<1>↓ 0%', content)

# =========================================================
# 3. ZERO SESSION & BEHAVIOR OVERVIEW 
#    "4m 22s" → "0m 0s", "64%" → "0%", "423" → "0"
# =========================================================
content = content.replace('>4m 22s<', '>0m 0s<')
content = content.replace('>64%<', '>0%<')
content = content.replace('>423<', '>0<')

# =========================================================
# 4. EMPTY RECENT ACTIVITIES TABLE - Replace all tbody rows with "No results"
# =========================================================
# Find the activities table body and empty it
activities_empty_tbody = '''              <tbody>
                <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">No results</td></tr>
              </tbody>'''

content = re.sub(
    r'(<table class="tbl">.*?<thead>.*?</thead>)\s*<tbody>.*?</tbody>',
    lambda m: m.group(1) + '\n' + activities_empty_tbody,
    content,
    count=1,
    flags=re.DOTALL
)

# =========================================================
# 5. ZERO AI QUICK ACTIONS numbers
# =========================================================
content = content.replace('⚠️ 58 decisions pending review', '⚠️ 0 decisions pending review')
content = content.replace('🔴 Budget 95% used', '🔴 Budget 0% used')
content = content.replace('✅ Test B winning +45% lift', '✅ No active tests')

# =========================================================
# 6. ZERO WALLET SECTION
# =========================================================
content = content.replace('↑ 5% than last month', '↑ 0% than last month')
content = content.replace('Limit $0.00K/mo', 'Limit $0.00/mo')
content = content.replace('Limit €0K/mo', 'Limit €0/mo')
content = content.replace('Limit £0K/mo', 'Limit £0/mo')
content = content.replace('$0.00 spent', '$0.00 spent')
content = content.replace('Total 6 wallets', 'Total 0 wallets')

# Zero out any remaining percentages in stat contexts
content = content.replace('↑ 28.4%', '↑ 0%')
content = content.replace('↑ 22.1%', '↑ 0%')
content = content.replace('↑ 35.7%', '↑ 0%')
content = content.replace('↑ 19.8%', '↑ 0%')
content = content.replace('↑ 16.3%', '↑ 0%')
content = content.replace('↑ 26.7%', '↑ 0%')
content = content.replace('↑ 14.2%', '↑ 0%')

# Intelligence page numbers
content = content.replace('>247<', '>0<')
content = content.replace('>189<', '>0<')
content = content.replace('>58<', '>0<')
content = content.replace('>4,821<', '>0<')
content = content.replace('>3,219<', '>0<')
content = content.replace('>8,392<', '>0<')
content = content.replace('>4,618<', '>0<')
content = content.replace('>2,819<', '>0<')
content = content.replace('>7,441<', '>0<')

# =========================================================
# 7. FIX NAVIGATION - The main issue is that .page CSS 
#    must hide by default and show only .page.active
#    Let's check and ensure the CSS is correct
# =========================================================

# Check if .page has display:none and .page.active has display:block
has_page_hidden = '.page{display:none' in content.replace(' ', '') or '.page { display: none' in content
has_page_active = '.page.active{display:' in content.replace(' ', '') or '.page.active { display:' in content

print(f"Page hidden CSS found: {has_page_hidden}")
print(f"Page active CSS found: {has_page_active}")

# If not found, inject proper CSS
if not has_page_hidden or not has_page_active:
    # Find where to inject - look for </style> or the existing page CSS
    page_nav_css = """
    /* PAGE NAVIGATION - Critical for routing */
    .page { display: none !important; }
    .page.active { display: block !important; }
"""
    # Inject before closing </style>
    content = content.replace('</style>', page_nav_css + '\n    </style>', 1)
    print("Injected page navigation CSS")

# Also make sure the first page (dashboard) has the 'active' class
# The page-dashboard should be active by default
if 'id="page-dashboard"' in content and 'id="page-dashboard" class="page active"' not in content and 'class="page active" id="page-dashboard"' not in content:
    content = content.replace(
        'class="page" id="page-dashboard"',
        'class="page active" id="page-dashboard"'
    )
    print("Set page-dashboard as active by default")

# =========================================================
# 8. ZERO OUT remaining non-zero numbers in hero/live section
# =========================================================
# live-visitors counter should be 0
content = re.sub(r'id="live-visitors">[^<]+<', 'id="live-visitors">0<', content)

# Event counter if any
content = re.sub(r'id="event-counter">[^<]+<', 'id="event-counter">0<', content)

# =========================================================
# 9. FIX THE ICON STYLE to remove the circular blank icons in stat cards
#    The images show ugly empty circle SVGs - remove them
#    They are inside .stat-label as nested divs with class stat-icon
# =========================================================
# Already done in step 1, but also check stat-mini-icon inline SVG circles
# that look like empty rings
content = re.sub(r'<div class="stat-mini-icon">.*?</div>', '', content, flags=re.DOTALL)

# =========================================================
# 10. ZERO REMAINING: "% of all sessions" type values
# =========================================================
content = re.sub(r'(\d+\.?\d*)% of all sessions', '0% of all sessions', content)
content = re.sub(r'(\d+\.?\d*)% acceptance', '0% acceptance', content)

# Remove old hero action buttons that look like the reference image bad ones
# The reference shows "+ New Agent", "Connect Data", "Review Approval", "View Workspace", "Launch Demo"
# These appear to be in the hero/onboarding section - leave them (they're functional)

# =========================================================
# WRITE OUTPUT
# =========================================================
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! File saved.")
print("Final size:", len(content))
