async function check() {
  try {
    const res = await fetch("http://localhost:3000");
    const html = await res.text();
    console.log("HTML response status:", res.status);
    console.log("HTML length:", html.length);

    // CSS 링크 탐색
    const cssMatches = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map(m => m[1]);
    console.log("Found CSS links:", cssMatches);

    for (const link of cssMatches) {
      const url = link.startsWith("http") ? link : `http://localhost:3000${link}`;
      const cssRes = await fetch(url);
      const cssText = await cssRes.text();
      console.log(`\n=== Checking CSS: ${url} ===`);
      console.log("CSS Status:", cssRes.status, "Length:", cssText.length);
      console.log("Includes Tailwind utilities (bg-emerald-700):", cssText.includes("bg-emerald-700") || cssText.includes("background-color"));
      console.log("Includes whitespace-nowrap:", cssText.includes("whitespace-nowrap") || cssText.includes("white-space:nowrap") || cssText.includes("white-space: nowrap"));
      console.log("Includes stat-number:", cssText.includes("stat-number"));
      console.log("Includes rounded override:", cssText.includes("rounded"));
    }
  } catch (e) {
    console.error("Check failed:", e.message);
  }
}

check();
