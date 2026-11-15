// All checks are HTTPS reachability checks through the selected route. They
// do not measure game-server RTT or validate account/login availability.
// Use each vendor's public web edge (not a regional download/login deep link)
// to reduce false negatives caused by redirects, geofencing, or bot challenges.
const service = (id, group, name, host, icon = id) => ({
  id, group, name, host, icon, url: `https://${host.replace(/\/+$/, '')}${host.includes('/') ? '' : '/'}`,
});

export const SERVICE_GROUPS = [
  { id: 'social', fa: 'شبکه‌های اجتماعی', en: 'Social media' },
  { id: 'public', fa: 'سرویس‌های عمومی و هوش مصنوعی', en: 'Public & AI services' },
  { id: 'gaming', fa: 'بازی و پلتفرم‌های بازی', en: 'Games & gaming platforms' },
  { id: 'downloads', fa: 'دانلود و درایورها', en: 'Downloads & drivers' },
];

export const SERVICES = [
  service('instagram', 'social', 'Instagram', 'www.instagram.com'),
  service('facebook', 'social', 'Facebook', 'www.facebook.com'),
  service('whatsapp', 'social', 'WhatsApp', 'www.whatsapp.com'),
  service('x', 'social', 'X', 'x.com'),
  service('tiktok', 'social', 'TikTok', 'www.tiktok.com'),
  service('telegram', 'social', 'Telegram', 'telegram.org'),
  service('discord', 'social', 'Discord', 'discord.com'),
  service('signal', 'social', 'Signal', 'signal.org'),
  service('snapchat', 'social', 'Snapchat', 'www.snapchat.com'),
  service('reddit', 'social', 'Reddit', 'www.reddit.com'),
  service('linkedin', 'social', 'LinkedIn', 'www.linkedin.com'),
  service('pinterest', 'social', 'Pinterest', 'www.pinterest.com'),
  service('threads', 'social', 'Threads', 'www.threads.net'),

  service('gemini', 'public', 'Gemini', 'gemini.google.com'),
  service('chatgpt', 'public', 'ChatGPT', 'chatgpt.com', 'openai'),
  service('claude', 'public', 'Claude', 'claude.ai'),
  service('copilot', 'public', 'Microsoft Copilot', 'copilot.microsoft.com', 'microsoftcopilot'),
  service('perplexity', 'public', 'Perplexity', 'www.perplexity.ai'),
  service('google', 'public', 'Google', 'www.google.com'),
  service('youtube', 'public', 'YouTube', 'www.youtube.com'),
  service('gmail', 'public', 'Gmail', 'mail.google.com/mail/'),
  service('google-drive', 'public', 'Google Drive', 'drive.google.com', 'googledrive'),
  service('google-play', 'public', 'Google Play', 'play.google.com', 'googleplay'),
  service('github', 'public', 'GitHub', 'github.com'),
  service('microsoft', 'public', 'Microsoft', 'www.microsoft.com'),
  service('apple', 'public', 'Apple', 'www.apple.com'),
  service('cloudflare', 'public', 'Cloudflare', 'www.cloudflare.com'),
  service('spotify', 'public', 'Spotify', 'open.spotify.com'),
  service('wikipedia', 'public', 'Wikipedia', 'www.wikipedia.org'),

  service('steam', 'gaming', 'Steam', 'store.steampowered.com'),
  service('battle-net', 'gaming', 'Battle.net', 'account.battle.net', 'battledotnet'),
  service('world-of-warcraft', 'gaming', 'World of Warcraft', 'worldofwarcraft.blizzard.com', 'worldofwarcraft'),
  service('overwatch', 'gaming', 'Overwatch 2', 'overwatch.blizzard.com'),
  service('hearthstone', 'gaming', 'Hearthstone', 'hearthstone.blizzard.com'),
  service('valorant', 'gaming', 'VALORANT', 'playvalorant.com'),
  service('league-of-legends', 'gaming', 'League of Legends', 'www.leagueoflegends.com', 'leagueoflegends'),
  service('epic-games', 'gaming', 'Epic Games', 'store.epicgames.com'),
  service('fortnite', 'gaming', 'Fortnite', 'www.fortnite.com'),
  service('minecraft', 'gaming', 'Minecraft', 'www.minecraft.net'),
  service('roblox', 'gaming', 'Roblox', 'www.roblox.com'),
  service('pubg', 'gaming', 'PUBG', 'www.pubg.com'),
  service('genshin-impact', 'gaming', 'Genshin Impact', 'genshin.hoyoverse.com', 'genshinimpact'),
  service('ea', 'gaming', 'EA app', 'www.ea.com'),
  service('ubisoft', 'gaming', 'Ubisoft Connect', 'www.ubisoft.com'),
  service('playstation', 'gaming', 'PlayStation', 'www.playstation.com'),
  service('xbox', 'gaming', 'Xbox', 'www.xbox.com'),
  service('counter-strike', 'gaming', 'Counter-Strike 2', 'www.counter-strike.net', 'counterstrike'),
  service('dota-2', 'gaming', 'Dota 2', 'www.dota2.com', 'dota2'),
  service('apex-legends', 'gaming', 'Apex Legends', 'www.ea.com/games/apex-legends', 'apexlegends'),

  service('hp', 'downloads', 'HP Support', 'support.hp.com'),
  service('dell', 'downloads', 'Dell Support', 'www.dell.com/support'),
  service('lenovo', 'downloads', 'Lenovo Support', 'support.lenovo.com'),
  service('asus', 'downloads', 'ASUS Support', 'www.asus.com/support'),
  service('acer', 'downloads', 'Acer Support', 'www.acer.com/us-en/support/drivers-and-manuals'),
  service('nvidia', 'downloads', 'NVIDIA Drivers', 'www.nvidia.com'),
  service('amd', 'downloads', 'AMD Drivers', 'www.amd.com/en/support/download/drivers.html'),
  service('intel', 'downloads', 'Intel Download Center', 'www.intel.com/content/www/us/en/download-center/home.html'),
  service('realtek', 'downloads', 'Realtek Downloads', 'www.realtek.com'),
  service('samsung', 'downloads', 'Samsung Support', 'www.samsung.com/support'),
  service('logitech', 'downloads', 'Logitech Support', 'support.logi.com'),
  service('microsoft-catalog', 'downloads', 'Microsoft Update Catalog', 'www.catalog.update.microsoft.com', 'microsoft'),
];

export const SERVICE_BY_ID = new Map(SERVICES.map((item) => [item.id, item]));
