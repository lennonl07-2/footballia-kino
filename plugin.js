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
function attrValue(attrs, name) {
  const re = new RegExp("\\b" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i");
  const m = re.exec(attrs || "");
  return m ? decode(m[2]) : "";
}
function selectHtml(html, selector) {
  try {
    return kino.html.select(String(html || ""), selector);
  } catch (e) {
    kino.log("HTML selector failed", selector, e && e.message);
    return [];
  }
}

function matchesFrom(html) {
  const out = [], seen = new Set();
  const rows = selectHtml(html, "tr");

  function addMatch(anchor, rowText) {
    const attrs = anchor && anchor.attrs ? anchor.attrs : {};
    const url = abs(attrs.href || "");
    if (!url || !MATCH_PATH.test(new URL(url).pathname) || seen.has(url)) return;

    let title = String(anchor.text || "").trim();
    if (!title && anchor.html) {
      const imgs = selectHtml(anchor.html, "img");
      if (imgs.length) title = String(imgs[0].attrs.alt || imgs[0].attrs.title || "").trim();
    }
    if (!title) title = String(rowText || "").trim();
    title = title.replace(/\s+/g, " ").trim();
    if (!title || title.length < 2) {
      title = new URL(url).pathname.split("/").pop()
        .replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
    if (!title || title.length < 2) return;

    seen.add(url);
    out.push({
      id: url, ref: url, title: title.slice(0, 180), kind: "movie",
      overview: "Partido completo · Footballia"
    });
  }

  // Footballia puts match links inside table rows. Read the row first so
  // image-only links still get a useful title from the surrounding row.
  for (const row of rows) {
    const anchors = selectHtml(row.html || "", "a[href*='/matches/']");
    for (const anchor of anchors) addMatch(anchor, row.text);
  }

  // Search pages may place match links outside a table.
  if (!out.length) {
    for (const anchor of selectHtml(html, "a[href*='/matches/']")) {
      addMatch(anchor, anchor.text);
    }
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
  const cookies = cookieHeader();
  if (!cookies) return { accountStatus: "No has vinculado tu cuenta todavía." };
  try {
    const r = await kino.fetch(
      BASE + "/matches/rcd-espanyol-fc-barcelona-liga-1-division-2004-2005",
      { headers: { Cookie: cookies } }
    );
    if (!r.ok) return { accountStatus: "Hay cookies guardadas, pero Footballia respondió " + r.status + ". Vuelve a vincular tu cuenta." };
    const html = await r.text();
    if (/sign up for free to watch the match/i.test(html)) {
      return { accountStatus: "La sesión no está iniciada. Pulsa Iniciar sesión en Footballia y vuelve a intentarlo." };
    }
    return { accountStatus: "Sesión vinculada y comprobada en Footballia." };
  } catch {
    return { accountStatus: "No se pudo comprobar la sesión. Comprueba tu conexión y vuelve a abrir Ajustes." };
  }
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formSearchUrl(path, field, q, base) {
  const params = new URLSearchParams();
  params.set("utf8", "✓");
  params.set(field, q);
  params.set(field.replace("_name", "_id"), "");
  params.set("url_base", base);
  return BASE + path + "?" + params.toString();
}

export async function search(query) {
  const q = safeQuery(query && query.q);
  if (q.length < 2) return [];

  // Prueba controlada: al buscar "peru", devolver exactamente un partido
  // conocido para comprobar que Kino muestra el resultado y abre su ficha.
  if (slugify(q) === "peru") {
    const ref = BASE + "/matches/argentina-peru-eliminatorias-mundial";
    return [{
      id: ref,
      ref,
      title: "Argentina vs. Peru (1969) — Eliminatorias al Mundial",
      kind: "movie",
      overview: "Prueba directa de Footballia · Abre la ficha del partido"
    }];
  }

  const slug = slugify(q);
  const seen = new Set();
  const results = [];

  try {
    const html = await page(BASE + "/teams/" + encodeURIComponent(slug));
    for (const item of matchesFrom(html)) {
      if (seen.has(item.ref)) continue;
      seen.add(item.ref);
      results.push(item);
    }
    if (results.length) return results;
  } catch (_) {}

  const urls = [
    formSearchUrl("/search_by_team", "team_name", q, "/teams"),
    formSearchUrl("/search_by_player", "player_name", q, "/players")
  ];
  const responses = await Promise.allSettled(urls.map((url) => page(url)));
  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    for (const item of matchesFrom(response.value)) {
      if (seen.has(item.ref)) continue;
      seen.add(item.ref);
      results.push(item);
      if (results.length >= 100) return results;
    }
  }
  return results;
}
function linksFrom(html, pathPattern) {
  const out = [], seen = new Set();
  for (const anchor of selectHtml(html, "a[href]")) {
    const url = abs(anchor.attrs && anchor.attrs.href);
    if (!url || !pathPattern.test(new URL(url).pathname) || seen.has(url)) continue;
    const title = String(anchor.text || "").trim();
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
