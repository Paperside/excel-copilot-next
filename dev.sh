#!/bin/bash

# Excel Copilot - Development Startup Script
# This script starts all services in development mode

echo "🚀 Starting Excel Copilot Development Environment..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dependencies are installed
if ! command -v uv &> /dev/null; then
    echo "${YELLOW}⚠️  uv not found. Installing...${NC}"
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "${YELLOW}⚠️  pnpm not found. Please install it first${NC}"
    echo "   npm install -g pnpm"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    cp .env.example .env
    echo "${YELLOW}   Please edit .env and fill in required values${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start Python Executor
echo "${GREEN}Starting Python Executor...${NC}"
cd python-executor
uv run python src/main.py &
PYTHON_PID=$!
cd ..

# Wait for Python executor to be ready
echo "Waiting for Python Executor to start..."
sleep 3

# Start Backend
echo "${GREEN}Starting Backend...${NC}"
cd backend
pnpm dev &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "Waiting for Backend to start..."
sleep 3

# Start Frontend
echo "${GREEN}Starting Frontend...${NC}"
cd frontend
pnpm dev &
FRONTEND_PID=$!
cd ..

# Print status
echo ""
echo "${GREEN}✓ All services started!${NC}"
echo ""
echo "Services:"
echo "  - Python Executor: http://localhost:8000"
echo "  - Backend API:     http://localhost:4000"
echo "  - Frontend:        http://localhost:3000"
echo "  - Health Check:    http://localhost:4000/api/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background jobs
wait
