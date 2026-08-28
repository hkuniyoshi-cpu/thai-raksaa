// Cloudflare Pages Function — /sitemap.xml
// GAS ?blog_all=1 を叩いて静的URL＋blog記事URLで動的sitemap生成
// Sheets の blog タブを SSoT として使用（Make 追加のたびに反映）

const GAS_URL      = 'https://script.google.com/macros/s/AKfycbzo3Bap0F2Yg7-AagzyyhDMw2YOh2y3ZvnKhgIKCnxpi6XFzGvWLe7twGKb_pDI0V4J/exec';
const SITE_URL     = 'https://thai-raksaa.search-mania.net';
const BLOG_URL_FMT = '/blog/?post={slug}';

const STATIC = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/privacy-policy.html', changefreq: 'yearly', priority: '0.2' },
  { path: '/terms.html', changefreq: 'yearly', priority: '0.2' },
];

export async function onRequest() {
  try {
    const upstream = await fetch(GAS_URL + '?blog_all=1', {
      redirect: 'follow',
      cf: { cacheTtl: 3600, cacheEverything: true }
    });
    if (!upstream.ok) {
      return new Response('<!-- upstream error: ' + upstream.status + ' -->', {
        status: 502,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
      });
    }
    const data = await upstream.json();
    const blog = Array.isArray(data.blog) ? data.blog : [];
    const today = new Date().toISOString().slice(0,10);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    STATIC.forEach(function(s) {
      xml += '  <url>\n';
      xml += '    <loc>' + SITE_URL + s.path + '</loc>\n';
      xml += '    <lastmod>' + today + '</lastmod>\n';
      xml += '    <changefreq>' + s.changefreq + '</changefreq>\n';
      xml += '    <priority>' + s.priority + '</priority>\n';
      xml += '  </url>\n';
    });

    blog.forEach(function(b) {
      if (!b || (!b.body && !b.title)) return;
      let slug = b.date || '';
      if (b.url) {
        const m = String(b.url).match(/\/blog\/([^\/\?#]+)/);
        if (m) slug = m[1];
        else {
          const m2 = String(b.url).match(/^([^\/\?#]+)/);
          if (m2) slug = m2[1].replace(/\/$/, '');
        }
      }
      if (!slug) return;
      const path = BLOG_URL_FMT.replace('{slug}', encodeURIComponent(slug));
      xml += '  <url>\n';
      xml += '    <loc>' + SITE_URL + path + '</loc>\n';
      xml += '    <lastmod>' + String(b.date || today) + '</lastmod>\n';
      xml += '    <changefreq>never</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>\n';
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });
  } catch (err) {
    return new Response('<!-- fetch err: ' + (err && err.message || err) + ' -->', {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' }
    });
  }
}
