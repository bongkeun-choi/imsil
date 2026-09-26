async function runTest() {
  console.log("=== 1. 주문 생성 테스트 ===");
  const orderRes = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "김옥자",
      phone: "010-9876-5432",
      address: "전북 임실군 임실읍 봉황로 123",
      shipping_date: "2026-09-26",
      items: [
        { product_id: 1, product_name: "절임배추 10kg", quantity: 1, unit_price: 38000, weight_kg: 10 },
        { product_id: 2, product_name: "절임배추 20kg", quantity: 1, unit_price: 68000, weight_kg: 20 }
      ],
      payment_status: "UNPAID",
      memo: "오후 배송 부탁드립니다."
    })
  });
  const orderData = await orderRes.json();
  console.log("주문 생성 결과:", orderData);

  console.log("\n=== 2. 대시보드 조회 테스트 ===");
  const dashRes = await fetch("http://localhost:3000/api/dashboard?date=2026-09-26");
  const dashData = await dashRes.json();
  console.log("대시보드 요약:", dashData.summary);
  console.log("주문 목록 수:", dashData.orders.length);

  console.log("\n=== 3. 고객 자동검색 테스트 (전화번호 뒷자리 5432) ===");
  const custRes = await fetch("http://localhost:3000/api/customers?q=5432");
  const custData = await custRes.json();
  console.log("고객 검색 결과:", custData.customers?.map(c => `${c.name} (${c.phone})`));

  console.log("\n=== 4. 원클릭 입금완료 처리 테스트 ===");
  if (orderData.orderId) {
    const payRes = await fetch(`http://localhost:3000/api/orders/${orderData.orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid" })
    });
    const payData = await payRes.json();
    console.log("입금 처리 결과:", payData);
  }

  console.log("\n=== 모든 핵심 비즈니스 로직 테스트 완료! ===");
}

runTest().catch(console.error);
