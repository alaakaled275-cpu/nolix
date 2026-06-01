"""
scripts/seed-training-data.py
Generates 200 synthetic labeled sessions for RandomForest training.
Run: python scripts/seed-training-data.py
"""
import random, uuid, subprocess, sys

def gen():
    rows = []
    for _ in range(200):
        sid = str(uuid.uuid4())
        t   = random.randint(5, 180)
        sd  = random.randint(0, 100)
        cl  = random.randint(0, 15)
        hes = round(random.uniform(0, 1), 2)
        eng = round(random.uniform(0, 1), 2)
        cart = random.choice(['unknown','viewed','added','checkout'])
        dev  = random.choice(['desktop','mobile','tablet'])
        ret  = random.choice(['true','false'])
        intent = random.randint(0, 100)
        cart_score = {'checkout':1.0,'added':0.6,'viewed':0.3,'unknown':0.0}[cart]
        click_rate = cl / max(t, 1)
        p_conv = (cart_score*0.4 + eng*0.3 + (1-hes)*0.2 + click_rate*2*0.1)
        converted = 'true' if (p_conv + random.gauss(0, 0.15)) > 0.55 else 'false'
        grp = 'control' if random.random() < 0.3 else 'treatment'
        rev = round(random.uniform(50, 500), 2) if converted == 'true' else 0
        rows.append(
            f"INSERT INTO popup_sessions (session_id,time_on_site,scroll_depth_pct,"
            f"cta_hover_count,hesitation_score,engagement_score,cart_status,device,"
            f"return_visitor,intent_score,converted,order_value,group_assignment,store_domain) "
            f"VALUES ('{sid}',{t},{sd},{cl},{hes},{eng},'{cart}','{dev}',"
            f"{ret},{intent},{converted},{rev},'{grp}','demo.store') ON CONFLICT DO NOTHING;"
        )
    return '\n'.join(rows)

sql = gen()
print(f"Generated {sql.count('INSERT')} rows")

# Pipe into docker
proc = subprocess.run(
    ['docker','exec','-i','support-postgres','psql','-U','support','-d','support'],
    input=sql.encode(), capture_output=True
)
out = proc.stdout.decode() + proc.stderr.decode()
if 'INSERT' in out or 'NOTICE' in out or proc.returncode == 0:
    print("Seed OK")
else:
    print("Seed output:", out[:500])
    sys.exit(1)

# Verify
proc2 = subprocess.run(
    ['docker','exec','support-postgres','psql','-U','support','-d','support',
     '-c', 'SELECT COUNT(*) as sessions, SUM(converted::int) as converted FROM popup_sessions'],
    capture_output=True
)
print("Verification:", proc2.stdout.decode().strip())
