const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  if (!process.env.TURSO_CONNECTION_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing Turso environment variables. Make sure they are defined in .env.local!");
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      x REAL NOT NULL,
      z REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Table 'messages' initialized successfully!");
}

main().catch(console.error);