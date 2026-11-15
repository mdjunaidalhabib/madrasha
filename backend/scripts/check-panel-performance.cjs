// Production bundle + real Chromium regression checks. All API data is local fixture data.
// Usage: node backend/scripts/check-panel-performance.cjs [admin-build] [super-admin-build]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { gzipSync } = require("node:zlib");
const { chromium } = require("playwright");

const builds = [
  ["admin", process.argv[2] || "admin/dist"],
  ["super-admin", process.argv[3] || "super-admin/dist"],
];

function bundleCheck(app, directory) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, ".vite/manifest.json")),
  );
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
  const collect = (key, seen = new Set()) => {
    if (seen.has(key)) return seen;
    seen.add(key);
    (manifest[key].imports || []).forEach((dep) => collect(dep, seen));
    return seen;
  };
  const files = (keys) =>
    new Set(
      [...keys].flatMap((key) => [
        manifest[key].file,
        ...(manifest[key].css || []),
      ]),
    );
  const initial = collect(entry);
  assert(
    ![...initial].some((key) => /excel|xlsx|DashboardChart/.test(key)),
    "Heavy code entered the initial dependency graph",
  );
  const dashboard = Object.keys(manifest).find((key) =>
    (app === "admin" ? /\/DashboardPage-/ : /\/SuperAdminDashboardPage-/).test(
      manifest[key].file,
    ),
  );
  assert(dashboard, "Dashboard chunk was not found in the production manifest");
  assert(
    ![...collect(dashboard)].some((key) =>
      /DashboardChart|CartesianChart/.test(key),
    ),
    "Charts block dashboard rendering",
  );
  const size = (keys) =>
    [...files(keys)].reduce(
      (total, file) =>
        total + gzipSync(fs.readFileSync(path.join(directory, file))).length,
      0,
    );
  assert(
    size(initial) < (app === "admin" ? 200000 : 160000),
    "Initial JS/CSS exceeded the performance budget",
  );
  const html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
  assert(
    !/<link[^>]+modulepreload[^>]+vendor-excel/.test(html),
    "Excel is preloaded by HTML",
  );
  assert(
    /\/assets\/Kalpurush-[a-f0-9]+\.ttf/.test(html),
    "UI font needs a versioned URL",
  );
  const worker = fs.readFileSync(path.join(directory, "sw.js"), "utf8");
  assert(
    !worker.includes("__VERSION__"),
    "Service worker build placeholders were not replaced",
  );
  const shell = JSON.parse(worker.match(/const SHELL = (\[[^;]+\]);/)[1]);
  assert(
    !shell.some((file) =>
      /excel|DashboardPage|DashboardChart|Template/.test(file),
    ),
    "Feature code is being precached",
  );
  console.log(
    `${app}: initial JS/CSS ${(size(initial) / 1000).toFixed(2)} KB gzip; dashboard before charts ${(size(new Set([...initial, ...collect(dashboard)])) / 1000).toFixed(2)} KB gzip`,
  );
}

const plan = {
  plan_status: "active",
  has_active_subscription: true,
  days_remaining: 60,
  plan_name: "Test",
  usage: { students: 2, users: 1 },
  student_limit: 100,
  user_limit: 10,
};
const summary = {
  students: 2,
  teachers: 1,
  users: 1,
  income: 1000,
  expense: 200,
  balance: 800,
  todayIncome: 100,
  todayExpense: 20,
  fundBalances: [],
  paymentMethodTotals: [],
  recentTransactions: [],
  studentsByGender: { male: 1, female: 1 },
  attendanceToday: { total: 2, percentage: 100 },
  pendingAdmissionsCount: 0,
  overdueFees: { count: 0, studentCount: 0, totalDue: 0, list: [] },
  upcomingExams: [],
  importantLinks: [],
};

async function startServer(directory, app) {
  const events = [];
  let blocked = false;
  let unavailable = false;
  const list = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    type: "ID_CARD",
    name: `Template ${index + 1}`,
    scope: "SYSTEM",
    is_published: true,
    is_active: true,
    updated_at: "2026-01-01",
  }));
  const server = http.createServer(async (req, res) => {
    if (unavailable) {
      req.socket.destroy();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    events.push({ path: url.pathname, time: Date.now() });
    if (url.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      let body = { data: {} };
      const endpoint = url.pathname.slice(4);
      if (endpoint === "/platform-brand") body = { data: { version: null } };
      else if (endpoint === "/settings/plan") {
        await new Promise((resolve) => setTimeout(resolve, 400));
        events.push({ path: "plan-response", time: Date.now() });
        body = {
          data: {
            ...plan,
            ...(blocked
              ? { has_active_subscription: false, plan_status: "expired" }
              : {}),
          },
        };
      } else if (endpoint === "/auth/me")
        body = {
          id: 1,
          name: "Test Admin",
          permissions: ["*"],
          modules: ["dashboard"],
          institution: {
            type: "MADRASA",
            default_language: "bn",
            languages: ["bn"],
          },
        };
      else if (endpoint === "/sidebar") body = [];
      else if (endpoint === "/dashboard") body = summary;
      else if (endpoint === "/dashboard/trends")
        body = {
          incomeExpense: [
            { period: "2026-01", total_income: 100, total_expense: 20 },
          ],
          attendance: [{ period: "2026-01", percentage: 100 }],
        };
      else if (endpoint === "/super/dashboard-stats")
        body = {
          totalMadrasas: 2,
          activeMadrasas: 2,
          totalStudents: 2,
          recentActivities: [],
          expiringPlans: [],
          expiredPlans: [],
        };
      else if (endpoint === "/super/dashboard-trends")
        body = {
          madrasaGrowth: [{ period: "2026-01", count: 2 }],
          revenue: [{ period: "2026-01", total: 100 }],
        };
      else if (endpoint === "/super/leads/summary")
        body = {
          data: {
            total: 0,
            today: 0,
            due: 0,
            counts: { NEW: 0, CONVERTED: 0 },
            recent: [],
          },
        };
      else if (endpoint === "/super/document-templates") body = { data: list };
      else if (/^\/super\/document-templates\/\d+$/.test(endpoint)) {
        const id = Number(endpoint.split("/").pop());
        body = {
          data: {
            ...list[id - 1],
            published: {
              width: 320,
              height: 200,
              layers: [],
              background: null,
            },
          },
        };
      }
      res.end(JSON.stringify(body));
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    let file = path.resolve(directory, relative || "index.html");
    if (!file.startsWith(path.resolve(directory) + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(relative)) {
        res.writeHead(404).end();
        return;
      }
      file = path.resolve(directory, "index.html");
    }
    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".ttf": "font/ttf",
      ".png": "image/png",
      ".webmanifest": "application/manifest+json",
    };
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader(
      "Cache-Control",
      relative.startsWith("assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    events,
    origin: `http://127.0.0.1:${server.address().port}`,
    block: () => {
      blocked = true;
    },
    setUnavailable: (value) => {
      unavailable = value;
    },
  };
}

async function browserCheck(browser, app, directory) {
  const { server, events, origin, block, setUnavailable } = await startServer(
    directory,
    app,
  );
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  context.setDefaultTimeout(10000);
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.abort(),
  );
  await context.addInitScript((origin) => {
    window.__INTERNAL_API_BASE__ = `${origin}/api`;
  }, origin);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${origin}/login`);
    await page.locator("input").first().waitFor();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert(
      !events.some((event) => /vendor-excel|DashboardChart/.test(event.path)),
      "Login downloaded an unused heavy feature",
    );
    // API results must never enter persistent PWA storage.
    await page.evaluate(() => fetch("/api/auth/me"));
    const cachedUrls = await page.evaluate(async () => {
      const keys = await caches.keys();
      return (
        await Promise.all(
          keys.map(async (key) =>
            (await (await caches.open(key)).keys()).map(
              (req) => new URL(req.url).pathname,
            ),
          ),
        )
      ).flat();
    });
    assert(
      !cachedUrls.some((url) => url.startsWith("/api/")),
      "Private API data was cached",
    );
    assert(
      !cachedUrls.some((url) => /DashboardChart|vendor-excel/.test(url)),
      "Unused features were precached",
    );
    await context.setOffline(true);
    setUnavailable(true);
    await page.reload();
    await page.locator("input").first().waitFor();
    await page
      .getByRole("status")
      .filter({ hasText: /ইন্টারনেট|offline/i })
      .waitFor();
    await context.setOffline(false);
    setUnavailable(false);
    await page.evaluate((app) => {
      if (app === "admin")
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({
            state: {
              token: "fixture-token",
              user: { id: 1, name: "Test Admin" },
              permissions: ["*"],
              modules: ["dashboard"],
              madrasaSlug: "fixture",
            },
            version: 0,
          }),
        );
      else localStorage.setItem("admin_token", "fixture-token");
    }, app);
    events.length = 0;
    const dashboardResponse = page.waitForResponse((res) =>
      res
        .url()
        .includes(
          app === "admin" ? "/api/dashboard" : "/api/super/dashboard-stats",
        ),
    );
    await page.goto(`${origin}/dashboard`);
    await dashboardResponse;
    await page.locator("main").waitFor();
    if (app === "admin")
      await page.locator("main").evaluate((el) => {
        el.scrollTop = 600;
      });
    await page.locator(".recharts-wrapper").first().waitFor();
    if (app === "admin") {
      const dataEvent = events.find((event) => event.path === "/api/dashboard");
      const verified = events.find((event) => event.path === "plan-response");
      const chunk = events.find((event) => /\/DashboardPage-/.test(event.path));
      assert(
        verified && dataEvent.time >= verified.time,
        "Dashboard API started before subscription verification",
      );
      assert(
        chunk && chunk.time < verified.time,
        "Page code was not downloaded during subscription verification",
      );
      block();
      events.length = 0;
      await page.reload();
      await page.waitForURL("**/settings/plan");
      assert(
        !events.some((event) => event.path === "/api/dashboard"),
        "Suspended plan mounted dashboard data effects",
      );
    } else {
      events.length = 0;
      const firstPreview = page.waitForResponse((res) =>
        /\/api\/super\/document-templates\/1$/.test(res.url()),
      );
      await page.goto(`${origin}/document-templates`);
      await page.getByText("Template 1", { exact: true }).waitFor();
      await firstPreview;
      const count = events.filter((event) =>
        /\/api\/super\/document-templates\/\d+$/.test(event.path),
      ).length;
      assert(
        count > 0 && count < 30,
        `All ${count} template previews loaded up front`,
      );
      const lastPreview = page.waitForResponse((res) =>
        /\/api\/super\/document-templates\/30$/.test(res.url()),
      );
      await page.locator("main").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await lastPreview;
    }
    assert.deepEqual(errors, [], "Browser runtime errors");
    console.log(
      `${app}: login, offline shell, API cache isolation, dashboard${app === "admin" ? ", plan gate + parallel chunk" : ", visible template previews"} passed`,
    );
  } catch (error) {
    console.error(app, {
      errors,
      state: await page
        .evaluate(() => ({
          online: navigator.onLine,
          statuses: [...document.querySelectorAll('[role="status"]')].map(
            (el) => el.textContent,
          ),
          body: document.body.innerText.slice(0, 300),
          main: document.querySelector("main")?.innerText.slice(0, 600),
          busy: [...document.querySelectorAll('[aria-busy="true"]')].map(
            (el) => ({
              top: el.getBoundingClientRect().top,
              height: el.getBoundingClientRect().height,
            }),
          ),
        }))
        .catch(() => null),
      recentRequests: events.slice(-20).map((event) => event.path),
    });
    throw error;
  } finally {
    await context.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

(async () => {
  builds.forEach(([app, directory]) => bundleCheck(app, directory));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [app, directory] of builds)
      await browserCheck(browser, app, directory);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
