import { createClient, Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("환경변수 TURSO_DATABASE_URL이 설정되지 않았습니다.");
    }

    client = createClient({
      url,
      authToken,
    });
  }

  return client;
}
