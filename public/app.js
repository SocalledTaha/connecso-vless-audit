const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $('#analyze-form'), url: $('#subscription-url'), text: $('#subscription-text'),
  start: $('#start-button'), error: $('#form-error'), progress: $('#progress-panel'), progressTitle: $('#progress-title'),
  progressCount: $('#progress-count'), progressBar: $('#progress-bar'), progressMessage: $('#progress-message'), history: $('#history-list'),
  results: $('#results-section'), resultsTitle: $('#results-title'), resultsSummary: $('#results-summary'), search: $('#result-search'), countries: $('#country-results'),
};
const dictionaries = {
  fa: {
    skip:'رفتن به بخش اصلی', private:'محیط خصوصی', xray:'تست واقعی با Xray', darkTheme:'تیره', lightTheme:'روشن', logout:'خروج', toolTitle:'بررسی اوتباند', toolSubtitle:'بررسی، مقایسه و آماده‌سازی خروجی JSON', scanOptions:'گزینه‌های بررسی', checkExit:'بررسی IP خروجی', protocolFilters:'\u0641\u06cc\u0644\u062a\u0631 \u0628\u0631 \u0627\u0633\u0627\u0633 \u067e\u0631\u0648\u062a\u06a9\u0644', protocolSupportHint:'WireGuard \u0648 MASQUE \u0628\u0627 JSON \u062e\u0631\u0648\u062c\u06cc Xray \u0642\u0627\u0628\u0644 \u0628\u0631\u0631\u0633\u06cc\u200c\u0627\u0646\u062f\u061b AmneziaWG \u0628\u0647 \u0647\u0633\u062a\u0647\u0654 \u062c\u062f\u0627\u06af\u0627\u0646\u0647 \u0646\u06cc\u0627\u0632 \u062f\u0627\u0631\u062f.', exitServiceOptions:'\u0628\u0631\u0631\u0633\u06cc IP \u062e\u0631\u0648\u062c\u06cc \u0648 \u0633\u0631\u0648\u06cc\u0633\u200c\u0647\u0627', noProtocols:'\u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u067e\u0631\u0648\u062a\u06a9\u0644 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646.',
    eyebrow:'ابزار بررسی اشتراک', headline:'مسیر سالم را<br><span>سریع و شفاف پیدا کن.</span>',
    intro:'برای هر کانکشن، RTT از مسیر تونل و زمان اتصال مستقیم سرور بررسی تا IP مقصد را ببین.',
    proof1:'TLS یا Reality', proof2:'آزمون با Xray', proof3:'دو معیار پینگ', step1:'گام اول', sourceTitle:'منبع کانفیگ را وارد کن', encrypted:'ارتباط رمزگذاری‌شده',
    tabUrl:'لینک اشتراک', tabText:'متن کانفیگ', urlLabel:'آدرس HTTPS اشتراک', urlHint:'آدرس فقط برای دریافت همین نوبت بررسی می‌شود.',
    textLabel:'کانفیگ‌ها یا متن اشتراک', textHint:'متن ساده یا Base64 پذیرفته می‌شود.',
    batchHint:'تعداد workerها با توجه به رم آزاد سرور خودکار تنظیم می‌شود.', start:'شروع بررسی', busy:'در حال بررسی…',
    whatChecked:'چه چیزی بررسی می‌شود؟', methodTitle:'پاسخ واقعی،<br>معیار موفقیت است.',
    methodCopy:'اسکن اصلی فقط RTT مسیر را می‌سنجد. بررسی سرویس‌ها و پایش زنده با هستهٔ جداگانه و به درخواست تو اجرا می‌شوند.',
    encryptedOnly:'رمزنگاری', tlsRealityOnly:'TLS، Reality یا رمزنگاری پروتکل', fullConnection:'اتصال کامل', httpsReply:'پاسخ HTTPS از مسیر تونل', serviceAccess:'دسترسی سرویس',
    privacy:'بررسی سرویس‌ها فقط دسترسی HTTPS را می‌سنجد و ورود به حساب را آزمایش نمی‌کند.', running:'بررسی در حال اجرا',
    connecting:'در حال اتصال به کانفیگ‌ها', interrupted:'بررسی قبلی نیمه‌کاره ماند', completed:'بررسی تمام شد',
    xrayRunning:'Xray در حال آزمایش مسیرهاست.', batchProgress:(n)=>n?`در حال بررسی با ${number(n)} worker بر اساس رم آزاد سرور؛ هر worker تا ۱۰ مسیر را هم‌زمان می‌سنجد. می‌توانی صفحه را ببندی و بعداً نتیجه را از سابقه ببینی.`:'تعداد workerها با توجه به رم آزاد سرور به‌صورت خودکار تعیین می‌شود؛ می‌توانی صفحه را ببندی و بعداً نتیجه را از سابقه ببینی.',
    progressCount:(d,t,s)=>`${d} از ${t} · موفق ${s}`,
    doneCount:(s,t)=>`${s} اتصال موفق از ${t} مورد.`,
    historyLabel:'سابقهٔ بررسی', historyTitle:'نتیجه‌های قبلی', refresh:'تازه‌سازی', loadingHistory:'در حال دریافت سابقه…',
    editHistory:'ویرایش', editName:'نام جست‌وجو', editTags:'برچسب‌ها', editSubscriptionUrl:'لینک اشتراک', saveMeta:'ذخیره', cancelMeta:'لغو', copySubscription:'کپی لینک ساب', favoriteHistory:'نشان‌کردن به‌عنوان علاقه‌مندی', unfavoriteHistory:'برداشتن از علاقه‌مندی‌ها', deleteHistory:'حذف بررسی', deleteConfirm:'این بررسی و نتیجه‌های ذخیره‌شده‌اش برای همیشه حذف شود؟', deleteFailed:'حذف بررسی انجام نشد', historySaved:'جزئیات جست‌وجو ذخیره شد.', noHistory:'هنوز بررسی‌ای ذخیره نشده است.', historyError:'دریافت سابقه انجام نشد', openHistory:'بازکردن نتایج', rescan:'اجرای دوباره', resume:'ادامه', resumeError:'ادامهٔ این بررسی ممکن نشد.', rescanUrlPrompt:'لینک ساب این بررسی در سابقهٔ قدیمی ذخیره نشده. لینک را وارد کن تا دوباره بررسی شود:',
    rescanOptions:'تنظیم اجرای دوباره', rescanLinkHint:'لینک را می‌توانی عوض کنی؛ ساب از ابتدا دریافت و فهرست کانفیگ‌ها دوباره ساخته می‌شود. فیلترهای اجرای قبلی از قبل انتخاب شده‌اند.', rescanStart:'شروع بررسی تازه', rescanNoProtocols:'حداقل یک پروتکل را انتخاب کن.', cancelRescan:'بستن',
    historySuccess:(s,t,d,finished,interrupted)=>`${s} موفق · ${d} از ${t} بررسی‌شده${finished?' · پایان‌یافته':interrupted?' · متوقف‌شده':' · ادامه در پس‌زمینه'}`,
    resultsLabel:'خروجی بررسی', resultTitle:'کانفیگ‌های موفق', resultsLoading:'در حال دریافت نتیجه‌ها به بخش‌های کوچک…',
    loading:'در حال بارگذاری…', loadErr:'نتیجه‌ها بارگذاری نشدند', retryHistory:'می‌توانی دوباره از سابقه همین بررسی را باز کنی.',
    resultsLoaded:(s,t)=>`${s} نتیجهٔ موفق · ${t} کانفیگ بررسی‌شده · بارگذاری مرحله‌ای`,
    resultsChunk:(a,b)=>`دریافت ${a} از ${b} نتیجهٔ موفق…`,
    noSearch:'نتیجه‌ای با این جست‌وجو پیدا نشد.', noSuccess:'در این بررسی اتصال موفقی پیدا نشد.',
    noName:'کانفیگ بدون نام', rttLabel:'RTT HTTP', pingAgain:'چک پینگ مجدد', pingAll:'پینگ همه', pingAllChecking:'در حال پینگ همه…', pingChecking:'در حال سنجش…', pingFailed:'بدون پاسخ', speedTest:'تست دانلود', speedTesting:'در حال تست…', speedFailed:'تست سرعت انجام نشد', speedResult:(rate,seconds)=>`میانگین مجموع ۴ اتصال: ${faNum.format(rate)} مگابایت‌برثانیه · ${faNum.format(seconds)} ثانیه`, timingNotSaved:'جزئیات زمان‌بندی برای این نتیجه ذخیره نشده است.', proxyConnect:'اتصال پراکسی', tlsViaOutbound:'TLS از تونل', firstByte:'اولین پاسخ', exitIp:'IP خروجی', countryUnknown:'کشور نامشخص', progressReconnect:'ارتباط لحظه‌ای قطع شد؛ در حال تلاش دوباره برای دریافت پیشرفت…',
    oldService:'بررسی نشده', reachable:'پاسخ موفق', unavailable:'پاسخ موفقی دریافت نشد', noReply:'بدون پاسخ', httpResponded:'پاسخ HTTP دریافت شد؛ سرور مقصد در دسترس است', httpResponseTime:'زمان کامل پاسخ HTTP', gameReachabilityOnly:'فقط دسترسی سایت؛ پینگ سرور بازی نیست', httpStatusIssue:'کد HTTP خطا/محدودیت است، نه خطای اتصال تونل', routeCheckFailed:'درخواست آزمون به مقصد نرسید', probeError_timeout:'مهلت پاسخ تمام شد', probeError_dns:'خطای DNS مقصد', probeError_tls:'خطای TLS', probeError_refused:'اتصال از سمت مقصد رد شد', probeError_network:'خطای شبکه یا مسیر', httpStatus:'HTTP', endpointPing:'پینگ مستقیم مقصد', endpointPingTip:'ICMP از سرور بررسی تا IP مقصد؛ ممکن است پاسخ ICMP بسته باشد.', selectConfig:'انتخاب کانفیگ', incompatible:'نیازمند بررسی', unsupportedOutbound:'ساختار اوتباند معتبر نیست', requiredFields:'آدرس، پورت یا اطلاعات احراز هویت ناقص است', unsupportedTransport:'انتقال با Xray پشتیبانی نمی‌شود', unsupportedCipher:'روش رمزنگاری Shadowsocks با Xray سازگار نیست', unsupportedSecurity:'امنیت این کانفیگ پشتیبانی نمی‌شود', missingReality:'SNI یا Public Key در Reality ناقص است', missingSni:'SNI در TLS ناقص است', protocol:'پروتکل', transport:'انتقال',
    configCopy:'کپی کانفیگ', copied:'کپی شد', ready:'آماده شد', copyAll:'کپی همه', copyJson:'کپی JSON', downloadJson:'دانلود JSON',
    allConfigs:'همهٔ کانفیگ‌ها', connections:(n)=>`${n} اتصال`, sortedName:'مرتب‌شده بر اساس نام', sortRtt:'کمترین RTT', sortName:'نام', sortCountry:'کشور', allProtocols:'همهٔ پروتکل‌ها', allSecurity:'همهٔ روش‌های امنیت', allTransports:'همهٔ روش‌های انتقال', anyService:'همهٔ سرویس‌ها', selectionCount:(n)=>`${number(n)} انتخاب`, selectVisible:'انتخاب موارد قابل‌مشاهده', clearSelection:'پاک‌کردن انتخاب', exportSelected:'کپی JSON انتخاب‌ها', exportAll:'کپی JSON همه', hideDuplicates:'پنهان‌کردن تکراری‌ها', duplicate:'تکراری', outboundReady:'خروجی معتبر', allCountries:'همهٔ کشورها',
    footerBrand:'بخشی از خانوادهٔ پروژه‌های Connecso', footerByline:'ساخته‌شده توسط Taha', footerDownload:'Get Connecso Client', footerDownloadTip:'Get the V2Ray-based VPN client for Windows and Android.',
    askUrl:'آدرس HTTPS اشتراک را وارد کن.', askText:'متن کانفیگ‌ها را وارد کن.', reading:'در حال خواندن و اعتبارسنجی ورودی…',
    replacePingConfirm:'یک بررسی هنوز در حال اجراست. متوقفش کنم و بررسی این فهرست جدید را همین حالا شروع کنم؟',
    newResults:'نتیجهٔ بررسی جدید', savedResults:'نتیجه‌های ذخیره‌شده', noReplyText:'پاسخ HTTPS از مسیر کانفیگ دریافت نشد.',
    serviceHint:'دسترسی فقط با درخواست HTTPS بررسی می‌شود؛ وضعیت ممکن است با محدودیت منطقه‌ای سرویس فرق داشته باشد.',
    updateButton:'به‌روزرسانی', updateConfirm:'نسخهٔ تازه را از گیت‌هاب دریافت و پنل را پس از نصب دوباره بارگذاری کنم؟', updateQueued:'درخواست به‌روزرسانی ثبت شد…', updateChecking:'در حال بررسی نسخهٔ تازه…', updateDownloading:'در حال دریافت فایل‌ها…', updatePreparing:'در حال آماده‌سازی فایل‌های پنل…', updateDependencies:'در حال نصب وابستگی‌ها…', updateDependenciesSkipped:'وابستگی‌ها تغییری نکرده‌اند؛ از این مرحله عبور شد.', updateInstalling:'در حال نصب نسخهٔ تازه…', updateRestarting:'در حال راه‌اندازی دوبارهٔ پنل…', updateElapsed:(m,s)=>`زمان این مرحله: ${number(m)} دقیقه و ${number(s)} ثانیه`, updateComplete:'به‌روزرسانی انجام شد؛ صفحه در حال بارگذاری دوباره است.', updateFailed:'به‌روزرسانی ناموفق بود', updateNoHelper:'امکان به‌روزرسانی داخل پنل روی این نصب فعال نشده است.',
    themeLabel:'تغییر تم', langLabel:'Switch to English', healthError:'ارتباط با سرویس برقرار نشد',
  },
  en: {
    skip:'Skip to main content', private:'Private workspace', xray:'Live Xray checks', darkTheme:'Dark', lightTheme:'Light', logout:'Log out', toolTitle:'Outbound checks', toolSubtitle:'Check, compare, and prepare outbound JSON', scanOptions:'Check options', checkExit:'Check exit IP', protocolFilters:'Filter by protocol', securityFilters:'Filter by security', transportFilters:'Filter by transport', otherSecurity:'Other / protocol-native', noSecurity:'No TLS / Reality', http2:'HTTP/2', kcp:'mKCP', otherTransport:'Other', allSecurity:'All security', allTransports:'All transports', noScanFilters:'Select at least one protocol, security, and transport type.', protocolSupportHint:'WireGuard and MASQUE can be tested from Xray outbound JSON. AmneziaWG needs a separate core.', exitServiceOptions:'Exit IP and service checks', noProtocols:'Select at least one protocol.',
    eyebrow:'Subscription route audit', headline:'Find working routes<br><span>quickly and clearly.</span>',
    intro:'See both route RTT through the tunnel and direct connectivity from the audit server to each endpoint.',
    proof1:'TLS or Reality', proof2:'Tested with Xray', proof3:'Two ping metrics', step1:'STEP 1', sourceTitle:'Choose a configuration source', encrypted:'Encrypted connection',
    tabUrl:'Subscription URL', tabText:'Paste configs', urlLabel:'HTTPS subscription URL', urlHint:'The URL is fetched only for this audit.',
    textLabel:'Configurations or subscription text', textHint:'Plain text or Base64 is accepted.',
    batchHint:'Worker count is automatically adjusted to available server memory.', start:'Start audit', busy:'Checking…',
    whatChecked:'What gets checked?', methodTitle:'A real response<br>is the success signal.',
    methodCopy:'The main scan measures route RTT only. Service checks and live monitoring run on a separate worker when requested.',
    encryptedOnly:'Encryption', tlsRealityOnly:'TLS, Reality, or protocol encryption', fullConnection:'Full connection', httpsReply:'HTTPS reply through the tunnel', serviceAccess:'Service access',
    privacy:'Service checks measure HTTPS reachability only. They do not sign in to accounts.', running:'AUDIT IN PROGRESS',
    connecting:'Connecting through configurations', interrupted:'Previous audit was interrupted', completed:'Audit complete',
    xrayRunning:'Xray is testing the routes.', batchProgress:(n)=>n?`Checking with ${n} worker(s), selected from available server memory; each worker checks up to 10 routes at once. You can close this page and return to history later.`:'Worker count is selected automatically from available server memory. You can close this page and return to history later.',
    progressCount:(d,t,s)=>`${d} of ${t} · ${s} working`, doneCount:(s,t)=>`${s} working routes out of ${t}.`,
    historyLabel:'AUDIT HISTORY', historyTitle:'Previous results', refresh:'Refresh', loadingHistory:'Loading history…',
    editHistory:'Edit', editName:'Search name', editTags:'Tags', editSubscriptionUrl:'Subscription URL', saveMeta:'Save', cancelMeta:'Cancel', copySubscription:'Copy sub link', favoriteHistory:'Add to favorites', unfavoriteHistory:'Remove from favorites', deleteHistory:'Delete audit', deleteConfirm:'Delete this audit and its saved results permanently?', deleteFailed:'Could not delete this audit', historySaved:'Search details saved.', noHistory:'No saved audits yet.', historyError:'Could not load history', openHistory:'Open results', rescan:'Run again', resume:'Resume', resumeError:'Could not resume this audit.', rescanUrlPrompt:'This older audit did not save its subscription URL. Enter the URL to run it again:',
    rescanOptions:'Run again options', rescanLinkHint:'You can replace the link. The subscription and configuration list will be fetched again from the beginning. Previous filters are preselected.', rescanStart:'Start fresh scan', rescanNoProtocols:'Select at least one protocol.', cancelRescan:'Cancel',
    historySuccess:(s,t,d,finished,interrupted)=>`${s} working · ${d} of ${t} checked${finished?' · complete':interrupted?' · interrupted':' · running in background'}`,
    resultsLabel:'AUDIT OUTPUT', resultTitle:'Working configurations', resultsLoading:'Loading results in small sections…',
    loading:'Loading…', loadErr:'Could not load results', retryHistory:'You can reopen this audit from history.',
    resultsLoaded:(s,t)=>`${s} working results · ${t} configs checked · loaded in pages`,
    resultsChunk:(a,b)=>`Loading ${a} of ${b} working results…`,
    noSearch:'No results match this search.', noSuccess:'No working connections were found in this audit.',
    noName:'Unnamed config', rttLabel:'HTTP RTT', pingAgain:'Check ping again', pingAll:'Ping all', pingAllChecking:'Pinging all…', pingChecking:'Checking…', pingFailed:'No response', speedTest:'Download test', speedTesting:'Testing…', speedFailed:'Speed test failed', speedResult:(rate,seconds)=>`4-stream average: ${rate} MB/s · ${seconds}s`, timingNotSaved:'Timing details were not saved for this result.', proxyConnect:'Proxy connect', tlsViaOutbound:'TLS via outbound', firstByte:'First byte', exitIp:'Exit IP', countryUnknown:'Unknown country', progressReconnect:'Live connection lost; reconnecting to get progress…',
    oldService:'Not checked', reachable:'Successful response', unavailable:'No successful HTTP response', noReply:'No response', httpResponded:'HTTP response received; destination server is reachable', httpResponseTime:'Full HTTP response time', gameReachabilityOnly:'Website reachability only; not a game-server ping', httpStatusIssue:'HTTP error/restriction code, not a tunnel connection error', routeCheckFailed:'Probe request did not reach the destination', probeError_timeout:'Request timed out', probeError_dns:'Destination DNS error', probeError_tls:'TLS error', probeError_refused:'Connection refused by destination', probeError_network:'Network or route error', httpStatus:'HTTP', endpointPing:'Direct endpoint ping', endpointPingTip:'ICMP from the audit server to the endpoint IP; ICMP may be blocked.', selectConfig:'Select configuration', incompatible:'Check required', unsupportedOutbound:'Invalid outbound structure', requiredFields:'Address, port, or authentication data is missing', unsupportedTransport:'Transport is unsupported by Xray', unsupportedCipher:'This Shadowsocks cipher is not supported by Xray', unsupportedSecurity:'This security mode is unsupported', missingReality:'Reality SNI or public key is missing', missingSni:'TLS SNI is missing', protocol:'Protocol', transport:'Transport',
    configCopy:'Copy config', copied:'Copied', ready:'Ready', copyAll:'Copy all', copyJson:'Copy JSON', downloadJson:'Download JSON',
    allConfigs:'All configurations', connections:(n)=>`${n} routes`, sortedName:'sorted by name', sortRtt:'Lowest RTT', sortName:'Name', sortCountry:'Country', allProtocols:'All protocols', allSecurity:'All security', allTransports:'All transports', anyService:'Any service', selectionCount:(n)=>`${number(n)} selected`, selectVisible:'Select visible', clearSelection:'Clear selection', exportSelected:'Copy selected JSON', exportAll:'Copy all JSON', hideDuplicates:'Hide duplicates', duplicate:'Duplicate', outboundReady:'Valid outbound', allCountries:'All countries',
    footerBrand:'Part of the Connecso Projects family', footerByline:'Made by Taha', footerDownload:'Get Connecso Client', footerDownloadTip:'Get the V2Ray-based VPN client for Windows and Android.',
    askUrl:'Enter an HTTPS subscription URL.', askText:'Paste one or more supported configs.', reading:'Reading and validating input…',
    replacePingConfirm:'A check is still running. Stop it and start checking this new list now?',
    newResults:'New audit results', savedResults:'Saved audit results', noReplyText:'No HTTPS response came through this route.',
    serviceHint:'Checks use HTTPS requests only; regional service restrictions may affect availability.',
    updateButton:'Update', updateConfirm:'Download and install the latest GitHub version, then reload the panel?', updateQueued:'Update request queued…', updateChecking:'Checking the installation…', updateDownloading:'Downloading the latest files…', updatePreparing:'Preparing the panel files…', updateDependencies:'Installing dependencies…', updateDependenciesSkipped:'Dependencies are unchanged; skipping this step.', updateInstalling:'Installing the new version…', updateRestarting:'Restarting the panel…', updateElapsed:(m,s)=>`This step has taken ${number(m)}m ${number(s)}s`, updateComplete:'Update complete; reloading the page.', updateFailed:'Update failed', updateNoHelper:'In-panel updates are not enabled for this installation.',
    themeLabel:'Toggle theme', langLabel:'تغییر زبان به فارسی', healthError:'Could not connect to the audit service',
  },
};
Object.assign(dictionaries.fa, {
  protocolFilters:'فیلتر بر اساس پروتکل', securityFilters:'فیلتر بر اساس امنیت', transportFilters:'فیلتر بر اساس انتقال', otherSecurity:'سایر / رمزنگاری بومی پروتکل', noSecurity:'بدون TLS یا Reality', http2:'HTTP/2', kcp:'mKCP', otherTransport:'سایر', allSecurity:'همهٔ روش‌های امنیت', allTransports:'همهٔ روش‌های انتقال', noScanFilters:'حداقل یک گزینه از هر گروه پروتکل، امنیت و انتقال را انتخاب کن.',
  rescanLinkHint:'لینک را می‌توانی عوض کنی؛ ساب از ابتدا دریافت و فهرست کانفیگ‌ها دوباره ساخته می‌شود. فیلترهای اجرای قبلی از قبل انتخاب شده‌اند.',
  stopAudit:'توقف اسکن', endpointPing:'سرور ← مقصد', endpointPingTip:'زمان برقراری اتصال TCP از سرور بررسی تا سرور مقصد؛ برای مسیرهای UDP قابل سنجش نیست.',
  fullServiceCheck:'بررسی همهٔ سرویس‌ها', checkingServices:'در حال بررسی سرویس‌ها…', servicesPending:'برای دریافت نتیجه، جزئیات را باز کن.',
  liveStart:'پایش زنده', liveStop:'توقف پایش', liveActive:'پایش زنده · هر ۵ ثانیه', serviceGroups:'بررسی سرویس‌ها', groupReachable:(ok,total)=>`${number(ok)} از ${number(total)} پاسخ‌گو`,
  groupProgress:(ok,checked,total)=>`${number(ok)} پاسخ HTTP · ${number(checked)} از ${number(total)} بررسی‌شده`,
  endpointConnect:'سرور ← اینترنت', stopInteractive:'توقف بررسی تعاملی', interactiveBusy:'در حال اجرای بررسی تعاملی',
});
Object.assign(dictionaries.en, {
  stopAudit:'Stop scan', endpointPing:'Server → endpoint', endpointPingTip:'TCP connection time from the audit server to the destination. Not measured for UDP routes.',
  fullServiceCheck:'Check all services', checkingServices:'Checking services…', servicesPending:'Open details to check service reachability.',
  liveStart:'Live monitor', liveStop:'Stop monitor', liveActive:'Live · every 5 sec', serviceGroups:'Service checks', groupReachable:(ok,total)=>`${number(ok)} of ${number(total)} reachable`,
  groupProgress:(ok,checked,total)=>`${number(ok)} responded · ${number(checked)} of ${number(total)} checked`,
  endpointConnect:'Server → endpoint', stopInteractive:'Stop interactive check', interactiveBusy:'An interactive check is running',
});
const faNum = new Intl.NumberFormat('fa-IR');
const state = { currentResults: [], currentJob: '', busy: false, busyKind: '', activityGeneration: 0, view: 'country', sortBy: 'rtt', selectedCountry: 'all', selectedUris: new Set(), visibleIndices: [], lang: localStorage.getItem('vless-audit-lang') || 'fa', lastJob: null, lastPingUri: '', interactiveId:'', interactiveKind:'', interactiveUri:'', interactiveProgress:null };
function t(key, ...args) { const value = dictionaries[state.lang][key] ?? dictionaries.fa[key] ?? key; return typeof value === 'function' ? value(...args) : value; }
function number(value) { const numeric = Number(value); return Number.isFinite(numeric) ? (state.lang === 'fa' ? faNum.format(numeric) : new Intl.NumberFormat('en-US').format(numeric)) : (state.lang === 'fa' ? '۰' : '0'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]); }
const RESCAN_PROTOCOLS = [['vless','VLESS'],['vmess','VMess'],['trojan','Trojan'],['shadowsocks','Shadowsocks'],['hysteria2','Hysteria2'],['wireguard','WireGuard'],['masque','MASQUE']];
const RESCAN_SECURITY = [['tls','TLS'],['reality','REALITY'],['none',null,'noSecurity'],['other',null,'otherSecurity']];
const RESCAN_TRANSPORTS = [['tcp','TCP / Raw'],['ws','WebSocket'],['grpc','gRPC'],['xhttp','XHTTP'],['httpupgrade','HTTP Upgrade'],['http2','HTTP/2'],['kcp','mKCP'],['hysteria2','Hysteria2'],['quic','QUIC'],['wireguard','WireGuard / UDP'],['masque','MASQUE / HTTP3'],['tcpudp','TCP + UDP'],['other',null,'otherTransport']];
function checkedValues(root, selector) { return [...root.querySelectorAll(selector)].filter((input) => input.checked).map((input) => input.value); }
function scanFilters(root) {
  return {
    protocolIds: checkedValues(root, 'input[name="protocolIds"], .protocol-option'),
    securityTypes: checkedValues(root, 'input[name="securityTypes"], .security-option'),
    transportTypes: checkedValues(root, 'input[name="transportTypes"], .transport-option'),
  };
}
function securityType(item) { const value=String(item.security||'').toLowerCase();if(value==='tls'||value==='reality')return value;return !value||value==='none'?'none':'other'; }
function transportType(item) { const value=String(item.transport||'').toLowerCase();if(value.includes('xhttp')||value.includes('splithttp'))return'xhttp';if(value.includes('httpupgrade'))return'httpupgrade';if(value.includes('grpc'))return'grpc';if(/\bws\b|websocket/.test(value))return'ws';if(value==='h2'||value.includes('http/2')||value==='http2'||value==='http')return'http2';if(value.includes('kcp'))return'kcp';if(value.includes('wireguard'))return'wireguard';if(value.includes('masque'))return'masque';if(value.includes('hysteria'))return'hysteria2';if(value.includes('quic'))return'quic';if(value.includes('tcp + udp'))return'tcpudp';if(value.includes('tcp')||value.includes('raw'))return'tcp';return'other'; }
function scanOptionMarkup(name, items, selected = null) { return items.map(([id,label,key])=>`<label class="option-check"><input type="checkbox" name="${name}" value="${id}" ${(selected ? selected.includes(id) : true) ? 'checked' : ''}><span>${key ? escapeHtml(t(key)) : escapeHtml(label)}</span></label>`).join(''); }
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
  $('#theme-toggle .theme-symbol').innerHTML = theme === 'dark'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42 1.42M18.8 3.2v3.4m-1.7-1.7h3.4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 14.1A8.7 8.7 0 0 1 9.9 3.6 8.9 8.9 0 1 0 20.4 14.1Z"/><path d="M17.2 4v3m-1.5-1.5h3M20 10v2m-1-1h2"/></svg>';
  $('#theme-toggle [data-theme-label]').textContent = t(theme === 'dark' ? 'lightTheme' : 'darkTheme');
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#080c10' : '#f3f8fb';
}
function showError(message = '') { elements.error.textContent = message; elements.error.hidden = !message; }
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  let data; try { data = await response.json(); } catch { throw new Error(state.lang === 'fa' ? 'پاسخ سرور قابل خواندن نبود.' : 'The server response could not be read.'); }
  if (!response.ok) { const error = new Error(data.error || `${state.lang === 'fa' ? 'خطای سرور' : 'Server error'} (${response.status})`); error.code = data.code || ''; throw error; }
  return data;
}
const UPDATE_ACTIVE = new Set(['queued','checking','downloading','installing','restarting']);
const UPDATE_LABELS = { queued:'updateQueued', checking:'updateChecking', downloading:'updateDownloading', installing:'updateInstalling', restarting:'updateRestarting' };
function showUpdateStatus(status) {
  const output = $('#update-status');
  const button = $('#update-button');
  if (!output || !button) return;
  const active = UPDATE_ACTIVE.has(status.state);
  const updateId = status.id || status.state;
  const wasSame = output.dataset.updateId === updateId;
  output.dataset.updateId = updateId;
  const dismissed = status.state === 'failed' && localStorage.getItem('vless-audit-dismissed-update') === updateId;
  output.hidden = status.state === 'idle' || dismissed;
  output.classList.toggle('is-error', status.state === 'failed');
  const messageKey = status.message || (status.state === 'complete' ? 'updateComplete' : UPDATE_LABELS[status.state]);
  let statusText = status.state === 'failed' ? `${t('updateFailed')}: ${status.error || ''}` : messageKey ? t(messageKey) : t('updateNoHelper');
  if (active && status.stageStartedAt) {
    const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(status.stageStartedAt)) / 1000));
    if (elapsed >= 10) statusText += ` · ${t('updateElapsed', Math.floor(elapsed / 60), elapsed % 60)}`;
  }
  $('#update-status-message').textContent = statusText;
  button.disabled = active;
  if (status.state === 'failed' && !wasSame && !dismissed) {
    window.setTimeout(() => {
      if (output.dataset.updateId === updateId && status.state === 'failed') {
        localStorage.setItem('vless-audit-dismissed-update', updateId);
        output.hidden = true;
      }
    }, 12000);
  }
  if (status.state === 'complete') {
    const completedId = output.dataset.updateId;
    window.setTimeout(() => {
      if (output.dataset.updateId === completedId) output.hidden = true;
    }, 5000);
  }
}
$('#dismiss-update-status')?.addEventListener('click', () => {
  const output = $('#update-status');
  if (output?.dataset.updateId) localStorage.setItem('vless-audit-dismissed-update', output.dataset.updateId);
  if (output) output.hidden = true;
});
async function watchUpdate() {
  try {
    const status = await api(`/api/update/status?t=${Date.now()}`);
    showUpdateStatus(status);
    if (UPDATE_ACTIVE.has(status.state)) { window.setTimeout(watchUpdate, 1800); return; }
    if (status.state === 'complete' && status.id && localStorage.getItem('vless-audit-reloaded-update') !== status.id) {
      localStorage.setItem('vless-audit-reloaded-update', status.id);
      window.setTimeout(() => window.location.reload(), 2200);
    }
  } catch { window.setTimeout(watchUpdate, 1800); }
}
function setBusy(busy, kind = '') { state.busy = busy; state.busyKind = busy ? (kind || 'other') : ''; const replaceable = ['ping-all','audit'].includes(state.busyKind); elements.start.disabled = busy && !replaceable; elements.start.querySelector('span:first-child').textContent = busy && !replaceable ? t('busy') : t('start'); }
function setProgress(job, detail = '') {
  state.lastJob = job; elements.progress.hidden = false;
  elements.progressTitle.textContent = job.finished ? (job.interrupted ? t('interrupted') : t('completed')) : t('connecting');
  const progressDone = Math.max(Number(job.done) || 0, Number(job.progressDone) || 0);
  elements.progressCount.textContent = t('progressCount', number(progressDone), number(job.total || 0), number(job.success || 0));
  elements.progressBar.style.width = `${job.total ? Math.min(100, (progressDone / job.total) * 100) : 0}%`;
  elements.progressMessage.textContent = detail || job.message || (job.finished ? t('doneCount', number(job.success || 0), number(job.total || 0)) : t('batchProgress', Number(job.workerCount) || 0));
  const stopButton=$('#stop-audit');if(stopButton)stopButton.hidden=Boolean(job.finished||!job.id);
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
    items.sort((a,b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || String(b.created).localeCompare(String(a.created)));
    elements.history.innerHTML = items.map((job) => {
      const done = Math.max(Number(job.done) || 0, Number(job.progressDone) || 0);
      const protocols = job.protocolIds || RESCAN_PROTOCOLS.map(([id]) => id);
      const securities = job.securityTypes || RESCAN_SECURITY.map(([id]) => id);
      const transports = job.transportTypes || RESCAN_TRANSPORTS.map(([id]) => id);
      const showOptions = (selected, options, allLabel) => selected.length === options.length
        ? [t(allLabel)]
        : options.filter(([id]) => selected.includes(id)).map(([, label, key]) => key ? t(key) : label);
      const coverage = [
        ...showOptions(protocols, RESCAN_PROTOCOLS, 'allProtocols'),
        ...showOptions(securities, RESCAN_SECURITY, 'allSecurity'),
        ...showOptions(transports, RESCAN_TRANSPORTS, 'allTransports'),
      ];
      const coverageTags = [...new Set([...(job.tags || []), ...coverage])].slice(0,12);
      const title = job.title?.trim() || `${job.id} · ${coverage.slice(0, 4).join(' / ') || t('allConfigs')}`;
      const protocolOptions = scanOptionMarkup('protocolIds', RESCAN_PROTOCOLS, protocols);
      const securityOptions = scanOptionMarkup('securityTypes', RESCAN_SECURITY, securities);
      const transportOptions = scanOptionMarkup('transportTypes', RESCAN_TRANSPORTS, transports);
      return `<article class="history-card"><div class="history-card-main"><div class="history-meta"><strong>${job.favorite ? '★ ' : ''}${escapeHtml(title)}</strong><span>${escapeHtml(dateLabel(job.created))}</span><small>${escapeHtml(t('historySuccess', number(job.success), number(job.total), number(done), Boolean(job.finished && !job.interrupted), Boolean(job.interrupted)))}${job.error ? ` · ${escapeHtml(job.error)}` : ''}</small>${coverageTags.length ? `<div class="history-tags">${coverageTags.map((tag)=>`<span class="history-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}</div><div class="history-actions"><button class="open-history" type="button" data-open-job="${escapeHtml(job.id)}">${escapeHtml(t('openHistory'))}</button>${job.hasSubscriptionUrl ? `<button class="open-history" type="button" data-copy-subscription="${escapeHtml(job.id)}">${escapeHtml(t('copySubscription'))}</button>` : ''}${job.canResume ? `<button class="open-history resume-history" type="button" data-resume-job="${escapeHtml(job.id)}">↻ ${escapeHtml(t('resume'))}</button>` : ''}<button class="open-history" type="button" data-edit-meta="${escapeHtml(job.id)}">${escapeHtml(t('editHistory'))}</button><button class="open-history favorite-history ${job.favorite ? 'is-favorite' : ''}" type="button" data-favorite-job="${escapeHtml(job.id)}" aria-label="${escapeHtml(t(job.favorite ? 'unfavoriteHistory' : 'favoriteHistory'))}" title="${escapeHtml(t(job.favorite ? 'unfavoriteHistory' : 'favoriteHistory'))}">${job.favorite ? '★' : '☆'}</button><button class="open-history rescan-history" type="button" data-rescan-job="${escapeHtml(job.id)}">↻ ${escapeHtml(t('rescan'))}</button><button class="open-history delete-history" type="button" data-delete-job="${escapeHtml(job.id)}" aria-label="${escapeHtml(t('deleteHistory'))}" title="${escapeHtml(t('deleteHistory'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button></div></div><form class="history-rescan-options" data-rescan-form="${escapeHtml(job.id)}" hidden><label class="rescan-url-field"><span>${escapeHtml(t('editSubscriptionUrl'))}</span><input name="subscriptionUrl" type="url" maxlength="2048" dir="ltr" autocomplete="url" placeholder="https://example.com/subscription" value="${escapeHtml(job.subscriptionUrl || '')}"></label><p>${escapeHtml(t('rescanLinkHint'))}</p><fieldset><legend>${escapeHtml(t('protocolFilters'))}</legend><div class="scan-option-grid">${protocolOptions}</div></fieldset><fieldset><legend>${escapeHtml(t('securityFilters'))}</legend><div class="scan-option-grid">${securityOptions}</div></fieldset><fieldset><legend>${escapeHtml(t('transportFilters'))}</legend><div class="scan-option-grid">${transportOptions}</div></fieldset><div class="history-edit-actions"><button class="open-history rescan-submit" type="submit">${escapeHtml(t('rescanStart'))}</button><button class="open-history" type="button" data-cancel-rescan="${escapeHtml(job.id)}">${escapeHtml(t('cancelRescan'))}</button></div></form><form class="history-edit" data-history-form="${escapeHtml(job.id)}" data-favorite="${job.favorite ? 'true' : 'false'}" hidden><label><span>${escapeHtml(t('editName'))}</span><input name="title" maxlength="80" value="${escapeHtml(job.title || '')}"></label><label><span>${escapeHtml(t('editTags'))}</span><input name="tags" maxlength="200" value="${escapeHtml((job.tags || []).join(', '))}"></label><label class="history-edit-url"><span>${escapeHtml(t('editSubscriptionUrl'))}</span><input name="subscriptionUrl" type="url" maxlength="2048" dir="ltr" autocomplete="url" placeholder="https://example.com/subscription" value="${escapeHtml(job.subscriptionUrl || '')}"></label><div class="history-edit-actions"><button class="open-history" type="submit">${escapeHtml(t('saveMeta'))}</button><button class="open-history" type="button" data-cancel-meta="${escapeHtml(job.id)}">${escapeHtml(t('cancelMeta'))}</button></div></form></article>`;
    }).join('');
    elements.history.querySelectorAll('.history-card').forEach((card, index) => {
      const status = card.querySelector('.history-meta small');
      if (status && items[index]) status.dataset.historyProgress = items[index].id;
    });
  } catch (error) { elements.history.innerHTML = `<div class="empty-history">${escapeHtml(t('historyError'))}: ${escapeHtml(error.message)}</div>`; }
}
function updateHistoryProgress(job) {
  const status = elements.history.querySelector(`[data-history-progress="${CSS.escape(job.id)}"]`);
  if (!status) return;
  const checked = Math.max(Number(job.done) || 0, Number(job.progressDone) || 0);
  status.textContent = `${t('historySuccess', number(job.success), number(job.total), number(checked), Boolean(job.finished && !job.interrupted), Boolean(job.interrupted))}${job.error ? ` · ${job.error}` : ''}`;
}
async function loadResults(jobId, title = t('resultTitle')) {
  elements.results.hidden = false; elements.resultsTitle.textContent = title; elements.resultsSummary.textContent = t('resultsLoading');
  elements.countries.innerHTML = `<div class="empty-history">${escapeHtml(t('loading'))}</div>`;
  elements.results.scrollIntoView({ behavior:'smooth', block:'start' });
  const all = []; let info = null;
  try {
    for (let offset = 0; ; offset += 100) {
      const chunk = await api(`/api/jobs/${encodeURIComponent(jobId)}?offset=${offset}&limit=100`); info = chunk; all.push(...chunk.results);
      elements.resultsSummary.textContent = t('resultsChunk', number(all.length), number(chunk.success));
      if (all.length >= chunk.success || chunk.results.length === 0) break;
    }
    state.currentResults = all; state.currentJob = jobId; state.selectedCountry = 'all'; state.selectedUris.clear(); elements.search.value = ''; renderResults();
    elements.resultsSummary.textContent = t('resultsLoaded', number(all.length), number(info?.total || all.length));
  } catch (error) { elements.countries.innerHTML = `<div class="empty-history">${escapeHtml(t('loadErr'))}: ${escapeHtml(error.message)}</div>`; elements.resultsSummary.textContent = t('retryHistory'); }
}
function searchable(item) { return `${item.country || ''} ${item.name || ''} ${item.endpoint || ''} ${item.ip || ''} ${item.security || ''} ${item.protocol || ''} ${item.transport || ''}`.toLocaleLowerCase(); }
function outboundIssues(item) {
  const outbound = item.outbound;
  if (!outbound) return [t('unsupportedOutbound')];
  const settings = outbound.settings || {};
  const stream = outbound.streamSettings || {};
  if (outbound.protocol === 'shadowsocks') {
    const server = settings.servers?.[0] || {};
    if (!server.address || !Number.isInteger(Number(server.port)) || !server.method || !server.password) return [t('requiredFields')];
    if (item.plugin || server.plugin || server.pluginOpts || server.plugin_opts) return [t('unsupportedTransport')];
    const method = String(server.method).trim().toLowerCase();
    if (!['2022-blake3-aes-128-gcm','2022-blake3-aes-256-gcm','2022-blake3-chacha20-poly1305','aes-128-gcm','aes-256-gcm','chacha20-poly1305','chacha20-ietf-poly1305','xchacha20-poly1305','xchacha20-ietf-poly1305'].includes(method)) return [t('unsupportedCipher')];
    return [];
  }
  if (outbound.protocol === 'wireguard' || outbound.protocol === 'masque') {
    const endpoint = settings.address || settings.peers?.[0]?.endpoint || '';
    const hasPort = Number.isInteger(Number(settings.port)) && Number(settings.port) > 0 || /:\d+$/.test(endpoint);
    return endpoint && hasPort ? [] : [t('requiredFields')];
  }
  if (outbound.protocol === 'trojan') {
    const server = settings.servers?.[0] || settings;
    if (!server.address || !Number.isInteger(Number(server.port)) || !server.password) return [t('requiredFields')];
    if (!['tls','reality'].includes(String(stream.security || '').toLowerCase())) return [t('unsupportedSecurity')];
    return [];
  }
  if (outbound.protocol === 'vmess') {
    const server = settings.vnext?.[0] || {};
    if (!server.address || !Number.isInteger(Number(server.port)) || !server.users?.[0]?.id) return [t('requiredFields')];
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
  const server = settings.vnext?.[0] || {};
  const user = server.users?.[0] || {};
  const address = settings.address || server.address; const port = settings.port || server.port; const id = settings.id || user.id;
  if (!address || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535 || !id) issues.push(t('requiredFields'));
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
function resultCard(item, index) {
  const name = item.name || item.endpoint || t('noName');
  const ping = item.pingCheck || { ok:item.ok, ms:item.ms, httpStatus:item.httpStatus, timings:item.timings };
  const endpointPingMs = ping.endpointConnectMs ?? item.endpointConnectMs;
  const timing = ping.timings;
  const tooltip = timing ? `HTTP ${ping.httpStatus || 0} · ${t('proxyConnect')} ${timing.proxyConnectMs ?? 0} ms · ${t('tlsViaOutbound')} ${timing.tlsViaOutboundMs ?? 0} ms · ${t('firstByte')} ${timing.firstByteMs ?? ping.ms ?? 0} ms` : t('timingNotSaved');
  const pingValue = ping.ok && ping.ms != null ? `${number(ping.ms)} ms` : t('pingFailed');
  const speedText = item.speedCheck?.ok
    ? t('speedResult', item.speedCheck.megabytesPerSecond, item.speedCheck.seconds)
    : item.speedCheck
      ? `${t('speedFailed')}${item.speedCheck.error ? `: ${item.speedCheck.error}` : item.speedCheck.status ? ` · HTTP ${item.speedCheck.status}` : ''}`
      : '';
  const speed = item.speedCheck ? `<small class="${item.speedCheck.ok ? 'speed-result' : 'speed-error'}" title="${escapeHtml(item.speedCheck.error || '')}">${escapeHtml(speedText)}</small>` : '';
  const issues = outboundIssues(item); const duplicate = duplicateUris().has(item.uri);
  const protocolLabel = ({hysteria2:'Hysteria2',shadowsocks:'Shadowsocks',vless:'VLESS',vmess:'VMess',trojan:'Trojan',wireguard:'WireGuard',masque:'MASQUE'})[item.protocol] || String(item.protocol || 'Unknown').toUpperCase();
  const details = [protocolLabel, item.transport || '—', item.security || ''].filter(Boolean).join(' · ');
  return `<article class="result-item route-card${state.lastPingUri === item.uri ? ' ping-updated' : ''}" data-result-index="${index}" data-uri="${escapeHtml(item.uri)}"><label class="select-config"><input type="checkbox" data-select-index="${index}" ${state.selectedUris.has(item.uri) ? 'checked' : ''}><span class="sr-only">${escapeHtml(t('selectConfig'))}</span></label><div class="result-primary"><div class="result-primary-head"><strong>${escapeHtml(name)}</strong><span class="result-flags">${duplicate ? `<span class="duplicate-tag">${escapeHtml(t('duplicate'))}</span>` : ''}${issues.length ? `<span class="compatibility-tag bad" title="${escapeHtml(issues.join(' · '))}">${escapeHtml(t('incompatible'))}</span>` : `<span class="compatibility-tag">${escapeHtml(t('outboundReady'))}</span>`}</span></div><code>${escapeHtml(item.endpoint)} · ${escapeHtml(item.ip)} · ${escapeHtml(item.country || t('countryUnknown'))}</code></div><div class="result-stat result-ping ${ping.ok ? '' : 'ping-failed'}" tabindex="0" title="${escapeHtml(tooltip)}">${pingValue}<small>${escapeHtml(t('rttLabel'))}</small></div><div class="result-stat result-endpoint-ping" title="${escapeHtml(t('endpointPingTip'))}">${endpointPingMs == null ? '—' : `${number(endpointPingMs)} ms`}<small>${escapeHtml(t('endpointPing'))}</small></div><div class="result-stat result-exit">${escapeHtml(item.exit || '—')}<small>${escapeHtml(t('exitIp'))}</small></div><span class="security-tag" title="${escapeHtml(t('protocol'))} · ${escapeHtml(t('transport'))}">${escapeHtml(details)}</span><div class="connection-actions"><button class="copy-button item-copy" type="button" data-copy-index="${index}">${escapeHtml(t('configCopy'))}</button><button class="copy-button ping-again-button" type="button" data-ping-index="${index}">${escapeHtml(t('pingAgain'))}</button><button class="copy-button speed-test-button" type="button" data-speed-index="${index}">↓ ${escapeHtml(t('speedTest'))}</button>${speed}</div></article>`;
}
function refreshResultCard(item) {
  const index = state.currentResults.indexOf(item);
  if (index < 0) return;
  const card = elements.countries.querySelector(`[data-result-index="${index}"]`);
  if (card) card.outerHTML = resultCard(item,index);
}
function countryOutbounds(country) {
  return uniqueOutbounds(state.currentResults.filter((item) => (item.country || t('countryUnknown')) === country));
}
function countryFilename(country) { const slug = country.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'unknown'; return `outbounds-${slug}.json`; }
const COUNTRY_NAME_CODES = {'albania':'AL','australia':'AU','austria':'AT','belarus':'BY','brazil':'BR','bulgaria':'BG','canada':'CA','chile':'CL','czechia':'CZ','czech republic':'CZ','estonia':'EE','finland':'FI','france':'FR','georgia':'GE','germany':'DE','greece':'GR','hong kong':'HK','india':'IN','indonesia':'ID','iran':'IR','ireland':'IE','israel':'IL','italy':'IT','japan':'JP','kazakhstan':'KZ','latvia':'LV','malaysia':'MY','mexico':'MX','netherlands':'NL','the netherlands':'NL','nigeria':'NG','norway':'NO','poland':'PL','romania':'RO','russia':'RU','singapore':'SG','south africa':'ZA','south korea':'KR','korea':'KR','spain':'ES','sweden':'SE','switzerland':'CH','taiwan':'TW','thailand':'TH','turkiye':'TR','türkiye':'TR','turkey':'TR','ukraine':'UA','united arab emirates':'AE','united kingdom':'GB','uk':'GB','united states':'US','usa':'US','vietnam':'VN'};
function flagAsset(code, country='') { const value=/^[a-z]{2}$/i.test(code||'')?code.toLowerCase():COUNTRY_NAME_CODES[String(country||'').trim().toLocaleLowerCase()]?.toLowerCase()||'globe'; return `<img class=\"country-flag\" src=\"/assets/flags/${value}.svg\" alt=\"\" loading=\"lazy\" decoding=\"async\">`; }
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
  const item=state.currentResults[index]; if(!item?.uri)return;
  button.disabled=true;button.textContent=t('pingChecking');
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
  finally{button.disabled=false;button.textContent=t('pingAgain');}
}
async function rerunCountryPings(country, button) {
  const items=state.currentResults.filter((item)=>(item.country||t('countryUnknown'))===country&&item.ok&&item.uri);
  if(!items.length||state.interactiveId)return;
  const original=button.textContent;button.disabled=true;button.textContent=t('pingAllChecking');
  try{
    const data=await api('/api/jobs/'+encodeURIComponent(state.currentJob)+'/results/ping-all',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uris:items.map(item=>item.uri)})});
    await watchInteractive(data, { items });
  }catch(error){showError(error.message);}
  finally{button.disabled=false;button.textContent=original;}
}
async function runDownloadTest(index, button) {
  const item=state.currentResults[index]; if(!item?.uri||state.interactiveId)return;
  button.disabled=true;button.textContent=t('speedTesting');
  try{const task=await api(`/api/jobs/${encodeURIComponent(state.currentJob)}/results/download`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uri:item.uri})});await watchInteractive(task,{item});}
  catch(error){showError(error.message);button.disabled=false;button.textContent=`↓ ${t('speedTest')}`;}
  finally{button.disabled=false;button.textContent=`↓ ${t('speedTest')}`;}
}
async function stopInteractive(id) {
  try { await api(`/api/interactive/${encodeURIComponent(id)}/stop`,{method:'POST'}); } catch {}
  for(let attempt=0;attempt<40;attempt++) {
    await new Promise((resolve)=>window.setTimeout(resolve,125));
    try { const status=await api(`/api/interactive/${encodeURIComponent(id)}`);if(!['starting','running','stopping'].includes(status.status))return; } catch { return; }
  }
}
async function watchInteractive(task, options = {}) {
  state.interactiveId=task.id;state.interactiveKind=task.kind;state.interactiveUri=options.item?.uri||task.uri||'';
  if(options.items) state.interactiveEntries=options.items;
  try {
    let current=task;
    while(['starting','running','stopping'].includes(current.status)) {
      state.interactiveProgress={done:current.done,total:current.total};
      await new Promise((resolve)=>window.setTimeout(resolve,1000));
      current=await api(`/api/interactive/${encodeURIComponent(task.id)}`);
    }
    if(current.status==='failed') throw new Error(current.error||t('interactiveBusy'));
    if(current.kind==='ping-all') {
      await reloadVisibleJobResults();
    } else if(current.kind==='download') {
      const item=options.item||state.currentResults.find((entry)=>entry.uri===state.interactiveUri);
      if(item&&current.result)item.speedCheck=current.result;
      if(item) refreshResultCard(item);
    }
  } finally {
    if(state.interactiveId===task.id){const item=options.item||state.currentResults.find((entry)=>entry.uri===state.interactiveUri);state.interactiveId='';state.interactiveKind='';state.interactiveUri='';state.interactiveProgress=null;if(item)refreshResultCard(item);}
  }
}
async function reloadVisibleJobResults() {
  if(!state.currentJob)return;
  const loaded=[];
  for(let offset=0;;offset+=100){const chunk=await api(`/api/jobs/${encodeURIComponent(state.currentJob)}?offset=${offset}&limit=100`);loaded.push(...chunk.results);if(loaded.length>=chunk.success||!chunk.results.length)break;}
  state.currentResults=loaded;renderResults();
}
function renderResults() {
  if (!elements.countries || elements.results.hidden) return;
  const existingCards = [...elements.countries.querySelectorAll('.country-card')];
  const hadRenderedCards = existingCards.length > 0;
  const previousView = existingCards.some((card) => card.dataset.view === 'name') ? 'name' : 'country';
  const openCountries = new Set(existingCards.filter((card) => card.open).map((card) => card.dataset.country));
  const allConfigsWasOpen = existingCards.some((card) => card.dataset.view === 'name' && card.open);
  const query = elements.search.value.trim().toLocaleLowerCase();
  const protocolFilter = $('#result-protocol').value;
  const securityFilter = $('#result-security').value;
  const transportFilter = $('#result-transport').value;
  const countries = new Map();
  for (const item of state.currentResults) {
    const key = item.countryCode || item.country || 'unknown';
    if (!countries.has(key)) countries.set(key, item);
  }
  const countryFilters = $('#country-filters');
  if (countryFilters) countryFilters.innerHTML = `<button class="country-filter ${state.selectedCountry === 'all' ? 'active' : ''}" type="button" data-country-filter="all" aria-pressed="${state.selectedCountry === 'all'}"><img class="country-flag" src="/assets/flags/globe.svg" alt=""><span>${escapeHtml(t('allCountries'))}</span></button>${[...countries.entries()].sort(([,a],[,b]) => localizedCountry(a).localeCompare(localizedCountry(b), state.lang)).map(([key,item]) => `<button class="country-filter ${state.selectedCountry === key ? 'active' : ''}" type="button" data-country-filter="${escapeHtml(key)}" aria-pressed="${state.selectedCountry === key}">${flagAsset(item.countryCode,item.country)}<span>${escapeHtml(localizedCountry(item))}</span></button>`).join('')}`;
  const duplicates = duplicateUris();
  const filtered = state.currentResults.filter((item) => {
    if (query && !searchable(item).includes(query)) return false;
    if (protocolFilter !== 'all' && String(item.protocol).toLowerCase() !== protocolFilter) return false;
    if (securityFilter !== 'all' && securityType(item) !== securityFilter) return false;
    if (transportFilter !== 'all' && transportType(item) !== transportFilter) return false;
    if (state.selectedCountry !== 'all' && String(item.countryCode || item.country || 'unknown') !== state.selectedCountry) return false;
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
async function monitorJob(job, generation = state.activityGeneration) {
  if(generation!==state.activityGeneration)return;
  await loadHistory();
  let current=job; if(generation!==state.activityGeneration)return; setProgress(current);updateHistoryProgress(current);
  state.currentJob=job.id;state.currentResults=[];state.selectedUris.clear();elements.results.hidden=false;elements.resultsTitle.textContent=t('newResults');elements.countries.innerHTML='';
  let loadedCount=0,lastRenderedCount=0,lastRenderedAt=Date.now();
  while(!current.finished){
    await new Promise((resolve)=>window.setTimeout(resolve,1100));if(generation!==state.activityGeneration)return;
    try { current=await api(`/api/jobs/${encodeURIComponent(job.id)}?summary=1`); }
    catch { setProgress(current,t('progressReconnect'));continue; }
    if(generation!==state.activityGeneration)return;setProgress(current);updateHistoryProgress(current);
    let chunk;
    try { chunk=await api(`/api/jobs/${encodeURIComponent(job.id)}?offset=${loadedCount}&limit=100`); }
    catch { setProgress(current,t('progressReconnect'));continue; }
    if(chunk.results.length){state.currentResults.push(...chunk.results);loadedCount+=chunk.results.length;elements.resultsSummary.textContent=t('resultsChunk',number(loadedCount),number(chunk.success));if(loadedCount-lastRenderedCount>=50||Date.now()-lastRenderedAt>=5000||current.finished){renderResults();lastRenderedCount=loadedCount;lastRenderedAt=Date.now();}}
  }
  if(generation!==state.activityGeneration)return;
  if(current.error) elements.progressMessage.textContent=current.error;
  await reloadVisibleJobResults();elements.resultsSummary.textContent=t('resultsLoaded',number(state.currentResults.length),number(current.total||state.currentResults.length));renderResults();await loadHistory();
}
async function restoreActiveAudit() {
  if (state.busy) return;
  try {
    const history = await api('/api/history');
    const active = history.find((job) => !job.finished && Number(job.done) < Number(job.total));
    if (!active || state.busy) return;
    const job = await api(`/api/jobs/${encodeURIComponent(active.id)}?summary=1`);
    if (job.finished) return;
    const generation = ++state.activityGeneration;
    setBusy(true,'audit');
    try { await monitorJob(job,generation); }
    catch (error) { if (generation === state.activityGeneration) { setProgress(job,t('progressReconnect'));showError(error.message); } }
    finally { if (generation === state.activityGeneration) setBusy(false); }
  } catch {}
}
document.querySelectorAll('.tab').forEach((tab)=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach((item)=>{const selected=item===tab;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected));});
  const isUrl=tab.dataset.mode==='url';$('#url-mode').hidden=!isUrl;$('#text-mode').hidden=isUrl;showError();
}));
elements.form.addEventListener('submit',async(event)=>{
  event.preventDefault();const replacingCheck=state.busy&&['ping-all','audit'].includes(state.busyKind);if(state.busy&&!replacingCheck)return;showError();const isUrl=!$('#url-mode').hidden;
    const payload=scanFilters(elements.form);if(!payload.protocolIds.length)return showError(t('noProtocols'));if(!payload.securityTypes.length||!payload.transportTypes.length)return showError(t('noScanFilters'));
  if(isUrl)payload.subscriptionUrl=elements.url.value.trim();else payload.text=elements.text.value.trim();
  if(isUrl&&!payload.subscriptionUrl)return showError(t('askUrl'));if(!isUrl&&!payload.text)return showError(t('askText'));
  const previousGeneration=state.activityGeneration;let generation=previousGeneration;let accepted=false;let declined=false;
  if(!replacingCheck){generation=++state.activityGeneration;setBusy(true,'audit');elements.progress.hidden=false;setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));}
  try{
    let job;
    try { job=await api('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); if(replacingCheck){generation=++state.activityGeneration;setBusy(true,'audit');elements.progress.hidden=false;setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));} accepted=true; }
    catch(error) {
      if(!['PING_ALL_ACTIVE','CHECK_ACTIVE'].includes(error.code))throw error;
      if(!window.confirm(t('replacePingConfirm'))){declined=true;throw error;}
      generation=++state.activityGeneration;setBusy(true,'audit');elements.progress.hidden=false;setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));
      accepted=true;
      job=await api('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,replaceCheck:true})});accepted=true;
    }
    await monitorJob(job,generation);
  }
  catch(error){if(!declined){showError(error.message);if(!replacingCheck)elements.progress.hidden=true;}}
  finally{if(!replacingCheck&&generation===state.activityGeneration)setBusy(false);else if(accepted&&generation===state.activityGeneration)setBusy(false);}
});
$('#refresh-history').addEventListener('click',loadHistory);elements.search.addEventListener('input',renderResults);
document.querySelectorAll('.view-tab').forEach((tab)=>tab.addEventListener('click',()=>{state.view=tab.dataset.view;document.querySelectorAll('.view-tab').forEach((item)=>{const selected=item===tab;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected));});renderResults();}));
elements.history.addEventListener('click', async (event) => {
  const favoriteButton = event.target.closest('[data-favorite-job]');
  const deleteButton = event.target.closest('[data-delete-job]');
  const editButton = event.target.closest('[data-edit-meta]');
  const cancelButton = event.target.closest('[data-cancel-meta]');
  if (editButton) {
    const form = elements.history.querySelector(`[data-history-form="${CSS.escape(editButton.dataset.editMeta)}"]`);
    elements.history.querySelectorAll('.history-edit').forEach((item) => { if (item !== form) item.hidden = true; });
    if (form) { form.hidden = false; form.querySelector('[name="title"]').focus(); }
    return;
  }
  if (cancelButton) {
    const form = elements.history.querySelector(`[data-history-form="${CSS.escape(cancelButton.dataset.cancelMeta)}"]`);
    if (form) form.hidden = true;
    return;
  }
  if (deleteButton) {
    if (!window.confirm(t('deleteConfirm'))) return;
    const deletedId = deleteButton.dataset.deleteJob;
    deleteButton.disabled = true;
    try {
      await api(`/api/jobs/${encodeURIComponent(deletedId)}`, { method:'DELETE' });
      if (state.currentJob === deletedId) {
        state.currentJob = '';
        state.currentResults = [];
        elements.results.hidden = true;
      }
      showError('');
      await loadHistory();
    } catch (error) {
      showError(`${t('deleteFailed')}: ${error.message}`);
      deleteButton.disabled = false;
    }
    return;
  }
  const cancelRescan = event.target.closest('[data-cancel-rescan]');
  if (cancelRescan) {
    const form = elements.history.querySelector(`[data-rescan-form="${CSS.escape(cancelRescan.dataset.cancelRescan)}"]`);
    if (form) form.hidden = true;
    return;
  }
  const copySubButton = event.target.closest('[data-copy-subscription]');
  if (copySubButton) {
    try {
      const data = await api(`/api/jobs/${encodeURIComponent(copySubButton.dataset.copySubscription)}?subscription-url=1`);
      if (data.subscriptionUrl) await copyText(data.subscriptionUrl, copySubButton);
    } catch (error) { showError(error.message); }
    return;
  }
  const jobId = favoriteButton?.dataset.favoriteJob;
  if (jobId) {
    try {
      const current = (await api('/api/history')).find((item) => item.id === jobId);
      if (!current) return;
      await api(`/api/jobs/${encodeURIComponent(jobId)}/meta`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ title:current.title || '', tags:current.tags || [], favorite:!current.favorite }) });
      await loadHistory();
    } catch (error) { showError(error.message); }
    return;
  }
  const rescan = event.target.closest('[data-rescan-job]');
  if (rescan) {
    if (state.busy) return;
    const form = elements.history.querySelector(`[data-rescan-form="${CSS.escape(rescan.dataset.rescanJob)}"]`);
    if (form) { form.hidden = !form.hidden; if (!form.hidden) form.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    return;
  }
  const resume = event.target.closest('[data-resume-job]');
  if (resume) {
    if (state.busy) return;
    setBusy(true, 'audit'); resume.disabled = true; showError(''); elements.progress.hidden = false;
    setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));
    try { const job = await api(`/api/jobs/${encodeURIComponent(resume.dataset.resumeJob)}/resume`, { method:'POST' }); await monitorJob(job); }
    catch (error) { showError(`${t('resumeError')}: ${error.message}`); elements.progress.hidden = true; }
    finally { setBusy(false); resume.disabled = false; await loadHistory(); }
    return;
  }
  const button = event.target.closest('[data-open-job]');
  if (button) loadResults(button.dataset.openJob,t('savedResults'));
});
elements.history.addEventListener('submit', async (event) => {
  const rescanForm = event.target.closest('[data-rescan-form]');
  if (rescanForm) {
    event.preventDefault();
    const filters = { protocolIds:checkedValues(rescanForm,'input[name="protocolIds"]'), securityTypes:checkedValues(rescanForm,'input[name="securityTypes"]'), transportTypes:checkedValues(rescanForm,'input[name="transportTypes"]') };
    if (!filters.protocolIds.length) { showError(t('rescanNoProtocols')); return; }
    if (!filters.securityTypes.length || !filters.transportTypes.length) { showError(t('noScanFilters')); return; }
    const submit = rescanForm.querySelector('.rescan-submit');
    submit.disabled = true;
    setBusy(true, 'audit'); showError(''); elements.progress.hidden = false;
    setProgress({id:'',done:0,total:0,success:0,finished:false},t('reading'));
    try {
      const subscriptionUrl = String(new FormData(rescanForm).get('subscriptionUrl') || '').trim();
      const job = await api(`/api/jobs/${encodeURIComponent(rescanForm.dataset.rescanForm)}/rescan`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({subscriptionUrl,...filters}) });
      rescanForm.hidden = true;
      await monitorJob(job);
    } catch (error) { showError(error.message); elements.progress.hidden = true; }
    finally { setBusy(false); submit.disabled = false; await loadHistory(); }
    return;
  }
  const form = event.target.closest('[data-history-form]');
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const data = new FormData(form);
    const tags = String(data.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    await api(`/api/jobs/${encodeURIComponent(form.dataset.historyForm)}/meta`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ title:String(data.get('title') || ''), tags, subscriptionUrl:String(data.get('subscriptionUrl') || '').trim(), favorite:form.dataset.favorite === 'true' }) });
    await loadHistory();
  } catch (error) { showError(error.message); submit.disabled = false; }
});
elements.countries.addEventListener('click',(event)=>{
  const pingAllButton=event.target.closest('[data-ping-all-country]');if(pingAllButton){rerunCountryPings(pingAllButton.dataset.pingAllCountry,pingAllButton);return;}
  const pingButton=event.target.closest('[data-ping-index]');if(pingButton){rerunPing(Number(pingButton.dataset.pingIndex),pingButton);return;}
  const speedButton=event.target.closest('[data-speed-index]');if(speedButton){runDownloadTest(Number(speedButton.dataset.speedIndex),speedButton);return;}
  const itemButton=event.target.closest('[data-copy-index]');if(itemButton){const item=state.currentResults[Number(itemButton.dataset.copyIndex)];if(item?.uri)copyText(item.uri,itemButton);return;}
  const groupButton=event.target.closest('[data-copy-group]');if(groupButton){event.preventDefault();const country=groupButton.dataset.copyGroup;const uris=state.currentResults.filter((item)=>(item.country||t('countryUnknown'))===country).map((item)=>item.uri).filter(Boolean);copyText(uris.join('\n'),groupButton);return;}
  const jsonButton=event.target.closest('[data-copy-json]');if(jsonButton){event.preventDefault();copyText(JSON.stringify(countryOutbounds(jsonButton.dataset.copyJson),null,2),jsonButton);return;}
  const downloadButton=event.target.closest('[data-download-json]');if(downloadButton){event.preventDefault();downloadJson(downloadButton.dataset.downloadJson,downloadButton);}
});
$('#stop-audit').addEventListener('click',async()=>{const id=state.lastJob?.id;if(!id)return;const button=$('#stop-audit');button.disabled=true;try{await api(`/api/jobs/${encodeURIComponent(id)}/stop`,{method:'POST'});}catch(error){showError(error.message);}finally{button.disabled=false;}});
elements.countries.addEventListener('change',(event)=>{const input=event.target.closest('[data-select-index]');if(!input)return;const item=state.currentResults[Number(input.dataset.selectIndex)];if(!item?.uri)return;if(input.checked)state.selectedUris.add(item.uri);else state.selectedUris.delete(item.uri);renderResults();});
$('#select-visible').addEventListener('click',()=>{for(const index of state.visibleIndices){const item=state.currentResults[index];if(item?.uri)state.selectedUris.add(item.uri);}renderResults();});
$('#clear-selection').addEventListener('click',()=>{state.selectedUris.clear();renderResults();});
$('#copy-selected-json').addEventListener('click',(event)=>{const items=state.currentResults.filter((item)=>state.selectedUris.has(item.uri));copyText(JSON.stringify(uniqueOutbounds(items),null,2),event.currentTarget);});
$('#copy-all-json').addEventListener('click',(event)=>copyText(JSON.stringify(uniqueOutbounds(state.currentResults),null,2),event.currentTarget));
$('#result-sort').addEventListener('change',(event)=>{state.sortBy=event.target.value;renderResults();});
$('#result-protocol').addEventListener('change',renderResults);$('#result-security').addEventListener('change',renderResults);$('#result-transport').addEventListener('change',renderResults);$('#hide-duplicates').addEventListener('change',renderResults);
$('#country-filters').addEventListener('click',(event)=>{const button=event.target.closest('[data-country-filter]');if(!button)return;state.selectedCountry=button.dataset.countryFilter;renderResults();});
$('#language-toggle').addEventListener('click',()=>{state.lang=state.lang==='fa'?'en':'fa';localStorage.setItem('vless-audit-lang',state.lang);applyLanguage();});
$('#theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#update-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (button.disabled || !window.confirm(t('updateConfirm'))) return;
  button.disabled = true;
  try { await api('/api/update', { method:'POST' }); await watchUpdate(); }
  catch (error) { showUpdateStatus({ state:'failed', error:error.message }); button.disabled = false; }
});
$('#logout-button').addEventListener('click',async()=>{try{await fetch('/api/logout',{method:'POST',cache:'no-store'});}finally{window.location.assign('/login');}});
setTheme(localStorage.getItem('vless-audit-theme')||'dark');applyLanguage();watchUpdate();restoreActiveAudit();
api('/api/health').catch((error)=>{elements.progress.hidden=false;elements.progressMessage.textContent=`${t('healthError')}: ${error.message}`;});
