import { createClient } from "@libsql/client";
import fs from "fs";

async function main() {
  const envContent = fs.readFileSync(".env.local", "utf8");
  const urlMatch = envContent.match(/TURSO_DATABASE_URL=([^\r\n]+)/);
  const tokenMatch = envContent.match(/TURSO_AUTH_TOKEN=([^\r\n]+)/);
  const url = urlMatch ? urlMatch[1].trim() : "";
  const authToken = tokenMatch ? tokenMatch[1].trim() : "";
  const client = createClient({ url, authToken });

  const schemaRes = await client.execute("PRAGMA table_info(customers)");
  console.log("--- customers table columns ---");
  console.table(schemaRes.rows);

  const addrSchema = await client.execute("PRAGMA table_info(customer_addresses)");
  console.log("--- customer_addresses table columns ---");
  console.table(addrSchema.rows);
}

main().catch(console.error);
