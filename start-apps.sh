#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Life Management App - Startup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Kill any existing processes on ports 8001 and 3000
echo -e "${GREEN}Cleaning up existing processes...${NC}"
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Backend
echo -e "${GREEN}Starting Backend (FastAPI)...${NC}"
cd /app/backend
source /root/.venv/bin/activate
nohup python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${BLUE}Backend PID: $BACKEND_PID${NC}"
sleep 3

# Check if backend started successfully
if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend started successfully on http://localhost:8001${NC}"
    echo -e "${GREEN}  API Docs: http://localhost:8001/docs${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Check /tmp/backend.log for errors${NC}"
    tail -20 /tmp/backend.log
    exit 1
fi

echo ""

# Start Frontend
echo -e "${GREEN}Starting Frontend (Angular)...${NC}"
cd /app/frontend
export HOST=0.0.0.0
export PORT=3000
nohup yarn start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${BLUE}Frontend PID: $FRONTEND_PID${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Both apps are starting...${NC}"
echo ""
echo -e "${GREEN}Backend:${NC}  http://localhost:8001"
echo -e "${GREEN}Frontend:${NC} http://localhost:3000 (will be ready in ~30 seconds)"
echo -e "${GREEN}API Docs:${NC} http://localhost:8001/docs"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  Backend:  tail -f /tmp/backend.log"
echo -e "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo -e "${BLUE}To stop:${NC}"
echo -e "  kill $BACKEND_PID $FRONTEND_PID"
echo -e "  OR run: pkill -f uvicorn && pkill -f 'ng serve'"
echo -e "${BLUE}========================================${NC}"

# Wait a bit for frontend to compile
echo -e "${GREEN}Waiting for frontend to compile (this takes ~30 seconds)...${NC}"
sleep 30

if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running on http://localhost:3000${NC}"
else
    echo -e "${RED}Frontend may still be compiling. Check /tmp/frontend.log${NC}"
fi

echo ""
echo -e "${GREEN}Apps are ready! Press Ctrl+C to view logs (apps will keep running)${NC}"
