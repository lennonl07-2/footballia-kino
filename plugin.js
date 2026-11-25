// Footballia source for Kino TV.
// Public catalogue search plus native playback only when Footballia openly exposes
// a direct media URL on its own domain. No shared credentials, cookie/token extraction,
// DRM circumvention, subscription bypass or anti-hotlink circumvention.

const BASE = "https://footballia.eu";
const MATCH_PATH = /\/matches\//i;
const MEDIA = /\.(?:mp4|m4v|webm|m3u8)(?:[?#]|$)/i;

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
  const r = await kino.fetch(url);
  if (!r.ok) throw new Error("Footballia respondió " + r.status);
  return r.text();
}
function safeQuery(q) {
  return String(q || "").trim().slice(0, 100);
}

export async function search(query) {
  const q = safeQuery(query && query.q);
  if (!q) return [];
  const routes = [
    BASE + "/search?query=" + encodeURIComponent(q),
    BASE + "/?s=" + encodeURIComponent(q),
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
  const re = /<a\\b([^>]*href=["']([^"']+)["'][^>]*)>([\\s\\S]*?)<\\/a>/gi;
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

// Kino's "Categorías" screen reads this export. Without it, the plugin installs
// but contributes no category group there.
export async function categories() {
  const html = await page(BASE + "/");
  const found = linksFrom(html, /^\\/competitions\\//i);
  return found.slice(0, 24).map((item) => ({
    id: item.id,
    title: item.title,
    ref: item.ref
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
  const candidates = [];
  const patterns = [
    /<source\b[^>]*src=["']([^"']+)["']/gi,
    /["']file["']\s*:\s*["']([^"']+)["']/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      const url = abs(m[1]);
      if (url && MEDIA.test(url)) candidates.push(url);
    }
  }
  if (candidates.length) {
    const url = candidates[0];
    return {
      url,
      mime: /\.m3u8(?:[?#]|$)/i.test(url)
        ? "application/vnd.apple.mpegurl"
        : (/\.webm(?:[?#]|$)/i.test(url) ? "video/webm" : "video/mp4")
    };
  }
  throw new Error(
    "Footballia no publica un enlace directo compatible en esta página. " +
    "Puede requerir una sesión o un reproductor protegido. Inicia sesión en Footballia " +
    "desde su web y comprueba si el partido permite reproducción externa."
  );
}
