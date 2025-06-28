// scripts/setup-database.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function setupDatabase() {
    console.log('🔧 Setting up database with sample data...');

    const db = await open({
        filename: './menu_manager.db',
        driver: sqlite3.Database
    });

    try {
        // First, create the tables if they don't exist
        console.log('🏗️  Creating database tables...');
        await db.exec(`
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uber_item_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                is_available BOOLEAN DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS item_ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                menu_item_id INTEGER,
                ingredient_id INTEGER,
                FOREIGN KEY (menu_item_id) REFERENCES menu_items (id),
                FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
            );

            CREATE TABLE IF NOT EXISTS action_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                ingredient TEXT NOT NULL,
                user TEXT,
                affected_items TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database tables created successfully!');

        // Sample ingredients for bubble tea shop
        const ingredients = [
            'tapioca', 'boba', 'popping boba', 'jelly', 'pudding',
            'taro', 'matcha', 'thai tea', 'jasmine tea', 'oolong',
            'brown sugar', 'honey', 'almond', 'coconut'
        ];

        // Sample menu items (you'll need to replace with your actual UberEats item IDs)
        const menuItems = [
            { uber_item_id: 'item_001', name: 'Classic Milk Tea with Tapioca' },
            { uber_item_id: 'item_002', name: 'Taro Milk Tea with Boba' },
            { uber_item_id: 'item_003', name: 'Thai Tea Latte with Jelly' },
            { uber_item_id: 'item_004', name: 'Matcha Latte with Pudding' },
            { uber_item_id: 'item_005', name: 'Brown Sugar Milk Tea with Tapioca' },
            { uber_item_id: 'item_006', name: 'Jasmine Green Tea with Popping Boba' },
            { uber_item_id: 'item_007', name: 'Coconut Milk Tea with Jelly' },
            { uber_item_id: 'item_008', name: 'Oolong Tea with Honey and Boba' },
            { uber_item_id: 'item_009', name: 'Almond Milk Tea with Pudding' },
            { uber_item_id: 'item_010', name: 'Add Tapioca Topping' },
            { uber_item_id: 'item_011', name: 'Add Boba Topping' },
            { uber_item_id: 'item_012', name: 'Add Jelly Topping' },
            { uber_item_id: 'item_013', name: 'Add Pudding Topping' },
            { uber_item_id: 'item_014', name: 'Add Popping Boba Topping' }
        ];

        // Insert ingredients
        console.log('📝 Adding ingredients...');
        for (const ingredient of ingredients) {
            await db.run(
                'INSERT OR IGNORE INTO ingredients (name) VALUES (?)',
                [ingredient]
            );
        }

        // Insert menu items
        console.log('🍽️  Adding menu items...');
        for (const item of menuItems) {
            await db.run(
                'INSERT OR IGNORE INTO menu_items (uber_item_id, name, is_available) VALUES (?, ?, ?)',
                [item.uber_item_id, item.name, 1]
            );
        }

        // Create ingredient mappings (which items contain which ingredients)
        console.log('🔗 Creating ingredient mappings...');

        const mappings = [
            // Drinks with tapioca
            { itemName: 'Classic Milk Tea with Tapioca', ingredients: ['tapioca'] },
            { itemName: 'Brown Sugar Milk Tea with Tapioca', ingredients: ['tapioca', 'brown sugar'] },
            { itemName: 'Add Tapioca Topping', ingredients: ['tapioca'] },

            // Drinks with boba
            { itemName: 'Taro Milk Tea with Boba', ingredients: ['boba', 'taro'] },
            { itemName: 'Oolong Tea with Honey and Boba', ingredients: ['boba', 'honey', 'oolong'] },
            { itemName: 'Add Boba Topping', ingredients: ['boba'] },

            // Drinks with jelly
            { itemName: 'Thai Tea Latte with Jelly', ingredients: ['jelly', 'thai tea'] },
            { itemName: 'Coconut Milk Tea with Jelly', ingredients: ['jelly', 'coconut'] },
            { itemName: 'Add Jelly Topping', ingredients: ['jelly'] },

            // Drinks with pudding
            { itemName: 'Matcha Latte with Pudding', ingredients: ['pudding', 'matcha'] },
            { itemName: 'Almond Milk Tea with Pudding', ingredients: ['pudding', 'almond'] },
            { itemName: 'Add Pudding Topping', ingredients: ['pudding'] },

            // Drinks with popping boba
            { itemName: 'Jasmine Green Tea with Popping Boba', ingredients: ['popping boba', 'jasmine tea'] },
            { itemName: 'Add Popping Boba Topping', ingredients: ['popping boba'] }
        ];

        for (const mapping of mappings) {
            // Get menu item ID
            const menuItem = await db.get(
                'SELECT id FROM menu_items WHERE name = ?',
                [mapping.itemName]
            );

            if (menuItem) {
                for (const ingredientName of mapping.ingredients) {
                    // Get ingredient ID
                    const ingredient = await db.get(
                        'SELECT id FROM ingredients WHERE name = ?',
                        [ingredientName]
                    );

                    if (ingredient) {
                        await db.run(
                            'INSERT OR IGNORE INTO item_ingredients (menu_item_id, ingredient_id) VALUES (?, ?)',
                            [menuItem.id, ingredient.id]
                        );
                    }
                }
            }
        }

        console.log('✅ Database setup completed successfully!');
        console.log('\n📊 Summary:');

        const ingredientCount = await db.get('SELECT COUNT(*) as count FROM ingredients');
        const itemCount = await db.get('SELECT COUNT(*) as count FROM menu_items');
        const mappingCount = await db.get('SELECT COUNT(*) as count FROM item_ingredients');

        console.log(`   • ${ingredientCount.count} ingredients added`);
        console.log(`   • ${itemCount.count} menu items added`);
        console.log(`   • ${mappingCount.count} ingredient mappings created`);

        console.log('\n🚀 Next steps:');
        console.log('   1. Update the uber_item_id values in menu_items table with your actual UberEats item IDs');
        console.log('   2. Set up your environment variables (.env file)');
        console.log('   3. Get your UberEats API credentials');
        console.log('   4. Create your Discord bot and get the token');
        console.log('   5. Run: docker-compose up -d');

    } catch (error) {
        console.error('❌ Database setup failed:', error);
    } finally {
        await db.close();
    }
}

// Helper function to display current database contents
async function showDatabaseContents() {
    const db = await open({
        filename: './menu_manager.db',
        driver: sqlite3.Database
    });

    console.log('\n📋 Current Database Contents:');

    console.log('\n🥤 Ingredients:');
    const ingredients = await db.all('SELECT * FROM ingredients ORDER BY name');
    ingredients.forEach(ing => console.log(`   • ${ing.name}`));

    console.log('\n🍽️  Menu Items:');
    const items = await db.all('SELECT * FROM menu_items ORDER BY name');
    items.forEach(item => console.log(`   • ${item.name} (${item.uber_item_id}) - ${item.is_available ? 'Available' : 'Out of Stock'}`));

    console.log('\n🔗 Ingredient Mappings:');
    const mappings = await db.all(`
        SELECT mi.name as item_name, i.name as ingredient_name
        FROM item_ingredients ii
        JOIN menu_items mi ON ii.menu_item_id = mi.id
        JOIN ingredients i ON ii.ingredient_id = i.id
        ORDER BY mi.name, i.name
    `);

    let currentItem = '';
    mappings.forEach(mapping => {
        if (mapping.item_name !== currentItem) {
            console.log(`   • ${mapping.item_name}:`);
            currentItem = mapping.item_name;
        }
        console.log(`     - ${mapping.ingredient_name}`);
    });

    await db.close();
}

// Run the setup
if (require.main === module) {
    const command = process.argv[2];

    if (command === 'show') {
        showDatabaseContents();
    } else {
        setupDatabase();
    }
}

module.exports = { setupDatabase, showDatabaseContents };