#!/usr/bin/env python3
"""
Merge human-coded findings into the objective_findings table.

For each human finding:
1. Map doc interview ID → DB UUID
2. Check if an LLM finding exists with same interview + objective + category
   and similar excerpt (>40% word overlap) → mark as 'both'
3. Otherwise insert as source='human'

Prerequisites:
- Run migration 0011_add_finding_source.sql first
- Files: parsed-human-findings.json, doc-to-db-mapping.json
"""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse
import psycopg2
from psycopg2.extras import execute_values

ROOT = Path(__file__).parent.parent

# ── Load data ──
findings_data = json.loads((ROOT / 'parsed-human-findings.json').read_text())
findings = findings_data['findings']
mapping = json.loads((ROOT / 'doc-to-db-mapping.json').read_text())

print(f'Loaded {len(findings)} human findings, {len(mapping)} interview mappings')

# ── Connect to DB ──
env_path = ROOT / '.env.local'
db_url = None
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line.startswith('DATABASE_URL=') and 'DIRECT' not in line:
        db_url = line.split('=', 1)[1].strip()
        break

parsed = urlparse(db_url)
clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))

conn = psycopg2.connect(clean_url, sslmode='require')
conn.autocommit = False
cur = conn.cursor()

# ── Fetch existing LLM findings for similarity matching ──
print('Fetching existing LLM findings...')
cur.execute("""
    SELECT id, interview_id, objective, category, label, excerpt
    FROM objective_findings
    WHERE source = 'llm'
""")
existing = cur.fetchall()
print(f'  Found {len(existing)} existing LLM findings')

# Index by (interview_id, objective, category) for fast lookup
from collections import defaultdict
existing_index = defaultdict(list)
for row in existing:
    key = (row[1], row[2], row[3])  # interview_id, objective, category
    existing_index[key].append({
        'id': row[0],
        'label': row[4] or '',
        'excerpt': (row[5] or '').lower(),
    })


def word_overlap(text_a, text_b):
    """Calculate word overlap ratio between two texts."""
    if not text_a or not text_b:
        return 0.0
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    # Jaccard-like: overlap relative to the smaller set
    return len(intersection) / min(len(words_a), len(words_b))


# ── Process findings ──
matched_both = 0
inserted_human = 0
skipped_no_mapping = 0
skipped_no_category = 0

# Track which LLM findings we've already matched to avoid double-matching
matched_llm_ids = set()

# Collect rows to insert in bulk
human_inserts = []
both_updates = []

for f in findings:
    doc_code = f['interview_id']
    uuid = mapping.get(doc_code)
    if not uuid:
        skipped_no_mapping += 1
        continue

    category = f.get('category')
    if not category or category not in ('facilitator', 'barrier'):
        skipped_no_category += 1
        continue

    objective = f.get('objective')
    if not objective or objective not in ('objective_1', 'objective_2', 'objective_3'):
        continue

    excerpt = (f.get('excerpt') or '').strip()
    theme = (f.get('theme') or '').strip()
    label = theme if theme else (excerpt[:80] + '...' if len(excerpt) > 80 else excerpt)
    if not label:
        continue

    # Try to match with an existing LLM finding
    key = (uuid, objective, category)
    candidates = existing_index.get(key, [])

    best_match = None
    best_overlap = 0.0

    for cand in candidates:
        if cand['id'] in matched_llm_ids:
            continue
        overlap = word_overlap(excerpt, cand['excerpt'])
        if overlap > best_overlap:
            best_overlap = overlap
            best_match = cand

    if best_match and best_overlap >= 0.40:
        # Match found — mark as 'both'
        both_updates.append(best_match['id'])
        matched_llm_ids.add(best_match['id'])
        matched_both += 1
    else:
        # No match — insert as 'human'
        human_inserts.append((
            uuid,       # interview_id
            objective,  # objective
            category,   # category
            label,      # label
            excerpt if excerpt else None,  # excerpt
            None,       # rationale
            None,       # timestamps
            'human',    # source
        ))
        inserted_human += 1

# ── Execute DB operations ──
print(f'\nMerge plan:')
print(f'  Matched (both): {matched_both}')
print(f'  New (human): {inserted_human}')
print(f'  Skipped (no mapping): {skipped_no_mapping}')
print(f'  Skipped (no category): {skipped_no_category}')

# Confirm before proceeding
response = input('\nProceed with merge? (y/n): ').strip().lower()
if response != 'y':
    print('Aborted.')
    conn.close()
    sys.exit(0)

try:
    # Update matched findings to 'both'
    if both_updates:
        cur.execute(
            "UPDATE objective_findings SET source = 'both' WHERE id = ANY(%s::uuid[])",
            (both_updates,)
        )
        print(f'  ✓ Updated {len(both_updates)} findings to source=both')

    # Insert new human findings
    if human_inserts:
        execute_values(
            cur,
            """INSERT INTO objective_findings
               (interview_id, objective, category, label, excerpt, rationale, timestamps, source)
               VALUES %s""",
            human_inserts,
        )
        print(f'  ✓ Inserted {len(human_inserts)} human findings')

    # Clear existing cluster assignments for re-clustering
    cur.execute("UPDATE objective_findings SET cluster_id = NULL")
    cur.execute("DELETE FROM objective_clusters")
    cur.execute("DELETE FROM objective_cluster_runs")
    print(f'  ✓ Cleared existing clusters (re-cluster from UI)')

    conn.commit()
    print(f'\n✅ Merge complete!')
    print(f'   Total findings now in DB: run a count to verify.')
    print(f'   Next: re-cluster from the Analysis page in the app.')

except Exception as e:
    conn.rollback()
    print(f'\n❌ Error: {e}')
    raise
finally:
    conn.close()
