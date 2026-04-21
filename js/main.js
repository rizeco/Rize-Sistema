
/* =============================================================
   RIZE™ SISTEMA — js/main.js
   Dashboard · Pedidos · Estoque · Financeiro · Recibos
   =============================================================

   CONFIGURE AS VARIÁVEIS ABAIXO:
   ============================================================= */

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, setDoc,
         deleteDoc, updateDoc, onSnapshot, query, orderBy, where,
         increment, serverTimestamp, writeBatch }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* -----------------------------------------------------------------
   🔧 CREDENCIAIS FIREBASE — mesmas da landing page
   ----------------------------------------------------------------- */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCy0dxrlthuRpidkv2XEZTlD8fx0RZXiF8",
  authDomain: "system-rize.firebaseapp.com",
  projectId: "system-rize",
  storageBucket: "system-rize.firebasestorage.app",
  messagingSenderId: "1021973532313",
  appId: "1:1021973532313:web:884a246199999f659e3208",
  measurementId: "G-E48TEMD2XM"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

/* -----------------------------------------------------------------
   🔧 UIDs DOS ADMINS (copie do Firebase Auth depois de criar as contas)
   Firebase Console → Authentication → Users → copie a coluna "User UID"
   ----------------------------------------------------------------- */
const ADMIN_UIDS = [
  "lt7G8hhGlYeCGNTkuMSxQrhKPdJ2",
  "3GDrg2qVGVeg8CU9d5ioFSAMhbc2",
];

/* =============================================================
   INICIALIZAÇÃO
   ============================================================= */
const fbApp = initializeApp(FIREBASE_CONFIG);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

/* Estado */
let _user     = null;
let _produtos = [];
let _pedidos  = [];
let _txs      = [];
let _marcas   = [];
let _recibos  = [];
let _unsubProdutos = null;
let _unsubPedidos  = null;
let editandoRecibId = null;
let logoData = '';

/* Utils */
const $ = id => document.getElementById(id);
const fmt = n  => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Date().toISOString().slice(0, 10);
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function fmtData(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}
function toast(msg, tipo = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className   = `toast show${tipo ? ' ' + tipo : ''}`;
  setTimeout(() => { t.className = 'toast hidden'; }, 3200);
}
function loading(v) { $('loading').classList.toggle('hidden', !v); }

/* =============================================================
   BOOT
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  iniciarAuth();
  iniciarNav();
  iniciarModal();
});

/* =============================================================
   AUTH
   ============================================================= */
function iniciarAuth() {
  $('btn-entrar').addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const senha = $('login-senha').value;
    const errEl = $('auth-erro');
    errEl.classList.add('hidden');
    $('btn-entrar').textContent = 'Entrando...';
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch {
      errEl.textContent = 'E-mail ou senha inválidos.';
      errEl.classList.remove('hidden');
    } finally {
      $('btn-entrar').textContent = 'Entrar';
    }
  });
  $('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-entrar').click(); });
  $('btn-sair').addEventListener('click', async () => {
    if (_unsubProdutos) _unsubProdutos();
    if (_unsubPedidos)  _unsubPedidos();
    await signOut(auth);
  });

  onAuthStateChanged(auth, async user => {
    if (user && ADMIN_UIDS.includes(user.uid)) {
      _user = user;
      $('tela-login').style.display  = 'none';
      $('tela-app').classList.remove('hidden');
      $('user-avatar').textContent  = (user.displayName || user.email || 'A')[0].toUpperCase();
      $('user-email').textContent   = user.email;
      loading(true);
      await carregarTudo();
      iniciarRealtime();
      loading(false);
      irPara('dashboard');
    } else if (user) {
      await signOut(auth);
      mostrarErroAuth('Acesso negado. Você não é administrador.');
    } else {
      $('tela-login').style.display  = 'flex';
      $('tela-app').classList.add('hidden');
    }
  });
}

function mostrarErroAuth(msg) {
  const el = $('auth-erro');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function carregarTudo() {
  const [p, pe, t, m, r] = await Promise.all([
    getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'orders'),   orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc'))),
    getDocs(collection(db, 'users', _user.uid, 'brands')),
    getDocs(query(collection(db, 'users', _user.uid, 'receipts'), orderBy('createdAt', 'desc'))),
  ]);
  _produtos = p.docs.map(d  => ({ id: d.id, ...d.data() }));
  _pedidos  = pe.docs.map(d => ({ id: d.id, ...d.data() }));
  _txs      = t.docs.map(d  => ({ id: d.id, ...d.data() }));
  _marcas   = m.docs.map(d  => ({ id: d.id, ...d.data() }));
  _recibos  = r.docs.map(d  => ({ id: d.id, ...d.data() }));
}

function iniciarRealtime() {
  _unsubProdutos = onSnapshot(
    query(collection(db, 'products'), orderBy('createdAt', 'desc')),
    snap => {
      _produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderGridEstoque();
      renderDashboard();
    }
  );
  _unsubPedidos = onSnapshot(
    query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
    snap => {
      _pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pendentes = _pedidos.filter(p => p.status === 'pending').length;
      $('badge-pendentes').textContent = pendentes > 0 ? pendentes : '';
      renderTabelaPedidos();
      renderDashboard();
    }
  );
}

/* =============================================================
   NAVEGAÇÃO
   ============================================================= */
function iniciarNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => irPara(btn.dataset.view));
  });
  document.querySelectorAll('[data-view]:not(.nav-btn)').forEach(el => {
    el.addEventListener('click', () => irPara(el.dataset.view));
  });
}

function irPara(nome) {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('ativo', b.dataset.view === nome));
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('ativo', v.id === `view-${nome}`));
  const titulos = { dashboard: 'Dashboard', pedidos: 'Pedidos', estoque: 'Estoque', financeiro: 'Financeiro', recibos: 'Recibos' };
  $('topbar-titulo').textContent = titulos[nome] || nome;
  $('topbar-acoes').innerHTML = '';

  if (nome === 'dashboard')  renderDashboard();
  if (nome === 'pedidos')    { renderTabelaPedidos(); iniciarFiltroPedidos(); }
  if (nome === 'estoque')    { renderGridEstoque(); iniciarAcoesEstoque(); }
  if (nome === 'financeiro') { renderFinanceiro(); iniciarAcoesFinanceiro(); }
  if (nome === 'recibos')    { renderSecaoRecibos(); iniciarFormRecibo(); }
}

/* =============================================================
   MODAL
   ============================================================= */
function iniciarModal() {
  $('modal-fechar').addEventListener('click', fecharModal);
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) fecharModal(); });
}
function abrirModal(html) { $('modal-conteudo').innerHTML = html; $('modal').classList.remove('hidden'); }
function fecharModal()    { $('modal').classList.add('hidden'); }

/* =============================================================
   DASHBOARD
   ============================================================= */
function renderDashboard() {
  const hj = hoje();
  const mesAtual = hj.slice(0, 7);

  const pedidosHoje = _pedidos.filter(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    return d.toISOString().slice(0, 10) === hj;
  }).length;

  const receitaMes = _pedidos
    .filter(p => p.status !== 'cancelled')
    .filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      return d.toISOString().slice(0, 7) === mesAtual;
    })
    .reduce((s, p) => s + (p.total || 0), 0);

  const pendentes = _pedidos.filter(p => p.status === 'pending').length;
  const totalEstoque = _produtos.reduce((s, p) =>
    s + Object.values(p.sizes || {}).reduce((a, b) => a + (Number(b) || 0), 0), 0);

  $('stat-hoje').textContent     = pedidosHoje;
  $('stat-receita').textContent  = fmt(receitaMes);
  $('stat-pendentes').textContent = pendentes;
  $('stat-estoque').textContent  = totalEstoque;

  // Tabela recente
  const recentes = _pedidos.slice(0, 5);
  $('dash-pedidos').innerHTML = recentes.length ? `
    <table>
      <thead><tr><th>Cliente</th><th>Produto(s)</th><th>Total</th><th>Status</th><th>Data</th></tr></thead>
      <tbody>${recentes.map(p => `
        <tr>
          <td><strong>${p.customerName || ''}</strong><br><small style="color:var(--cinza5)">${p.customerPhone || ''}</small></td>
          <td style="font-size:12px">${(p.items || []).map(i => `${i.productName} · ${i.size}`).join('<br>')}</td>
          <td style="font-family:var(--mono);font-weight:700">${fmt(p.total || 0)}</td>
          <td>${badge(p.status)}</td>
          <td style="color:var(--cinza3)">${fmtData(p.createdAt)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="tabela-vazia">Nenhum pedido ainda.</p>';

  setTimeout(() => { renderGraficoEstoque(); renderGraficoReceita(); }, 120);
}

function renderGraficoEstoque() {
  const el = $('grafico-estoque');
  if (!el) return;
  if (window._gEstoque) window._gEstoque.destroy();
  window._gEstoque = new Chart(el, {
    type: 'bar',
    data: {
      labels: _produtos.map(p => `${p.name || ''} ${p.color || ''}`),
      datasets: [{ data: _produtos.map(p => Object.values(p.sizes || {}).reduce((a, b) => a + (Number(b) || 0), 0)), backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#555' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#555' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
}

function renderGraficoReceita() {
  const el = $('grafico-receita');
  if (!el) return;
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const data = dias.map(dia =>
    _pedidos.filter(p => p.status !== 'cancelled')
      .filter(p => { const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0); return d.toISOString().slice(0, 10) === dia; })
      .reduce((s, p) => s + (p.total || 0), 0)
  );
  if (window._gReceita) window._gReceita.destroy();
  window._gReceita = new Chart(el, {
    type: 'line',
    data: { labels: dias.map(d => d.slice(5)), datasets: [{ data, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.05)', tension: 0.4, fill: true, pointRadius: 3 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#555' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#555', callback: v => 'R$' + v }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
}

/* =============================================================
   PEDIDOS
   ============================================================= */
function iniciarFiltroPedidos() {
  $('busca-pedidos')?.addEventListener('input', renderTabelaPedidos);
  $('filtro-status')?.addEventListener('change', renderTabelaPedidos);
}

function renderTabelaPedidos() {
  const busca  = ($('busca-pedidos')?.value || '').toLowerCase();
  const status = $('filtro-status')?.value || '';
  let lista = [..._pedidos];
  if (busca)  lista = lista.filter(p => (p.customerName + p.customerPhone + '').toLowerCase().includes(busca));
  if (status) lista = lista.filter(p => p.status === status);

  $('tabela-pedidos').innerHTML = lista.length ? `
    <table>
      <thead><tr><th>#</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Frete</th><th>Status</th><th>Data</th><th></th></tr></thead>
      <tbody>${lista.map((p, i) => `
        <tr>
          <td style="font-family:var(--mono);color:var(--cinza3)">${String(i + 1).padStart(3, '0')}</td>
          <td><strong>${p.customerName || ''}</strong><br><small style="color:var(--cinza5)">${p.customerPhone || ''}</small></td>
          <td style="font-size:12px">${(p.items || []).map(it => `${it.productName} · <b>${it.size}</b> · ${it.qty}un`).join('<br>')}</td>
          <td style="font-family:var(--mono);font-weight:700">${fmt(p.total || 0)}</td>
          <td style="font-family:var(--mono)">${fmt(p.shipping || 0)}</td>
          <td>${badge(p.status)}</td>
          <td style="color:var(--cinza3)">${fmtData(p.createdAt)}</td>
          <td><button class="btn btn-ghost sm" onclick="verPedido('${p.id}')">Ver</button></td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="tabela-vazia">Nenhum pedido encontrado.</p>';
}

window.verPedido = function(id) {
  const p   = _pedidos.find(x => x.id === id);
  if (!p) return;
  const addr = p.address || {};
  const end  = [addr.rua, addr.numero, addr.complemento, addr.bairro, addr.cidade, addr.uf, addr.cep].filter(Boolean).join(', ');
  abrirModal(`
    <div class="modal-titulo">Detalhes do Pedido</div>
    <div class="pedido-detalhe">
      <div class="pedido-sec"><label>Cliente</label>
        <p><strong>${p.customerName || ''}</strong> · ${p.customerPhone || ''}</p>
        ${p.customerEmail ? `<p>${p.customerEmail}</p>` : ''}
        ${p.cpf ? `<p>CPF: ${p.cpf}</p>` : ''}
      </div>
      <div class="pedido-sec"><label>Endereço</label><p>${end || 'Não informado'}</p></div>
      <div class="pedido-sec"><label>Itens</label>
        <div class="pedido-itens">
          ${(p.items || []).map(it => `
            <div class="pedido-item-row">
              <span>${it.productName} · Tam: <strong>${it.size}</strong> · Qtd: ${it.qty}</span>
              <span style="font-family:var(--mono);font-weight:700">${fmt(it.price * it.qty)}</span>
            </div>`).join('')}
          <div class="pedido-item-row" style="justify-content:flex-end;gap:16px">
            <span style="color:var(--cinza3)">Frete: ${fmt(p.shipping || 0)}</span>
            <strong>Total: ${fmt(p.total || 0)}</strong>
          </div>
        </div>
      </div>
      ${p.notes ? `<div class="pedido-sec"><label>Observações</label><p>${p.notes}</p></div>` : ''}
      <div class="pedido-sec"><label>Status</label>
        <div class="status-row">
          <select id="modal-status" class="select-chip">
            ${['pending','confirmed','shipped','delivered','cancelled'].map(s =>
              `<option value="${s}" ${p.status === s ? 'selected' : ''}>${labelStatus(s)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="salvarStatus('${id}')">Salvar</button>
          <button class="btn btn-perigo" onclick="excluirPedido('${id}')">Excluir</button>
        </div>
      </div>
    </div>`);
};

window.salvarStatus = async function(id) {
  const status = $('modal-status').value;
  await updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() });
  if (status === 'confirmed') {
    const p = _pedidos.find(x => x.id === id);
    if (p) {
      await addDoc(collection(db, 'transactions'), {
        type: 'income', amount: p.total || 0,
        category: 'Venda', description: `Pedido de ${p.customerName}`,
        date: hoje(), orderId: id, createdAt: serverTimestamp(),
      });
      _txs = (await getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }
  fecharModal();
  toast('Status atualizado!', 'sucesso');
};

window.excluirPedido = async function(id) {
  if (!confirm('Excluir pedido?')) return;
  await deleteDoc(doc(db, 'orders', id));
  fecharModal();
  toast('Pedido excluído.');
};

/* =============================================================
   ESTOQUE
   ============================================================= */
function iniciarAcoesEstoque() {
  $('btn-novo-produto')?.addEventListener('click', () => modalProduto(null));
}

function renderGridEstoque() {
  const el = $('grid-estoque');
  if (!el) return;
  el.innerHTML = _produtos.length ? _produtos.map(p => {
    const chips = ['P','M','G','GG'].map(s => {
      const q   = Number(p.sizes?.[s]) || 0;
      const cls = q === 0 ? 'zero' : q <= 3 ? 'baixo' : '';
      return `<div class="tam-chip ${cls}"><span class="tam-chip-label">${s}</span><span class="tam-chip-valor">${q}</span></div>`;
    }).join('');
    return `
      <div class="estoque-card">
        <div class="estoque-card-topo">
          <div>
            <div class="estoque-nome">${p.name || ''}</div>
            <div class="estoque-cor">${p.color || ''}</div>
          </div>
          <div class="estoque-preco">${fmt(p.price || 0)}</div>
        </div>
        <div class="tamanhos-grid">${chips}</div>
        <div class="estoque-acoes">
          <button class="btn btn-ghost sm" onclick="modalProduto('${p.id}')">Editar</button>
          <button class="btn btn-perigo sm" onclick="excluirProduto('${p.id}')">Excluir</button>
        </div>
      </div>`;
  }).join('') : '<p style="color:var(--cinza5);grid-column:1/-1;padding:40px;text-align:center">Nenhum produto cadastrado.</p>';
}

window.modalProduto = function(id) {
  const p = id ? _produtos.find(x => x.id === id) : null;
  const sz = p?.sizes || { P: 0, M: 0, G: 0, GG: 0 };
  abrirModal(`
    <div class="modal-titulo">${p ? 'Editar Produto' : 'Novo Produto'}</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><label>Nome</label><input id="p-nome" value="${p?.name || ''}" placeholder="The Eyes Tee"/></div>
      <div class="field"><label>Cor</label><input id="p-cor" value="${p?.color || ''}" placeholder="Preto"/></div>
      <div class="field"><label>Preço (R$)</label><input id="p-preco" type="number" value="${p?.price || 179.90}" step="0.01"/></div>
      <div style="font-family:var(--dm);font-size:10px;color:var(--cinza5);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px">Estoque por tamanho</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${['P','M','G','GG'].map(s => `<div class="field"><label>${s}</label><input id="p-${s}" type="number" value="${sz[s] || 0}" min="0"/></div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" onclick="salvarProduto('${p?.id || ''}')">Salvar</button>
        <button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button>
      </div>
    </div>`);
};

window.salvarProduto = async function(existingId) {
  const produto = {
    id: existingId || genId(),
    name:  $('p-nome').value.trim(),
    color: $('p-cor').value.trim(),
    price: parseFloat($('p-preco').value) || 0,
    sizes: { P: +$('p-P').value, M: +$('p-M').value, G: +$('p-G').value, GG: +$('p-GG').value },
    active: true,
  };
  if (!produto.name) { toast('Informe o nome do produto.', 'erro'); return; }
  try {
    if (existingId) {
      await setDoc(doc(db, 'products', existingId), { ...produto, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await setDoc(doc(db, 'products', produto.id), { ...produto, createdAt: serverTimestamp() });
    }
    fecharModal();
    toast('Produto salvo!', 'sucesso');
  } catch(e) {
    console.error('ERRO ao salvar produto:', e);
    toast('Erro ao salvar: ' + e.message, 'erro');
  }
};

window.excluirProduto = async function(id) {
  if (!confirm('Excluir produto? Ação irreversível.')) return;
  await deleteDoc(doc(db, 'products', id));
  toast('Produto excluído.');
};

/* =============================================================
   FINANCEIRO
   ============================================================= */
function iniciarAcoesFinanceiro() {
  $('btn-nova-tx')?.addEventListener('click', modalTransacao);
  $('filtro-tx')?.addEventListener('change', renderFinanceiro);
}

function renderFinanceiro() {
  const filtro = $('filtro-tx')?.value || '';
  const lista  = filtro ? _txs.filter(t => t.type === filtro) : _txs;

  const entradas = _txs.filter(t => t.type === 'income').reduce((s, t)  => s + (t.amount || 0), 0);
  const saidas   = _txs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const saldo    = entradas - saidas;

  $('fin-resumo').innerHTML = `
    <div class="fin-card entrada"><div class="fin-card-rotulo">Entradas</div><div class="fin-card-valor">${fmt(entradas)}</div></div>
    <div class="fin-card saida"><div class="fin-card-rotulo">Saídas</div><div class="fin-card-valor">${fmt(saidas)}</div></div>
    <div class="fin-card ${saldo >= 0 ? 'entrada' : 'saida'}"><div class="fin-card-rotulo">Saldo</div><div class="fin-card-valor">${fmt(saldo)}</div></div>`;

  $('tabela-fin').innerHTML = lista.length ? `
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
      <tbody>${lista.map(t => `
        <tr>
          <td style="font-family:var(--mono);color:var(--cinza3)">${t.date || ''}</td>
          <td>${badge(t.type)}</td>
          <td style="color:var(--cinza3)">${t.category || ''}</td>
          <td>${t.description || ''}</td>
          <td style="font-family:var(--mono);font-weight:700;color:${t.type === 'income' ? 'var(--verde)' : 'var(--vermelho)'}">
            ${t.type === 'income' ? '+' : '-'}${fmt(t.amount || 0)}
          </td>
          <td><button class="btn-icon" onclick="excluirTx('${t.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button></td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="tabela-vazia">Nenhuma transação.</p>';
}

function modalTransacao() {
  abrirModal(`
    <div class="modal-titulo">Nova Transação</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><label>Tipo</label>
        <select id="tx-tipo" class="sel-full">
          <option value="income">Entrada</option>
          <option value="expense">Saída</option>
        </select>
      </div>
      <div class="field"><label>Categoria</label><input id="tx-cat" placeholder="Venda, Frete, Estamparia..."/></div>
      <div class="field"><label>Descrição</label><input id="tx-desc" placeholder="Detalhe..."/></div>
      <div class="field"><label>Valor (R$)</label><input id="tx-valor" type="number" step="0.01" min="0" placeholder="0,00"/></div>
      <div class="field"><label>Data</label><input id="tx-data" type="date" value="${hoje()}"/></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" onclick="salvarTx()">Salvar</button>
        <button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button>
      </div>
    </div>`);
}

window.salvarTx = async function() {
  const tx = {
    type:        $('tx-tipo').value,
    category:    $('tx-cat').value.trim(),
    description: $('tx-desc').value.trim(),
    amount:      parseFloat($('tx-valor').value) || 0,
    date:        $('tx-data').value,
  };
  if (!tx.amount) { toast('Informe o valor.', 'erro'); return; }
  await addDoc(collection(db, 'transactions'), { ...tx, createdAt: serverTimestamp() });
  _txs = (await getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() }));
  fecharModal(); renderFinanceiro();
  toast('Lançamento salvo!', 'sucesso');
};

window.excluirTx = async function(id) {
  if (!confirm('Excluir lançamento?')) return;
  await deleteDoc(doc(db, 'transactions', id));
  _txs = _txs.filter(t => t.id !== id);
  renderFinanceiro();
  toast('Excluído.');
};

/* =============================================================
   RECIBOS
   ============================================================= */
function renderSecaoRecibos() {
  atualizarSelectMarcas();
  renderTabelaRecibos();
  $('f-data').value = hoje();
  proximoNumeroRecibo();
  renderPreviewRecibo();
}

function iniciarFormRecibo() {
  if ($('btn-salvar-recibo').__ok) return;
  $('btn-salvar-recibo').__ok = true;

  $('btn-add-item').addEventListener('click', addItemRecibo);
  $('btn-salvar-recibo').addEventListener('click', salvarRecibo);
  $('btn-limpar-recibo').addEventListener('click', limparFormRecibo);
  $('btn-salvar-marca').addEventListener('click', salvarMarca);
  $('btn-pdf').addEventListener('click', exportarPDF);
  $('btn-png').addEventListener('click', exportarPNG);
  $('sel-marca').addEventListener('change', carregarMarca);
  $('logo-drop').addEventListener('click', () => $('f-logo').click());
  $('f-logo').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      logoData = ev.target.result;
      $('logo-preview').innerHTML = `<img src="${logoData}" style="max-height:52px;object-fit:contain">`;
      renderPreviewRecibo();
    };
    reader.readAsDataURL(file);
  });
  $('f-cep').addEventListener('blur', buscarCEPRecibo);

  const camposPreview = ['f-marca','f-cliente','f-tel','f-data','f-numero','f-frete','f-desconto','f-rua','f-bairro','f-cidade','f-politica','f-notas'];
  camposPreview.forEach(id => $(id)?.addEventListener('input', renderPreviewRecibo));
  $('f-pgto-metodo')?.addEventListener('change', renderPreviewRecibo);
  $('f-pgto-status')?.addEventListener('change', renderPreviewRecibo);

  addItemRecibo();
}

async function proximoNumeroRecibo() {
  const marcaNome = $('f-marca')?.value?.trim() || 'RIZ';
  const prefix    = marcaNome.toUpperCase().replace(/\s/g,'').slice(0, 3);
  const nums = _recibos
    .map(r => r.number || '')
    .filter(n => n.startsWith(prefix + '-'))
    .map(n => parseInt(n.split('-').pop()) || 0);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  $('f-numero').value = `${prefix}-${next}`;
}

function atualizarSelectMarcas() {
  const sel = $('sel-marca');
  if (!sel) return;
  sel.innerHTML = '<option value="">Carregar marca...</option>' +
    _marcas.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

function carregarMarca() {
  const id = $('sel-marca').value;
  const m  = _marcas.find(x => x.id === id);
  if (!m) return;
  $('f-marca').value    = m.name || '';
  $('f-resp').value     = m.responsible || '';
  $('f-contato').value  = m.contact || '';
  $('f-email').value    = m.email || '';
  $('f-ig').value       = m.instagram || '';
  if (m.logo) {
    logoData = m.logo;
    $('logo-preview').innerHTML = `<img src="${m.logo}" style="max-height:52px;object-fit:contain">`;
  }
  renderPreviewRecibo();
}

async function salvarMarca() {
  const m = {
    id:          genId(),
    name:        $('f-marca').value.trim(),
    responsible: $('f-resp').value,
    contact:     $('f-contato').value,
    email:       $('f-email').value,
    instagram:   $('f-ig').value,
    logo:        logoData,
  };
  if (!m.name) { toast('Informe o nome da marca.', 'erro'); return; }
  await setDoc(doc(db, 'users', _user.uid, 'brands', m.id), m, { merge: true });
  _marcas = (await getDocs(collection(db, 'users', _user.uid, 'brands'))).docs.map(d => ({ id: d.id, ...d.data() }));
  atualizarSelectMarcas();
  toast('Marca salva!', 'sucesso');
}

async function buscarCEPRecibo() {
  const cep = $('f-cep').value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (!d.erro) { $('f-rua').value = d.logradouro || ''; $('f-bairro').value = d.bairro || ''; $('f-cidade').value = `${d.localidade} - ${d.uf}`; }
  } catch {}
  renderPreviewRecibo();
}

function addItemRecibo() {
  const lista = $('itens-lista');
  const row   = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" placeholder="Produto / Descrição">
    <input type="number" placeholder="Qtd" value="1" min="1">
    <input type="number" placeholder="R$" value="0" step="0.01">
    <button class="btn-remover" type="button">✕</button>`;
  row.querySelector('.btn-remover').onclick = () => { row.remove(); renderPreviewRecibo(); };
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', renderPreviewRecibo));
  lista.appendChild(row);
  renderPreviewRecibo();
}

function getItensRecibo() {
  return Array.from($('itens-lista').querySelectorAll('.item-row')).map(row => {
    const inputs = row.querySelectorAll('input');
    return { desc: inputs[0].value, qty: +inputs[1].value || 1, price: +inputs[2].value || 0 };
  }).filter(i => i.desc);
}

function renderPreviewRecibo() {
  const itens   = getItensRecibo();
  const frete   = parseFloat($('f-frete')?.value || 0);
  const desc    = parseFloat($('f-desconto')?.value || 0);
  const sub     = itens.reduce((s, i) => s + i.qty * i.price, 0);
  const total   = sub + frete - desc;
  const endereco = [$('f-rua')?.value, $('f-bairro')?.value, $('f-cidade')?.value].filter(Boolean).join(', ');

  $('recibo-preview').innerHTML = `
    <div class="r-head">
      <div>
        ${logoData ? `<img src="${logoData}" style="max-height:46px;margin-bottom:8px;object-fit:contain">` : ''}
        <div class="r-marca">${$('f-marca')?.value || 'Marca'}</div>
        <div class="r-num">Recibo Nº ${$('f-numero')?.value || ''}</div>
      </div>
      <div style="text-align:right">
        <div class="r-data">${$('f-data')?.value ? new Date($('f-data').value + 'T12:00').toLocaleDateString('pt-BR') : ''}</div>
        ${$('f-ig')?.value  ? `<div class="r-small">${$('f-ig').value}</div>` : ''}
        ${$('f-contato')?.value ? `<div class="r-small">${$('f-contato').value}</div>` : ''}
      </div>
    </div>
    ${$('f-cliente')?.value ? `
    <div class="r-sec">
      <div class="r-sec-label">Cliente</div>
      <div class="r-cli-nome">${$('f-cliente').value}</div>
      ${$('f-tel')?.value ? `<div class="r-small">${$('f-tel').value}</div>` : ''}
      ${endereco ? `<div class="r-small">${endereco}</div>` : ''}
    </div>` : ''}
    <div class="r-sec r-tabela">
      <div class="r-sec-label">Itens</div>
      <table>
        <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${itens.map(i => `<tr><td>${i.desc}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">R$${i.price.toFixed(2).replace('.',',')}</td><td style="text-align:right">R$${(i.qty*i.price).toFixed(2).replace('.',',')}</td></tr>`).join('')}</tbody>
      </table>
      <div class="r-total">
        ${frete ? `<div class="r-small">Frete: R$${frete.toFixed(2).replace('.',',')}</div>` : ''}
        ${desc  ? `<div class="r-small">Desconto: -R$${desc.toFixed(2).replace('.',',')}</div>` : ''}
        <div class="r-total-valor">Total: R$${total.toFixed(2).replace('.',',')}</div>
      </div>
    </div>
    <div class="r-sec">
      <div class="r-sec-label">Pagamento</div>
      <div class="r-small">${$('f-pgto-metodo')?.value || 'PIX'} · ${labelStatus($('f-pgto-status')?.value)}</div>
      ${$('f-envio')?.value ? `<div class="r-small">Envio: ${$('f-envio').value}${$('f-prazo')?.value ? ' · ' + $('f-prazo').value : ''}</div>` : ''}
    </div>
    ${$('f-politica')?.value ? `<div class="r-sec"><div class="r-sec-label">Política</div><div class="r-small">${$('f-politica').value}</div></div>` : ''}
    ${$('f-notas')?.value    ? `<div class="r-sec"><div class="r-sec-label">Observações</div><div class="r-small">${$('f-notas').value}</div></div>` : ''}
    <div class="r-rodape">
      <span>${$('f-marca')?.value || ''}</span>
      <span>Emitido em ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>`;
}

async function salvarRecibo() {
  const itens = getItensRecibo();
  if (!itens.length) { toast('Adicione pelo menos um item.', 'erro'); return; }
  const frete = parseFloat($('f-frete').value) || 0;
  const desc  = parseFloat($('f-desconto').value) || 0;
  const total = itens.reduce((s, i) => s + i.qty * i.price, 0) + frete - desc;
  const recibo = {
    id:          editandoRecibId || genId(),
    number:      $('f-numero').value,
    brandName:   $('f-marca').value,     logo: logoData,
    responsible: $('f-resp').value,      contact: $('f-contato').value,
    email:       $('f-email').value,     instagram: $('f-ig').value,
    clientName:  $('f-cliente').value,   clientPhone: $('f-tel').value,
    clientEmail: $('f-email-cli').value,
    address:     $('f-rua').value + ', ' + $('f-cidade').value,
    itens, shipping: frete, discount: desc, total,
    paymentMethod: $('f-pgto-metodo').value,
    paymentStatus: $('f-pgto-status').value,
    shippingMethod: $('f-envio').value, shippingDeadline: $('f-prazo').value,
    policy: $('f-politica').value, notes: $('f-notas').value,
    date: $('f-data').value, createdAt: new Date().toISOString(),
  };
  loading(true);
  await setDoc(doc(db, 'users', _user.uid, 'receipts', recibo.id), recibo, { merge: true });
  _recibos = (await getDocs(query(collection(db, 'users', _user.uid, 'receipts'), orderBy('createdAt', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() }));
  loading(false);
  editandoRecibId = null;
  limparFormRecibo();
  renderTabelaRecibos();
  toast('Recibo salvo!', 'sucesso');
}

function limparFormRecibo() {
  editandoRecibId = null; logoData = '';
  ['f-marca','f-resp','f-contato','f-email','f-ig','f-cliente','f-tel',
   'f-email-cli','f-rua','f-bairro','f-cidade','f-cep',
   'f-envio','f-prazo','f-politica','f-notas'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('f-frete').value = '0'; $('f-desconto').value = '0';
  $('f-data').value  = hoje();
  $('itens-lista').innerHTML = '';
  $('logo-preview').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg><span>Clique para enviar</span>';
  addItemRecibo();
  proximoNumeroRecibo();
  renderPreviewRecibo();
}

function renderTabelaRecibos() {
  const busca = ($('busca-recibos')?.value || '').toLowerCase();
  const lista = busca ? _recibos.filter(r => (r.clientName + r.brandName + r.number).toLowerCase().includes(busca)) : _recibos;
  $('tabela-recibos').innerHTML = lista.length ? `
    <table>
      <thead><tr><th>Número</th><th>Marca</th><th>Cliente</th><th>Total</th><th>Data</th><th>Status</th><th></th></tr></thead>
      <tbody>${lista.map(r => `
        <tr>
          <td style="font-family:var(--mono)">${r.number || ''}</td>
          <td>${r.brandName || ''}</td>
          <td>${r.clientName || ''}</td>
          <td style="font-family:var(--mono);font-weight:700">${fmt(r.total || 0)}</td>
          <td style="color:var(--cinza3)">${r.date || ''}</td>
          <td>${badge(r.paymentStatus || 'pending')}</td>
          <td style="display:flex;gap:5px">
            <button class="btn btn-ghost sm" onclick="editarRecibo('${r.id}')">Editar</button>
            <button class="btn btn-perigo sm" onclick="excluirRecibo('${r.id}')">Excluir</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="tabela-vazia">Nenhum recibo salvo.</p>';
  $('busca-recibos')?.addEventListener('input', renderTabelaRecibos);
}

window.editarRecibo = function(id) {
  const r = _recibos.find(x => x.id === id);
  if (!r) return;
  editandoRecibId = r.id;
  const set = (fId, v) => { if ($(fId)) $(fId).value = v || ''; };
  set('f-numero', r.number); set('f-marca', r.brandName); set('f-resp', r.responsible);
  set('f-contato', r.contact); set('f-email', r.email); set('f-ig', r.instagram);
  set('f-cliente', r.clientName); set('f-tel', r.clientPhone); set('f-email-cli', r.clientEmail);
  set('f-data', r.date); set('f-frete', r.shipping); set('f-desconto', r.discount);
  set('f-pgto-metodo', r.paymentMethod); set('f-pgto-status', r.paymentStatus);
  set('f-envio', r.shippingMethod); set('f-prazo', r.shippingDeadline);
  set('f-politica', r.policy); set('f-notas', r.notes);
  if (r.logo) { logoData = r.logo; $('logo-preview').innerHTML = `<img src="${r.logo}" style="max-height:52px;object-fit:contain">`; }
  $('itens-lista').innerHTML = '';
  (r.itens || []).forEach(item => {
    addItemRecibo();
    const rows   = $('itens-lista').querySelectorAll('.item-row');
    const inputs = rows[rows.length - 1].querySelectorAll('input');
    inputs[0].value = item.desc; inputs[1].value = item.qty; inputs[2].value = item.price;
  });
  renderPreviewRecibo();
  $('recibo-form-panel').scrollIntoView({ behavior: 'smooth' });
};

window.excluirRecibo = async function(id) {
  if (!confirm('Excluir recibo?')) return;
  await deleteDoc(doc(db, 'users', _user.uid, 'receipts', id));
  _recibos = _recibos.filter(r => r.id !== id);
  renderTabelaRecibos();
  toast('Recibo excluído.');
};

async function exportarPDF() {
  const el     = $('recibo-preview');
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' });
  const img    = canvas.toDataURL('image/png');
  const pdf    = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const w      = pdf.internal.pageSize.getWidth();
  pdf.addImage(img, 'PNG', 0, 0, w, (canvas.height * w) / canvas.width);
  pdf.save(`recibo-${$('f-numero')?.value || 'rize'}.pdf`);
}

async function exportarPNG() {
  const canvas = await html2canvas($('recibo-preview'), { scale: 2, backgroundColor: '#fff' });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `recibo-${$('f-numero')?.value || 'rize'}.png`;
  a.click();
}

/* =============================================================
   HELPERS
   ============================================================= */
function labelStatus(s) {
  return { pending: 'Pendente', confirmed: 'Confirmado', shipped: 'Enviado',
           delivered: 'Entregue', cancelled: 'Cancelado',
           paid: 'Pago', partial: 'Parcial', income: 'Entrada', expense: 'Saída' }[s] || s;
}
function badge(s) { return `<span class="badge badge-${s}">${labelStatus(s)}</span>`; }
