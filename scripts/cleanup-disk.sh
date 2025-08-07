#!/bin/bash

echo "🧹 Emergency Disk Cleanup Script for CinemaHint Server"
echo "=================================================="

# Show current disk usage
echo "💾 Current disk usage:"
df -h

echo ""
echo "🛑 Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true

echo "🗑️ Removing all containers..."
docker rm $(docker ps -aq) 2>/dev/null || true

echo "🖼️ Removing all images..."
docker rmi $(docker images -q) 2>/dev/null || true

echo "📦 Removing all volumes..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true

echo "🌐 Removing all networks..."
docker network rm $(docker network ls -q) 2>/dev/null || true

echo "🏗️ Removing build cache..."
docker builder prune -af

echo "🧹 System-wide Docker cleanup..."
docker system prune -af --volumes

echo "📝 Cleaning logs..."
sudo rm -rf /var/log/*.log /var/log/*/*.log 2>/dev/null || true

echo "🗂️ Cleaning temporary files..."
sudo rm -rf /tmp/* /var/tmp/* 2>/dev/null || true

echo "📦 Cleaning package cache..."
sudo rm -rf ~/.npm /root/.npm 2>/dev/null || true
sudo apt-get clean 2>/dev/null || true
sudo rm -rf /var/lib/apt/lists/* 2>/dev/null || true

echo "🗄️ Cleaning old backup files..."
find ~/cinema-hint-server/backups/ -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true

echo ""
echo "✅ Cleanup completed!"
echo "💾 Disk usage after cleanup:"
df -h

echo ""
echo "📊 Available space on root partition:"
df -h / | awk 'NR==2 {print "Available: " $4 " (" $5 " used)"}'

echo ""
echo "🔄 You can now retry your deployment!"