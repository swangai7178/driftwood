import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// GET: Retrieve all messages
export async function GET() {
  const result = await client.execute("SELECT * FROM messages ORDER BY id DESC LIMIT 50");
  return NextResponse.json(result.rows);
}

// POST: Seal a new message
export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    const x = (Math.random() - 0.5) * 8;
    const z = (Math.random() - 0.5) * 8;

    await client.execute({
      sql: "INSERT INTO messages (content, x, z) VALUES (?, ?, ?)",
      args: [content, x, z],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to cast message" }, { status: 500 });
  }
}