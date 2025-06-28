const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function testDrinksToppings() {
    const db = await open({
        filename: path.join(__dirname, '..', 'menu_manager.db'),
        driver: sqlite3.Database
    });

    console.log('=== Testing Drinks and Toppings Database Structure ===\n');

    try {
        // First, let's add Pearl Milk Tea as a drink that contains pearls
        console.log('1. Adding Pearl Milk Tea drink...');
        await db.run(`
            INSERT OR IGNORE INTO menu_items (uber_item_id, name, item_type, is_available)
            VALUES ('drink_pearl_milk_tea_001', 'Pearl Milk Tea', 'drink', 1)
        `);

        // Get the Pearl Milk Tea ID
        const pearlMilkTea = await db.get(`SELECT id FROM menu_items WHERE uber_item_id = 'drink_pearl_milk_tea_001'`);
        
        // Get ingredient IDs
        const pearlsIngredient = await db.get(`SELECT id FROM ingredients WHERE LOWER(name) = 'pearls'`);
        const milkTeaIngredient = await db.get(`SELECT id FROM ingredients WHERE LOWER(name) = 'milk tea'`);

        // Link Pearl Milk Tea to its ingredients
        if (pearlMilkTea && pearlsIngredient) {
            await db.run(`
                INSERT OR IGNORE INTO item_ingredients (menu_item_id, ingredient_id)
                VALUES (?, ?)
            `, [pearlMilkTea.id, pearlsIngredient.id]);
        }

        if (pearlMilkTea && milkTeaIngredient) {
            await db.run(`
                INSERT OR IGNORE INTO item_ingredients (menu_item_id, ingredient_id)
                VALUES (?, ?)
            `, [pearlMilkTea.id, milkTeaIngredient.id]);
        }

        console.log('✅ Pearl Milk Tea added with pearls and milk tea ingredients\n');

        // 2. Show all items containing pearls
        console.log('2. All items containing "pearls" ingredient:');
        const pearlItems = await db.all(`
            SELECT mi.name, mi.item_type, mi.is_available, mi.uber_item_id
            FROM menu_items mi
            JOIN item_ingredients ii ON mi.id = ii.menu_item_id
            JOIN ingredients i ON ii.ingredient_id = i.id
            WHERE LOWER(i.name) = 'pearls'
        `);

        console.table(pearlItems);

        // 3. Simulate removing pearls (86 pearls)
        console.log('\n3. Simulating "86 pearls" - marking all pearl items as unavailable:');
        await db.run(`
            UPDATE menu_items 
            SET is_available = 0, updated_at = datetime('now')
            WHERE id IN (
                SELECT mi.id
                FROM menu_items mi
                JOIN item_ingredients ii ON mi.id = ii.menu_item_id
                JOIN ingredients i ON ii.ingredient_id = i.id
                WHERE LOWER(i.name) = 'pearls'
            )
        `);

        // Show affected items
        const affectedItems = await db.all(`
            SELECT name, item_type 
            FROM menu_items 
            WHERE is_available = 0 AND id IN (
                SELECT mi.id
                FROM menu_items mi
                JOIN item_ingredients ii ON mi.id = ii.menu_item_id
                JOIN ingredients i ON ii.ingredient_id = i.id
                WHERE LOWER(i.name) = 'pearls'
            )
        `);

        console.log('Affected items:');
        affectedItems.forEach(item => {
            console.log(`  - ${item.name} (${item.item_type})`);
        });

        // 4. Show current menu status
        console.log('\n4. Current Menu Status:');
        const status = await db.all(`
            SELECT 
                item_type,
                COUNT(*) as total,
                SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END) as out_of_stock
            FROM menu_items
            GROUP BY item_type
        `);

        console.table(status);

        // 5. Restore pearls
        console.log('\n5. Restoring pearls - marking all pearl items as available:');
        await db.run(`
            UPDATE menu_items 
            SET is_available = 1, updated_at = datetime('now')
            WHERE id IN (
                SELECT mi.id
                FROM menu_items mi
                JOIN item_ingredients ii ON mi.id = ii.menu_item_id
                JOIN ingredients i ON ii.ingredient_id = i.id
                WHERE LOWER(i.name) = 'pearls'
            )
        `);

        console.log('✅ All pearl items restored!\n');

        // 6. Show drinks with toppings relationships (if any exist)
        console.log('6. Drink-Topping Relationships:');
        const relationships = await db.all(`
            SELECT 
                d.name as drink_name,
                t.name as topping_name,
                dt.is_default
            FROM drink_toppings dt
            JOIN menu_items d ON dt.drink_id = d.id
            JOIN menu_items t ON dt.topping_id = t.id
        `);

        if (relationships.length > 0) {
            console.table(relationships);
        } else {
            console.log('No drink-topping relationships defined yet.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await db.close();
    }
}

// Run test if called directly
if (require.main === module) {
    testDrinksToppings().catch(console.error);
}

module.exports = { testDrinksToppings };