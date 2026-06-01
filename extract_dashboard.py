with open(r'c:\Users\ALQ\Downloads\New folder (17)\opspulse-fixed (1).html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find full frame section
frame_idx = content.find('class="frame"')
# go back to find the opening div tag
frame_open = content.rfind('<div', 0, frame_idx)

# Find closing of the body
body_close = content.rfind('</body>')

# Extract the full dashboard section (frame to body close)
dashboard_html = content[frame_open:body_close]

# Remove onboarding overlay - it's before frame_open anyway
# Also remove the <script> tags at the end
script_start = dashboard_html.rfind('<script')
if script_start > 0:
    dashboard_html = dashboard_html[:script_start]

# Remove the closing </div> that corresponds to the frame wrapper
# (we'll add it back in JSX)

print(f'Dashboard HTML extracted: {len(dashboard_html)} chars')
print('\n=== FIRST 1500 chars ===')
print(dashboard_html[:1500])
print('\n=== LAST 500 chars ===')
print(dashboard_html[-500:])
