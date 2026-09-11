import pkg from 'pg';
const { Client } = pkg;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        customer_name TEXT,
        phone_number TEXT,
        item_name TEXT,
        quantity INTEGER,
        amount INTEGER,
        due_date TEXT,
        notes TEXT,
        raw_parsed JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ orders table created successfully');
    await client.end();
  } catch (error) {
    console.error('Migration error:', error.message);
    await client.end();
    process.exit(1);
  }
}

migrate();
