import re

file_path = 'opspulse-fixed (1).html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make all stats 0
classes_to_zero = ['balance-amount', 'w-amount', 'lm-val', 'stat-mini-val', 'stat-amount', 'em-val', 'var-cr', 'alert-sum-num', 'weight-val', 'discount-tag']

for cls in classes_to_zero:
    content = re.sub(rf'(<div[^>]*class=\"[^\"]*\b{cls}\b[^\"]*\"[^>]*>)\s*[\$\€\£\+]?[0-9,]+(\.[0-9]+)?%?\s*(<\/div>)', rf'\g<1>0\g<3>', content)
    content = re.sub(rf'(<span[^>]*class=\"[^\"]*\b{cls}\b[^\"]*\"[^>]*>)\s*[\$\€\£\+]?[0-9,]+(\.[0-9]+)?%?\s*(<\/span>)', rf'\g<1>0\g<3>', content)

# Special cases
content = content.replace('$689,372.00', '$0.00')
content = content.replace('1,247', '0')
content = content.replace('34%', '0%')
content = content.replace('8.4%', '0.0%')
content = content.replace('892', '0')
content = content.replace('$22,678.00', '$0.00')
content = content.replace('€18,345.00', '€0.00')
content = content.replace('£15,000.00', '£0.00')
content = content.replace('$1,400.00 spent', '$0.00 spent')
content = content.replace('374 / 1,247', '0 / 0')
content = content.replace('62%', '0%')
content = content.replace('78%', '0%')
content = content.replace('95% Used', '0% Used')
content = content.replace('$9,500 / $10,000 used', '$0 / $10,000 used')
content = content.replace('14.2%', '0.0%')
content = content.replace('5,891', '0')
content = content.replace('+$12.4K', '$0')
content = content.replace('14.8%', '0.0%')
content = content.replace('$8.2K', '$0')
content = content.replace('+34%', '0%')
content = content.replace('$18,320.30', '$0.00')
content = content.replace('$231,388.25', '$0.00')
content = content.replace('$1,248,542.75', '$0.00')
content = content.replace('$249,708.55', '$0.00')
content = content.replace('$401,189.75', '$0.00')
content = content.replace('$80,237.95', '$0.00')
content = content.replace('$233,481.22', '$0.00')
content = content.replace('$46,696.24', '$0.00')
content = content.replace('$177,266.91', '$0.00')
content = content.replace('$35,453.38', '$0.00')
content = content.replace('$122,368.44', '$0.00')
content = content.replace('$24,473.69', '$0.00')
content = content.replace('$94,871.21', '$0.00')
content = content.replace('$18,974.24', '$0.00')
content = content.replace('$950', '$0')
content = content.replace('$700', '$0')
content = content.replace('$1,050', '$0')
content = content.replace('$850', '$0')

# Additional replacements to ensure everything is zeroed out
content = re.sub(r'Total Earnings<div[^>]*>.*?</div></div>\s*<div[^>]*>[\$\€\£\+]?[0-9,\.]+</div>', 'Total Earnings<div class="stat-icon"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/><polyline points="4,6 6,8 9,4.5"/></svg></div></div>\n              <div class="stat-amount">$0</div>', content)

# Replace table values to 0
content = re.sub(r'\$[0-9,]+(\.[0-9]+)?', '$0.00', content)

# JS Modifications
content = re.sub(r'const profit = \[.*\];', 'const profit = [0,0,0,0,0,0,0,0];', content)
content = re.sub(r'const loss = \[.*\];', 'const loss = [0,0,0,0,0,0,0,0];', content)
content = re.sub(r'const vals = \[([0-9\.\,]+)\];', 'const vals = [0,0,0,0,0,0,0];', content)
content = content.replace("el.textContent = (1247 + Math.floor(Math.random()*20) - 8).toLocaleString();", "el.textContent = '0';")

# 7 Days Free Trial before the script in onboarding
content = content.replace('<div class="ob-code-wrap">', '<div style="font-size:12px;font-weight:700;color:var(--accent-green);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">7 Days Free Trial</div>\n        <div class="ob-code-wrap">')

# Modify JS sparklines to zeroes
content = re.sub(r'vals:\[.*?\]', 'vals:[0,0,0,0,0,0,0,0,0,0]', content)

# Modify genVisitors to show no results instead of generating 10 random elements
empty_table_js = """function genVisitors() {
  const tbody = document.getElementById('visitors-table');
  if (!tbody) return;
  tbody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No results</div>';
}"""
content = re.sub(r'function genVisitors\(\)\s*\{[\s\S]*?\}', empty_table_js, content)

# Empty heatmap
empty_heatmap_js = """function genHeatmap() {
  const el = document.getElementById('page-heatmap');
  if (!el) return;
  el.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No results</div>';
}"""
content = re.sub(r'function genHeatmap\(\)\s*\{[\s\S]*?\}', empty_heatmap_js, content)

# Modify addFeedItem to do nothing
content = content.replace('function addFeedItem() {', 'function addFeedItem() {\n  return;\n')

# Mobile & iPad complete responsiveness fixes
# Ensure .ob-platform-grid, .dash-main-grid, etc., are perfectly responsive
css_responsive_fixes = """
    /* MOBILE RESPONSIVE OVERRIDES EXTENDED */
    @media (max-width: 768px) {
      .hero-actions { display: grid; grid-template-columns: 1fr 1fr; width: calc(100% - 40px); gap: 10px; left: 20px; bottom: 72px; }
      .action-btn { justify-content: center; width: 100%; }
      .launch-btn { position: relative; width: calc(100% - 40px); left: 20px; bottom: 20px; right: auto; margin-top: 20px; display: block; text-align: center; }
      
      .stat-grid-3 { grid-template-columns: 1fr !important; }
      .dash-main-grid { grid-template-columns: 1fr !important; }
      .live-metric { min-width: 100% !important; }
      .tbl { display: block; overflow-x: auto; white-space: nowrap; }
      
      .kpi-row { grid-template-columns: 1fr !important; }
      .alerts-summary { grid-template-columns: 1fr 1fr !important; }
      .exp-variants { grid-template-columns: 1fr !important; }
      .pricing-grid { grid-template-columns: 1fr !important; }
      .calib-grid { grid-template-columns: 1fr !important; }
      .conv-control-grid { grid-template-columns: 1fr !important; }
      .ai-mode-selector { grid-template-columns: 1fr !important; }
      .wallet-items { flex-direction: column; }
      
      .nav-right { padding-left: 0; }
      .nav-icons { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 5px; }
    }
    @media (max-width: 600px) {
      .live-bar { flex-direction: column; }
      .btn-row { flex-direction: column; }
    }
"""
content = content.replace('/* MOBILE RESPONSIVE OVERRIDES */', css_responsive_fixes + '\n    /* MOBILE RESPONSIVE OVERRIDES */')

# Make Icons Distinctive (Glassmorphism + Neon Shadow like the requested reference)
# Usually, icons can be made distinct with gradient backgrounds, soft borders, and colored drop shadows.
css_icon_fixes = """
    /* DISTINCTIVE ICONS */
    .stat-mini-icon, .stat-icon, .live-metric-icon, .dr-icon, .ob-card-icon, .int-logo {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
      overflow: hidden;
    }
    
    [data-theme="dark"] .stat-mini-icon, [data-theme="dark"] .stat-icon, [data-theme="dark"] .live-metric-icon, [data-theme="dark"] .dr-icon, [data-theme="dark"] .ob-card-icon, [data-theme="dark"] .int-logo {
      background: rgba(20, 20, 25, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    
    .live-metric-icon[style*="background:#e8f5e9"] { background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%) !important; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important; border: none; }
    .live-metric-icon[style*="background:#e8f5e9"] svg { stroke: white !important; }
    
    .live-metric-icon[style*="background:#fff3e0"] { background: linear-gradient(135deg, #ff9800 0%, #e65100 100%) !important; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3) !important; border: none; }
    .live-metric-icon[style*="background:#fff3e0"] svg { stroke: white !important; }
    
    .live-metric-icon[style*="background:#e3f2fd"] { background: linear-gradient(135deg, #2196f3 0%, #1565c0 100%) !important; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3) !important; border: none; }
    .live-metric-icon[style*="background:#e3f2fd"] svg { stroke: white !important; }
    
    .live-metric-icon[style*="background:#f3e5f5"] { background: linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%) !important; box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3) !important; border: none; }
    .live-metric-icon[style*="background:#f3e5f5"] svg { stroke: white !important; }

    .live-metric-icon[style*="background:rgba(224,69,69,0.1)"] { background: linear-gradient(135deg, #f44336 0%, #c62828 100%) !important; box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3) !important; border: none; }
    .live-metric-icon[style*="background:rgba(224,69,69,0.1)"] svg { stroke: white !important; }
"""
content = content.replace('/* CARD BASE */', css_icon_fixes + '\n    /* CARD BASE */')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
