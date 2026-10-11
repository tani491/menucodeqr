const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");

function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const importer = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, mocks);
    return require(name);
  };
  new Function("require", "module", "exports", code)(importer, module, module.exports);
  return module.exports;
}

const validation = load("src/lib/validation.ts");
const marketing = load("src/lib/marketing.ts");
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

async function main() {
  const dish = { nameFr: "Pastels", price: 2000, categoryId: "starters" };
  check(validation.dishSchema.safeParse(dish).success, "valid dish accepted");
  for (const value of [-1, NaN, Infinity, 100000, "2000"]) check(!validation.dishSchema.safeParse({ ...dish, price: value }).success, "invalid price rejected");
  check(!validation.dishSchema.safeParse({ ...dish, restaurantId: "other" }).success, "tenant override rejected");
  check(!validation.dishSchema.safeParse({ ...dish, imageUrl: "javascript:alert(1)" }).success, "script media rejected");
  check(!validation.dishImageSchema.safeParse(`data:image/jpeg;base64,${"A".repeat(200000)}`).success, "oversized base64 rejected");
  check(validation.tableNumberSchema.safeParse("Terrasse 2-é").success, "plain text table accepted");
  for (const value of ["<script>alert(1)</script>", "<img onerror=alert(1)>", "", "A".repeat(41)]) check(!validation.tableNumberSchema.safeParse(value).success, "unsafe table rejected");
  check(!/[<>]/.test(validation.sanitizeTableNumber("<script>2</script>")), "legacy table markup removed");
  const settings = { ...marketing.defaultMarketingSettings, whatsappNumber: "221773615944" };
  check(marketing.settingsSchema.safeParse(settings).success, "valid WhatsApp accepted");
  check(!marketing.settingsSchema.safeParse({ ...settings, whatsappNumber: "+221 77" }).success, "invalid WhatsApp rejected");
  check(!marketing.settingsSchema.safeParse({ ...settings, role: "super_admin" }).success, "marketing unknown fields rejected");

  const originalSecret = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = "test-only-secret";
  let token = null;
  const { proxy } = load("src/proxy.ts", { "next-auth/jwt": { getToken: async () => token } });
  const origin = "https://example.test";
  for (const route of ["/api/orders", "/api/menu-orders", "/api/admin/marketing", "/api/auth/callback/credentials"]) {
    check((await proxy(new NextRequest(origin + route, { method: "POST", headers: { origin: "https://attacker.test" } }))).status === 403, "cross origin mutation blocked");
  }
  check((await proxy(new NextRequest(origin + "/api/orders", { method: "POST" }))).status === 403, "originless mutation blocked");
  check((await proxy(new NextRequest(origin + "/api/menu/demo", { headers: { origin: "https://attacker.test" } }))).status === 403, "cross origin read blocked");
  check((await proxy(new NextRequest(origin + "/api/menu-orders", { method: "POST", headers: { origin } }))).status === 200, "same origin public order reaches handler");
  check((await proxy(new NextRequest(origin + "/admin"))).status === 307, "anonymous admin redirected");
  token = { role: "restaurateur", restaurantId: "r1" };
  check((await proxy(new NextRequest(origin + "/admin"))).status === 403, "restaurateur admin blocked");
  check((await proxy(new NextRequest(origin + "/api/admin/marketing"))).status === 403, "restaurateur admin API blocked");
  token = { role: "admin" };
  check((await proxy(new NextRequest(origin + "/admin"))).status === 403, "legacy admin not promoted");
  token = { role: "super_admin" };
  check((await proxy(new NextRequest(origin + "/admin"))).status === 200, "super admin allowed");
  check((await proxy(new NextRequest(origin + "/dashboard"))).status === 403, "wrong workspace role blocked");
  delete process.env.NEXTAUTH_SECRET;
  check((await proxy(new NextRequest(origin + "/admin"))).status === 503, "missing secret fails closed");
  if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = originalSecret;

  // A server-side Firestore fixture verifies prices, tenant checks and capability access.
  const records = new Map([
    ["restaurants/r1", { id: "r1", slug: "demo", status: "active" }],
    ["dishes/d1", { restaurantId: "r1", price: 2000, nameFr: "Pastels", isAvailable: true }],
    ["dishes/foreign", { restaurantId: "r2", price: 1, isAvailable: true }],
  ]);
  let count = 0;
  const snap = key => ({ id: key.split("/")[1], exists: records.has(key), data: () => records.get(key), ref: ref(key) });
  const ref = key => ({ key, id: key.split("/")[1], get: async () => snap(key) });
  const db = {
    collection: collection => ({ doc: id => ref(`${collection}/${id || `new${++count}`}`), where: () => ({ limit: () => ({ get: async () => ({ docs: [snap("restaurants/r1")] }) }) }) }),
    runTransaction: async operation => {
      const staged = [];
      const result = await operation({ get: async reference => snap(reference.key), create: (reference, value) => staged.push([reference.key, value]) });
      staged.forEach(([key, value]) => records.set(key, value));
      return result;
    },
  };
  const routes = load("src/app/api/menu-orders/route.ts", { "@/lib/firebaseAdmin": { getFirebaseAdminFirestore: () => db } });
  const order = { slug: "demo", tableNumber: "Terrasse 2", customerName: "Client", customerPhone: "221773615944", items: [{ itemId: "d1", quantity: 2 }] };
  const post = value => routes.POST(new NextRequest(origin + "/api/menu-orders", { method: "POST", body: JSON.stringify(value) }));
  check((await post({ ...order, items: [{ itemId: "foreign", quantity: 1 }] })).status === 409, "foreign dish rejected");
  check((await post({ ...order, totalPrice: 1 })).status === 400, "client total override rejected");
  check((await post({ ...order, tableNumber: "<script>" })).status === 400, "server rejects table HTML");
  const created = await post(order);
  check(created.status === 201, "valid order persisted");
  const payload = await created.json();
  check(payload.order.totalPrice === 4000, "total computed from database");
  check(records.get(`order_access/${payload.id}`).tokenHash !== payload.token, "tracking token stored hashed");
  check((await routes.GET(new NextRequest(`${origin}/api/menu-orders?id=${payload.id}`))).status === 403, "id alone cannot read order");
  check((await routes.GET(new NextRequest(`${origin}/api/menu-orders?id=${payload.id}`, { headers: { "x-order-token": "0".repeat(64) } }))).status === 403, "wrong token rejected");
  check((await routes.GET(new NextRequest(`${origin}/api/menu-orders?id=${payload.id}`, { headers: { "x-order-token": payload.token } }))).status === 200, "correct capability reads order");
  records.get("restaurants/r1").status = "suspended";
  check((await post(order)).status === 409, "suspended restaurant cannot receive order");

  const itemApi = load("src/app/api/dashboard/firestore-items/route.ts", {
    "@/lib/firestore-tenant": { requireFirestoreRestaurant: async () => ({ db, restaurantId: "r1" }) },
  });
  const mutate = value => itemApi.POST(new NextRequest(origin + "/api/dashboard/firestore-items", { method: "POST", body: JSON.stringify(value) }));
  check((await mutate({ action: "update", id: "foreign", collection: "dishes", data: { price: 3000 } })).status === 404, "foreign dish cannot be edited");
  check((await mutate({ action: "delete", id: "foreign", collection: "dishes" })).status === 404, "foreign dish cannot be deleted");
  check((await mutate({ action: "update", id: "d1", collection: "dishes", data: { restaurantId: "r2" } })).status === 400, "dish cannot be transferred by payload");
  check((await mutate({ action: "update", id: "d1", collection: "users", data: { price: 3000 } })).status === 400, "collection override rejected");
  records.set("categories/foreign", { restaurantId: "r2" });
  check((await mutate({ action: "create", data: { ...dish, categoryId: "foreign" } })).status === 404, "foreign category cannot receive a dish");

  // A token signed before reassignment no longer authorizes API access.
  process.env.NEXTAUTH_SECRET = "test-only-secret";
  let profile = { role: "restaurateur", restaurantId: "r1" };
  const serverAuth = load("src/lib/api-auth.ts", {
    "next-auth": { getServerSession: async () => ({ user: { id: "uid1", role: "restaurateur", restaurantId: "r1" } }) },
    "@/lib/auth": { authOptions: {} }, "@/lib/db": { db: {} },
    "@/lib/firebaseAdmin": {
      getFirebaseAdminAuth: () => ({ getUser: async () => ({ disabled: false }) }),
      getFirebaseAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => profile }) }) }) }),
    },
  });
  check(!(await serverAuth.requireAuth()).error, "matching live profile accepted");
  profile = { role: "restaurateur", restaurantId: "r2" };
  check((await serverAuth.requireAuth()).error.status === 401, "reassigned tenant invalidates old token");
  profile = { role: "user", restaurantId: "r1" };
  check((await serverAuth.requireAuth()).error.status === 401, "revoked role invalidates old token");
  if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = originalSecret;

  // An existing review contains server-managed fields; it remains readable.
  const review = { restaurantName: "Resto", ownerName: "Gérant", comment: "Excellent", rating: 5, avatarBase64: "", isActive: true, id: "review", createdAt: "2026-10-11" };
  const reader = load("src/lib/marketing-server.ts", { "@/lib/firebaseAdmin": { getFirebaseAdminFirestore: () => ({ collection: name => name === "testimonials" ? { get: async () => ({ docs: [{ id: "review", data: () => review }] }) } : { doc: () => ({ get: async () => ({ data: () => settings }) }) } }) } });
  check((await reader.readMarketing()).testimonials.length === 1, "strict validation preserves stored reviews");
  records.get("restaurants/r1").status = "active";
  records.get("restaurants/r1").managerEmail = "private@example.test";
  records.get("restaurants/r1").userId = "private-owner";
  let offline = false;
  const publicDb = {
    collection: name => {
      let field, value, max = Infinity;
      const q = {
        where: (f, _op, v) => { field = f; value = v; return q; },
        limit: n => { max = n; return q; },
        get: async () => {
          if (offline) throw new Error("Fixture unavailable");
          return { docs: [...records.keys()].filter(key => key.startsWith(`${name}/`) && (!field || records.get(key)[field] === value)).slice(0, max).map(snap) };
        },
      };
      return q;
    },
  };
  const menus = load("src/lib/menu-data.ts", { "./firebaseAdmin": { getFirebaseAdminFirestore: () => publicDb } });
  const menu = await menus.getMenuBySlug("demo");
  check(menu.restaurant.name !== undefined, "public menu still loads");
  check(!JSON.stringify(menu).includes("private@example.test") && !JSON.stringify(menu).includes("private-owner"), "owner details excluded from public response");
  check(menu.items.every(item => item.id !== "foreign"), "menu dishes scoped to restaurant");
  offline = true;
  const logError = console.error;
  try { console.error = () => {}; check(await menus.getMenuBySlug("demo") === null, "database failure cannot serve a stale active menu"); }
  finally { console.error = logError; }
  console.log(`${checks} contrôles de sécurité réussis (fixtures locales, sans certification Firebase déployé).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
