#!/bin/bash
# scenario_accept_v2.sh
# Agent A (Requester) - Finalizing

set -e
CLI="node dist/cli.js"
ESCROW_ID=${1:-1}

echo "--- 🟢 STEP 6: Requester Accepting Delivery ---"
$CLI accept --escrow $ESCROW_ID

echo "--- 🏅 Checking Badges ---"
$CLI badges

echo "--- 🎉 V2 Alpha End-to-End Success! ---"
