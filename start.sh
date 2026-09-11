#!/usr/bin/env bash
echo "======================================================"
echo "   Starting Vendora Sovereign Offline System..."
echo "======================================================"
echo ""

if command -v node &> /dev/null; then
    echo "[OK] Node.js detected. Launching web server..."
    node scripts/serve.mjs
    exit 0
fi

if command -v python3 &> /dev/null; then
    echo "[OK] Python detected. Launching static web server..."
    if command -v open &> /dev/null; then
        open http://localhost:5173
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:5173
    fi
    python3 -m http.server 5173 --directory artifacts/orders-app/dist/public
    exit 0
fi

echo "[ERROR] Neither Node.js nor Python was found."
echo "Please install Node.js (https://nodejs.org) to run this application."
exit 1
