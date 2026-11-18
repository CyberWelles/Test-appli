'use strict';

/* ---------- Conversions ---------- */

// "192.168.1.10" -> entier non signé 32 bits, ou null si invalide
function parseIp(str) {
  const parts = str.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

// entier 32 bits -> "a.b.c.d"
function toIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

// préfixe (0..32) -> masque en entier
function cidrToMask(cidr) {
  return cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
}

// Accepte "24", "/24" ou "255.255.255.0" -> préfixe (0..32), ou null
function parseMask(str) {
  const s = str.trim().replace(/^\//, '');
  if (/^\d{1,2}$/.test(s)) {
    const c = Number(s);
    return c <= 32 ? c : null;
  }
  const m = parseIp(s);
  if (m === null) return null;
  // Un masque valide = des 1 contigus puis des 0 : l'inverse +1 est une puissance de 2
  const inv = (~m) >>> 0;
  if ((inv & (inv + 1)) !== 0) return null;
  let cidr = 0;
  for (let b = 31; b >= 0 && ((m >>> b) & 1); b--) cidr++;
  return cidr;
}

/* ---------- Calcul ---------- */

function compute(ip, cidr) {
  const mask = cidrToMask(cidr);
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = 2 ** (32 - cidr);

  let first, last, hosts, note = '';
  if (cidr === 32) {
    first = last = network; hosts = 1;
    note = '/32 : adresse d’hôte unique.';
  } else if (cidr === 31) {
    first = network; last = broadcast; hosts = 2;
    note = '/31 : lien point-à-point (RFC 3021), les 2 adresses sont utilisables.';
  } else {
    first = network + 1; last = broadcast - 1; hosts = total - 2;
  }
  return { mask, wildcard, network, broadcast, first, last, hosts, note };
}

/* ---------- Interface ---------- */

const $ = (id) => document.getElementById(id);
const ipIn = $('ip'), maskIn = $('mask'), err = $('error'), res = $('results');

function showError(msg, field) {
  err.textContent = msg;
  err.hidden = false;
  res.hidden = true;
  ipIn.setAttribute('aria-invalid', field === 'ip');
  maskIn.setAttribute('aria-invalid', field === 'mask');
}

function update() {
  let ipStr = ipIn.value, maskStr = maskIn.value;

  // Permet de taper directement "192.168.1.10/24" dans le champ IP
  if (ipStr.includes('/')) {
    const [a, b] = ipStr.split('/');
    ipStr = a;
    if (!maskStr.trim()) maskStr = b;
  }

  err.hidden = true;
  ipIn.removeAttribute('aria-invalid');
  maskIn.removeAttribute('aria-invalid');

  if (!ipStr.trim() || !maskStr.trim()) { res.hidden = true; return; }

  const ip = parseIp(ipStr);
  if (ip === null) return showError('Adresse IP invalide (ex. 192.168.1.10).', 'ip');
  const cidr = parseMask(maskStr);
  if (cidr === null) return showError('Masque invalide (ex. 24 ou 255.255.255.0).', 'mask');

  const r = compute(ip, cidr);
  $('r-mask').textContent = `${toIp(r.mask)} (/${cidr})`;
  $('r-wildcard').textContent = toIp(r.wildcard);
  $('r-network').textContent = `${toIp(r.network)}/${cidr}`;
  $('r-broadcast').textContent = cidr >= 31 ? '—' : toIp(r.broadcast);
  $('r-first').textContent = toIp(r.first);
  $('r-last').textContent = toIp(r.last);
  $('r-hosts').textContent = r.hosts.toLocaleString('fr-FR');
  $('note').textContent = r.note;
  $('note').hidden = !r.note;
  res.hidden = false;
}

ipIn.addEventListener('input', update);
maskIn.addEventListener('input', update);
document.querySelectorAll('.presets button').forEach((btn) =>
  btn.addEventListener('click', () => { maskIn.value = btn.dataset.cidr; update(); })
);
$('form').addEventListener('submit', (e) => e.preventDefault());

/* ---------- Service worker (mode hors-ligne + installation) ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

// Exposé pour les tests éventuels
window.subnet = { parseIp, parseMask, compute, toIp, cidrToMask };
