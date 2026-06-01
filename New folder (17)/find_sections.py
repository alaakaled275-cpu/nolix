import re

with open('opspulse-fixed (1).html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line numbers for the sections to remove
sections = [
    'Total Spending',
    'Total Revenue',
    'Total Income',
    'Session & Behavior Overview',
    'Total Balance',
    'Monthly Spending Limit',
    'My Cards',
    'Total Earnings',
    'Wallets',
    'AI Quick Actions',
]

for section in sections:
    for i, line in enumerate(lines):
        if section in line:
            print(f"Line {i+1}: [{section}] => {line.strip()[:120]}")
