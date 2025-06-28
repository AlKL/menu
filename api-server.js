const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

class UberEatsMenuManager {
    constructor() {
        this.app = express();
        this.db = null;
        this.port = process.env.PORT || 3001;

        // UberEats API configuration
        this.uberEatsConfig = {
            baseURL: 'https://api.uber.com/v2/eats',
            storeId: process.env.UBEREATS_STORE_ID,
            accessToken: process.env.UBEREATS_ACCESS_TOKEN
        };

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // 86 an ingredient (remove from menu)
        this.app.post('/api/86', async (req, res) => {
            try {
                const { ingredient, user } = req.body;

                if (!ingredient) {
                    return res.status(400).json({ error: 'Ingredient is required' });
                }

                const affectedItems = await this.removeIngredientFromMenu(ingredient);

                // Log the action
                await this.logAction('86', ingredient, user, affectedItems);

                res.json({
                    success: true,
                    ingredient,
                    affectedItems,
                    message: `Successfully removed ${ingredient} from menu`
                });

            } catch (error) {
                console.error('86 endpoint error:', error);
                res.status(500).json({
                    error: 'Failed to remove ingredient from menu',
                    details: error.message
                });
            }
        });

        // Restore an ingredient
        this.app.post('/api/restore', async (req, res) => {
            try {
                const { ingredient, user } = req.body;

                if (!ingredient) {
                    return res.status(400).json({ error: 'Ingredient is required' });
                }

                const restoredItems = await this.restoreIngredientToMenu(ingredient);

                // Log the action
                await this.logAction('restore', ingredient, user, restoredItems);

                res.json({
                    success: true,
                    ingredient,
                    restoredItems,
                    message: `Successfully restored ${ingredient} to menu`
                });

            } catch (error) {
                console.error('Restore endpoint error:', error);
                res.status(500).json({
                    error: 'Failed to restore ingredient to menu',
                    details: error.message
                });
            }
        });

        // Get menu status
        this.app.get('/api/status', async (req, res) => {
            try {
                const { ingredient } = req.query;

                if (ingredient) {
                    const status = await this.getIngredientStatus(ingredient);
                    res.json(status);
                } else {
                    const overallStatus = await this.getOverallMenuStatus();
                    res.json(overallStatus);
                }

            } catch (error) {
                console.error('Status endpoint error:', error);
                res.status(500).json({
                    error: 'Failed to get menu status',
                    details: error.message
                });
            }
        });

        // Get available ingredients
        this.app.get('/api/ingredients', async (req, res) => {
            try {
                const ingredients = await this.getAvailableIngredients();
                res.json({ ingredients });

            } catch (error) {
                console.error('Ingredients endpoint error:', error);
                res.status(500).json({
                    error: 'Failed to get ingredients',
                    details: error.message
                });
            }
        });

        // Get drinks and toppings list
        this.app.get('/api/menu-items', async (req, res) => {
            try {
                const { type } = req.query;
                const items = await this.getMenuItems(type);
                res.json({ items });

            } catch (error) {
                console.error('Menu items endpoint error:', error);
                res.status(500).json({
                    error: 'Failed to get menu items',
                    details: error.message
                });
            }
        });

        // Admin route to sync menu from UberEats
        this.app.post('/api/admin/sync-menu', async (req, res) => {
            try {
                await this.syncMenuFromUberEats();
                res.json({ success: true, message: 'Menu synced successfully' });

            } catch (error) {
                console.error('Menu sync error:', error);
                res.status(500).json({
                    error: 'Failed to sync menu',
                    details: error.message
                });
            }
        });
    }

    async removeIngredientFromMenu(ingredient) {
        // Get all menu items (both drinks and toppings) that contain this ingredient
        const menuItems = await this.getMenuItemsByIngredient(ingredient);

        if (menuItems.length === 0) {
            throw new Error(`No menu items found containing "${ingredient}"`);
        }

        const affectedItems = {
            drinks: [],
            toppings: []
        };

        for (const item of menuItems) {
            try {
                // Update item availability via UberEats API
                await this.updateItemAvailability(item.uber_item_id, false);

                // Update local database
                await this.updateLocalItemStatus(item.uber_item_id, false);

                // Categorize affected items
                if (item.item_type === 'topping') {
                    affectedItems.toppings.push(item.name);
                } else {
                    affectedItems.drinks.push(item.name);
                }

                console.log(`✅ Removed "${item.name}" (${item.item_type}) from menu`);

            } catch (error) {
                console.error(`❌ Failed to remove "${item.name}":`, error.message);
                // Continue with other items even if one fails
            }
        }

        return affectedItems;
    }

    async restoreIngredientToMenu(ingredient) {
        const menuItems = await this.getMenuItemsByIngredient(ingredient);

        if (menuItems.length === 0) {
            throw new Error(`No menu items found containing "${ingredient}"`);
        }

        const restoredItems = {
            drinks: [],
            toppings: []
        };

        for (const item of menuItems) {
            try {
                // Update item availability via UberEats API
                await this.updateItemAvailability(item.uber_item_id, true);

                // Update local database
                await this.updateLocalItemStatus(item.uber_item_id, true);

                // Categorize restored items
                if (item.item_type === 'topping') {
                    restoredItems.toppings.push(item.name);
                } else {
                    restoredItems.drinks.push(item.name);
                }

                console.log(`✅ Restored "${item.name}" (${item.item_type}) to menu`);

            } catch (error) {
                console.error(`❌ Failed to restore "${item.name}":`, error.message);
            }
        }

        return restoredItems;
    }

    async updateItemAvailability(uberItemId, isAvailable) {
        // This would call the UberEats API to update item availability
        // For now, we'll simulate the API call

        const url = `${this.uberEatsConfig.baseURL}/stores/${this.uberEatsConfig.storeId}/menus/items`;

        const requestData = {
            item_id: uberItemId,
            suspension_info: isAvailable ? null : {
                reason: "OUT_OF_STOCK",
                suspended_until: null // Indefinite suspension
            }
        };

        try {
            const response = await axios.post(url, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.uberEatsConfig.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('UberEats API Error:', error.response.data);
                throw new Error(`UberEats API Error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`);
            }
            throw error;
        }
    }

    async getMenuItemsByIngredient(ingredient) {
        const query = `
            SELECT mi.*, i.name as ingredient_name
            FROM menu_items mi
            JOIN item_ingredients ii ON mi.id = ii.menu_item_id
            JOIN ingredients i ON ii.ingredient_id = i.id
            WHERE LOWER(i.name) = LOWER(?)
        `;

        return await this.db.all(query, [ingredient]);
    }

    async getMenuItems(type) {
        let query = 'SELECT * FROM menu_items';
        const params = [];

        if (type && ['drink', 'topping'].includes(type)) {
            query += ' WHERE item_type = ?';
            params.push(type);
        }

        query += ' ORDER BY name';

        return await this.db.all(query, params);
    }

    async getIngredientStatus(ingredient) {
        const menuItems = await this.getMenuItemsByIngredient(ingredient);

        const available = {
            drinks: [],
            toppings: []
        };
        const outOfStock = {
            drinks: [],
            toppings: []
        };

        menuItems.forEach(item => {
            const category = item.item_type === 'topping' ? 'toppings' : 'drinks';
            if (item.is_available) {
                available[category].push(item.name);
            } else {
                outOfStock[category].push(item.name);
            }
        });

        return { available, outOfStock };
    }

    async getOverallMenuStatus() {
        const query = `
            SELECT
                item_type,
                COUNT(*) as total_items,
                SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as available_count,
                SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END) as out_of_stock_count
            FROM menu_items
            GROUP BY item_type
        `;

        const results = await this.db.all(query);

        const status = {
            drinks: { total: 0, available: 0, outOfStock: 0 },
            toppings: { total: 0, available: 0, outOfStock: 0 }
        };

        results.forEach(row => {
            const type = row.item_type === 'topping' ? 'toppings' : 'drinks';
            status[type] = {
                total: row.total_items,
                available: row.available_count,
                outOfStock: row.out_of_stock_count
            };
        });

        return status;
    }

    async getAvailableIngredients() {
        const query = 'SELECT DISTINCT name FROM ingredients ORDER BY name';
        const rows = await this.db.all(query);
        return rows.map(row => row.name);
    }

    async updateLocalItemStatus(uberItemId, isAvailable) {
        const query = 'UPDATE menu_items SET is_available = ?, updated_at = ? WHERE uber_item_id = ?';
        await this.db.run(query, [isAvailable ? 1 : 0, new Date().toISOString(), uberItemId]);
    }

    async logAction(action, ingredient, user, affectedItems) {
        const query = `
            INSERT INTO action_logs (action, ingredient, user, affected_items, timestamp)
            VALUES (?, ?, ?, ?, ?)
        `;

        await this.db.run(query, [
            action,
            ingredient,
            user || 'unknown',
            JSON.stringify(affectedItems),
            new Date().toISOString()
        ]);
    }

    async syncMenuFromUberEats() {
        // This would fetch the current menu from UberEats and update local database
        // Placeholder for actual implementation
        console.log('Syncing menu from UberEats...');

        try {
            const url = `${this.uberEatsConfig.baseURL}/stores/${this.uberEatsConfig.storeId}/menus`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.uberEatsConfig.accessToken}`
                }
            });

            // Process and store menu data
            // In a real implementation, you would parse the response and:
            // 1. Identify drinks vs toppings based on category or other fields
            // 2. Update the database with proper item_type

            console.log('Menu sync completed');
            return response.data;

        } catch (error) {
            console.error('Menu sync failed:', error.message);
            throw error;
        }
    }

    async initializeDatabase() {
        this.db = await open({
            filename: './data/menu_manager.db',
            driver: sqlite3.Database
        });

        // Check if migration is needed
        const tableInfo = await this.db.all(`PRAGMA table_info(menu_items)`);
        const hasItemType = tableInfo.some(col => col.name === 'item_type');

        if (!hasItemType) {
            console.log('⚠️  Database needs migration. Please run: node scripts/migrate-to-drinks-toppings.js');
            console.log('Continuing with limited functionality...');
        }

        console.log('✅ Database connected');
    }

    async start() {
        try {
            await this.initializeDatabase();

            // Validate UberEats configuration
            if (!this.uberEatsConfig.storeId || !this.uberEatsConfig.accessToken) {
                console.warn('⚠️  UberEats API credentials not configured. Set UBEREATS_STORE_ID and UBEREATS_ACCESS_TOKEN environment variables.');
            }

            this.app.listen(this.port, () => {
                console.log(`🚀 Menu Manager API server running on port ${this.port}`);
                console.log(`📊 Health check: http://localhost:${this.port}/health`);
            });

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start the server
const menuManager = new UberEatsMenuManager();
menuManager.start();

module.exports = UberEatsMenuManager;