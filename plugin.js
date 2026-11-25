// Footballia plugin for Kino TV.
// Each viewer links their own Footballia account through Kino's visible browser.
// Playback is resolved only from direct media URLs exposed by Footballia's page;
// no DRM, paywall, token-signing or anti-hotlink bypass is attempted.

const BASE = "https://footballia.eu";
const MATCH_PATH = /\/matches\//i;
const MEDIA = /\.(?:mp4|m4v|webm|m3u8)(?:[?#]|$)/i;

function cfg(key) {
  try { return kino.config.get(key) || ""; } catch { return ""; }
}
function cookieHeader() {
  return [cfg("cookieA"), cfg("cookieB"), cfg("cookieC"), cfg("cookieD")].join("");
}
function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function textOf(s) {
  return decode(String(s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}
function abs(href) {
  try {
    const u = new URL(decode(href), BASE);
    if (u.protocol !== "https:" ||
        (u.hostname !== "footballia.eu" && !u.hostname.endsWith(".footballia.eu"))) return "";
    return u.href.split("#")[0];
  } catch { return ""; }
}
function mediaUrl(href) {
  try {
    const u = new URL(decode(href), BASE);
    if (u.protocol !== "https:" || !MEDIA.test(u.href)) return "";
    return u.href;
  } catch { return ""; }
}
function matchesFrom(html) {
  const out = [], seen = new Set();
  const re = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = abs(m[2]);
    if (!url || !MATCH_PATH.test(new URL(url).pathname) || seen.has(url)) continue;
    const title = textOf(m[3]) || textOf(m[1].replace(/href=["'][^"']+["']/i, ""));
    if (!title || title.length < 5) continue;
    seen.add(url);
    out.push({
      id: url, ref: url, title: title.slice(0, 180), kind: "movie",
      overview: "Partido completo · Footballia"
    });
  }
  return out;
}
async function page(url) {
  const headers = {};
  const cookies = cookieHeader();
  if (cookies) headers.Cookie = cookies;
  const r = await kino.fetch(url, { headers });
  if (!r.ok) throw new Error("Footballia respondió " + r.status);
  return r.text();
}
function safeQuery(q) {
  return String(q || "").trim().slice(0, 100);
}

export async function action(key) {
  if (key !== "login") throw new Error("Acción no reconocida");
  if (!kino.visualBrowser || !kino.visualBrowser.available) {
    return { message: "Este dispositivo no tiene navegador compatible. Prueba desde un teléfono Android o una TV con WebView." };
  }
  const r = await kino.visualBrowser.open({
    url: "https://footballia.eu/users/sign_in?locale=en",
    title: "Footballia",
    collect: {
      cookies: ["_footballia_session", "remember_user_token"],
      storeAs: {
        setting: "cookieA",
        spill: ["cookieB", "cookieC", "cookieD"],
        format: "header"
      }
    },
    userAgent: "browser",
    timeoutMs: 600000
  });
  if (r.status !== "done") return { message: "Inicio de sesión cancelado o no completado." };
  if (!r.stored) return { message: "No se guardó ninguna cookie de sesión. Comprueba que hayas iniciado sesión y pulsa Listo." };
  return { message: "Sesión guardada en este dispositivo." };
}

export async function settingsStatus() {
  const saved = !!cookieHeader();
  return { accountStatus: saved ? "Sesión guardada. Si caduca, vuelve a iniciar sesión." : "No has vinculado tu cuenta todavía." };
}

export async function search(query) {
  const q = safeQuery(query && query.q);
  if (!q) return [];
  // Footballia's visible site search uses the query parameter; try the common
  // public search endpoint first, then the site's root search.
  const routes = [
    BASE + "/search?query=" + encodeURIComponent(q),
    BASE + "/?search=" + encodeURIComponent(q),
    BASE + "/matches?search=" + encodeURIComponent(q)
  ];
  let lastError;
  for (const url of routes) {
    try {
      const found = matchesFrom(await page(url));
      if (found.length) return found.slice(0, 40);
    } catch (e) { lastError = e; }
  }
  if (lastError) throw lastError;
  return [];
}

function linksFrom(html, pathPattern) {
  const out = [], seen = new Set();
  const re = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = abs(m[2]);
    if (!url || !pathPattern.test(new URL(url).pathname) || seen.has(url)) continue;
    const title = textOf(m[3]);
    if (!title || title.length < 2) continue;
    seen.add(url);
    out.push({ id: url, title: title.slice(0, 40), ref: url });
  }
  return out;
}

export async function categories() {
  const html = await page(BASE + "/");
  const found = linksFrom(html, /^\/competitions\//i);
  return found.slice(0, 24).map((item) => ({
    id: item.id, title: item.title, ref: item.ref
  }));
}

export async function home() {
  const html = await page(BASE + "/");
  const items = matchesFrom(html).slice(0, 30);
  return items.length ? [{
    id: "footballia-latest", title: "Partidos de Footballia",
    ref: BASE + "/", items
  }] : [];
}

export async function browse(ref, cursor) {
  await null;
  const url = abs(ref);
  if (!url) throw new Error("Categoría de Footballia no válida");
  const pageNumber = cursor ? Number(cursor) : 1;
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100) {
    throw new Error("Página no válida");
  }
  const target = url + (url.includes("?") ? "&" : "?") + "page=" + pageNumber;
  const items = matchesFrom(await page(target)).slice(0, 50);
  return { items, next: items.length === 50 ? String(pageNumber + 1) : undefined };
}

export async function resolve(ref) {
  await null;
  const pageUrl = abs(ref);
  if (!pageUrl || !MATCH_PATH.test(new URL(pageUrl).pathname)) {
    throw new Error("Referencia de partido no válida");
  }
  const html = await page(pageUrl);
  const patterns = [
    /<source\b[^>]*src=["']([^"']+)["']/gi,
    /["']file["']\s*:\s*["']([^"']+)["']/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      const url = mediaUrl(m[1]);
      if (url) {
        return {
          url,
          mime: /\.m3u8(?:[?#]|$)/i.test(url)
            ? "application/vnd.apple.mpegurl"
            : (/\.webm(?:[?#]|$)/i.test(url) ? "video/webm" : "video/mp4")
        };
      }
    }
  }
  throw new Error(
    "No se encontró una fuente directa compatible en la página. " +
    "Comprueba que tu cuenta esté vinculada. Si el reproductor protege el flujo " +
    "o no publica una URL directa, Kino no puede reproducirlo de forma nativa."
  );
}
