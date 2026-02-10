#!/bin/bash
# scenario_requester_v2.sh
# Agent A (Requester) - Uses the main Deployer/Owner key from .env

set -e
CLI="node dist/cli.js"

echo "--- 🟢 STEP 1: Requester Publishing Job ---"
$CLI publish --title "V2 Security Audit Alpha" --description "Audit the NeoBadge.sol for potential burn logic vulnerabilities." --budget 50

# Extract Job ID
JOB_ID=$($CLI jobs --limit 1 | grep "🆔 Job #" | head -n 1 | awk -F'#' '{print $2}' | xargs)
echo "✅ Job Created: #$JOB_ID"

echo "--- ⏳ Waiting for Agent Bid... ---"
# We wait here for the provider script to run in a separate step or manual delay
sleep 15

echo "--- 🟢 STEP 3: Selecting Bid ---"
# Assume the first bid is the one we want
BID_ID=1
$CLI select-bid --job $JOB_ID --bid $BID_ID

echo "--- 🟢 STEP 4: Locking SoW & Paying Intent ---"
# The CLI 'jobs' command needs to show Escrow ID. 
# For now, we'll assume Escrow ID corresponds to Job ID in this fresh run, 
# but let's try to fetch it if possible.
ESCROW_ID=$JOB_ID 

SOW_HASH="0x$(openssl rand -hex 32)"
$CLI set-sow --escrow $ESCROW_ID --sow $SOW_HASH
$CLI pay-intent --escrow $ESCROW_ID --amount 5

echo "--- ✅ Requester Phase 1 Complete. Awaiting Delivery. ---"
