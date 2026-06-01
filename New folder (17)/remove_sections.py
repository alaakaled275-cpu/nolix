with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

# =========================================================
# 1. Remove LEFT COL entirely (Total Balance + Wallets + 
#    Monthly Spending Limit + My Cards + AI Quick Actions)
#    Lines 1350-1411
# =========================================================
left_col_start = '''        <!-- LEFT COL -->
        <div style="display:flex;flex-direction:column;gap:12px;">'''

left_col_end = '''        </div>

        <!-- RIGHT COL -->'''

# Find and remove from left_col_start to left_col_end
idx_start = content.find(left_col_start)
idx_end = content.find(left_col_end)

if idx_start > -1 and idx_end > -1:
    content = content[:idx_start] + '\n        <!-- RIGHT COL -->' + content[idx_end + len(left_col_end):]
    print("LEFT COL removed (Total Balance, Wallets, My Cards, AI Quick Actions)")
else:
    print("WARNING: left col not found")
    print("start found:", idx_start)
    print("end found:", idx_end)

# =========================================================
# 2. Remove the 3-column stat grid (Total Earnings, Total Spending,
#    Total Income, Total Revenue, Income Chart)
#    + the activities card + Session & Behavior Overview
# =========================================================

# Remove the stat grid (lines 1415-1448)
stat_grid_block = '''          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div class="stat-card earnings">
              <div class="stat-label">Total Earnings</div>
              <div class="stat-amount">$0.00</div>
              <div style="display:flex;align-items:center;gap:4px;"><span class="stat-badge badge-up-white">↑ 0%</span><span class="stat-period">This month</span></div>
            </div>
            <div class="stat-card spending">
              <div class="stat-label">Total Spending</div>
              <div class="stat-amount">0</div>
              <div style="display:flex;align-items:center;gap:4px;"><span class="stat-badge badge-down-red">↓ 0%</span><span class="stat-period" style="color:var(--text-muted);">This month</span></div>
            </div>'''

if stat_grid_block in content:
    # Find opening of the grid div and closing after all 4 stat cards + income chart
    start = content.find(stat_grid_block)
    # Find closing </div> of the grid (after Revenue card)
    revenue_end = content.find('</div>\n\n          <div class="activities-card">', start)
    if revenue_end > -1:
        content = content[:start] + content[revenue_end + len('</div>\n\n          <div class="activities-card">'):]
        print("Stat grid removed (Total Earnings/Spending/Income/Revenue)")
    else:
        print("WARNING: stat grid end not found")
else:
    print("WARNING: stat grid start not found")

# =========================================================
# 3. Remove Session & Behavior Overview card
# =========================================================
session_card = '''          <!-- SESSION OVERVIEW -->
          <div class="card">
            <div class="section-header"><div class="section-title">Session &amp; Behavior Overview</div><span style="font-size:10px;color:var(--text-muted);"><span class="live-dot"></span>Live</span></div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
              <div style="text-align:center;padding:12px;background:var(--surface-hover);border-radius:10px;border:0.5px solid var(--border);">
                <div style="font-size:18px;font-weight:700;color:var(--text-primary);font-family:var(--font-display);">0m 0s</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:3px;font-weight:500;text-transform:uppercase;letter-spacing:0.3px;">Avg Time on Page</div>
              </div>
              <div style="text-align:center;padding:12px;background:var(--surface-hover);border-radius:10px;border:0.5px solid var(--border);">
                <div style="font-size:18px;font-weight:700;color:var(--text-primary);font-family:var(--font-display);">0%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:3px;font-weight:500;text-transform:uppercase;letter-spacing:0.3px;">Avg Scroll Depth</div>
              </div>
              <div style="text-align:center;padding:12px;background:var(--accent-purple-bg);border-radius:10px;border:0.5px solid rgba(124,58,237,0.1);">
                <div style="font-size:18px;font-weight:700;color:var(--accent-purple);font-family:var(--font-display);">0</div>
                <div style="font-size:10px;color:var(--accent-purple);margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Revenue Leak Risk</div>
              </div>
              <div style="text-align:center;padding:12px;background:var(--accent-green-bg);border-radius:10px;border:0.5px solid rgba(61,168,95,0.12);">
                <div style="font-size:18px;font-weight:700;color:var(--accent-green);font-family:var(--font-display);">0%</div>
                <div style="font-size:10px;color:var(--accent-green);margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Offer Acceptance</div>
              </div>
            </div>
          </div>'''

if session_card in content:
    content = content.replace(session_card, '')
    print("Session & Behavior Overview removed")
else:
    print("WARNING: session card not found (may have different whitespace)")

with open('opspulse-fixed (1).html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
