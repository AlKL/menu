# Docker Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- UberEats API credentials
- Discord bot token

## Setup Instructions

1. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your credentials:
   ```
   UBEREATS_STORE_ID=your_store_id
   UBEREATS_ACCESS_TOKEN=your_access_token
   DISCORD_BOT_TOKEN=your_bot_token
   ALLOWED_CHANNELS=channel_id1,channel_id2
   ```

2. **Build and start containers**
   ```bash
   docker-compose up -d --build
   ```

3. **View logs**
   ```bash
   # All services
   docker-compose logs -f

   # API only
   docker-compose logs -f menu-api

   # Bot only
   docker-compose logs -f discord-bot
   ```

4. **Stop services**
   ```bash
   docker-compose down
   ```

## Database Management

The Docker setup automatically:
1. Creates the initial database if it doesn't exist
2. Runs the migration to add drinks/toppings support
3. Persists data in the `./data` directory

### Manual database operations:
```bash
# Access the API container
docker exec -it ubereats-menu-api sh

# Run database setup
node scripts/setup-database.js

# Run migration
node scripts/migrate-to-drinks-toppings.js

# Test the new functionality
node scripts/test-drinks-toppings.js
```

## Updating the Application

1. **Pull latest changes**
   ```bash
   git pull
   ```

2. **Rebuild and restart**
   ```bash
   docker-compose up -d --build
   ```

The migration will run automatically on startup.

## Troubleshooting

### Database issues
- Check if `menu_manager.db` exists in the project root
- Ensure the `data` directory has proper permissions
- View migration logs: `docker-compose logs menu-api | grep -i migration`

### Connection issues
- Verify environment variables are set correctly
- Check if both containers are on the same network: `docker network inspect menu_menu-network`
- Test API health: `curl http://localhost:3001/health`

### Discord bot not responding
- Verify bot token is correct
- Check allowed channels configuration
- Ensure bot has proper permissions in Discord server