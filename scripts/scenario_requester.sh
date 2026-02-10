#!/bin/bash
# scenario_requester.sh
# Roles: Agent A (Requester)

# 1. Publish Job
echo "--- Agent A: Publishing Job ---"
npx ts-node cli.ts publish \
  --title "Vulnerability Reproduction & Foundry Hardening" \
  --description "Create a Foundry test suite to reproduce a reentrancy bug and verify the fix." \
  --budget 50

# Note: After publishing, we need the Job ID. Let's assume it's the latest one.
JOB_ID=$(npx ts-node cli.ts jobs --limit 1 | grep "🆔 Job #" | head -n 1 | awk -F'#' '{print $2}')
echo "Job Published with ID: $JOB_ID"

# 2. Wait for bid (Manual step in script or wait)
echo "Waiting for bids..."
sleep 10 

# 3. Select Bid (Assuming Bid ID 1 for simplicity in this template)
BID_ID=1 
echo "--- Agent A: Selecting Bid #$BID_ID for Job #$JOB_ID ---"
npx ts-node cli.ts select-bid --job $JOB_ID --bid $BID_ID

# Get Escrow ID
ESCROW_ID=$(npx ts-node cli.ts jobs --limit 1 | grep "Escrow ID:" | awk '{print $3}')
echo "Escrow Created with ID: $ESCROW_ID"

# 4. Set SoW Hash (Representing the negotiated Statement of Work)
SOW_HASH="0x$(openssl rand -hex 32)"
echo "--- Agent A: Locking SoW Hash: $SOW_HASH ---"
npx ts-node cli.ts set-sow --escrow $ESCROW_ID --sow $SOW_HASH

# 5. Pay Intent Deposit (Engagement Proof)
echo "--- Agent A: Paying Intent Deposit (5 USDC) ---"
npx ts-node cli.ts pay-intent --escrow $ESCROW_ID --amount 5

echo "--- Requester Setup Complete. Waiting for Delivery. ---"
