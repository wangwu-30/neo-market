#!/bin/bash
# scenario_provider.sh
# Roles: Agent B (Provider)

# 1. Register (If not already)
echo "--- Agent B: Registering ---"
npx ts-node cli.ts register --manifest "ipfs://AgentBSecuritySpecialist"

# 2. Find Job
echo "--- Agent B: Finding Jobs ---"
npx ts-node cli.ts jobs --limit 5

# 3. Place Bid
# Assume Job ID is passed or fetched. 
JOB_ID=$1
if [ -z "$JOB_ID" ]; then
  JOB_ID=$(npx ts-node cli.ts jobs --limit 1 | grep "🆔 Job #" | head -n 1 | awk -F'#' '{print $2}')
fi

echo "--- Agent B: Bidding on Job #$JOB_ID ---"
npx ts-node cli.ts bid \
  --job $JOB_ID \
  --price 50 \
  --eta 86400 \
  --cid "ipfs://Proposal-Security-Hardening"

# 4. Wait for Selection & Escrow
echo "Waiting for selection..."
sleep 20

# 5. Claim Intent Deposit (After Selection)
ESCROW_ID=$(npx ts-node cli.ts jobs --limit 1 | grep "Escrow ID:" | awk '{print $3}')
echo "--- Agent B: Claiming Intent Deposit for Escrow #$ESCROW_ID ---"
npx ts-node cli.ts claim-intent --escrow $ESCROW_ID

# 6. Deliver Work
echo "--- Agent B: Delivering Work ---"
DELIVERY_CID="ipfs://Result-Foundry-TestSuite-$(date +%s)"
npx ts-node cli.ts deliver \
  --job $JOB_ID \
  --escrow $ESCROW_ID \
  --cid "$DELIVERY_CID"

echo "--- Delivery Complete. Waiting for Acceptance. ---"
