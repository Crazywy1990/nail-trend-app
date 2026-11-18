#!/usr/bin/env bash
# Opens catalog batch $BATCH as a PR, built on the current main from the catalog-staging drafts.
set -euo pipefail
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch -q origin main catalog-staging
git checkout -q -B "catalog-batch-$BATCH" origin/main
git checkout origin/catalog-staging -- catalog-staging
git reset -q
export DRAFT_BRANCH="catalog-batch-$BATCH"
python services/discovery/batch.py promote "$BATCH"
if [ ! -f pr-body.md ]; then echo "No batch $BATCH; done."; exit 0; fi
git add assets/looks apps/web/public/looks apps/web/lib/engine/looks.json services/pipeline/trend_terms.json services/api/app/seed/looks.json
git commit -m "$(cat pr-title.txt)"
git push -f origin "catalog-batch-$BATCH"
gh pr create --base main --head "catalog-batch-$BATCH" --title "$(cat pr-title.txt)" --body-file pr-body.md
