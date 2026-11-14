const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $('#analyze-form'), url: $('#subscription-url'), text: $('#subscription-text'), offset: $('#start-offset'),
  start: $('#start-button'), error: $('#form-error'), progress: $('#progress-panel'), progressTitle: $('#progress-title'),
  progressCount: $('#progress-count'), progressBar: $('#progress-bar'), progressMessage: $('#progress-message'), history: $('#history-list'),
  results: $('#results-section'), resultsTitle: $('#results-title'), resultsSummary: $('#results-summary'), search: $('#result-search'), countries: $('#country-results'),
};
const dictionaries = {
  fa: {
    skip:'رفتن به بخش اصلی', private:'محیط خصوصی', xray:'تست واقعی با Xray', darkTheme:'تیره', lightTheme:'روشن', logout:'خروج', toolTitle:'بررسی اوتباند', toolSubtitle:'بررسی، مقایسه و آماده‌سازی خروجی JSON', scanOptions:'گزینه‌های بررسی', checkExit:'بررسی IP خروجی',
    eyebrow:'ابزار بررسی اشتراک', headline:'مسیر سالم را<br><span>سریع و شفاف پیدا کن.</span>',
    intro:'اتصال‌های VLESS، Shadowsocks و Hysteria2 را از مسیر واقعی بررسی کن؛ RTT، کشور IP خروجی و دسترسی HTTPS به سرویس‌ها را ببین.',
    proof1:'TLS یا Reality', proof2:'آزمون با Xray', proof3:'RTT و سرویس‌ها', step1:'گام اول', sourceTitle:'منبع کانفیگ را وارد کن', encrypted:'ارتباط رمزگذاری‌شده',
    tabUrl:'لینک اشتراک', tabText:'متن کانفیگ', urlLabel:'آدرس HTTPS اشتراک', urlHint:'آدرس فقط برای دریافت همین نوبت بررسی می‌شود.',
    textLabel:'کانفیگ‌ها یا متن اشتراک', textHint:'متن ساده یا Base64 پذیرفته می‌شود.', offsetLabel:'شروع از کانفیگ', batchLabel:'تست هم‌زمان',
    batchHint:'هر دسته با Xray مشترک بررسی می‌شود.', start:'شروع بررسی', busy:'در حال بررسی…',
    whatChecked:'چه چیزی بررسی می‌شود؟', methodTitle:'پاسخ واقعی،<br>معیار موفقیت است.',
    methodCopy:'Xray از هر کانفیگ وصل می‌شود و درخواست‌های HTTPS را از همان تونل می‌فرستد.',
    encryptedOnly:'رمزنگاری', tlsRealityOnly:'TLS، Reality یا رمزنگاری پروتکل', fullConnection:'اتصال کامل', httpsReply:'پاسخ HTTPS از مسیر تونل', serviceAccess:'دسترسی سرویس',
    privacy:'بررسی سرویس‌ها فقط دسترسی HTTPS را می‌سنجد و ورود به حساب را آزمایش نمی‌کند.', running:'بررسی در حال اجرا',
    connecting:'در حال اتصال به کانفیگ‌ها', interrupted:'بررسی قبلی نیمه‌کاره ماند', completed:'بررسی تمام شد',
    xrayRunning:'Xray در حال آزمایش مسیرهاست.', batchProgress:(n)=>`Xray در حال آزمایش دسته‌های ${faNum.format(n)}تایی است؛ این صفحه را باز نگه دار.`,
    progressCount:(d,t,s)=>`${faNum.format(d)} از ${faNum.format(t)} · موفق ${faNum.format(s)}`,
    doneCount:(s,t)=>`${faNum.format(s)} اتصال موفق از ${faNum.format(t)} مورد.`,
    historyLabel:'سابقهٔ بررسی', historyTitle:'نتیجه‌های قبلی', refresh:'تازه‌سازی', loadingHistory:'در حال دریافت سابقه…',
    noHistory:'هنوز بررسی‌ای ذخیره نشده است.', historyError:'دریافت سابقه انجام نشد', openHistory:'بازکردن نتایج', rescan:'اجرای دوباره', rescanUrlPrompt:'لینک ساب این بررسی در سابقهٔ قدیمی ذخیره نشده. لینک را وارد کن تا دوباره بررسی شود:',
    historySuccess:(s,t,o)=>`${faNum.format(s)} موفق از ${faNum.format(t)} · شروع ${faNum.format(o+1)}`,
    resultsLabel:'خروجی بررسی', resultTitle:'کانفیگ‌های موفق', resultsLoading:'در حال دریافت نتیجه‌ها به بخش‌های کوچک…',
    loading:'در حال بارگذاری…', loadErr:'نتیجه‌ها بارگذاری نشدند', retryHistory:'می‌توانی دوباره از سابقه همین بررسی را باز کنی.',
    resultsLoaded:(s,t)=>`${faNum.format(s)} نتیجهٔ موفق · ${faNum.format(t)} کانفیگ بررسی‌شده · بارگذاری مرحله‌ای`,
    resultsChunk:(a,b)=>`دریافت ${faNum.format(a)} از ${faNum.format(b)} نتیجهٔ موفق…`,
    noSearch:'نتیجه‌ای با این جست‌وجو پیدا نشد.', noSuccess:'در این بررسی اتصال موفقی پیدا نشد.',
    noName:'کانفیگ بدون نام', rttLabel:'RTT HTTP', routeLatency:'سرور → اینترنت', routeLatencyHint:'زمان TCP/TLS از سرور بررسی تا مقصد از مسیر این اوتباند؛ پینگ ICMP نیست.', pingAgain:'چک پینگ مجدد', pingAll:'پینگ همه', pingAllChecking:'در حال پینگ همه…', pingChecking:'در حال سنجش…', pingFailed:'بدون پاسخ', speedTest:'تست دانلود', speedTesting:'در حال تست…', speedFailed:'تست سرعت انجام نشد', speedResult:(rate,seconds)=>`میانگین مجموع ۴ اتصال: ${faNum.format(rate)} مگابایت‌برثانیه · ${faNum.format(seconds)} ثانیه`, timingNotSaved:'جزئیات زمان‌بندی برای این نتیجه ذخیره نشده است.', proxyConnect:'اتصال پراکسی', tlsViaOutbound:'TLS از تونل', firstByte:'اولین پاسخ', exitIp:'IP خروجی', countryUnknown:'کشور نامشخص',
    oldService:'بررسی نشده', reachable:'دسترسی دارد', unavailable:'دسترسی ندارد', noReply:'بدون پاسخ', httpStatus:'HTTP', selectConfig:'انتخاب کانفیگ', incompatible:'نیازمند بررسی', unsupportedOutbound:'ساختار اوتباند معتبر نیست', requiredFields:'آدرس، پورت یا اطلاعات احراز هویت ناقص است', unsupportedTransport:'انتقال با Xray پشتیبانی نمی‌شود', unsupportedSecurity:'امنیت این کانفیگ پشتیبانی نمی‌شود', missingReality:'SNI یا Public Key در Reality ناقص است', missingSni:'SNI در TLS ناقص است', protocol:'پروتکل', transport:'انتقال',
    configCopy:'کپی کانفیگ', copied:'کپی شد', ready:'آماده شد', copyAll:'کپی همه', copyJson:'کپی JSON', downloadJson:'دانلود JSON',
    allConfigs:'همهٔ کانفیگ‌ها', connections:(n)=>`${faNum.format(n)} اتصال`, sortedName:'مرتب‌شده بر اساس نام', sortRtt:'کمترین RTT', sortName:'نام', sortCountry:'کشور', allProtocols:'همهٔ پروتکل‌ها', anyService:'همهٔ سرویس‌ها', selectionCount:(n)=>`${faNum.format(n)} انتخاب`, selectVisible:'انتخاب موارد قابل‌مشاهده', clearSelection:'پاک‌کردن انتخاب', exportSelected:'کپی JSON انتخاب‌ها', exportAll:'کپی JSON همه', hideDuplicates:'پنهان‌کردن تکراری‌ها', duplicate:'تکراری', outboundReady:'خروجی معتبر', allCountries:'همهٔ کشورها',
    footerBrand:'بخشی از خانوادهٔ پروژه‌های Connecso', footerByline:'ساخته Taha · @SocalledTaha', footerPromo:'کلاینت VPN مبتنی بر V2Ray برای Windows و Android', footerProject:'مزاد کد', footerDownload:'دریافت Connecso', footerAndroid:'Android · 0.2', footerDownloadTip:'کلاینت VPN مبتنی بر V2Ray برای Windows و Android',
    askUrl:'آدرس HTTPS اشتراک را وارد کن.', askText:'متن کانفیگ‌ها را وارد کن.', reading:'در حال خواندن و اعتبارسنجی ورودی…',
    newResults:'نتیجهٔ بررسی جدید', savedResults:'نتیجه‌های ذخیره‌شده', noReplyText:'پاسخ HTTPS از مسیر کانفیگ دریافت نشد.',
    serviceHint:'دسترسی فقط با درخواست HTTPS بررسی می‌شود؛ وضعیت ممکن است با محدودیت منطقه‌ای سرویس فرق داشته باشد.',
    themeLabel:'تغییر تم', langLabel:'Switch to English', healthError:'ارتباط با سرویس برقرار نشد',
  },
  en: {
    skip:'Skip to main content', private:'Private workspace', xray:'Live Xray checks', darkTheme:'Dark', lightTheme:'Light', logout:'Log out', toolTitle:'Outbound checks', toolSubtitle:'Check, compare, and prepare outbound JSON', scanOptions:'Check options', checkExit:'Check exit IP',
    eyebrow:'Subscription route audit', headline:'Find working routes<br><span>quickly and clearly.</span>',
    intro:'Test VLESS, Shadowsocks, and Hysteria2 through a real route. Review RTT, exit IP country, and HTTPS reachability for popular services.',
    proof1:'TLS or Reality', proof2:'Tested with Xray', proof3:'RTT and services', step1:'STEP 1', sourceTitle:'Choose a configuration source', encrypted:'Encrypted connection',
    tabUrl:'Subscription URL', tabText:'Paste configs', urlLabel:'HTTPS subscription URL', urlHint:'The URL is fetched only for this audit.',
    textLabel:'Configurations or subscription text', textHint:'Plain text or Base64 is accepted.', offsetLabel:'Start at config', batchLabel:'Concurrent checks',
    batchHint:'Each batch is checked through one shared Xray instance.', start:'Start audit', busy:'Checking…',
    whatChecked:'What gets checked?', methodTitle:'A real response<br>is the success signal.',
    methodCopy:'Xray connects with each config and sends HTTPS requests through that same tunnel.',
    encryptedOnly:'Encryption', tlsRealityOnly:'TLS, Reality, or protocol encryption', fullConnection:'Full connection', httpsReply:'HTTPS reply through the tunnel', serviceAccess:'Service access',
    privacy:'Service checks measure HTTPS reachability only. They do not sign in to accounts.', running:'AUDIT IN PROGRESS',
    connecting:'Connecting through configurations', interrupted:'Previous audit was interrupted', completed:'Audit complete',
    xrayRunning:'Xray is testing the routes.', batchProgress:(n)=>`Xray is testing batches of ${n} configs. Keep this page open.`,
    progressCount:(d,t,s)=>`${d} of ${t} · ${s} working`, doneCount:(s,t)=>`${s} working routes out of ${t}.`,
    historyLabel:'AUDIT HISTORY', historyTitle:'Previous results', refresh:'Refresh', loadingHistory:'Loading history…',
    noHistory:'No saved audits yet.', historyError:'Could not load history', openHistory:'Open results', rescan:'Run again', rescanUrlPrompt:'This older audit did not save its subscription URL. Enter the URL to run it again:',
    historySuccess:(s,t,o)=>`${s} working of ${t} · starts at ${o+1}`,
    resultsLabel:'AUDIT OUTPUT', resultTitle:'Working configurations', resultsLoading:'Loading results in small sections…',
    loading:'Loading…', loadErr:'Could not load results', retryHistory:'You can reopen this audit from history.',
    resultsLoaded:(s,t)=>`${s} working results · ${t} configs checked · loaded in pages`,
    resultsChunk:(a,b)=>`Loading ${a} of ${b} working results…`,
    noSearch:'No results match this search.', noSuccess:'No working connections were found in this audit.',
    noName:'Unnamed config', rttLabel:'HTTP RTT', routeLatency:'Server → internet', routeLatencyHint:'TCP/TLS time measured from this audit server to the destination through this outbound; this is not ICMP ping.', pingAgain:'Check ping again', pingAll:'Ping all', pingAllChecking:'Pinging all…', pingChecking:'Checking…', pingFailed:'No response', speedTest:'Download test', speedTesting:'Testing…', speedFailed:'Speed test failed', speedResult:(rate,seconds)=>`4-stream average: ${rate} MB/s · ${seconds}s`, timingNotSaved:'Timing details were not saved for this result.', proxyConnect:'Proxy connect', tlsViaOutbound:'TLS via outbound', firstByte:'First byte', exitIp:'Exit IP', countryUnknown:'Unknown country',
    oldService:'Not checked', reachable:'Reachable', unavailable:'Unavailable', noReply:'No response', httpStatus:'HTTP', selectConfig:'Select configuration', incompatible:'Check required', unsupportedOutbound:'Invalid outbound structure', requiredFields:'Address, port, or authentication data is missing', unsupportedTransport:'Transport is unsupported by Xray', unsupportedSecurity:'This security mode is unsupported', missingReality:'Reality SNI or public key is missing', missingSni:'TLS SNI is missing', protocol:'Protocol', transport:'Transport',
    configCopy:'Copy config', copied:'Copied', ready:'Ready', copyAll:'Copy all', copyJson:'Copy JSON', downloadJson:'Download JSON',
    allConfigs:'All configurations', connections:(n)=>`${n} routes`, sortedName:'sorted by name', sortRtt:'Lowest RTT', sortName:'Name', sortCountry:'Country', allProtocols:'All protocols', anyService:'Any service', selectionCount:(n)=>`${n} selected`, selectVisible:'Select visible', clearSelection:'Clear selection', exportSelected:'Copy selected JSON', exportAll:'Copy all JSON', hideDuplicates:'Hide duplicates', duplicate:'Duplicate', outboundReady:'Valid outbound', allCountries:'All countries',
    footerBrand:'Part of the Connecso Projects family', footerByline:'Made by Taha · @SocalledTaha', footerPromo:'A V2Ray-based VPN client for Windows and Android', footerProject:'Source code', footerDownload:'Get Connecso', footerAndroid:'Android · 0.2', footerDownloadTip:'A V2Ray-based VPN client for Windows and Android',
    askUrl:'Enter an HTTPS subscription URL.', askText:'Paste one or more supported configs.', reading:'Reading and validating input…',
    newResults:'New audit results', savedResults:'Saved audit results', noReplyText:'No HTTPS response came through this route.',
    serviceHint:'Checks use HTTPS requests only; regional service restrictions may affect availability.',
    themeLabel:'Toggle theme', langLabel:'تغییر زبان به فارسی', healthError:'Could not connect to the audit service',
  },
};
const faNum = new Intl.NumberFormat('fa-IR');
const state = { currentResults: [], currentJob: '', busy: false, view: 'country', sortBy: 'rtt', selectedCountry: 'all', selectedUris: new Set(), visibleIndices: [], lang: localStorage.getItem('vless-audit-lang') || 'fa', lastJob: null, lastPingUri: '' };
function t(key, ...args) { const value = dictionaries[state.lang][key] ?? dictionaries.fa[key] ?? key; return typeof value === 'function' ? value(...args) : value; }
function number(value) { return state.lang === 'fa' ? faNum.format(value) : new Intl.NumberFormat('en-US').format(value); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]); }
function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((node) => { const value = t(node.dataset.i18n); node.innerHTML = value; });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll('[data-placeholder]').forEach((node) => { node.placeholder = t(node.dataset.placeholder); });
  $('#language-toggle').textContent = state.lang === 'fa' ? 'EN' : 'FA';
  $('#language-toggle').setAttribute('aria-label', t('langLabel'));
  $('#theme-toggle').setAttribute('aria-label', t('themeLabel'));
  $('#theme-toggle [data-theme-label]').textContent = t(document.documentElement.dataset.theme === 'dark' ? 'lightTheme' : 'darkTheme');
  document.querySelectorAll('.tab').forEach((tab) => { const key = tab.dataset.mode === 'url' ? 'tabUrl' : 'tabText'; tab.textContent = t(key); });
  document.querySelectorAll('.view-tab').forEach((tab) => { tab.textContent = t(tab.dataset.view === 'country' ? 'byCountry' : 'byName'); });
  if (state.lastJob) setProgress(state.lastJob);
  renderResults();
  loadHistory();
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('vless-audit-theme', theme);
  $('#theme-toggle .theme-symbol').textContent = theme === 'dark' ? '☼' : '☾';
  $('#theme-toggle [data-theme-label]').textContent = t(theme === 'dark' ? 'lightTheme' : 'darkTheme');
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#080c10' : '#f3f8fb';
}
function showError(message = '') { elements.error.textContent = message; elements.error.hidden = !message; }
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  let data; try { data = await response.json(); } catch { throw new Error(state.lang === 'fa' ? 'پاسخ سرور قابل خواندن نبود.' : 'The server response could not be read.'); }
  if (!response.ok) throw new Error(data.error || `${state.lang === 'fa' ? 'خطای سرور' : 'Server error'} (${response.status})`);
  return data;
}
function setBusy(busy) { state.busy = busy; elements.start.disabled = busy; elements.start.querySelector('span:first-child').textContent = t(busy ? 'busy' : 'start'); }
function setProgress(job, detail = '') {
  state.lastJob = job; elements.progress.hidden = false;
  elements.progressTitle.textContent = job.finished ? (job.interrupted ? t('interrupted') : t('completed')) : t('connecting');
  elements.progressCount.textContent = t('progressCount', number(job.done || 0), number(job.total || 0), number(job.success || 0));
  elements.progressBar.style.width = `${job.total ? Math.min(100, (job.done / job.total) * 100) : 0}%`;
  elements.progressMessage.textContent = detail || job.message || (job.finished ? t('doneCount', number(job.success || 0), number(job.total || 0)) : t('batchProgress', number(job.batchSize || 10)));
}
function dateLabel(value) {
  const parsed = new Date(String(value).replace(' UTC', 'Z'));
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(state.lang === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle:'medium', timeStyle:'short' }).format(parsed);
}
async function loadHistory() {
  elements.history.innerHTML = `<div class="empty-history">${escapeHtml(t('loadingHistory'))}</div>`;
  try {
    const items = await api('/api/history');
    if (!items.length) { elements.history.innerHTML = `<div class="empty-history">${escapeHtml(t('noHistory'))}</div>`; return; }
    elements.history.innerHTML = items.map((job) => `<article class="history-card"><div class="history-meta"><strong>${escapeHtml(job.id)}</strong><span>${escapeHtml(dateLabel(job.created))}</span><small>${escapeHtml(t('historySuccess', number(job.success), number(job.total), number(job.offset || 0)))}</small></div><div class="history-actions"><button class="open-history" type="button" data-open-job="${escapeHtml(job.id)}">${escapeHtml(t('openHistory'))}</button><button class="open-history rescan-history" type="button" data-rescan-job="${escapeHtml(job.id)}" data-needs-url="${job.needsRescanUrl ? 'true' : 'false'}">↻ ${escapeHtml(t('rescan'))}</button></div></article>`).join('');
  } catch (error) { elements.history.innerHTML = `<div class="empty-history">${escapeHtml(t('historyError'))}: ${escapeHtml(error.message)}</div>`; }
}
async function loadResults(jobId, title = t('resultTitle')) {
  elements.results.hidden = false; elements.resultsTitle.textContent = title; elements.resultsSummary.textContent = t('resultsLoading');
  elements.countries.innerHTML = `<div class="empty-history">${escapeHtml(t('loading'))}</div>`;
  elements.results.scrollIntoView({ behavior:'smooth', block:'start' });
  const all = []; let info = null;
  try {
    for (let offset = 0; ; offset += 12) {
      const chunk = await api(`/api/jobs/${encodeURIComponent(jobId)}?offset=${offset}&limit=12`); info = chunk; all.push(...chunk.results);
      elements.resultsSummary.textContent = t('resultsChunk', number(all.length), number(chunk.success));
      if (all.length >= chunk.success || chunk.results.length === 0) break;
    }
    state.currentResults = all; state.currentJob = jobId; state.selectedCountry = 'all'; state.selectedUris.clear(); elements.search.value = ''; renderResults();
    elements.resultsSummary.textContent = t('resultsLoaded', number(all.length), number(info?.total || all.length));
  } catch (error) { elements.countries.innerHTML = `<div class="empty-history">${escapeHtml(t('loadErr'))}: ${escapeHtml(error.message)}</div>`; elements.resultsSummary.textContent = t('retryHistory'); }
}
function searchable(item) { return `${item.country || ''} ${item.name || ''} ${item.endpoint || ''} ${item.ip || ''} ${item.security || ''} ${item.protocol || ''} ${item.transport || ''}`.toLocaleLowerCase(); }
const serviceIcons = {
  gemini:'<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#8ab4f8" d="M8 0c.8 3.6 2.4 5.2 8 8-5.6 2.8-7.2 4.4-8 8C7.2 12.4 5.6 10.8 0 8 5.6 5.2 7.2 3.6 8 0Z"/></svg>',
  youtube:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="3" fill="#ff3344"/><path d="m7 5.5 4 2.5-4 2.5z" fill="white"/></svg>',
  instagram:'<svg viewBox="0 0 16 16" aria-hidden="true"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#ffb13b"/><stop offset=".55" stop-color="#ed3d83"/><stop offset="1" stop-color="#7544d8"/></linearGradient></defs><rect x="1" y="1" width="14" height="14" rx="4" fill="url(#ig)"/><rect x="4" y="4" width="8" height="8" rx="2.7" fill="none" stroke="white" stroke-width="1.2"/><circle cx="8" cy="8" r="1.8" fill="none" stroke="white" stroke-width="1.1"/><circle cx="11.2" cy="4.8" r=".8" fill="white"/></svg>',
  telegram:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#27a9e8"/><path d="m3.3 7.7 8.8-3.4c.4-.15.75.1.6.65l-1.5 7.1c-.1.5-.4.6-.8.35L8 10.3l-1.2 1.15c-.13.13-.24.24-.5.24l.18-2.7 4.9-4.4c.2-.18-.05-.26-.3-.09L5 8.3 2.8 7.6c-.48-.16-.5-.48.5-.88Z" fill="white"/></svg>',
};
const serviceNames = { gemini:'Gemini', youtube:'YouTube', instagram:'Instagram', telegram:'Telegram' };
function outboundIssues(item) {
  const outbound = item.outbound;
  if (!outbound) return [t('unsupportedOutbound')];
  const settings = outbound.settings || {};
  const stream = outbound.streamSettings || {};
  if (outbound.protocol === 'shadowsocks') {
    const server = settings.servers?.[0] || {};
    if (!server.address || !Number.isInteger(Number(server.port)) || !server.method || !server.password) return [t('requiredFields')];
    if (item.plugin) return [t('unsupportedTransport')];
    return [];
  }
  if (outbound.protocol === 'hysteria') {
    const hysteria = stream.hysteriaSettings || {};
    if (!settings.address || !Number.isInteger(Number(settings.port)) || !hysteria.auth) return [t('requiredFields')];
    if (stream.network !== 'hysteria' || stream.security !== 'tls') return [t('unsupportedTransport')];
    if (!(stream.tlsSettings || {}).serverName) return [t('missingSni')];
    return [];
  }
  if (outbound.protocol !== 'vless') return [t('unsupportedOutbound')];
  const network = String(stream.network || 'tcp').toLowerCase();
  const issues = [];
  if (!settings.address || !Number.isInteger(Number(settings.port)) || Number(settings.port) < 1 || Number(settings.port) > 65535 || !settings.id) issues.push(t('requiredFields'));
  if (!['tcp','ws','grpc','httpupgrade','xhttp'].includes(network)) issues.push(t('unsupportedTransport'));
  if (!['tls','reality'].includes(String(stream.security || '').toLowerCase())) issues.push(t('unsupportedSecurity'));
  if (stream.security === 'reality') {
    const reality = stream.realitySettings || {};
    if (!reality.serverName || !reality.publicKey) issues.push(t('missingReality'));
  }
  if (stream.security === 'tls' && !(stream.tlsSettings || {}).serverName) issues.push(t('missingSni'));
  return issues;
}
function outboundSignature(item) {
  if (!item.outbound) return item.uri || '';
  const copy = structuredClone(item.outbound); copy.tag = '';
  return JSON.stringify(copy);
}
function duplicateUris() {
  const seen = new Set(); const duplicates = new Set();
  for (const item of state.currentResults) { const signature = outboundSignature(item); if (seen.has(signature)) duplicates.add(item.uri); else seen.add(signature); }
  return duplicates;
}
function uniqueOutbounds(items) {
  const used = new Set(); const outbounds = [];
  for (const item of items) {
    const issues = outboundIssues(item); if (issues.length || !item.outbound) continue;
    const copy = structuredClone(item.outbound); const original = String(copy.tag || item.name || 'VLESS'); let tag = original; let suffix = 2;
    while (used.has(tag)) tag = `${original} (${suffix++})`;
    used.add(tag); copy.tag = tag; outbounds.push(copy);
  }
  return outbounds;
}
function servicesMarkup(item) {
  return `<div class="service-checks" aria-label="${escapeHtml(t('serviceAccess'))}">${Object.keys(serviceNames).map((id) => {
    const result = item.services?.find((service) => service.id === id);
    const status = !result ? 'unknown' : result.ok ? 'ok' : 'bad';
    const detail = !result ? t('oldService') : result.status ? `${result.ok ? t('reachable') : t('unavailable')} · HTTP ${result.status}${result.ms != null ? ` · ${number(result.ms)} ms` : ''}` : t('noReply');
    return `<span class="service-badge ${status}" title="${escapeHtml(`${serviceNames[id]}: ${detail}`)}" aria-label="${escapeHtml(`${serviceNames[id]}: ${detail}`)}"><span class="service-icon">${serviceIcons[id]}</span><span class="service-dot" aria-hidden="true"></span><span class="service-name">${serviceNames[id]}</span></span>`;
  }).join('')}</div>`;
}
function resultCard(item, index) {
  const name = item.name || item.endpoint || t('noName');
  const ping = item.pingCheck || { ok:item.ok, ms:item.ms, httpStatus:item.httpStatus, timings:item.timings };
  const timing = ping.timings;
  const tooltip = timing ? `HTTP ${ping.httpStatus || 0} · ${t('proxyConnect')} ${timing.proxyConnectMs ?? 0} ms · ${t('tlsViaOutbound')} ${timing.tlsViaOutboundMs ?? 0} ms · ${t('firstByte')} ${timing.firstByteMs ?? ping.ms ?? 0} ms` : t('timingNotSaved');
  const pingValue = ping.ok && ping.ms != null ? `${number(ping.ms)} ms` : t('pingFailed');
  const routeValue = timing?.tlsViaOutboundMs != null ? `${number(timing.tlsViaOutboundMs)} ms` : '—';
  const speedText = item.speedCheck?.ok
    ? t('speedResult', item.speedCheck.megabytesPerSecond, item.speedCheck.seconds)
    : item.speedCheck
      ? `${t('speedFailed')}${item.speedCheck.error ? `: ${item.speedCheck.error}` : item.speedCheck.status ? ` · HTTP ${item.speedCheck.status}` : ''}`
      : '';
  const speed = item.speedCheck ? `<small class="${item.speedCheck.ok ? 'speed-result' : 'speed-error'}" title="${escapeHtml(item.speedCheck.error || '')}">${escapeHtml(speedText)}</small>` : '';
  const issues = outboundIssues(item); const duplicate = duplicateUris().has(item.uri);
  const protocolLabel = item.protocol === 'hysteria2' ? 'Hysteria2' : item.protocol === 'shadowsocks' ? 'Shadowsocks' : 'VLESS';
  const details = [protocolLabel, item.transport || '—', item.security || ''].filter(Boolean).join(' · ');
  return `<article class="result-item${state.lastPingUri === item.uri ? ' ping-updated' : ''}" data-result-index="${index}"><label class="select-config"><input type="checkbox" data-select-index="${index}" ${state.selectedUris.has(item.uri) ? 'checked' : ''}><span class="sr-only">${escapeHtml(t('selectConfig'))}</span></label><div class="result-primary"><div class="result-primary-head"><strong>${escapeHtml(name)}</strong><span class="result-flags">${duplicate ? `<span class="duplicate-tag">${escapeHtml(t('duplicate'))}</span>` : ''}${issues.length ? `<span class="compatibility-tag bad" title="${escapeHtml(issues.join(' · '))}">${escapeHtml(t('incompatible'))}</span>` : `<span class="compatibility-tag">${escapeHtml(t('outboundReady'))}</span>`}</span><span class="speed-test-wrap"><button class="copy-button speed-test-button" type="button" data-speed-index="${index}" title="${escapeHtml(item.speedCheck?.ok ? t('speedResult', item.speedCheck.megabytesPerSecond, item.speedCheck.seconds) : t('speedTest'))}">↓ ${escapeHtml(t('speedTest'))}</button>${speed}</span></div><code>${escapeHtml(item.endpoint)} · ${escapeHtml(item.ip)} · ${escapeHtml(item.country || t('countryUnknown'))}</code></div><div class="result-metrics"><div class="result-stat ${ping.ok ? '' : 'ping-failed'}" tabindex="0" title="${escapeHtml(tooltip)}">${pingValue}<small>${escapeHtml(t('rttLabel'))}</small></div><div class="result-stat route-latency" tabindex="0" title="${escapeHtml(t('routeLatencyHint'))}">${routeValue}<small>${escapeHtml(t('routeLatency'))}</small></div></div><div class="result-stat">${escapeHtml(item.exit || '—')}<small>${escapeHtml(t('exitIp'))}</small></div><span class="security-tag" title="${escapeHtml(t('protocol'))} · ${escapeHtml(t('transport'))}">${escapeHtml(details)}</span><div class="connection-actions"><button class="copy-button item-copy" type="button" data-copy-index="${index}">${escapeHtml(t('configCopy'))}</button><button class="copy-button ping-again-button" type="button" data-ping-index="${index}">${escapeHtml(t('pingAgain'))}</button></div>${servicesMarkup(item)}</article>`;
}
function countryOutbounds(country) {
  return uniqueOutbounds(state.currentResults.filter((item) => (item.country || t('countryUnknown')) === country));
}
function countryFilename(country) { const slug = country.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'unknown'; return `outbounds-${slug}.json`; }
const COUNTRY_NAME_CODES = {'albania':'AL','australia':'AU','austria':'AT','belarus':'BY','brazil':'BR','bulgaria':'BG','canada':'CA','chile':'CL','czechia':'CZ','czech republic':'CZ','estonia':'EE','finland':'FI','france':'FR','georgia':'GE','germany':'DE','greece':'GR','hong kong':'HK','india':'IN','indonesia':'ID','iran':'IR','ireland':'IE','israel':'IL','italy':'IT','japan':'JP','kazakhstan':'KZ','latvia':'LV','malaysia':'MY','mexico':'MX','netherlands':'NL','the netherlands':'NL','nigeria':'NG','norway':'NO','poland':'PL','romania':'RO','russia':'RU','singapore':'SG','south africa':'ZA','south korea':'KR','korea':'KR','spain':'ES','sweden':'SE','switzerland':'CH','taiwan':'TW','thailand':'TH','turkiye':'TR','türkiye':'TR','turkey':'TR','ukraine':'UA','united arab emirates':'AE','united kingdom':'GB','uk':'GB','united states':'US','usa':'US','vietnam':'VN'};
function flagEmoji(code, country='') { let value=/^[a-z]{2}$/i.test(code||'')?code.toUpperCase():COUNTRY_NAME_CODES[String(country||'').trim().toLocaleLowerCase()]||''; if(value==='UK')value='GB'; return value ? String.fromCodePoint(...[...value].map((char)=>127397+char.charCodeAt(0))) : '🌐'; }
function localizedCountry(item) {
  if (!item.countryCode) return item.country || t('countryUnknown');
  try { return new Intl.DisplayNames([state.lang], { type:'region' }).of(item.countryCode.toUpperCase()) || item.country; }
  catch { return item.country || item.countryCode; }
}
function downloadJson(country, button) {
  const outbounds = countryOutbounds(country); if (!outbounds.length) return;
  const blob = new Blob([JSON.stringify(outbounds, null, 2)], { type:'application/json;charset=utf-8' }); const link = document.createElement('a'); const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl; link.download = countryFilename(country); document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  const oldText = button.textContent; button.textContent = t('ready'); window.setTimeout(() => { button.textContent = oldText; }, 1400);
}
async function rerunPing(index, button) {
  const item=state.currentResults[index]; if(!item?.uri||state.busy)return;
  setBusy(true);button.disabled=true;button.textContent=t('pingChecking');
  try{
    item.pingCheck=await api(`/api/jobs/${encodeURIComponent(state.currentJob)}/results/ping`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uri:item.uri})});
    state.lastPingUri=item.uri;
    renderResults();
    requestAnimationFrame(()=>{
      const card=elements.countries.querySelector(`[data-result-index="${index}"]`);
      if(!card)return;
      const group=card.closest('details'); if(group)group.open=true;
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('ping-updated');
      window.setTimeout(()=>{card.classList.remove('ping-updated');if(state.lastPingUri===item.uri)state.lastPingUri='';},2800);
    });
  }
  catch(error){showError(error.message);button.disabled=false;button.textContent=t('pingAgain');}
  finally{setBusy(false);}
}
async function rerunCountryPings(country, button) {
  const items=state.currentResults.filter((item)=>(item.country||t('countryUnknown'))===country&&item.ok&&item.uri);
  if(!items.length||state.busy)return;
  const original=button.textContent;setBusy(true);button.disabled=true;button.textContent=t('pingAllChecking');
  try{
    const data=await api('/api/jobs/'+encodeURIComponent(state.currentJob)+'/results/ping-all',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uris:items.map(item=>item.uri)})});
    const updated=[];
    for(const result of data.results||[]){const item=items.find(candidate=>candidate.uri===result.uri);if(item&&result.pingCheck){item.pingCheck=result.pingCheck;updated.push(item);}}
    renderResults();
    requestAnimationFrame(()=>updated.forEach(item=>{const index=state.currentResults.indexOf(item);const card=elements.countries.querySelector('[data-result-index="'+index+'"]');if(!card)return;card.classList.add('ping-updated');window.setTimeout(()=>card.classList.remove('ping-updated'),2800);}));
  }catch(error){showError(error.message);}
  finally{setBusy(false);button.disabled=false;button.textContent=original;}
}
async function runDownloadTest(index, button) {
  const item=state.currentResults[index]; if(!item?.uri||state.busy)return;
  setBusy(true);button.disabled=true;button.textContent=t('speedTesting');
  try{item.speedCheck=await api(`/api/jobs/${encodeURIComponent(state.currentJob)}/results/download`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uri:item.uri})});renderResults();}
  catch(error){showError(error.message);button.disabled=false;button.textContent=`↓ ${t('speedTest')}`;}
  finally{setBusy(false);}
}
function renderResults() {
  if (!elements.countries || elements.results.hidden) return;
  const existingCards = [...elements.countries.querySelectorAll('.country-card')];
  const hadRenderedCards = existingCards.length > 0;
  const previousView = existingCards.some((card) => card.dataset.view === 'name') ? 'name' : 'country';
  const openCountries = new Set(existingCards.filter((card) => card.open).map((card) => card.dataset.country));
  const allConfigsWasOpen = existingCards.some((card) => card.dataset.view === 'name' && card.open);
  const query = elements.search.value.trim().toLocaleLowerCase();
  const protocolFilter = $('#result-security').value;
  const serviceFilter = $('#result-service').value;
  const countries = new Map();
  for (const item of state.currentResults) {
    const key = item.countryCode || item.country || 'unknown';
    if (!countries.has(key)) countries.set(key, item);
  }
  const countryFilters = $('#country-filters');
  if (countryFilters) countryFilters.innerHTML = `<button class="country-filter ${state.selectedCountry === 'all' ? 'active' : ''}" type="button" data-country-filter="all" aria-pressed="${state.selectedCountry === 'all'}"><span>🌐</span><span>${escapeHtml(t('allCountries'))}</span></button>${[...countries.entries()].sort(([,a],[,b]) => localizedCountry(a).localeCompare(localizedCountry(b), state.lang)).map(([key,item]) => `<button class="country-filter ${state.selectedCountry === key ? 'active' : ''}" type="button" data-country-filter="${escapeHtml(key)}" aria-pressed="${state.selectedCountry === key}"><span>${flagEmoji(item.countryCode,item.country)}</span><span>${escapeHtml(localizedCountry(item))}</span></button>`).join('')}`;
  const duplicates = duplicateUris();
  const filtered = state.currentResults.filter((item) => {
    if (query && !searchable(item).includes(query)) return false;
    if (protocolFilter !== 'all' && String(item.protocol).toLowerCase() !== protocolFilter) return false;
    if (state.selectedCountry !== 'all' && String(item.countryCode || item.country || 'unknown') !== state.selectedCountry) return false;
    if (serviceFilter !== 'all' && !item.services?.some((service) => service.id === serviceFilter && service.ok)) return false;
    if ($('#hide-duplicates').checked && duplicates.has(item.uri)) return false;
    return true;
  });
  const compare = (a,b) => {
    if (state.sortBy === 'name') return String(a.name || a.endpoint).localeCompare(String(b.name || b.endpoint), state.lang);
    if (state.sortBy === 'country') return String(a.country || '').localeCompare(String(b.country || ''), state.lang) || String(a.name || '').localeCompare(String(b.name || ''), state.lang);
    return (Number(a.pingCheck?.ms ?? a.ms ?? Infinity) - Number(b.pingCheck?.ms ?? b.ms ?? Infinity)) || String(a.name || '').localeCompare(String(b.name || ''), state.lang);
  };
  filtered.sort(compare);
  state.visibleIndices = filtered.map((item) => state.currentResults.indexOf(item));
  $('#selection-count').textContent = t('selectionCount', state.selectedUris.size);
  $('#copy-selected-json').disabled = !state.selectedUris.size;
  if (!filtered.length) { elements.countries.innerHTML = `<div class="empty-history">${escapeHtml(state.currentResults.length ? t('noSearch') : t('noSuccess'))}</div>`; return; }
  if (state.view === 'name') {
    const ordered = filtered.map((item) => ({ item, index:state.currentResults.indexOf(item) }));
    elements.countries.innerHTML = `<details class="country-card" data-view="name" ${previousView === 'name' ? allConfigsWasOpen ? 'open' : '' : 'open'}><summary><span><span class="country-title">${escapeHtml(t('allConfigs'))}</span><span class="country-count">${escapeHtml(t('connections', number(ordered.length)))} · ${escapeHtml(t('sortedName'))}</span></span><span class="country-actions" aria-hidden="true">⌄</span></summary><div class="country-body">${ordered.map(({item,index}) => resultCard(item,index)).join('')}</div></details>`; return;
  }
  const groups = new Map(); for (const item of filtered) { const country = item.country || t('countryUnknown'); if (!groups.has(country)) groups.set(country, []); groups.get(country).push(item); }
  const orderedGroups = [...groups.entries()].sort(([a,itemsA],[b,itemsB]) => state.sortBy === 'rtt'
    ? Math.min(...itemsA.map((item) => Number(item.pingCheck?.ms ?? item.ms ?? Infinity))) - Math.min(...itemsB.map((item) => Number(item.pingCheck?.ms ?? item.ms ?? Infinity)))
    : a.localeCompare(b,state.lang));
  elements.countries.innerHTML = orderedGroups.map(([country,items],groupIndex) => {
    const indexed = items.map((item) => ({item,index:state.currentResults.indexOf(item)}));
    const shouldOpen = previousView === 'country' && hadRenderedCards ? openCountries.has(country) : groupIndex === 0;
    return `<details class="country-card" data-country="${escapeHtml(country)}" ${shouldOpen?'open':''}><summary><span><span class="country-title">${escapeHtml(country)}</span><span class="country-count">${escapeHtml(t('connections',number(items.length)))}</span></span><span class="country-actions"><button class="copy-button group-copy" type="button" data-copy-group="${escapeHtml(country)}">${escapeHtml(t('copyAll'))}</button><button class="copy-button ping-all-button" type="button" data-ping-all-country="${escapeHtml(country)}">${escapeHtml(t('pingAll'))}</button><button class="copy-button json-copy" type="button" data-copy-json="${escapeHtml(country)}">${escapeHtml(t('copyJson'))}</button><button class="copy-button json-download" type="button" data-download-json="${escapeHtml(country)}">${escapeHtml(t('downloadJson'))}</button><span aria-hidden="true">⌄</span></span></summary><div class="country-body">${indexed.map(({item,index}) => resultCard(item,index)).join('')}</div></details>`;
  }).join('');
}
async function copyText(text, button) {
  const original = button.textContent;
  try { await navigator.clipboard.writeText(text); }
  catch { const temporary=document.createElement('textarea'); temporary.value=text; temporary.style.position='fixed'; temporary.style.opacity='0'; document.body.append(temporary); temporary.select(); document.execCommand('copy'); temporary.remove(); }
  button.textContent=t('copied'); window.setTimeout(()=>{button.textContent=original;},1400);
}
async function monitorJob(job) {
  let current=job; setProgress(current);
  while(!current.finished){await new Promise((resolve)=>window.setTimeout(resolve,1100));current=await api(`/api/jobs/${encodeURIComponent(job.id)}?summary=1`);setProgress(current);}
  if(current.error) elements.progressMessage.textContent=current.error;
  await loadResults(job.id,t('newResults')); await loadHistory();
}
document.querySelectorAll('.tab').forEach((tab)=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach((item)=>{const selected=item===tab;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected));});
  const isUrl=tab.dataset.mode==='url';$('#url-mode').hidden=!isUrl;$('#text-mode').hidden=isUrl;showError();
}));
elements.form.addEventListener('submit',async(event)=>{
  event.preventDefault();if(state.busy)return;showError();const isUrl=!$('#url-mode').hidden;
    const payload={offset:Number(elements.offset.value||0),batchSize:Number($('#batch-size').value||10),checkExit:$('#check-exit').checked,serviceIds:[...document.querySelectorAll('.service-option:checked')].map((input)=>input.value)};
  if(isUrl)payload.subscriptionUrl=elements.url.value.trim();else payload.text=elements.text.value.trim();
  if(isUrl&&!payload.subscriptionUrl)return showError(t('askUrl'));if(!isUrl&&!payload.text)return showError(t('askText'));
  setBusy(true);elements.progress.hidden=false;setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));
  try{const job=await api('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});await monitorJob(job);}
  catch(error){showError(error.message);elements.progress.hidden=true;}finally{setBusy(false);}
});
$('#refresh-history').addEventListener('click',loadHistory);elements.search.addEventListener('input',renderResults);
document.querySelectorAll('.view-tab').forEach((tab)=>tab.addEventListener('click',()=>{state.view=tab.dataset.view;document.querySelectorAll('.view-tab').forEach((item)=>{const selected=item===tab;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected));});renderResults();}));
elements.history.addEventListener('click',async(event)=>{const rescan=event.target.closest('[data-rescan-job]');if(rescan){if(state.busy)return;const options={method:'POST'};if(rescan.dataset.needsUrl==='true'){const subscriptionUrl=window.prompt(t('rescanUrlPrompt'),elements.url.value.trim());if(!subscriptionUrl?.trim())return;options.headers={'content-type':'application/json'};options.body=JSON.stringify({subscriptionUrl:subscriptionUrl.trim()});}setBusy(true);rescan.disabled=true;showError('');elements.progress.hidden=false;setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));try{const job=await api(`/api/jobs/${encodeURIComponent(rescan.dataset.rescanJob)}/rescan`,options);await monitorJob(job);}catch(error){showError(error.message);elements.progress.hidden=true;}finally{setBusy(false);rescan.disabled=false;}return;}const button=event.target.closest('[data-open-job]');if(button)loadResults(button.dataset.openJob,t('savedResults'));});
elements.countries.addEventListener('click',(event)=>{
  const pingAllButton=event.target.closest('[data-ping-all-country]');if(pingAllButton){rerunCountryPings(pingAllButton.dataset.pingAllCountry,pingAllButton);return;}
  const pingButton=event.target.closest('[data-ping-index]');if(pingButton){rerunPing(Number(pingButton.dataset.pingIndex),pingButton);return;}
  const speedButton=event.target.closest('[data-speed-index]');if(speedButton){runDownloadTest(Number(speedButton.dataset.speedIndex),speedButton);return;}
  const itemButton=event.target.closest('[data-copy-index]');if(itemButton){const item=state.currentResults[Number(itemButton.dataset.copyIndex)];if(item?.uri)copyText(item.uri,itemButton);return;}
  const groupButton=event.target.closest('[data-copy-group]');if(groupButton){event.preventDefault();const country=groupButton.dataset.copyGroup;const uris=state.currentResults.filter((item)=>(item.country||t('countryUnknown'))===country).map((item)=>item.uri).filter(Boolean);copyText(uris.join('\n'),groupButton);return;}
  const jsonButton=event.target.closest('[data-copy-json]');if(jsonButton){event.preventDefault();copyText(JSON.stringify(countryOutbounds(jsonButton.dataset.copyJson),null,2),jsonButton);return;}
  const downloadButton=event.target.closest('[data-download-json]');if(downloadButton){event.preventDefault();downloadJson(downloadButton.dataset.downloadJson,downloadButton);}
});
elements.countries.addEventListener('change',(event)=>{const input=event.target.closest('[data-select-index]');if(!input)return;const item=state.currentResults[Number(input.dataset.selectIndex)];if(!item?.uri)return;if(input.checked)state.selectedUris.add(item.uri);else state.selectedUris.delete(item.uri);renderResults();});
$('#select-visible').addEventListener('click',()=>{for(const index of state.visibleIndices){const item=state.currentResults[index];if(item?.uri)state.selectedUris.add(item.uri);}renderResults();});
$('#clear-selection').addEventListener('click',()=>{state.selectedUris.clear();renderResults();});
$('#copy-selected-json').addEventListener('click',(event)=>{const items=state.currentResults.filter((item)=>state.selectedUris.has(item.uri));copyText(JSON.stringify(uniqueOutbounds(items),null,2),event.currentTarget);});
$('#copy-all-json').addEventListener('click',(event)=>copyText(JSON.stringify(uniqueOutbounds(state.currentResults),null,2),event.currentTarget));
$('#result-sort').addEventListener('change',(event)=>{state.sortBy=event.target.value;renderResults();});
$('#result-security').addEventListener('change',renderResults);$('#result-service').addEventListener('change',renderResults);$('#hide-duplicates').addEventListener('change',renderResults);
$('#country-filters').addEventListener('click',(event)=>{const button=event.target.closest('[data-country-filter]');if(!button)return;state.selectedCountry=button.dataset.countryFilter;renderResults();});
$('#language-toggle').addEventListener('click',()=>{state.lang=state.lang==='fa'?'en':'fa';localStorage.setItem('vless-audit-lang',state.lang);applyLanguage();});
$('#theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#logout-button').addEventListener('click',async()=>{try{await fetch('/api/logout',{method:'POST',cache:'no-store'});}finally{window.location.assign('/login');}});
setTheme(localStorage.getItem('vless-audit-theme')||'dark');applyLanguage();
api('/api/health').catch((error)=>{elements.progress.hidden=false;elements.progressMessage.textContent=`${t('healthError')}: ${error.message}`;});
