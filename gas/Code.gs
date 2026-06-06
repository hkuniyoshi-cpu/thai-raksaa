/* ============================================================
   Code.gs — GAS Web App / CMS JSON API
   タイ古式 RAKSAA（ラクサー）
   ============================================================ */

const SS_ID = '1Wvqvl3aTWE_KDLQosoWTM5XYZbxTmmQHHjVFs0xGNfc';

/* ========================= Google Places API キー =========================
   Google Cloud Console → APIs & Services → Credentials → API キー を貼る
   APIの制限: Places API のみ許可
   ======================================================================= */
const PLACES_API_KEY = 'AIzaSyC7A9M0cSdJPVYJJIqa8289v0FGi_Xf4d8';

/* ========================= Google クチコミ同期 =========================
   手動または時間トリガーで実行 → Sheets reviews タブを最新クチコミで上書き
   初回実行時に Place ID を自動検索してキャッシュ（2回目以降は高速）
   ==================================================================== */

function _getPlaceId_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('RAKSAA_PLACE_ID');
  if (id) return id;                          // キャッシュ済みならそのまま返す
  // 未キャッシュ → findplacefromtext で取得
  const url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'
    + '?input='      + encodeURIComponent('タイ古式 RAKSAA ラクサー 那覇おもろまち')
    + '&inputtype=textquery'
    + '&fields=place_id'
    + '&key='        + PLACES_API_KEY;
  const json = JSON.parse(UrlFetchApp.fetch(url).getContentText());
  if (json.candidates && json.candidates.length > 0) {
    id = json.candidates[0].place_id;
    props.setProperty('RAKSAA_PLACE_ID', id);
    Logger.log('✅ Place ID をキャッシュしました: ' + id);
  } else {
    Logger.log('❌ Place ID が見つかりませんでした: ' + JSON.stringify(json));
  }
  return id;
}

function syncGoogleReviews() {
  if (!PLACES_API_KEY) { Logger.log('❌ PLACES_API_KEY が未設定です'); return; }

  const placeId = _getPlaceId_();
  if (!placeId) { Logger.log('❌ Place ID 取得失敗'); return; }

  const url = 'https://maps.googleapis.com/maps/api/place/details/json'
    + '?place_id='      + placeId
    + '&fields=reviews'
    + '&language=ja'
    + '&reviews_sort=newest'
    + '&key='           + PLACES_API_KEY;
  const json = JSON.parse(UrlFetchApp.fetch(url).getContentText());

  if (!json.result || !json.result.reviews || !json.result.reviews.length) {
    Logger.log('クチコミが見つかりません: ' + JSON.stringify(json.status));
    return;
  }

  const ss   = SpreadsheetApp.openById(SS_ID);
  const sh   = ss.getSheetByName(SH.REVIEWS);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 4).clearContent();

  json.result.reviews.forEach((r, i) => {
    const d  = new Date(r.time * 1000);
    const ds = d.getFullYear() + '-'
             + String(d.getMonth() + 1).padStart(2, '0') + '-'
             + String(d.getDate()).padStart(2, '0');
    sh.getRange(i + 2, 1, 1, 4).setValues([[
      r.author_name,
      r.rating,
      r.text || '',
      ds
    ]]);
  });
  Logger.log('✅ クチコミ同期完了: ' + json.result.reviews.length + '件');
}

/* 毎日自動実行するトリガー設定（一度だけ実行すればOK） */
function setupReviewsTrigger() {
  // 既存トリガーを削除してから登録（重複防止）
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncGoogleReviews')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncGoogleReviews')
    .timeBased().everyDays(1).atHour(6).create();
  Logger.log('✅ 毎日06:00に自動実行するトリガーを設定しました');
}

const SH = {
  SETTINGS : 'settings',
  HERO     : 'hero',
  ABOUT    : 'about',
  MENU     : 'menu',
  FEATURES : 'features',
  FOR_YOU  : 'forYou',
  REVIEWS  : 'reviews',
  BLOG     : 'blog',
  ACCESS   : 'access',
  SNS      : 'sns',
  DELIVERY : 'delivery',
  FAQ      : 'faq',
  CTA      : 'cta',
};

/* ========================= Entry point ========================= */
function doGet(e) {
  const ss      = SpreadsheetApp.openById(SS_ID);
  const blogAll = e && e.parameter && e.parameter.blog_all === '1';
  const data = {
    settings : getSettings(ss),
    hero     : getHero(ss),
    about    : getAbout(ss),
    menu     : getMenu(ss),
    features : getFeatures(ss),
    forYou   : getForYou(ss),
    reviews  : getReviews(ss),
    blog     : blogAll ? getAllBlog(ss) : getBlog(ss),
    access   : getAccess(ss),
    sns      : getSNS(ss),
    delivery : getDelivery(ss),
    faq      : getFAQ(ss),
    cta      : getCTA(ss),
  };
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========================= Helpers ========================= */
function rows(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1); // skip header row
}

function cellToDateStr(cell) {
  if (!cell) return '';
  if (cell instanceof Date) {
    const y = cell.getFullYear();
    const m = String(cell.getMonth() + 1).padStart(2, '0');
    const d = String(cell.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Sheets が日付シリアル値（数値）として格納した場合（例: 46167 → 2026-05-25）
  if (typeof cell === 'number' && cell > 40000 && cell < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30)); // Sheets エポック: 1899/12/30
    const d = new Date(epoch.getTime() + cell * 86400000);
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  }
  return String(cell);
}

function toDriveUrl(cell) {
  if (!cell) return '';
  const s = String(cell).trim();
  // Google Drive 共有URL → thumbnail URL に変換（uc?export=view より安定）
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
  if (s.startsWith('http')) return s;
  return '';
}

// key-value形式シート（A列=キー, B列=値）を Object に変換
function kvSheet(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return {};
  const obj = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) obj[String(r[0])] = String(r[1] || '');
  });
  return obj;
}

/* ========================= Section readers ========================= */
function getSettings(ss) { return kvSheet(ss, SH.SETTINGS); }

function getHero(ss) {
  const r = rows(ss, SH.HERO);
  return {
    subLines: r.filter(row => String(row[0]).toLowerCase() === 'sub')
               .map(row => String(row[1] || '')).filter(Boolean),
    photos  : r.filter(row => String(row[0]).toLowerCase() === 'photo')
               .map(row => ({ caption: String(row[1] || ''), image: toDriveUrl(row[2]) })),
  };
}

function getAbout(ss) {
  const r = rows(ss, SH.ABOUT);
  const qRow = r.find(row => String(row[0]).toLowerCase() === 'quote');
  return {
    paragraphs: r.filter(row => String(row[0]).toLowerCase() === 'para')
                 .map(row => String(row[1] || '')).filter(Boolean),
    quote     : qRow ? String(qRow[1] || '') : '',
    photos    : r.filter(row => String(row[0]).toLowerCase() === 'photo')
                 .map(row => ({ caption: String(row[1] || ''), image: toDriveUrl(row[2]) })),
  };
}

function getMenu(ss) {
  return rows(ss, SH.MENU)
    .filter(r => r[0])
    .map(r => ({
      name      : String(r[0] || ''),
      price     : String(r[1] || ''),
      desc      : String(r[2] || ''),
      bestSeller: String(r[3] || '').toLowerCase() === 'true' || r[3] === true || r[3] === 1,
      image     : toDriveUrl(r[4]),
    }));
}

function getFeatures(ss) {
  return rows(ss, SH.FEATURES)
    .filter(r => r[1])
    .map((r, i) => ({
      num  : String(r[0] || String(i + 1).padStart(2, '0')),
      title: String(r[1] || ''),
      desc : String(r[2] || ''),
    }));
}

function getForYou(ss) {
  return rows(ss, SH.FOR_YOU)
    .filter(r => r[0])
    .map(r => ({
      label  : String(r[0] || ''),
      caption: String(r[1] || ''),
      image  : toDriveUrl(r[2]),
    }));
}

function getReviews(ss) {
  return rows(ss, SH.REVIEWS)
    .filter(r => r[0])
    .map(r => ({
      name : String(r[0] || ''),
      stars: parseInt(r[1], 10) || 5,
      text : String(r[2] || ''),
      date : cellToDateStr(r[3]),
    }));
}

function _blogRows_(ss) {
  return rows(ss, SH.BLOG)
    .filter(r => r[1] || r[2])
    .reverse()
    .map(r => {
      const isNew = ['published', 'draft'].includes(String(r[6] || '').trim().toLowerCase());
      if (isNew) {
        return {
          date    : cellToDateStr(r[1]),
          title   : String(r[2] || ''),
          body    : String(r[3] || ''),
          image   : toDriveUrl(r[4]),
          url     : String(r[5] || ''),
          status  : String(r[6]).trim().toLowerCase(),
          ctaLabel: String(r[7] || ''),
        };
      }
      return {
        date: cellToDateStr(r[1]), title: String(r[2] || ''),
        body: '', image: toDriveUrl(r[3]), url: '',
        status: 'published', ctaLabel: '',
      };
    });
}

/* 通常モード: 今日以前の published のみ・最新4件 */
function getBlog(ss) {
  // タイムゾーンバグ修正: JST での今日日付を文字列比較で使用
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return _blogRows_(ss)
    .filter(b => {
      if (b.status === 'draft') return false;
      if (b.date && b.date > todayStr) return false;
      return true;
    })
    .sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    })
    .slice(0, 4);
}

/* 全件モード: blog/index.html（詳細ページ）が ?blog_all=1 で呼ぶ */
function getAllBlog(ss) {
  return _blogRows_(ss).filter(b => b.status !== 'draft');
}

function getAccess(ss)   { return kvSheet(ss, SH.ACCESS); }

function getSNS(ss) {
  return rows(ss, SH.SNS)
    .filter(r => r[0])
    .map(r => ({
      platform: String(r[0] || ''),
      handle  : String(r[1] || ''),
      desc    : String(r[2] || ''),
      url     : String(r[3] || ''),
    }));
}

function getDelivery(ss) {
  return rows(ss, SH.DELIVERY)
    .filter(r => r[0])
    .map(r => ({
      type   : String(r[0] || ''),
      title  : String(r[1] || ''),
      desc   : String(r[2] || ''),
      btnText: String(r[3] || ''),
      url    : String(r[4] || ''),
    }));
}

function getFAQ(ss) {
  return rows(ss, SH.FAQ)
    .filter(r => r[0])
    .map(r => ({
      q: String(r[0] || ''),
      a: String(r[1] || ''),
    }));
}

function getCTA(ss) { return kvSheet(ss, SH.CTA); }
