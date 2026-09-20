/* Cloudflare Pages Function: /blog/{slug}/
 * Server-Side Rendered ブログ詳細ページ（タイ古式 RAKSAA）
 *
 * 目的:
 *   - Googlebot が JS レンダリング待ちせずに完全な HTML を受け取れる → インデックス高速化
 *   - パス型 URL (/blog/{slug}/) で CTR 向上・エンティティ理解強化
 *   - JSON-LD BlogPosting 埋込で Rich Snippet 対応
 *
 * Cache: 15分
 */

const GAS_URL       = 'https://script.google.com/macros/s/AKfycbzo3Bap0F2Yg7-AagzyyhDMw2YOh2y3ZvnKhgIKCnxpi6XFzGvWLe7twGKb_pDI0V4J/exec';
const SITE_URL      = 'https://thai-raksaa.search-mania.net';
const STORE_NAME    = 'タイ古式 RAKSAA';
const STORE_NAME_EN = 'Thai Massage RAKSAA';

export async function onRequest(context) {
  const slug = context.params.slug;
  if (!slug) {
    return Response.redirect(SITE_URL + '/blog/', 302);
  }

  try {
    const upstream = await fetch(GAS_URL + '?blog_all=1&v=1', {
      redirect: 'follow',
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!upstream.ok) {
      return html(renderError('CMS upstream ' + upstream.status), 502);
    }
    const data = await upstream.json();
    const posts = (data && data.blog) || [];

    const post = findPost(posts, slug);
    if (!post) {
      return html(renderNotFound(), 404);
    }

    return html(renderPost(post, slug), 200, {
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    });
  } catch (err) {
    return html(renderError(String(err && err.message || err)), 500);
  }
}

function html(body, status, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }, extraHeaders || {});
  return new Response(body, { status: status || 200, headers });
}

function findPost(posts, slug) {
  const decodedSlug = decodeURIComponent(slug);
  for (const p of posts) {
    if (!p) continue;
    const raw = String(p.url || '').replace(/\/+$/, '');
    const lastSeg = raw.split('/').pop();
    if (lastSeg && lastSeg === decodedSlug) return p;
    if (p.date === decodedSlug) return p;
  }
  return null;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : String(s);
}

function extractTitle(post) {
  if (post.title && String(post.title).trim()) return String(post.title).trim();
  if (post.body) {
    const firstLine = String(post.body).split(/[。\n]/)[0].trim();
    if (firstLine) return firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
  }
  if (post.date) return `${fmtDate(post.date)} の投稿`;
  return 'お知らせ';
}

function toImageUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  const m1 = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w1200`;
  const m2 = s.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1200`;
  if (s.indexOf('drive.google.com/thumbnail') !== -1) {
    return s.replace(/([?&])sz=[^&]*/, '$1sz=w1200');
  }
  return s;
}

function renderPost(post, slug) {
  const title = extractTitle(post);
  const bodyRaw = String(post.body || '');
  const desc = (bodyRaw || title).replace(/\s+/g, ' ').slice(0, 160);
  const imgUrl = toImageUrl(post.image);
  const date = post.date || '';
  const dateFmt = fmtDate(date);
  const canonical = SITE_URL + '/blog/' + encodeURIComponent(slug) + '/';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': title,
    'description': desc,
    'datePublished': date,
    'inLanguage': 'ja',
    'url': canonical,
    'mainEntityOfPage': { '@type': 'WebPage', '@id': canonical },
    'publisher': {
      '@type': 'Organization',
      'name': STORE_NAME,
      'alternateName': STORE_NAME_EN,
      'url': SITE_URL,
      'logo': { '@type': 'ImageObject', 'url': SITE_URL + '/favicon.svg' }
    },
    'author': {
      '@type': 'Organization', 'name': STORE_NAME, 'url': SITE_URL
    }
  };
  if (imgUrl) jsonLd.image = imgUrl;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#FAFAF7">
<meta http-equiv="content-language" content="ja">

<title>${esc(title)} | ${esc(STORE_NAME)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(STORE_NAME)}">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${imgUrl ? `<meta property="og:image" content="${esc(imgUrl)}">` : `<meta property="og:image" content="${SITE_URL}/ogp.png">`}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${imgUrl ? `<meta name="twitter:image" content="${esc(imgUrl)}">` : `<meta name="twitter:image" content="${SITE_URL}/ogp.png">`}

<link rel="icon" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet">

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#FAFAF7;color:#1A1A1A;font-family:'Zen Kaku Gothic New','Hiragino Sans',sans-serif;line-height:1.85;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
header{background:#1A1A1A;padding:16px 20px;text-align:center;position:sticky;top:0;z-index:10}
header a{color:#FAFAF7;text-decoration:none;font-size:17px;letter-spacing:.24em;font-family:'Shippori+Mincho',serif;font-weight:600}
.wrap{max-width:720px;margin:60px auto;padding:0 24px 80px}
article.card{background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,.12)}
article.card img{width:100%;display:block;max-height:480px;object-fit:cover}
.card-body{padding:36px 38px 44px}
.date{font-size:12px;color:#3A3530;letter-spacing:.24em;display:block}
h1{margin:14px 0 28px;font-size:22px;line-height:1.7;font-weight:600;font-family:'Shippori+Mincho',serif;color:#1A1A1A;letter-spacing:.04em}
.text{font-size:15px;line-height:2.05;white-space:pre-wrap;color:#3A3530;word-break:break-word}
.back-wrap{margin-top:52px;text-align:center}
.back-btn{display:inline-block;padding:14px 36px;border:1.5px solid #1A1A1A;color:#1A1A1A;text-decoration:none;border-radius:2px;font-size:13px;letter-spacing:.2em;font-family:'Shippori+Mincho',serif;transition:all .35s ease}
.back-btn:hover{background:#1A1A1A;color:#FAFAF7}
.produced-by{text-align:center;margin-top:64px;font-size:11px;letter-spacing:.24em;color:#3A3530;opacity:.6}
.produced-by a{color:#C9A84C;text-decoration:none;transition:opacity .3s ease}
.produced-by a:hover{opacity:.7}
@media (max-width:600px){.wrap{margin:30px auto;padding:0 16px 60px}.card-body{padding:26px 22px 32px}h1{font-size:19px;margin:12px 0 22px}.text{font-size:14.5px;line-height:1.95}header a{font-size:14px;letter-spacing:.2em}.back-btn{padding:13px 28px;font-size:12px}}
</style>

<script type="application/ld+json">
${JSON.stringify(jsonLd)}
</script>
</head>
<body>

<header><a href="${SITE_URL}/">${esc(STORE_NAME)}</a></header>

<div class="wrap">
  <article class="card">
    ${imgUrl ? `<img src="${esc(imgUrl)}" alt="${esc(title)}" loading="eager">` : ''}
    <div class="card-body">
      ${date ? `<span class="date">${esc(dateFmt)}</span>` : ''}
      <h1>${esc(title)}</h1>
      <p class="text">${esc(bodyRaw)}</p>
    </div>
  </article>
  <div class="back-wrap">
    <a class="back-btn" href="${SITE_URL}/">← トップへ戻る</a>
  </div>
  <div class="produced-by">
    Produced by <a href="https://search-mania.net/" target="_blank" rel="noopener noreferrer">SearchMania Inc.</a>
  </div>
</div>

</body>
</html>`;
}

function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>記事が見つかりません | ${esc(STORE_NAME)}</title>
<meta name="robots" content="noindex,follow">
<link rel="icon" href="/favicon.svg">
<style>
body{background:#FAFAF7;color:#1A1A1A;font-family:'Hiragino Sans',sans-serif;text-align:center;padding:120px 24px}
h1{font-family:'Shippori+Mincho',serif;font-size:24px;margin-bottom:16px}
p{color:#3A3530;font-size:14px;margin-bottom:36px;line-height:1.9}
a.back{display:inline-block;padding:14px 36px;border:1.5px solid #1A1A1A;color:#1A1A1A;text-decoration:none;font-size:13px;letter-spacing:.24em}
</style>
</head>
<body>
<h1>記事が見つかりません</h1>
<p>指定された記事は削除されたか、URL が正しくない可能性があります。</p>
<a class="back" href="${SITE_URL}/">← トップへ戻る</a>
</body>
</html>`;
}

function renderError(msg) {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>Error</title><meta name="robots" content="noindex,nofollow"></head>
<body style="font-family:sans-serif;padding:60px;text-align:center"><h1>一時的なエラー</h1><p>${esc(msg)}</p><p><a href="${SITE_URL}/">トップへ戻る</a></p></body></html>`;
}
