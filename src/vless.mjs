import { isIP } from 'node:net';

function ipv4Number(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];
    return value !== null && !blocked.some(([network, bits]) => {
      const base = ipv4Number(network);
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (base & mask);
    });
  }
  if (family !== 6) return false;
  const value = address.toLowerCase().split('%')[0];
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicAddress(mapped[1]);
  if (value === '::' || value === '::1') return false;
  if (/^(fc|fd|fe[89ab]|ff)/.test(value)) return false;
  if (value.startsWith('2001:db8:') || value === '2001:db8') return false;
  return true;
}

function decodeBase64(text) {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  return Buffer.from(normalized + '='.repeat((4 - normalized.length % 4) % 4), 'base64').toString('utf8');
}

export function parseSubscription(input) {
  let text = String(input || '').trim();
  if (!/(?:vless|ss|hysteria2|hy2):\/\//i.test(text) && text.length < 2_500_000) {
    try {
      const decoded = decodeBase64(text);
      if (/(?:vless|ss|hysteria2|hy2):\/\//i.test(decoded)) text = decoded;
    } catch {}
  }
  const configs = [];
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    const uri = line.trim();
    if (!/^(?:vless|ss|hysteria2|hy2):\/\//i.test(uri) || seen.has(uri)) continue;
    seen.add(uri);
    try {
      if (/^ss:\/\//i.test(uri)) {
        const config = parseShadowsocks(uri);
        if (config) configs.push(config);
        continue;
      }
      const parsed = new URL(uri);
      const entries = [...parsed.searchParams.entries()];
      const getParam = (...names) => {
        for (const name of names) {
          const value = entries.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
          if (value) return value;
        }
        return '';
      };
      const host = parsed.hostname.replace(/^\[|\]$/g, '');
      const port = Number(parsed.port);
      const security = getParam('security').toLowerCase();
      if (!host || !port || port < 1 || port > 65535) continue;
      if (parsed.protocol === 'hysteria2:' || parsed.protocol === 'hy2:') {
        const auth = decodeURIComponent(parsed.username || '') + (parsed.password ? ':' + decodeURIComponent(parsed.password) : '');
        if (!auth) continue;
        const params = Object.fromEntries(parsed.searchParams.entries());
        params.sni = getParam('sni', 'servername', 'server_name') || host;
        params.insecure = ['1', 'true', 'yes'].includes(getParam('insecure').toLowerCase());
        params.obfs = getParam('obfs').toLowerCase();
        params.obfsPassword = getParam('obfs-password', 'obfs_password');
        params.auth = auth;
        params.type = 'hysteria2';
        const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : host + ':' + port;
        configs.push({ uri, protocol: 'hysteria2', transport: 'Hysteria2 / QUIC', host, port, security: 'tls', params, name });
        continue;
      }
      const uuid = decodeURIComponent(parsed.username);
      if (parsed.protocol !== 'vless:' || !uuid || !['tls', 'reality'].includes(security)) continue;
      const params = Object.fromEntries(parsed.searchParams.entries());
      // Accept the standard Xray URI keys and common aliases emitted by subscription converters.
      params.type = getParam('type', 'network') || 'tcp';
      params.sni = getParam('sni', 'serverName', 'server_name');
      params.fp = getParam('fp', 'fingerprint');
      params.pbk = getParam('pbk', 'publicKey', 'public_key', 'realityPublicKey', 'reality_public_key');
      params.sid = getParam('sid', 'shortId', 'short_id');
      params.spx = getParam('spx', 'spiderX', 'spider_x');
      if (security === 'reality' && !params.pbk) continue;
      const name = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : host + ':' + port;
      const network = params.type.toLowerCase() === 'raw' ? 'tcp' : params.type.toLowerCase();
      configs.push({ uri, protocol: 'vless', transport: transportLabel(network), host, port, uuid, security, params, name });
    } catch {}
  }
  return configs;
}

function parseShadowsocks(uri) {
  const body = uri.slice(uri.indexOf('//') + 2);
  const hashAt = body.indexOf('#');
  const name = hashAt >= 0 ? decodeURIComponent(body.slice(hashAt + 1)) : '';
  const withoutHash = hashAt >= 0 ? body.slice(0, hashAt) : body;
  const queryAt = withoutHash.indexOf('?');
  const rawMain = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  const query = new URLSearchParams(queryAt >= 0 ? withoutHash.slice(queryAt + 1) : '');
  let method = '', password = '', host = '', port = 0;
  const at = rawMain.lastIndexOf('@');
  if (at >= 0) {
    const authPart = rawMain.slice(0, at);
    const addressPart = rawMain.slice(at + 1);
    const decodedAuth = decodeURIComponent(authPart);
    if (decodedAuth.includes(':')) {
      const colon = decodedAuth.indexOf(':');
      method = decodedAuth.slice(0, colon);
      password = decodedAuth.slice(colon + 1);
    } else {
      const legacy = decodeBase64(decodedAuth);
      const colon = legacy.indexOf(':');
      if (colon < 0) return null;
      method = legacy.slice(0, colon);
      password = legacy.slice(colon + 1);
    }
    const address = new URL('ss://' + addressPart);
    host = address.hostname.replace(/^\[|\]$/g, '');
    port = Number(address.port);
  } else {
    const legacy = decodeBase64(rawMain);
    const match = legacy.match(/^([^:]+):(.+)@(.+):(\d+)$/);
    if (!match) return null;
    [, method, password, host, port] = match;
    port = Number(port);
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  }
  if (!method || !password || !host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  const params = { method, password, plugin: query.get('plugin') || '' };
  return {
    uri, protocol: 'shadowsocks', transport: 'TCP + UDP', host, port,
    security: method, params, name: name || host + ':' + port,
  };
}

function transportLabel(network) {
  return ({ tcp: 'TCP (Raw)', ws: 'WS', grpc: 'gRPC', xhttp: 'XHTTP', httpupgrade: 'HTTPUpgrade', hysteria: 'Hysteria2 / QUIC' })[network] || network.toUpperCase();
}

function buildOutbound(config, tag) {
  const q = config.params;
  if (config.protocol === 'shadowsocks') {
    if (q.plugin) throw new Error('این لینک Shadowsocks از plugin استفاده می‌کند و برای تست مستقیم با Xray پشتیبانی نمی‌شود.');
    return { tag, protocol: 'shadowsocks', settings: { servers: [{ address: config.host, port: config.port, method: q.method, password: q.password }] } };
  }
  if (config.protocol === 'hysteria2') {
    const streamSettings = {
      network: 'hysteria', security: 'tls',
      tlsSettings: { serverName: q.sni || config.host, allowInsecure: Boolean(q.insecure) },
      hysteriaSettings: { version: 2, auth: q.auth, udpIdleTimeout: 60 },
    };
    if (q.obfs) {
      if (q.obfs !== 'salamander' || !q.obfsPassword) throw new Error('نوع یا رمز obfuscation این Hysteria2 پشتیبانی نمی‌شود.');
      streamSettings.finalmask = { udp: [{ type: 'salamander', settings: { password: q.obfsPassword } }] };
    }
    return { tag, protocol: 'hysteria', settings: { version: 2, address: config.host, port: config.port }, streamSettings };
  }
  let network = (q.type || 'tcp').toLowerCase();
  if (network === 'raw') network = 'tcp';
  if (!['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'].includes(network)) {
    throw new Error('این نوع انتقال در نسخهٔ فعلی Xray پشتیبانی نمی‌شود.');
  }
  const stream = { network, security: config.security };
  const serverName = q.sni || config.host;
  const fingerprint = q.fp || 'chrome';
  if (config.security === 'tls') {
    stream.tlsSettings = { serverName, allowInsecure: false, fingerprint };
  } else {
    stream.realitySettings = {
      serverName,
      fingerprint,
      publicKey: q.pbk,
      shortId: q.sid || '',
      spiderX: q.spx || '/',
    };
  }
  if (network === 'ws') {
    const headers = {};
    if (q.host) headers.Host = q.host;
    stream.wsSettings = { path: q.path || '/', headers };
  } else if (network === 'grpc') {
    stream.grpcSettings = {
      serviceName: q.serviceName || q.path || '',
      authority: q.authority || '',
    };
  } else if (network === 'httpupgrade') {
    stream.httpupgradeSettings = { path: q.path || '/', host: q.host || '' };
  } else if (network === 'xhttp') {
    stream.xhttpSettings = { path: q.path || '/', host: q.host || '', mode: q.mode || 'auto' };
  }
  if (q.alpn) stream[config.security === 'tls' ? 'tlsSettings' : 'realitySettings'].alpn = q.alpn.split(',');
  const user = { id: config.uuid, encryption: q.encryption || 'none' };
  if (q.flow) user.flow = q.flow;
  return {
    tag,
    protocol: 'vless',
    settings: { vnext: [{ address: config.host, port: config.port, users: [user] }] },
    streamSettings: stream,
  };
}

export function buildXrayConfig(config, socksPort) {
  const inboundTag = 'probe-in';
  const outboundTag = 'probe-out';
  return {
    log: { loglevel: 'none' },
    inbounds: [{
      tag: inboundTag,
      listen: '127.0.0.1',
      port: socksPort,
      protocol: 'socks',
      settings: { auth: 'noauth', udp: false },
    }],
    outbounds: [buildOutbound(config, outboundTag)],
    routing: { rules: [{ type: 'field', inboundTag: [inboundTag], outboundTag }] },
  };
}

export function buildXrayBatchConfig(configs, socksPorts) {
  if (configs.length !== socksPorts.length || !configs.length) throw new Error('Invalid Xray batch.');
  const inbounds = [];
  const outbounds = [];
  const rules = [];
  for (let index = 0; index < configs.length; index += 1) {
    const inboundTag = `probe-in-${index}`;
    const outboundTag = `probe-out-${index}`;
    inbounds.push({
      tag: inboundTag,
      listen: '127.0.0.1',
      port: socksPorts[index],
      protocol: 'socks',
      settings: { auth: 'noauth', udp: false },
    });
    outbounds.push(buildOutbound(configs[index], outboundTag));
    rules.push({ type: 'field', inboundTag: [inboundTag], outboundTag });
  }
  return { log: { loglevel: 'none' }, inbounds, outbounds, routing: { rules } };
}

export function toPanelOutbound(config, tag = config.name) {
  const q = config.params;
  if (config.protocol === 'shadowsocks') {
    return {
      tag: String(tag || config.host + ':' + config.port), protocol: 'shadowsocks',
      settings: { servers: [{ address: config.host, port: config.port, method: q.method, password: q.password }] },
    };
  }
  if (config.protocol === 'hysteria2') {
    const streamSettings = {
      network: 'hysteria', security: 'tls',
      tlsSettings: { serverName: q.sni || config.host, allowInsecure: Boolean(q.insecure) },
      hysteriaSettings: { version: 2, auth: q.auth, udpIdleTimeout: 60 },
    };
    if (q.obfs) {
      if (q.obfs !== 'salamander' || !q.obfsPassword) throw new Error('نوع یا رمز obfuscation این Hysteria2 پشتیبانی نمی‌شود.');
      streamSettings.finalmask = { udp: [{ type: 'salamander', settings: { password: q.obfsPassword } }] };
    }
    return { tag: String(tag || config.host + ':' + config.port), protocol: 'hysteria', settings: { version: 2, address: config.host, port: config.port }, streamSettings };
  }
  let network = (q.type || 'tcp').toLowerCase();
  if (network === 'raw') network = 'tcp';
  if (!['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'].includes(network)) {
    throw new Error('این نوع انتقال برای خروجی پنل پشتیبانی نمی‌شود.');
  }
  const outbound = {
    tag: String(tag || config.host + ':' + config.port),
    protocol: 'vless',
    settings: {
      address: config.host,
      port: config.port,
      id: config.uuid,
      flow: q.flow || '',
      encryption: q.encryption || 'none',
    },
    streamSettings: { network, security: config.security },
  };
  const serverName = q.sni || config.host;
  if (config.security === 'tls') {
    outbound.streamSettings.tlsSettings = {
      serverName,
      fingerprint: q.fp || 'chrome',
      allowInsecure: false,
    };
    if (q.alpn) outbound.streamSettings.tlsSettings.alpn = q.alpn.split(',');
  } else {
    outbound.streamSettings.realitySettings = {
      fingerprint: q.fp || 'chrome',
      serverName,
      publicKey: q.pbk,
      shortId: q.sid || '',
      spiderX: q.spx || '',
      mldsa65Verify: q.mldsa65Verify || '',
    };
    if (q.alpn) outbound.streamSettings.realitySettings.alpn = q.alpn.split(',');
  }
  if (network === 'tcp') {
    outbound.streamSettings.tcpSettings = { header: { type: q.headerType || 'none' } };
  } else if (network === 'ws') {
    outbound.streamSettings.wsSettings = { path: q.path || '/', headers: q.host ? { Host: q.host } : {} };
  } else if (network === 'grpc') {
    outbound.streamSettings.grpcSettings = {
      serviceName: q.serviceName || q.path || '',
      authority: q.authority || '',
      multiMode: (q.mode || '').toLowerCase() === 'multi',
    };
  } else if (network === 'httpupgrade') {
    outbound.streamSettings.httpupgradeSettings = { path: q.path || '/', host: q.host || '' };
  } else if (network === 'xhttp') {
    outbound.streamSettings.xhttpSettings = { path: q.path || '/', host: q.host || '', mode: q.mode || 'auto' };
  }
  return outbound;
}
