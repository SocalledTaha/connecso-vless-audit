import test from 'node:test';
import assert from 'node:assert/strict';
import { buildXrayConfig, isPublicAddress, parseSubscription, toPanelOutbound } from './vless.mjs';

const uuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

test('subscription parser keeps unique VLESS entries only when TLS or Reality is configured', () => {
  const input = [
    `vless://${uuid}@example.net:443?security=tls&type=ws&path=%2Flesson&sni=example.net#TLS`,
    `vless://${uuid}@example.net:443?security=tls&type=ws&path=%2Flesson&sni=example.net#TLS`,
    `vless://${uuid}@example.net:80?security=none&type=tcp#Plain`,
    `vless://${uuid}@example.org:443?security=reality&pbk=publickey&sid=ab12&type=tcp#Reality`,
  ].join('\n');
  const parsed = parseSubscription(input);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map((item) => item.security), ['tls', 'reality']);
  assert.equal(parsed[0].params.path, '/lesson');
});

test('parser accepts base64 subscription text', () => {
  const uri = `vless://${uuid}@example.net:443?security=tls#TLS`;
  assert.equal(parseSubscription(Buffer.from(uri).toString('base64')).length, 1);
});

test('Xray config preserves WS TLS and Reality transport settings', () => {
  const [ws] = parseSubscription(`vless://${uuid}@example.net:443?security=tls&type=ws&path=%2Fcourse&host=cdn.example.net&sni=example.net#WS`);
  const wsConfig = buildXrayConfig(ws, 15001);
  assert.equal(wsConfig.outbounds[0].streamSettings.wsSettings.path, '/course');
  assert.equal(wsConfig.outbounds[0].streamSettings.wsSettings.headers.Host, 'cdn.example.net');
  assert.equal(wsConfig.outbounds[0].streamSettings.tlsSettings.serverName, 'example.net');
  const [reality] = parseSubscription(`vless://${uuid}@example.net:443?security=reality&pbk=pub&sid=ab12&type=xhttp&path=%2Fx&sni=target.example#Reality`);
  const realityConfig = buildXrayConfig(reality, 15002);
  assert.equal(realityConfig.outbounds[0].streamSettings.realitySettings.publicKey, 'pub');
  assert.equal(realityConfig.outbounds[0].streamSettings.xhttpSettings.path, '/x');
});

test('Panel export is a single VLESS outbound with preserved Reality fields', () => {
  const uri = `vless://${uuid}@edge.example.net:443?security=reality&pbk=pk123&sid=abcd&spx=%2Flearn&type=ws&path=%2Fcourse&host=cdn.example.net&sni=www.example.net&fp=chrome&flow=xtls-rprx-vision#UK%20one`;
  const [config] = parseSubscription(uri);
  const outbound = toPanelOutbound(config);
  assert.equal(outbound.tag, 'UK one');
  assert.equal(outbound.protocol, 'vless');
  assert.equal(outbound.settings.vnext[0].address, 'edge.example.net');
  assert.equal(outbound.settings.vnext[0].users[0].id, uuid);
  assert.equal(outbound.streamSettings.security, 'reality');
  assert.equal(outbound.streamSettings.realitySettings.publicKey, 'pk123');
  assert.equal(outbound.streamSettings.wsSettings.path, '/course');
  assert.equal(outbound.streamSettings.wsSettings.headers.Host, 'cdn.example.net');
  assert.equal(outbound.protocol === 'freedom' || outbound.protocol === 'blackhole', false);
  const xhttpUri = `vless://${uuid}@edge.example.net:443?security=tls&type=xhttp&path=%2Fclass&host=origin.example.net&mode=packet-up&sni=edge.example.net#XHTTP`;
  const [xhttpConfig] = parseSubscription(xhttpUri);
  const xhttp = toPanelOutbound(xhttpConfig);
  assert.equal(xhttp.streamSettings.network, 'xhttp');
  assert.equal(xhttp.streamSettings.xhttpSettings.path, '/class');
  assert.equal(xhttp.streamSettings.xhttpSettings.host, 'origin.example.net');
  assert.equal(xhttp.streamSettings.xhttpSettings.mode, 'packet-up');
});

test('public address filter rejects local and reserved IPv4/IPv6 values', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.2', '169.254.2.3', '224.0.0.1', '::1', 'fc00::1', 'fe80::1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});
