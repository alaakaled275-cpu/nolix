import sys

with open(r'c:\Users\ALQ\Downloads\New folder (17)\opspulse-fixed (1).html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find the main frame div
frame_start = content.find('class="frame"')
print('Frame class found at:', frame_start)

# Find the topnav 
topnav_start = content.find('class="topnav"', frame_start)
topnav_start2 = content.find('topnav', frame_start)
print('Topnav at:', topnav_start, topnav_start2)

# Find main-grid
grid_start = content.find('main-grid', frame_start)
print('Main grid at:', grid_start)

# Find where hero starts
hero_start = content.find('hero-bg', frame_start)
print('Hero at:', hero_start)

# Dump key sections
markers = {
    'frame_start': frame_start,
    'topnav': topnav_start2,
    'grid': grid_start, 
    'hero': hero_start,
}

for name, pos in markers.items():
    if pos > 0:
        section = content[pos:pos+500]
        print(f'\n=== {name} (at {pos}) ===')
        print(section[:300])
