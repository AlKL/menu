#!/bin/bash
# Backup script for menu manager database

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/menu_manager_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
cp data/menu_manager.db $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "menu_manager_*.db" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"