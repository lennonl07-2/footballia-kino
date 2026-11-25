// Footballia source for Kino TV.
// Catalogue pages are indexed from Footballia's public HTML. Playback only accepts
// a direct media URL explicitly exposed by the page; it does not bypass login,
// subscription, DRM, signed URLs, anti-hotlinking or other access controls.

const BASE = "https://footballia.eu";
const MATCH_PATH = /\\/matches\\//i;
const MEDIA = /\\.(?:mp4|m4v|webm|m3u8)(?:[?#]|$)/i;

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#(\\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function textOf(s) {
  return decode(String(s || "").replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\\s+/g, " ").trim();
}
function abs(href) {
  try {
    const u = new URL(decode(href), BASE);
    if (u.protocol !== "https:" || (u.hostname !== "footballia.eu" && !u.hostname.endsWith(".footballia.eu"))) return "";
    return u.href.split("#")[0];
  } catch { return ""; }
}
function posterFrom(html) {
  const m = /<img[^>]+(?:src|data-src)=["']([^"']+)["']/i.exec(html);
  return m ? abs(m[1]) || (m[1].startsWith("https://") ? m[1] : "") : undefined;
}
function matchesFrom(html) {
  const out = [], seen = new Set();
  const re = /<a\\b([^>]*href=["']([^"']+)["'][^>]*)>([\\s\\S]*?)<\\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = abs(m[2]);
    if (!url || !MATCH_PATH.test(new URL(url).pathname) || seen.has(url)) continue;
    const title = textOf(m[3]) || textOf(m[1].replace(/href=["'][^"']+["']/i, ""));
    if (!title || title.length < 5) continue;
    seen.add(url);
    out.push({
      id:url, ref:url, title:title.slice(0,180), kind:"movie",
      poster:posterFrom(m[3]),
      overview:"Partido completo · Footballia"
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
  return String(q || "").trim().slice(0,100);
}

export async function search(query) {
  const q = safeQuery(query && query.q);
  if (!q) return [];
  // Try Footballia's search routes; the first route returning match cards wins.
  const routes = [
    BASE + "/search?query=" + encodeURIComponent(q),
    BASE + "/?s=" + encodeURIComponent(q),
    BASE + "/matches?search=" + encodeURIComponent(q)
  ];
  let lastError;
  for (const url of routes) {
    try {
      const found = matchesFrom(await page(url));
      if (found.length) return found.slice(0,40);
    } catch (e) { lastError = e; }
  }
  if (lastError) throw lastError;
  return [];
}

export async function home() {
  const html = await page(BASE + "/");
  const items = matchesFrom(html).slice(0,30);
  return items.length ? [{
    id:"footballia-latest", title:"Partidos de Footballia", ref:BASE + "/",
    items
  }] : [];
}

export async function browse(ref, cursor) {
  const url = abs(ref);
  if (!url) throw new Error("Categoría de Footballia no válida");
  const target = cursor ? url + (url.includes("?") ? "&" : "?") + "page=" + encodeURIComponent(cursor) : url;
  const items = matchesFrom(await page(target)).slice(0,50);
  return { items, next: items.length === 50 ? String(Number(cursor || 1) + 1) : undefined };
}

export async function resolve(ref) {
  const pageUrl = abs(ref);
  if (!pageUrl || !MATCH_PATH.test(new URL(pageUrl).pathname)) {
    throw new Error("Referencia de partido no válida");
  }
  const html = await page(pageUrl);

  // Accept only direct media URLs openly present in the page source.
  const candidates = [];
  const patterns = [
    /<source\\b[^>]*src=["']([^"']+)["']/gi,
    /["']file["']\\s*:\\s*["']([^"']+)["']/gi
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
    return { url, mime: /\\.m3u8(?:[?#]|$)/i.test(url) ? "application/vnd.apple.mpegurl" : (/\\.webm/i.test(url) ? "video/webm" : "video/mp4") };
  }
  throw new Error(
    "Footballia no expone un enlace de vídeo directo accesible desde el plugin. " +
    "Este partido puede requerir iniciar sesión o usar el reproductor protegido de Footballia. " +
    "Abre la página en Footballia para comprobar el acceso; Kino solo puede reproducir aquí fuentes directas que el sitio permita."
  );
}
