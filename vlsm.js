'use strict';

/* Onglet « Plan d'adressage » : découpage VLSM d'un bloc CIDR.
   Réutilise parseIp, parseMask, cidrToMask, compute et toIp définis dans app.js. */

/* ---------- Calcul ---------- */

// Plus long préfixe (= plus petit sous-réseau) offrant au moins `needed` adresses utilisables.
// Minimum /30 : un VLAN avec passerelle a besoin d'un réseau et d'un broadcast.
function prefixForHosts(needed) {
  for (let p = 30; p >= 0; p--) {
    if (2 ** (32 - p) - 2 >= needed) return p;
  }
  return null; // impossible même avec /0
}

// block : { network, cidr }  —  vlans : [{ name, hosts }]
// gatewayExtra : true si la passerelle s'ajoute au nombre d'hôtes demandé
function planVlsm(block, vlans, gatewayExtra) {
  const blockSize = 2 ** (32 - block.cidr);
  const blockEnd = block.network + blockSize; // exclu

  // Du plus gros besoin au plus petit (à égalité, on garde l'ordre de saisie)
  const sorted = vlans
    .map((v, i) => {
      const needed = v.hosts + (gatewayExtra ? 1 : 0);
      const prefix = prefixForHosts(needed);
      return { ...v, order: i, needed, prefix, size: prefix === null ? Infinity : 2 ** (32 - prefix) };
    })
    .sort((a, b) => b.size - a.size || b.hosts - a.hosts || a.order - b.order);

  // Allocation séquentielle. Comme les tailles sont des puissances de 2 décroissantes,
  // chaque sous-réseau tombe automatiquement sur une frontière alignée.
  let next = block.network;
  const placed = [], rejected = [];
  for (const v of sorted) {
    if (v.prefix === null || v.prefix < block.cidr || next + v.size > blockEnd) {
      rejected.push(v);
      continue;
    }
    const r = compute(next, v.prefix);
    // compute() renvoie aussi un champ `hosts` (adresses utilisables) : on le renomme
    // en `usable` pour ne pas écraser le nombre d'hôtes demandé.
    const { hosts: usable, ...net } = r;
    placed.push({ ...v, ...net, gateway: r.first, usable });
    next += v.size;
  }

  const required = sorted.reduce((s, v) => s + v.size, 0);
  return { placed, rejected, blockSize, used: next - block.network, required, freeFrom: next, blockEnd };
}

/* ---------- Interface ---------- */

const blockIn = $('block'), vlanBox = $('vlans'), gwExtra = $('gw-extra');
const planErr = $('plan-error'), planRes = $('plan-results');
const planWarn = $('plan-warning'), planSummary = $('plan-summary'), planList = $('plan-list');
const rowTpl = $('vlan-row');
const fmt = (n) => n.toLocaleString('fr-FR');

function addVlanRow(name = '', hosts = '') {
  const row = rowTpl.content.firstElementChild.cloneNode(true);
  row.querySelector('.vlan-name').value = name;
  row.querySelector('.vlan-hosts').value = hosts;
  row.querySelector('.vlan-del').addEventListener('click', () => { row.remove(); updatePlan(); });
  vlanBox.appendChild(row);
  return row;
}

function readVlans() {
  const list = [], errors = [];
  vlanBox.querySelectorAll('.vlan-row').forEach((row, i) => {
    const nameIn = row.querySelector('.vlan-name'), hostsIn = row.querySelector('.vlan-hosts');
    const name = nameIn.value.trim(), h = hostsIn.value.trim();
    hostsIn.removeAttribute('aria-invalid');
    if (!name && !h) return; // ligne vide : ignorée
    if (!/^\d+$/.test(h) || Number(h) < 1) {
      hostsIn.setAttribute('aria-invalid', 'true');
      errors.push(`« ${name || 'VLAN ' + (i + 1)} » : nombre d'hôtes invalide.`);
      return;
    }
    list.push({ name: name || `VLAN ${i + 1}`, hosts: Number(h) });
  });
  return { list, errors };
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function row(label, value, hl) {
  const d = el('div', hl ? 'row hl' : 'row');
  d.append(el('span', '', label), el('output', '', value));
  return d;
}

function planError(msg) {
  planErr.textContent = msg;
  planErr.hidden = false;
  planRes.hidden = true;
}

function updatePlan() {
  planErr.hidden = true;
  blockIn.removeAttribute('aria-invalid');
  savePlan();

  const blockStr = blockIn.value.trim();
  const { list, errors } = readVlans();
  if (!blockStr) { planRes.hidden = true; return; }

  // Bloc : "a.b.c.d/nn" (le masque décimal est aussi accepté après le /)
  const [ipPart, maskPart] = blockStr.split('/');
  const ip = parseIp(ipPart || '');
  const cidr = maskPart === undefined ? null : parseMask(maskPart);
  if (ip === null || cidr === null) {
    blockIn.setAttribute('aria-invalid', 'true');
    return planError('Bloc invalide : saisir une adresse au format CIDR (ex. 10.0.0.0/22).');
  }
  if (errors.length) return planError(errors.join(' '));
  if (!list.length) { planRes.hidden = true; return; }

  const network = (ip & cidrToMask(cidr)) >>> 0;
  const p = planVlsm({ network, cidr }, list, gwExtra.checked);

  // Avertissements
  const warn = [];
  if (network !== ip) warn.push(`Adresse ajustée sur le réseau ${toIp(network)}/${cidr} (bits d'hôte non nuls).`);
  if (p.rejected.length) {
    warn.push(`Bloc trop petit : il faut ${fmt(p.required)} adresses, le /${cidr} n'en contient que ${fmt(p.blockSize)}. ` +
      `Non placé${p.rejected.length > 1 ? 's' : ''} : ${p.rejected.map((v) => v.name).join(', ')}.`);
  }
  planWarn.textContent = warn.join(' ');
  planWarn.hidden = !warn.length;
  planWarn.classList.toggle('danger', p.rejected.length > 0);

  // Résumé
  planSummary.replaceChildren(
    row('Bloc', `${toIp(network)}/${cidr}`, true),
    row('Adresses utilisées', `${fmt(p.used)} / ${fmt(p.blockSize)} (${Math.round(p.used / p.blockSize * 100)} %)`),
    row('Espace libre', p.freeFrom < p.blockEnd ? `à partir de ${toIp(p.freeFrom)}` : 'aucun')
  );

  // Une carte par VLAN, dans l'ordre d'allocation
  planList.replaceChildren(...p.placed.map((v) => {
    const card = el('article', 'results vlan-card');
    const h = el('h2', '', v.name);
    h.append(el('small', '', ` ${fmt(v.hosts)} hôte${v.hosts > 1 ? 's' : ''} demandé${v.hosts > 1 ? 's' : ''}`));
    card.append(
      h,
      row('Réseau', `${toIp(v.network)}/${v.prefix}`, true),
      row('Masque', toIp(v.mask)),
      row('Passerelle', toIp(v.gateway), true),
      row('Plage utilisable', `${toIp(v.first)} – ${toIp(v.last)}`),
      row('Broadcast', toIp(v.broadcast)),
      row('Adresses utilisables', `${fmt(v.usable)} (libres : ${fmt(v.usable - v.needed)})`)
    );
    return card;
  }));

  planRes.hidden = false;
}

/* Mémorise la saisie localement (confort uniquement, l'appli marche sans) */
function savePlan() {
  try {
    const vlans = [...vlanBox.querySelectorAll('.vlan-row')].map((r) =>
      [r.querySelector('.vlan-name').value, r.querySelector('.vlan-hosts').value]);
    localStorage.setItem('plan', JSON.stringify({ block: blockIn.value, vlans, gw: gwExtra.checked }));
  } catch (e) { /* stockage indisponible */ }
}

function loadPlan() {
  try {
    const s = JSON.parse(localStorage.getItem('plan'));
    if (s && Array.isArray(s.vlans)) {
      blockIn.value = s.block || '';
      gwExtra.checked = s.gw !== false;
      s.vlans.forEach(([n, h]) => addVlanRow(n, h));
      return s.vlans.length > 0;
    }
  } catch (e) { /* rien de sauvegardé */ }
  return false;
}

if (!loadPlan()) { addVlanRow(); addVlanRow(); addVlanRow(); }

$('add-vlan').addEventListener('click', () => {
  addVlanRow().querySelector('.vlan-name').focus();
  updatePlan();
});
$('plan-form').addEventListener('input', updatePlan);
$('plan-form').addEventListener('submit', (e) => e.preventDefault());
updatePlan();

/* ---------- Onglets ---------- */

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab, focus) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tab.focus();
  try { localStorage.setItem('tab', tab.id); } catch (e) { /* ignoré */ }
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
  });
});

try {
  const saved = $(localStorage.getItem('tab') || '');
  if (saved && tabs.includes(saved)) selectTab(saved);
} catch (e) { /* ignoré */ }

window.subnet.planVlsm = planVlsm;
window.subnet.prefixForHosts = prefixForHosts;
