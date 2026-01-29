#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping all apps...${NC}"

# Stop backend
pkill -f "uvicorn server:app" 2>/dev/null || true
pkill -f "python -m uvicorn" 2>/dev/null || true

# Stop frontend
pkill -f "ng serve" 2>/dev/null || true
pkill -f "yarn start" 2>/dev/null || true

# Kill any process using ports 8001 and 3000
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

sleep 2

echo -e "${GREEN}All apps stopped!${NC}"
