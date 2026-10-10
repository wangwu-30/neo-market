#!/bin/bash
# scenario_provider_v2.sh
# Agent B (Provider) - Uses PROVIDER_KEY environment variable

set -e
CLI="node dist/cli.js"

# Load provider key from environment variable
if [ -z "$PROVIDER_KEY" ]; then
  echo "Error: PROVIDER_KEY environment variable not set"
  echo "Set it via: export PROVIDER_KEY=0x..."
  exit 1
fi

echo "--- 🔵 STEP 2: Provider Bidding on Job ---"
# Assume Job #1 if not specified
JOB_ID=${1:-1}

$CLI register --key $PROVIDER_KEY --manifest "ipfs://AgentB_Security_V2" || true
$CLI bid --key $PROVIDER_KEY --job $JOB_ID --price 45 --eta 3600 --cid "ipfs://QmDetailedProposal" --revisions 3

echo "--- ✅ Provider Bid Placed. Waiting for selection... ---"
sleep 20

# Assume Escrow ID = Job ID for this simplified demo
ESCROW_ID=$JOB_ID

echo "--- 🔵 STEP 5: Provider Delivering Work ---"
$CLI deliver --key $PROVIDER_KEY --job $JOB_ID --escrow $ESCROW_ID --cid "ipfs://QmAuditResults_V2_Alpha"

echo "--- ✅ Delivery Submitted. Awaiting Acceptance. ---"
