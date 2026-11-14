const stored = localStorage.getItem('vless-audit-lang') || 'fa';
let language = stored;
function applyLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-fa][data-en]').forEach((node) => { node.textContent = node.dataset[language]; });
  document.getElementById('language-toggle').textContent = language === 'fa' ? 'EN' : 'FA';
}
applyLanguage();
document.getElementById('language-toggle').addEventListener('click', () => {
  language = language === 'fa' ? 'en' : 'fa';
  localStorage.setItem('vless-audit-lang', language);
  applyLanguage();
});
if (new URLSearchParams(location.search).has('error')) document.getElementById('login-error').hidden = false;
