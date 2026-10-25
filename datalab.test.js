// Unit tests for the data lab: parsers, normaliser, analytics, backtest, reviews, prices, xlsx.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), D = require("../datalab.js");
const day = s => new Date(D.date(s)).toISOString().slice(0, 10);

test("money formats", () => {
  assert.equal(D.money("Rs. 1,499/-"), 1499); assert.equal(D.money("₹2,99,999.50"), 299999.5); assert.equal(D.money("1.2k"), 1200);
  assert.equal(D.money("2 lakh"), 200000); assert.equal(D.money("(1,299)"), -1299); assert.ok(isNaN(D.money("free")));
});
test("date formats, day first", () => {
  assert.equal(day("05/10/2026"), "2026-10-05"); assert.equal(day("10/25/2026"), "2026-10-25"); assert.equal(day("2026-10-05"), "2026-10-05");
  assert.equal(day("12 Oct 2026"), "2026-10-12"); assert.equal(day("46300"), "2026-10-05"); assert.equal(D.date("soon"), null);
});
test("csv: delimiter, quotes, blank rows, mapping, normalising", () => {
  const p = D.parseCSV('Order Date;Product Name;Sold By;Amount Paid;MRP;Rating;Status\n05/10/2026;"Earbuds; black";BoomStore;"₹2,999";7999;4.1;Delivered\n06/10/2026;Charger;VoltCo;Rs 499;;4.4;Returned\n;;;;;;\n07/10/2026;Mystery;X;free;;;\n08/10/2026;Kurta;LoomCo;1.2k;1500;9;\n');
  assert.equal(p.delimiter, ";"); assert.equal(p.rows.length, 4); assert.equal(p.rows[0][1], "Earbuds; black");
  const n = D.normalize(p, D.mapColumns(p.headers));
  assert.equal(n.recs.length, 3); assert.deepEqual(n.recs.map(r => r.cat), ["Electronics", "Electronics", "Fashion"]); assert.deepEqual(n.issues.map(i => i.field), ["price", "rating"]); assert.equal(n.quality, 75);
});
test("csv: escaped quotes and newlines inside cells", () => assert.deepEqual(D.parseCSV('a,b\n"x""y","line1\nline2"\n').rows[0], ['x"y', "line1\nline2"]));
test("analysis: outliers and duplicates", () => {
  const r = (t, p, d) => ({ title: t, price: p, cat: "Electronics", seller: "S", ts: Date.UTC(2026, 9, d) });
  const A = D.analyse([1, 2, 3, 4, 5, 6].map(i => r("Item" + i, 500 + i * 10, i)).concat([r("Charger 65W", 48000, 9), r("Item1", 510, 3)]));
  assert.deepEqual(A.outliers.map(o => o.title), ["Charger 65W"]); assert.deepEqual(A.dups.map(o => o.title), ["Item1"]);
});
test("backtest: daily cap, repeat guard, block mode", () => {
  const r = (t, p, c, d) => ({ title: t, price: p, cat: c, seller: "S", ts: Date.UTC(2026, 9, d) });
  const B = D.backtest([r("A", 5000, "Dining", 1), r("B", 3000, "Dining", 1), r("C", 5000, "Dining", 3), r("A", 900, "Dining", 4)], { mode: { Dining: "auto" }, budget: 6000, daily: 6000 });
  assert.deepEqual([B.allowed, B.held], [2, 2]); assert.equal(D.backtest([r("Z", 100, "Travel", 1)], { mode: { Travel: "block" } }).blocked, 1);
});
test("reviews: copies, mismatch, short, bursts", () => {
  const v = D.reviews(D.parseReviews("5|Great product, loved it a lot\n5|Great product loved it a lot!!!\n1|Broke after two days, waste of money\n4|WORST thing ever, got a refund\n5|ok"));
  assert.ok(v.flags[1].some(f => /Near copy/.test(f))); assert.ok(v.flags[3].some(f => /does not match/.test(f))); assert.deepEqual(v.flags[4], ["Very short"]);
  const b = D.reviews(Array.from({ length: 10 }, (_, i) => ({ rating: 5, ts: Date.UTC(2026, 9, 1) + i * 3e6, text: "Excellent quality, really worth buying " + i + " now" })));
  assert.ok(b.burst && b.reasons.length >= 2);
});
test("prices: verdict, fake discount, too short", () => {
  assert.equal(D.prices([4799, 4899, 4799, 4999, 4799, 4799, 4850], 6499, 12999).verdict, "Pricey right now");
  assert.match(D.prices(Array(30).fill(6400), 6499, 9999).notes.join(), /not real/); assert.equal(D.prices([1, 2], 1), null);
  assert.deepEqual(D.series("2026-10-01,4799\n2026-10-02,4899\n2026-10-03,4799"), [4799, 4899, 4799]);
});
test("xlsx: reads a real workbook without libraries", async () => {
  const b = fs.readFileSync(path.join(__dirname, "fixtures", "orders.xlsx")), p = await D.xlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const n = D.normalize(p, D.mapColumns(p.headers));
  assert.equal(n.recs.length, 3); assert.equal(n.recs[0].title, "Wireless earbuds & case"); assert.equal(new Date(n.recs[0].ts).toISOString().slice(0, 10), "2026-10-05"); assert.equal(n.recs[1].price, 1499); assert.ok(n.recs[1].returned);
});
