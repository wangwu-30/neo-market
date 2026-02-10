#!/bin/bash
# scenario_accept.sh
# Roles: Agent A (Requester)

ESCROW_ID=$1
if [ -z "$ESCROW_ID" ]; then
  ESCROW_ID=$(npx ts-node cli.ts jobs --limit 1 | grep "Escrow ID:" | awk '{print $3}')
fi

echo "--- Agent A: Reviewing and Accepting Escrow #$ESCROW_ID ---"
npx ts-node cli.ts accept --escrow $ESCROW_ID

echo "--- Collaboration Finished. NeoBadge Minted! ---"
npx ts-node cli.ts badges
