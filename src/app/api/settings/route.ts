import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute("SELECT key, value FROM settings");
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key as string] = (row.value as string) || "";
    }

    // 상품 단가도 함께 조회
    const productsResult = await db.execute(
      "SELECT id, name, weight_kg, price FROM products WHERE active = 1 ORDER BY weight_kg ASC"
    );

    return NextResponse.json({
      success: true,
      settings,
      products: productsResult.rows,
    });
  } catch (error) {
    console.error("설정 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "설정 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();

    if (body.settings && typeof body.settings === "object") {
      for (const [key, value] of Object.entries(body.settings)) {
        await db.execute({
          sql: `INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          args: [key, String(value)],
        });
      }
    }

    // 상품 단가 수정이 있는 경우
    if (body.products && Array.isArray(body.products)) {
      for (const p of body.products) {
        if (p.id && p.price) {
          await db.execute({
            sql: "UPDATE products SET price = ?, updated_at = ? WHERE id = ?",
            args: [Number(p.price), new Date().toISOString(), Number(p.id)],
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "설정이 저장되었습니다." });
  } catch (error) {
    console.error("설정 저장 실패:", error);
    return NextResponse.json(
      { success: false, error: "설정 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
