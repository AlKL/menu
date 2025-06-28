const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function migrateDatabase() {
    const db = await open({
        filename: path.join(__dirname, '..', 'data', 'menu_manager.db'),
        driver: sqlite3.Database
    });

    console.log('Starting database migration for drinks and toppings support...');

    try {
        // Start transaction
        await db.exec('BEGIN TRANSACTION');

        // Add type column to menu_items to distinguish between drinks and toppings
        console.log('Adding item_type column to menu_items...');
        await db.exec(`
            ALTER TABLE menu_items 
            ADD COLUMN item_type TEXT DEFAULT 'drink' 
            CHECK (item_type IN ('drink', 'topping'))
        `);

        // Create a new table for topping relationships
        console.log('Creating drink_toppings table...');
        await db.exec(`
            CREATE TABLE IF NOT EXISTS drink_toppings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drink_id INTEGER NOT NULL,
                topping_id INTEGER NOT NULL,
                is_default BOOLEAN DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (drink_id) REFERENCES menu_items (id),
                FOREIGN KEY (topping_id) REFERENCES menu_items (id),
                UNIQUE(drink_id, topping_id)
            )
        `);

        // Add indexes for better performance
        console.log('Creating indexes...');
        await db.exec(`
            CREATE INDEX IF NOT EXISTS idx_menu_items_type ON menu_items(item_type);
            CREATE INDEX IF NOT EXISTS idx_menu_items_uber_id ON menu_items(uber_item_id);
            CREATE INDEX IF NOT EXISTS idx_drink_toppings_drink ON drink_toppings(drink_id);
            CREATE INDEX IF NOT EXISTS idx_drink_toppings_topping ON drink_toppings(topping_id);
        `);

        // Update existing menu items to set them as drinks by default
        console.log('Setting existing items as drinks...');
        await db.exec(`
            UPDATE menu_items 
            SET item_type = 'drink' 
            WHERE item_type IS NULL
        `);

        // Create a view for easier querying
        console.log('Creating helpful views...');
        await db.exec(`
            CREATE VIEW IF NOT EXISTS drinks_view AS
            SELECT * FROM menu_items WHERE item_type = 'drink';
            
            CREATE VIEW IF NOT EXISTS toppings_view AS
            SELECT * FROM menu_items WHERE item_type = 'topping';
            
            CREATE VIEW IF NOT EXISTS drink_topping_relationships AS
            SELECT 
                d.id as drink_id,
                d.name as drink_name,
                d.uber_item_id as drink_uber_id,
                t.id as topping_id,
                t.name as topping_name,
                t.uber_item_id as topping_uber_id,
                dt.is_default
            FROM drink_toppings dt
            JOIN menu_items d ON dt.drink_id = d.id
            JOIN menu_items t ON dt.topping_id = t.id;
        `);

        // Commit transaction
        await db.exec('COMMIT');
        console.log('Migration completed successfully!');

        // Display the new schema
        console.log('\nNew database schema:');
        const tables = await db.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        
        for (const table of tables) {
            console.log(`\n=== ${table.name} ===`);
            const schema = await db.all(`PRAGMA table_info(${table.name})`);
            schema.forEach(col => {
                console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
            });
        }

    } catch (error) {
        console.error('Migration failed:', error);
        await db.exec('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

// Add some sample toppings data
async function addSampleToppings() {
    const db = await open({
        filename: path.join(__dirname, '..', 'data', 'menu_manager.db'),
        driver: sqlite3.Database
    });

    console.log('\nAdding sample topping data...');

    try {
        // Add common bubble tea toppings
        const toppings = [
            { name: 'Pearls', uber_id: 'topping_pearls_001' },
            { name: 'Crystal Boba', uber_id: 'topping_crystal_002' },
            { name: 'Popping Boba', uber_id: 'topping_popping_003' },
            { name: 'Aloe Vera', uber_id: 'topping_aloe_004' },
            { name: 'Grass Jelly', uber_id: 'topping_grass_005' },
            { name: 'Pudding', uber_id: 'topping_pudding_006' },
            { name: 'Red Bean', uber_id: 'topping_redbean_007' },
            { name: 'Coconut Jelly', uber_id: 'topping_coconut_008' }
        ];

        for (const topping of toppings) {
            await db.run(`
                INSERT OR IGNORE INTO menu_items (uber_item_id, name, item_type, is_available)
                VALUES (?, ?, 'topping', 1)
            `, [topping.uber_id, topping.name]);

            // Also add the topping as an ingredient if it doesn't exist
            await db.run(`
                INSERT OR IGNORE INTO ingredients (name)
                VALUES (?)
            `, [topping.name.toLowerCase()]);
        }

        // Link toppings to their ingredients
        const toppingItems = await db.all(`SELECT id, name FROM menu_items WHERE item_type = 'topping'`);
        for (const item of toppingItems) {
            const ingredient = await db.get(`SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?)`, [item.name]);
            if (ingredient) {
                await db.run(`
                    INSERT OR IGNORE INTO item_ingredients (menu_item_id, ingredient_id)
                    VALUES (?, ?)
                `, [item.id, ingredient.id]);
            }
        }

        console.log('Sample toppings added successfully!');

    } catch (error) {
        console.error('Failed to add sample toppings:', error);
    } finally {
        await db.close();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateDatabase()
        .then(() => addSampleToppings())
        .catch(console.error);
}

module.exports = { migrateDatabase };