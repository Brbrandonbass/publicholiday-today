const fs = require('fs');
const path = require('path');
const { COUNTRIES, COMMON_DESCRIPTIONS, COUNTRY_OVERRIDES } = require('./content');

const DATA_DIR = path.join(__dirname, 'data');
const OUT_DIR = path.join(__dirname, '..', 'holidays');
fs.mkdirSync(OUT_DIR, { recursive: true });

function describe(code, name, localName) {
  const overrides = COUNTRY_OVERRIDES[code];
  if (overrides) {
    if (overrides[name]) return overrides[name];
    if (overrides[localName]) return overrides[localName];
  }
  const hay = `${name} ${localName}`;
  for (const [re, desc] of COMMON_DESCRIPTIONS) {
    if (re.test(hay)) return desc;
  }
  return `An official public holiday observed as part of the national calendar.`;
}

function dayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
function longDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function regionLabel(h) {
  if (h.global) return 'National';
  if (h.counties && h.counties.length) return h.counties.join(', ');
  return 'Regional';
}

function buildRows(holidays) {
  // De-duplicate identical date+localName rows (Nager sometimes repeats a holiday once per county)
  const seen = new Map();
  for (const h of holidays) {
    const key = h.date + '|' + h.localName;
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (!existing.global && h.global) existing.global = true;
      if (h.counties) existing.counties = [...new Set([...(existing.counties||[]), ...h.counties])];
    } else {
      seen.set(key, { ...h });
    }
  }
  return [...seen.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function pageHtml(code, meta, holidays) {
  const rows = buildRows(holidays);
  const title = `Public Holidays in ${meta.name.replace(/^the /,'')} 2026 — Complete Guide`;
  const desc = `Full list of ${rows.length} public holidays in ${meta.name} for 2026, with dates, days of the week, and what each holiday celebrates. Updated official calendar.`;
  const url = `https://publicholiday.today/holidays/${code}`;

  const tableRows = rows.map(h => `
      <tr>
        <td class="hd-date">${longDate(h.date)}</td>
        <td class="hd-day">${dayName(h.date)}</td>
        <td class="hd-name">${escapeHtml(h.localName)}${h.localName!==h.name?`<span class="hd-en">${escapeHtml(h.name)}</span>`:''}</td>
        <td class="hd-region">${escapeHtml(regionLabel(h))}</td>
      </tr>`).join('');

  const nationalOnly = rows.filter(h=>h.global);
  const descList = nationalOnly.map(h => `
      <div class="hd-card">
        <div class="hd-card-top"><span class="hd-card-date">${longDate(h.date)}</span><span class="hd-card-day">${dayName(h.date)}</span></div>
        <div class="hd-card-name">${escapeHtml(h.localName)}</div>
        <div class="hd-card-desc">${describe(code, h.name, h.localName)}</div>
      </div>`).join('');

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": desc,
    "url": url,
    "dateModified": "2026-01-01",
    "publisher": { "@type": "Organization", "name": "publicholiday.today", "url": "https://publicholiday.today" },
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": nationalOnly.map((h,i) => ({
        "@type": "ListItem", "position": i+1,
        "item": { "@type": "Event", "name": h.localName, "startDate": h.date, "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode" }
      }))
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="publicholiday.today">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<script type="application/ld+json">${JSON.stringify(schema)}</script>

<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3483931747806619" crossorigin="anonymous"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#f6f3ee;--surface:#fff;--ink:#1c1814;--muted:#9a8f82;
  --border:#e6dfd5;--yes:#1a6b3a;--yes-bg:#e6f4ec;
  --no:#7a3b1e;--accent:#d4522a;--r:20px;
  --sh:0 4px 32px rgba(0,0,0,.08),0 1px 4px rgba(0,0,0,.04);
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;flex-direction:column;}
nav{position:relative;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--border);background:rgba(246,243,238,.9);backdrop-filter:blur(8px);}
.nav-logo{font-family:'Playfair Display',serif;font-size:16px;font-style:italic;color:var(--ink);text-decoration:none;}
.nav-links{display:flex;gap:8px;}
.nav-link{font-size:12px;font-weight:500;padding:7px 14px;border-radius:100px;text-decoration:none;color:var(--muted);transition:all .2s;border:1px solid transparent;}
.nav-link:hover{color:var(--ink);border-color:var(--border);}
.nav-link.cta{background:var(--ink);color:#fff;border-color:var(--ink);}
.page{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;padding:28px 16px 56px;max-width:760px;margin:0 auto;width:100%;gap:16px;}
.breadcrumb{align-self:flex-start;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);flex-wrap:wrap;}
.breadcrumb a{color:var(--muted);text-decoration:none;}
.breadcrumb a:hover{color:var(--ink);}
.hero-flag{font-size:40px;}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(24px,5vw,34px);font-weight:700;text-align:center;line-height:1.2;letter-spacing:-.3px;}
.hero-sub{font-size:13px;color:var(--muted);text-align:center;max-width:520px;}
.seo-block{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:24px 26px;font-size:14px;line-height:1.75;color:#4a4038;}
.check-cta{width:100%;text-decoration:none;display:block;}
.check-cta-inner{background:linear-gradient(135deg,#1a6b3a,#2d9e58);border-radius:20px;padding:20px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 4px 20px rgba(26,107,58,.25);}
.check-cta-inner span.emoji{font-size:32px;flex-shrink:0;}
.check-cta-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#fff;margin-bottom:2px;}
.check-cta-sub{font-size:12px;color:rgba(255,255,255,.8);font-weight:300;}
.section-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);font-weight:500;align-self:flex-start;padding-left:4px;}
.hd-cards{width:100%;display:flex;flex-direction:column;gap:8px;}
.hd-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 18px;}
.hd-card-top{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px;}
.hd-card-name{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;margin-bottom:4px;}
.hd-card-desc{font-size:13px;color:#4a4038;line-height:1.6;}
.table-wrap{width:100%;overflow-x:auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:520px;}
thead th{text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:600;padding:14px 16px;border-bottom:1px solid var(--border);}
tbody td{padding:12px 16px;border-bottom:1px solid var(--border);vertical-align:top;}
tbody tr:last-child td{border-bottom:none;}
.hd-date{font-weight:500;white-space:nowrap;}
.hd-day{color:var(--muted);white-space:nowrap;}
.hd-name{font-weight:500;}
.hd-en{display:block;font-size:11px;color:var(--muted);font-weight:300;}
.hd-region{color:var(--muted);font-size:12px;}
.ad-wrapper{width:100%;border:1px dashed var(--border);border-radius:14px;padding:14px 16px;text-align:center;}
.ad-tag{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:8px;}
footer{position:relative;z-index:1;border-top:1px solid var(--border);padding:24px 24px 32px;font-size:11px;color:var(--muted);font-weight:300;line-height:2;}
.footer-inner{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:flex-start;}
.footer-col h4{font-size:11px;font-weight:600;color:var(--ink);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;}
.footer-links{display:flex;flex-direction:column;gap:4px;}
.footer-links a{color:var(--muted);text-decoration:none;font-size:11px;}
.footer-links a:hover{color:var(--ink);}
.footer-bottom{max-width:960px;margin:16px auto 0;padding-top:16px;border-top:1px solid var(--border);font-size:10px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.footer-bottom a{color:var(--muted);text-decoration:none;}
@media(max-width:400px){.nav-links .nav-link:not(.cta){display:none;}}
</style>
</head>
<body>
<nav>
  <a class="nav-logo" href="/">publicholiday.today</a>
  <div class="nav-links">
    <a class="nav-link" href="/leave">🗓️ Leave Planner</a>
    <a class="nav-link" href="/calculate">📆 Business Days</a>
    <a class="nav-link cta" href="/api">API for Devs →</a>
  </div>
</nav>
<div class="page">
  <div class="breadcrumb"><a href="/">Home</a> <span>›</span> <a href="/holidays">Holidays</a> <span>›</span> <span>${escapeHtml(meta.name)}</span></div>
  <span class="hero-flag">${meta.flag}</span>
  <h1 class="hero-title">Public Holidays in ${escapeHtml(meta.name)} <em style="font-style:italic;color:var(--accent)">2026</em></h1>
  <p class="hero-sub">${rows.length} public and regional holidays observed across ${escapeHtml(meta.name)} in 2026.</p>

  <div class="seo-block">
    <p>${meta.intro}</p>
  </div>

  <a class="check-cta" href="/${code}">
    <div class="check-cta-inner">
      <span class="emoji">🎉</span>
      <div>
        <div class="check-cta-title">Is today a holiday in ${escapeHtml(meta.short)}?</div>
        <div class="check-cta-sub">Get an instant yes/no answer with our live holiday checker →</div>
      </div>
    </div>
  </a>

  <div class="ad-wrapper">
    <span class="ad-tag">Advertisement</span>
    <ins class="adsbygoogle" style="display:block;width:100%;min-height:90px;" data-ad-client="ca-pub-3483931747806619" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>

  <div class="section-label">Full 2026 Calendar</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Date</th><th>Day</th><th>Holiday</th><th>Observed</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <div class="section-label">What Each Holiday Means</div>
  <div class="hd-cards">${descList}</div>

  <div class="seo-block">
    <p style="font-size:12px;color:var(--muted)">Holiday dates sourced from the <a href="https://date.nager.at" style="color:var(--muted)">Nager.Date public holiday API</a> and cross-checked annually. Regional and subnational holidays may not apply to every worker in ${escapeHtml(meta.name)} — always confirm with your employer or local authority for time-off purposes.</p>
  </div>
</div>
<footer>
  <div class="footer-inner">
    <div class="footer-col">
      <h4>publicholiday.today</h4>
      <div style="font-size:11px;color:var(--muted);max-width:200px;line-height:1.6;">The simplest way to check if today is a public holiday, anywhere in the world.</div>
    </div>
    <div class="footer-col">
      <h4>Popular</h4>
      <div class="footer-links">
        <a href="/holidays/US">🇺🇸 United States</a>
        <a href="/holidays/GB">🇬🇧 United Kingdom</a>
        <a href="/holidays/AU">🇦🇺 Australia</a>
        <a href="/holidays/CA">🇨🇦 Canada</a>
        <a href="/holidays/ZA">🇿🇦 South Africa</a>
      </div>
    </div>
    <div class="footer-col">
      <h4>Developers</h4>
      <div class="footer-links">
        <a href="/api">Holiday API</a>
        <a href="/api/docs">Documentation</a>
        <a href="/api/pricing">Pricing</a>
      </div>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <div class="footer-links">
        <a href="/about">About</a>
        <a href="/calculate">Business Days Calculator</a>
        <a href="/privacy">Privacy Policy</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 publicholiday.today · Holiday data via <a href="https://date.nager.at">Nager.Date</a></span>
    <span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span>
  </div>
</footer>
</body>
</html>
`;
}

const codes = Object.keys(COUNTRIES);
for (const code of codes) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${code}.json`)));
  const html = pageHtml(code, COUNTRIES[code], raw);
  fs.writeFileSync(path.join(OUT_DIR, `${code}.html`), html);
  console.log(`Built holidays/${code}.html (${raw.length} raw entries)`);
}
console.log('Done:', codes.join(', '));
