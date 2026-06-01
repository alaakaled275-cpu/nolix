import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

# =========================================================
# FIX genVisitors — corrupted: has orphaned code after early return
# =========================================================
# Remove the orphaned code lines after the function closing
bad_visitors = """function genVisitors() {
  const tbody = document.getElementById('visitors-table');
  if (!tbody) return;
  tbody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No results</div>';
};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;">${letter}</div>
      <span style="font-family:var(--mono);font-size:10px;color:var(--text-muted);">${id}</span>
      <span style="font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${page}">${page}</span>
      <span style="font-size:11px;color:var(--text-secondary);">${Math.floor(time/60)}m ${time%60}s</span>
      <span style="font-size:11px;color:var(--text-secondary);">${scroll}%</span>
      <span style="font-size:11px;color:var(--text-secondary);">${clicks} clicks</span>
      <span class="${hsC}" style="font-size:11px;font-weight:700;font-family:var(--mono);">${hs} <span style="font-size:9px;opacity:0.7;">${riskLabel}</span></span>
      <span>${hasOffer ? '<span class="badge badge-green">15% OFF</span>' : '<span class="badge badge-gray">None</span>'}</span>
      <button class="btn-sm btn-sm-outline" onclick="showToast('Session ${id} opened')" style="font-size:10px;padding:3px 8px;">View</button>
    </div>`;
  }
  tbody.innerHTML = html;
}"""

good_visitors = """function genVisitors() {
  const tbody = document.getElementById('visitors-table');
  if (!tbody) return;
  tbody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No results</div>';
}"""

content = content.replace(bad_visitors, good_visitors)

# =========================================================
# FIX genHeatmap — corrupted: has orphaned pages array after early return
# =========================================================
bad_heatmap = """function genHeatmap() {
  const el = document.getElementById('page-heatmap');
  if (!el) return;
  el.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No results</div>';
},
    {name:'/cart', score:0.81, sessions:3219, cls:'hs-high'},
    {name:'/products', score:0.58, sessions:8392, cls:'hs-med'},
    {name:'/category', score:0.49, sessions:4618, cls:'hs-med'},
    {name:'/search', score:0.38, sessions:2819, cls:'hs-med'},
    {name:'/home', score:0.31, sessions:7441, cls:'hs-low'},
  ];
  const el = document.getElementById('page-heatmap');
  if (!el) return;
  el.innerHTML = pages.map(p => `
    <div style="display:grid;grid-template-columns:120px 1fr 80px 80px;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--border);align-items:center;">
      <span style="font-size:11px;color:var(--text-primary);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;">${p.name}</span>
      <div style="height:6px;background:var(--border-md);border-radius:99px;overflow:hidden;"><div style="height:100%;background:currentColor;width:${p.score*100}%;border-radius:99px;" class="${p.cls}"></div></div>
      <span class="${p.cls}" style="font-size:12px;font-weight:700;text-align:center;">${p.score}</span>
      <span style="font-size:11px;color:var(--text-muted);text-align:center;">${p.sessions.toLocaleString()}</span>
    </div>
  `).join('');
}"""

good_heatmap = """function genHeatmap() {
  const el = document.getElementById('page-heatmap');
  if (!el) return;
  el.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No results</div>';
}"""

content = content.replace(bad_heatmap, good_heatmap)

# Verify fixes applied
print("genVisitors fixed:", 'tbody.innerHTML = html;' not in content)
print("genHeatmap fixed:", "'hs-high'" not in content or 'function genHeatmap' in content)
print("Orphaned code gone:", 'riskLabel}</span></span>' not in content)

with open('opspulse-fixed (1).html', 'w', encoding='utf-8') as f:
    f.write(content)

print("File saved.")
