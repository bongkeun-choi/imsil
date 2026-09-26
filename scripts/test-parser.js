const fs = require('fs');
const ts = require('typescript');
const code = fs.readFileSync('src/lib/orderParser.ts', 'utf8');
const js = ts.transpile(code);
const exp = {};
const fn = new Function('exports', js);
fn(exp);

const testCases = [
  '전주시 완산구 고사동 303 - 3으로 배추 10키로 2박스 보내주세요 얼마인가요? 010-6615-776 최봉근입니',
  '사장님 안녕하세요 11월 18일에 20키로 3박스 부탁합니다 홍길동 010-1234-5678 서울시 종로구 삼청로 12-3',
  '절임배추 10키로 하나요 010-9999-8888 이순신입니다 주소 전남 여수시 돌산읍 돌산로 100',
  '받는사람: 강감찬 010 5555 4444 경기도 파주시 문산읍 통일로 5 20kg 두박스 11/25'
];

testCases.forEach((tc, i) => {
  console.log(`\n--- Test Case ${i + 1} ---`);
  console.log('Input:', tc);
  const res = exp.parseOrderText(tc);
  console.log('Name:', res.customer_name);
  console.log('Phone:', res.customer_phone);
  console.log('Address:', res.shipping_address);
  console.log('Date:', res.shipping_date);
  console.log('Items:', res.items);
});
