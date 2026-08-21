#!/bin/bash
# Author: Gemini
# OS support: Web/Node
# Description: Script to deploy app to Synology NAS

NAS_USER="xuanhung"
NAS_IP="192.168.20.250"
NAS_PATH="/volume1/web/DDT_webapp"

echo "Deploying to $NAS_USER@$NAS_IP:$NAS_PATH..."

# Sync files (excluding node_modules, .git, and build artifacts)
rsync -avz --exclude 'node_modules' \
           --exclude '.git' \
           --exclude 'dist' \
           --exclude '.env.local' \
           -e "ssh -p 22" \
           ./ $NAS_USER@$NAS_IP:$NAS_PATH

# Run docker-compose on NAS
echo "Restarting Docker containers on NAS..."
ssh -p 22 $NAS_USER@$NAS_IP "cd $NAS_PATH && docker-compose down && docker-compose build --no-cache && docker-compose up -d"

echo "Deploy completed!"
