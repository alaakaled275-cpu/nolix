import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

print("=== KEY CHANGES VERIFIED ===")
print("7 Days Free Trial present:", "7 Days Free Trial" in content)
print("No results (visitors) present:", "No results" in content)
print("Live visitors = 0:", "textContent = '0'" in content)
print("Profit bars zeroed:", "const profit = [0,0,0,0,0,0,0,0]" in content)
print("Loss bars zeroed:", "const loss = [0,0,0,0,0,0,0,0]" in content)
print("Sparklines zeroed:", "vals:[0,0,0,0,0,0,0,0,0,0]" in content)
print("genVisitors returns empty:", "return;" in content)
print("Mobile media query extended:", "@media (max-width: 768px)" in content)
print("Distinctive icons CSS added:", "DISTINCTIVE ICONS" in content)
print("---")

# Check for non-zero amounts remaining
non_zero = re.findall(r'\$[1-9][0-9,]+\.[0-9]+', content)
# Filter out code/API key examples
non_zero_display = [v for v in non_zero if v not in ["$100.00"]][:15]
print("Remaining large dollar amounts:", non_zero_display[:10])

# File size
import os
size = os.path.getsize('opspulse-fixed (1).html')
print(f"File size: {size:,} bytes")
