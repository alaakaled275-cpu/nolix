import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Increase gap for dash-main-grid
content = content.replace(
    '<div class="dash-main-grid" style="display:flex;flex-direction:column;gap:14px;">',
    '<div class="dash-main-grid" style="display:flex;flex-direction:column;gap:24px;">'
)

# 2. Hero Banner padding and spacing
content = content.replace(
    '<div class="card" style="padding: 24px; background: linear-gradient(135deg, var(--surface-solid) 0%, var(--surface-hover) 100%); border: 1px solid var(--border-md);">',
    '<div class="card" style="padding: 32px 40px; background: linear-gradient(135deg, var(--surface-solid) 0%, var(--surface-hover) 100%); border: 1px solid var(--border-md); border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.02);">'
)
content = content.replace(
    '<div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 20px;">Net Incremental Revenue',
    '<div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 28px;">Net Incremental Revenue'
)
content = content.replace('padding-right: 16px;', 'padding-right: 24px;')
content = content.replace('padding: 0 16px;', 'padding: 0 24px;')
content = content.replace('padding-left: 16px;', 'padding-left: 24px;')
content = content.replace('font-size: 32px;', 'font-size: 36px;') # Make numbers slightly larger

# 3. KPI Cards grid gap
content = content.replace(
    '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">',
    '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;">'
)
content = content.replace('padding: 20px;', 'padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);')
content = content.replace('font-size: 26px;', 'font-size: 30px;')

# 4. Charts & Engine Grid gap
content = content.replace(
    '<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px;">',
    '<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">'
)
content = content.replace(
    '<!-- LEFT: LINE CHART -->\n          <div class="card" style="display:flex; flex-direction:column;">',
    '<!-- LEFT: LINE CHART -->\n          <div class="card" style="display:flex; flex-direction:column; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">'
)
content = content.replace(
    '<!-- RIGHT: DONUT & ENGINE -->\n          <div style="display: flex; flex-direction: column; gap: 14px;">',
    '<!-- RIGHT: DONUT & ENGINE -->\n          <div style="display: flex; flex-direction: column; gap: 24px;">'
)

# 5. Fix card styling inside Right Column
content = content.replace(
    '<div class="card" style="flex: 1;">',
    '<div class="card" style="flex: 1; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">'
)

# 6. Live Decision Feed
content = content.replace(
    '<!-- 4. LIVE DECISION FEED -->\n        <div class="card" style="padding: 0; overflow: hidden;">',
    '<!-- 4. LIVE DECISION FEED -->\n        <div class="card" style="padding: 0; overflow: hidden; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.02);">'
)
content = content.replace(
    'padding: 16px 20px;',
    'padding: 20px 32px;'
)
content = content.replace(
    'padding: 12px 20px;',
    'padding: 16px 32px;'
)

# Make badges in the feed look better (more padding, softer corners)
content = content.replace(
    'padding: 4px 8px;',
    'padding: 6px 12px; border-radius: 20px;'
)

with open('opspulse-fixed (1).html', 'w', encoding='utf-8') as f:
    f.write(content)

print("UI improved with more space, rounded corners, and soft shadows.")
