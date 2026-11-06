(function () {
  "use strict";
  var KEY = "adega_pdv_v1";
  var brl = Core.brl, FL = Core.FORMA_LABEL;
  var CATL = { combo: "Combos", cerveja: "Cervejas", whisky: "Whiskies", vinho: "Vinhos", destilado: "Destilados", espumante: "Espumantes", outros: "Outros" };

  /* ---------- Estado ---------- */
  var st = load();
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.versao) return Object.assign(Core.novoEstado(), s); } catch (e) {}
    var n = Core.novoEstado();
    (window.SEED_PRODUTOS || []).forEach(function (p) { Core.salvarProduto(n, p); });
    (window.SEED_COMBOS || []).forEach(function (c) {
      var comps = c.itens.map(function (i) { var pr = n.produtos.filter(function (x) { return x.nome === i.nome; })[0]; return pr ? { produtoId: pr.id, qtd: i.qtd } : null; }).filter(Boolean);
      if (comps.length) Core.salvarProduto(n, { tipo: "combo", nome: c.nome, preco: c.preco, desc: c.desc, componentes: comps });
    });
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {}
    return n;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { toast("Não foi possível salvar (armazenamento cheio?). Faça backup!", true); }
  }
  var user = null; // usuário logado (Auth.sessao)
  var PERM = { admin: ["venda", "caixa", "vendas", "estoque", "relatorios", "config"], vendedor: ["venda", "caixa", "vendas"] };
  function can(tab) { return !!user && PERM[user.papel].indexOf(tab) > -1; }
  function isAdmin() { return !!user && user.papel === "admin"; }
  function log(acao, detalhe) { Core.audit(st, user ? user.usuario : "-", acao, detalhe); }
  var ui = { descAutorizado: null, ultima: null, tab: "venda", cat: "todos", q: "", cart: [], desc: { tipo: "valor", valor: 0 }, vendasDia: hoje(), relPeriodo: "hoje", estoqueQ: "", estCat: "todos", soBaixo: false };

  /* ---------- Utilidades ---------- */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function num(s) { var v = parseFloat(String(s == null ? "" : s).replace(/\./g, function (m, i, str) { return str.indexOf(",") > -1 ? "" : m; }).replace(",", ".")); return isFinite(v) ? v : 0; }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dia(str, fim) { var p = str.split("-"); return fim ? new Date(+p[0], p[1] - 1, +p[2], 23, 59, 59, 999) : new Date(+p[0], p[1] - 1, +p[2], 0, 0, 0, 0); }
  function dt(iso) { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  function hr(iso) { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function toast(msg, bad, actLabel, onAct) {
    var t = $("#toast"), b = $("#toastAct"); $("#toastMsg").textContent = msg;
    b.hidden = !actLabel; b.textContent = actLabel || ""; b.onclick = function () { t.className = "toast"; if (onAct) onAct(); };
    t.className = "toast show" + (bad ? " bad" : ""); clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = "toast"; }, actLabel ? 6000 : 2600);
  }
  function confirmar(titulo, texto, rotulo, onOk, perigo) {
    openModal("<h2>" + esc(titulo) + '</h2><p class="muted">' + esc(texto) + '</p><div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn" id="cfNo">Voltar</button><button class="btn ' + (perigo ? "danger" : "gold") + '" id="cfOk">' + esc(rotulo) + "</button></div>");
    $("#cfNo").focus(); $("#cfNo").onclick = closeModal; $("#cfOk").onclick = function () { closeModal(); onOk(); };
  }
  function download(name, text, mime) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function tryDo(fn) { try { return fn(); } catch (e) { toast(e.message, true); return null; } }

  var modalBg = $("#modalBg"), modal = $("#modal");
  function openModal(html) { modal.innerHTML = html; modalBg.hidden = false; var f = $("input:not([type=hidden]),select,button.gold", modal); if (f) f.focus(); }
  function closeModal() { modalBg.hidden = true; modal.innerHTML = ""; modal.oninput = null; modal.onclick = null; modal.onkeydown = null; if (ui.tab === "venda" && $("#busca")) $("#busca").focus(); }
  modalBg.addEventListener("mousedown", function (e) { if (e.target === modalBg) closeModal(); });

  /* ---------- Cupom ---------- */
  var W = 32;
  function lr(a, b) { a = String(a); b = String(b); var sp = Math.max(1, W - a.length - b.length); return a + " ".repeat(sp) + b; }
  function ctr(s) { s = String(s); return " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s; }
  function cupomVenda(v) {
    var L = [ctr((st.config.loja || "Adega Prime").toUpperCase()), ctr("CUPOM NÃO FISCAL"), "-".repeat(W), "Venda #" + v.id + "  " + dt(v.data), "Operador: " + v.operador, "-".repeat(W)];
    v.itens.forEach(function (i) { L.push(i.nome.slice(0, W)); L.push(lr("  " + i.qtd + " x " + brl(i.preco).replace(/\u00a0/g, " "), brl(i.preco * i.qtd).replace(/\u00a0/g, " "))); });
    L.push("-".repeat(W), lr("Subtotal", brl(v.subtotal)));
    if (v.desconto > 0) L.push(lr("Desconto", "-" + brl(v.desconto)));
    L.push(lr("TOTAL", brl(v.total)), "");
    v.pagamentos.forEach(function (p) { L.push(lr(FL[p.forma], brl(p.valor))); });
    if (v.troco > 0) L.push(lr("Troco", brl(v.troco)));
    if (v.status === "cancelada") L.push("", ctr("*** CANCELADA ***"));
    L.push("", ctr("Obrigado! Beba com moderação."), ctr("Venda proibida a menores de 18"));
    return L.join("\n").replace(/\u00a0/g, " ");
  }
  function imprimir(texto) { $("#cupom").innerHTML = "<pre>" + esc(texto) + "</pre>"; window.print(); }

  /* ---------- Navegação ---------- */
  $("#tabs").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; if (!can(b.dataset.tab)) return; ui.tab = b.dataset.tab; render(); });
  function render() {
    user = user || Auth.sessao();
    document.body.classList.toggle("locked", !user);
    $("#userChip").hidden = !user;
    if (!user) { view.onclick = null; return vAuth(); }
    if (!can(ui.tab)) ui.tab = "venda";
    $("#userNome").textContent = user.nome; $("#userPapel").textContent = Auth.PAPEIS[user.papel];
    $$("#tabs button").forEach(function (b) { b.hidden = !can(b.dataset.tab); b.classList.toggle("active", b.dataset.tab === ui.tab); });
    var cx = Core.caixaAberto(st), s = $("#caixaStatus");
    s.className = "caixa-status " + (cx ? "on" : "off");
    s.textContent = cx ? "Caixa aberto · " + cx.operador : "Caixa fechado";
    view.onclick = null;
    ({ venda: vVenda, caixa: vCaixa, estoque: vEstoque, vendas: vVendas, relatorios: vRel, config: vConfig })[ui.tab]();
  }
  var view = $("#view");

  /* =========================== LOGIN =========================== */
  function vAuth() {
    var setup = !Auth.temAdmin();
    view.innerHTML = '<div class="login panel stack"><img src="logo.png" alt="Adega Prime" width="64" style="margin:0 auto">' +
      "<h2 style=\"text-align:center\">" + (setup ? "Primeiro acesso" : "Entrar na Área da equipe") + "</h2>" +
      (setup ? '<p class="muted small">Crie o acesso do <b>administrador</b>. Guarde a senha: ela libera estoque, preços, relatórios e usuários.</p>' : "") +
      '<form id="fAuth" class="stack" novalidate>' +
      (setup ? '<label>Seu nome<input id="aNome" autocomplete="name"></label>' : "") +
      '<label>Usuário<input id="aUser" autocomplete="username" autocapitalize="none" spellcheck="false"' + (setup ? ' value="admin"' : "") + "></label>" +
      '<label>Senha' + (setup ? " (mín. 8 caracteres)" : "") + '<input id="aPass" type="password" autocomplete="' + (setup ? "new-password" : "current-password") + '"></label>' +
      (setup ? '<label>Repita a senha<input id="aPass2" type="password" autocomplete="new-password"></label>' : "") +
      '<label class="check"><input type="checkbox" id="aShow" style="width:auto"> mostrar senha</label>' +
      '<div class="err" id="aErr" role="alert"></div><button class="btn gold" id="aGo" type="submit">' + (setup ? "Criar administrador e entrar" : "Entrar") + "</button></form>" +
      '<p class="small muted" style="text-align:center">' + (setup ? "" : "Esqueceu a senha? Peça ao administrador para redefinir. ") + '<a href="../index.html" style="color:var(--gold-l)">← Voltar ao site</a></p></div>';
    $("#aShow").onchange = function (e) { $$("input[type=password],#aPass,#aPass2", view).forEach(function (i) { i.type = e.target.checked ? "text" : "password"; }); };
    $("#" + (setup ? "aNome" : "aUser")).focus();
    $("#fAuth").onsubmit = function (e) {
      e.preventDefault();
      var u = $("#aUser").value.trim(), pw = $("#aPass").value, err = $("#aErr"), btn = $("#aGo"); err.textContent = "";
      if (!u || !pw) { err.textContent = "Informe usuário e senha."; return; }
      if (setup) {
        if (pw !== $("#aPass2").value) { err.textContent = "As senhas não conferem."; return; }
      }
      btn.disabled = true; btn.textContent = setup ? "Criando…" : "Entrando…";
      var go = setup ? Auth.criarUsuario({ nome: $("#aNome").value, usuario: u, papel: "admin", senha: pw }) : Promise.resolve();
      go.then(function () { return Auth.login(u, pw); }).then(function (usr) {
        user = usr; log("login", setup ? "primeiro acesso (admin criado)" : ""); save(); ui.tab = "venda"; render();
      }).catch(function (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = setup ? "Criar administrador e entrar" : "Entrar"; $("#aPass").value = ""; $("#aPass").focus(); });
    };
  }
  function sair() {
    function fazer() { log("logout", ""); save(); Auth.sair(); user = null; ui.cart = []; ui.desc = { tipo: "valor", valor: 0 }; ui.ultima = null; ui.descAutorizado = null; closeModal(); render(); }
    if (ui.cart.length) confirmar("Sair agora?", "Há uma venda em andamento. Ao sair, o carrinho será descartado.", "Sair", fazer, true); else fazer();
  }
  $("#btnSair").onclick = sair;
  $("#themeBtn").onclick = function () {
    var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.classList.add("theme-anim"); document.documentElement.dataset.theme = next;
    try { localStorage.setItem("adega_theme", next); } catch (e) {}
    setTimeout(function () { document.documentElement.classList.remove("theme-anim"); }, 420);
  };
  // Pede login de administrador (para ações restritas feitas por vendedor)
  function pedirAdmin(motivo, onOk) {
    if (isAdmin()) return onOk(user);
    openModal("<h2>Autorização do administrador</h2><p class=\"muted\">" + esc(motivo) + '</p><form id="fAdm" class="stack" novalidate><label>Usuário do administrador<input id="adU" autocomplete="off" autocapitalize="none"></label><label>Senha<input id="adP" type="password" autocomplete="off"></label><div class="err" id="adE" role="alert"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="adX">Voltar</button><button class="btn gold" id="adO" type="submit">Autorizar</button></div></form>');
    $("#adX").onclick = closeModal;
    $("#fAdm").onsubmit = function (e) {
      e.preventDefault(); var b = $("#adO"); b.disabled = true; $("#adE").textContent = "";
      Auth.verificarAdmin($("#adU").value, $("#adP").value).then(function (adm) { closeModal(); onOk(adm); })
        .catch(function (er) { $("#adE").textContent = er.message; b.disabled = false; $("#adP").value = ""; $("#adP").focus(); });
    };
  }

  function formAbrir() {
    return '<div class="panel stack" style="max-width:420px"><h2>Abrir caixa</h2>' +
      '<p class="muted">Operador: <b>' + esc(user.nome) + "</b></p>" +
      '<label>Dinheiro inicial no caixa (troco) R$<input id="opTroco" inputmode="decimal" value="0"></label>' +
      '<button class="btn gold" id="btnAbrir">Abrir caixa</button></div>';
  }
  function bindAbrir() {
    var b = $("#btnAbrir"); if (!b) return;
    b.onclick = function () { var cxN = tryDo(function () { return Core.abrirCaixa(st, user.nome, num($("#opTroco").value)); }); if (cxN) { cxN.usuario = user.usuario; log("abrir caixa", "#" + cxN.id + " troco " + brl(cxN.trocoInicial)); save(); toast("Caixa aberto"); render(); } };
  }

  /* =========================== VENDA =========================== */
  function vVenda() {
    if (!Core.caixaAberto(st)) { view.innerHTML = formAbrir(); bindAbrir(); return; }
    var cats = ["todos"].concat(Core.CATEGORIAS);
    view.innerHTML = '<div class="pdv"><section>' +
      '<label for="busca" class="small muted" style="margin-bottom:.25rem">Buscar produto ou bipar código <kbd>F2</kbd> · quantidade: <kbd>3*código</kbd></label><input id="busca" placeholder="Código de barras, código ou nome…" autocomplete="off" aria-describedby="buscaErr" value="' + esc(ui.q) + '"><div class="err" id="buscaErr" role="alert"></div>' +
      '<div class="cats">' + cats.map(function (c) { return '<button class="chip' + (ui.cat === c ? " active" : "") + '" data-cat="' + c + '">' + (c === "todos" ? "Todos" : CATL[c]) + "</button>"; }).join("") + '</div>' +
      '<div class="prods" id="prods"></div></section>' +
      '<aside class="panel cart"><div id="ultima"></div><h2>Venda atual</h2><div class="items" id="items"></div>' +
      '<div class="row" style="margin-bottom:.5rem"><label style="flex:1">Desconto<input id="descV" inputmode="decimal" value="' + (ui.desc.valor || "") + '" placeholder="0"></label>' +
      '<label style="width:90px">Tipo<select id="descT"><option value="valor"' + (ui.desc.tipo === "valor" ? " selected" : "") + '>R$</option><option value="percent"' + (ui.desc.tipo === "percent" ? " selected" : "") + '>%</option></select></label></div>' +
      '<div id="totais"></div>' +
      '<div class="row" style="margin-top:.5rem"><button class="btn danger" id="btnLimpar">Cancelar (F8)</button><button class="btn gold" id="btnFin" style="flex:1">Finalizar (F4)</button></div></aside></div>';
    $("#busca").oninput = function (e) { ui.q = e.target.value; $("#buscaErr").textContent = ""; $("#busca").classList.remove("invalid"); updProds(); };
    $("#busca").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); buscaEnter(); } };
    $$(".chip", view).forEach(function (c) { c.onclick = function () { ui.cat = c.dataset.cat; $$(".chip", view).forEach(function (x) { x.classList.toggle("active", x === c); }); updProds(); }; });
    $("#prods").onclick = function (e) { var b = e.target.closest("[data-id]"); if (b) addItem(+b.dataset.id, 1); };
    $("#items").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return; var id = +b.dataset.id;
      if (b.dataset.q) addItem(id, +b.dataset.q); if (b.dataset.rm) { var idx = ui.cart.findIndex(function (i) { return i.produtoId === id; }), item = ui.cart[idx]; ui.cart.splice(idx, 1); updCart(); toast(item.nome + " removido", false, "Desfazer", function () { ui.cart.splice(Math.min(idx, ui.cart.length), 0, item); updCart(); }); }
    };
    $("#descV").oninput = function () { ui.desc.valor = num($("#descV").value); ui.descAutorizado = null; updCart(); };
    $("#descT").onchange = function () { ui.desc.tipo = $("#descT").value; ui.descAutorizado = null; updCart(); };
    $("#btnLimpar").onclick = limparVenda;
    $("#btnFin").onclick = finalizar;
    updProds(); updCart(); updUltima(); $("#busca").focus();
  }
  function updUltima() {
    var u = ui.ultima; $("#ultima").innerHTML = u ? '<div class="notice ok">Última venda <b>#' + u.id + "</b> · " + brl(u.total) + (u.troco > 0 ? " · troco <b>" + brl(u.troco) + "</b>" : "") + ' <button class="btn sm" id="uVer">Ver cupom</button></div>' : "";
    if (u && $("#uVer")) $("#uVer").onclick = function () { mostrarVenda(st.vendas.filter(function (v) { return v.id === u.id; })[0], false); };
  }
  function compText(p) { return (p.componentes || []).map(function (c) { var q = Core.achar(st, c.produtoId); return c.qtd + "× " + (q ? q.nome : "?"); }).join(" + "); }
  function updProds() {
    var lista = Core.buscar(st, ui.q).filter(function (p) { return ui.cat === "todos" || p.categoria === ui.cat; });
    $("#prods").innerHTML = lista.map(function (p) {
      var disp = Core.disponivel(st, p), combo = Core.ehCombo(p), baixo = !combo && disp > 0 && disp <= p.minimo;
      return '<button class="prod" data-id="' + p.id + '"' + (disp <= 0 ? " disabled" : "") + (combo ? ' title="' + esc(compText(p)) + '"' : "") + "><b>" + esc(p.nome) + "</b>" + (combo ? '<span class="tag">combo</span>' : "") +
        '<span class="st' + (baixo ? " low" : "") + '">' + (disp <= 0 ? "Sem estoque" : baixo ? "Últimas: " + disp : (combo ? "Disp.: " : "Estoque: ") + disp) + '</span><span class="pr">' + (Core.emPromo(p) ? '<del class="muted small">' + brl(p.preco) + "</del> " : "") + brl(Core.precoAtual(p)) + "</span></button>";
    }).join("") || '<p class="muted">Nenhum produto.</p>';
  }
  function totaisVenda() { return Core.totais(ui.cart, ui.desc); }
  function updCart() {
    $("#items").innerHTML = ui.cart.map(function (i) {
      return '<div class="it"><div><b>' + esc(i.nome) + '</b><div class="small muted">' + brl(i.preco) + " cada" + (Core.ehCombo(Core.achar(st, i.produtoId)) ? " · " + esc(compText(Core.achar(st, i.produtoId))) : "") + '</div></div><div class="right"><b>' + brl(i.preco * i.qtd) + "</b></div>" +
        '<div class="qty"><button data-id="' + i.produtoId + '" data-q="-1" aria-label="Diminuir">−</button><span>' + i.qtd + '</span><button data-id="' + i.produtoId + '" data-q="1" aria-label="Aumentar">+</button></div>' +
        '<div class="right"><button class="btn sm" data-id="' + i.produtoId + '" data-rm="1">remover</button></div></div>';
    }).join("") || '<p class="muted">Carrinho vazio. Bipe ou toque num produto.</p>';
    var t = totaisVenda();
    $("#totais").innerHTML = '<div class="tot"><span>Subtotal</span><span>' + brl(t.subtotal) + "</span></div>" + (t.desconto > 0 ? '<div class="tot"><span>Desconto</span><span>-' + brl(t.desconto) + "</span></div>" : "") + '<div class="tot big"><span>Total</span><b>' + brl(t.total) + "</b></div>";
  }
  function addItem(id, q) {
    var p = Core.achar(st, id); if (!p) return;
    var it = ui.cart.filter(function (i) { return i.produtoId === id; })[0], novo = (it ? it.qtd : 0) + q;
    if (novo <= 0) { ui.cart = ui.cart.filter(function (i) { return i.produtoId !== id; }); return updCart(); }
    try { Core.verificarEstoque(st, ui.cart.filter(function (i) { return i.produtoId !== id; }).concat([{ produtoId: id, qtd: novo }])); } catch (er) { return toast(er.message, true); }
    if (it) it.qtd = novo; else ui.cart.push({ produtoId: id, nome: p.nome, preco: Core.precoAtual(p), qtd: novo });
    updCart();
  }
  function buscaEnter() {
    var raw = $("#busca").value.trim(); if (!raw) return;
    var q = 1, cod = raw, m = raw.match(/^(\d+)\s*[*x]\s*(.+)$/i);
    if (m) { q = +m[1]; cod = m[2]; }
    var p = Core.porCodigo(st, cod);
    if (!p) { var r = Core.buscar(st, cod); if (r.length === 1) p = r[0]; }
    if (!p) { $("#buscaErr").textContent = "Nenhum produto com “" + raw + "”. Confira o código ou busque pelo nome."; $("#busca").classList.add("invalid"); return; }
    addItem(p.id, q); ui.q = ""; $("#busca").value = ""; updProds();
  }
  function limparVenda() {
    if (!ui.cart.length) return;
    confirmar("Descartar a venda atual?", "Os " + ui.cart.length + " item(ns) do carrinho serão removidos. Nenhum estoque é alterado.", "Descartar venda", function () { ui.cart = []; ui.desc = { tipo: "valor", valor: 0 }; if (ui.tab === "venda") vVenda(); toast("Venda descartada"); }, true);
  }

  function finalizar() {
    if (!ui.cart.length) return toast("Carrinho vazio", true);
    ui.cart.forEach(function (i) { var pr = Core.achar(st, i.produtoId); if (pr) i.preco = Core.precoAtual(pr); }); updCart();
    var t = totaisVenda(); if (t.total <= 0) return toast("Total inválido", true);
    var pct = t.subtotal > 0 ? t.desconto / t.subtotal * 100 : 0, lim = Number(st.config.descontoMaxVendedor) || 0;
    if (!isAdmin() && pct > lim + 1e-9 && !ui.descAutorizado) return pedirAdmin("Desconto de " + pct.toFixed(1).replace(".", ",") + "% (limite do vendedor: " + lim + "%).", function (adm) { ui.descAutorizado = adm.usuario; log("desconto autorizado", pct.toFixed(1) + "% por " + adm.usuario); finalizar(); });
    openModal('<h2>Pagamento</h2><div class="tot big"><span>Total</span><b>' + brl(t.total) + "</b></div>" +
      Core.FORMAS.map(function (f) { return '<div class="pay"><label for="pf-' + f + '">' + FL[f] + '</label><input id="pf-' + f + '" data-f="' + f + '" inputmode="decimal" placeholder="0,00"><button class="btn sm" data-fill="' + f + '">Valor total</button></div>'; }).join("") +
      '<div class="row small" style="margin:-.1rem 0 .5rem 0"><span class="muted">Dinheiro recebido:</span>' + [20, 50, 100, 200].map(function (n) { return '<button class="btn sm" data-cash="' + n + '">R$ ' + n + "</button>"; }).join("") + "</div>" +
      '<div id="payRes" class="panel" style="margin-top:.75rem"></div><div class="err" id="payErr"></div>' +
      '<div class="row" style="margin-top:.75rem;justify-content:flex-end"><button class="btn" id="payCancel">Voltar</button><button class="btn gold" id="payOk" disabled>Confirmar venda</button></div>');
    function pags() { return $$("[data-f]", modal).map(function (i) { return { forma: i.dataset.f, valor: Core.round2(num(i.value)) }; }).filter(function (p) { return p.valor > 0; }); }
    function upd() {
      var r = Core.resumoPagamento(t.total, pags());
      $("#payRes").innerHTML = '<div class="tot"><span>Pago</span><span>' + brl(r.pago) + "</span></div>" + (r.restante > 0 ? '<div class="tot"><span>Falta</span><b class="warn">' + brl(r.restante) + "</b></div>" : "") + (r.troco > 0 ? '<div class="tot big"><span>Troco</span><b>' + brl(r.troco) + "</b></div>" : "");
      $("#payErr").textContent = r.erro || ""; $("#payOk").disabled = !r.ok;
    }
    modal.oninput = upd;
    modal.onclick = function (e) {
      var c = e.target.closest("[data-cash]");
      if (c) { $('[data-f="dinheiro"]', modal).value = String(c.dataset.cash); upd(); return; }
      var b = e.target.closest("[data-fill]"); if (!b) return;
      var f = b.dataset.fill, outros = pags().filter(function (p) { return p.forma !== f; }).reduce(function (s, p) { return s + p.valor; }, 0);
      $('[data-f="' + f + '"]', modal).value = String(Math.max(0, Core.round2(t.total - outros))).replace(".", ","); upd();
    };
    $("#payCancel").onclick = closeModal;
    modal.onkeydown = function (e) { if (e.key === "Enter" && !$("#payOk").disabled) { e.preventDefault(); $("#payOk").click(); } };
    $("#payOk").onclick = function () {
      var v = tryDo(function () { return Core.finalizarVenda(st, ui.cart, ui.desc, pags(), user.usuario); });
      if (!v) return;
      save(); ui.cart = []; ui.desc = { tipo: "valor", valor: 0 }; modal.oninput = null; modal.onclick = null; modal.onkeydown = null;
      ui.ultima = { id: v.id, total: v.total, troco: v.troco }; ui.descAutorizado = null; if (v.desconto > 0) log("venda com desconto", "#" + v.id + " " + brl(v.desconto));
      mostrarVenda(v, true); if (ui.tab === "venda") vVenda();
    };
    upd();
  }
  function mostrarVenda(v, nova) {
    openModal("<h2>" + (nova ? "Venda concluída" : "Venda #" + v.id) + "</h2>" + (v.troco > 0 ? '<div class="tot big"><span>Troco</span><b>' + brl(v.troco) + "</b></div>" : "") +
      '<div class="panel"><pre style="font:12px/1.35 monospace;white-space:pre-wrap">' + esc(cupomVenda(v)) + '</pre></div><div class="row" style="margin-top:.75rem;justify-content:flex-end"><button class="btn" id="mFechar">' + (nova ? "Nova venda" : "Fechar") + '</button><button class="btn gold" id="mPrint">Imprimir</button></div>');
    $("#mFechar").onclick = closeModal; $("#mPrint").onclick = function () { imprimir(cupomVenda(v)); };
  }

  /* =========================== CAIXA =========================== */
  function vCaixa() {
    var cx = Core.caixaAberto(st), h = "";
    if (!cx) h += formAbrir();
    else {
      var r = Core.resumoCaixa(st, cx);
      h += '<div class="row sp"><h2>Caixa aberto — ' + esc(cx.operador) + ' <span class="muted small">desde ' + dt(cx.abertoEm) + '</span></h2><div class="row"><button class="btn" id="bSup">+ Suprimento</button><button class="btn" id="bSang">− Sangria</button><button class="btn danger" id="bFechar">Fechar caixa</button></div></div>' +
        '<div class="cards"><div class="card"><small>Vendas</small><b>' + r.vendas + '</b></div><div class="card"><small>Total vendido</small><b>' + brl(r.total) + '</b></div>' +
        Core.FORMAS.map(function (f) { return '<div class="card"><small>' + FL[f] + (f === "dinheiro" ? " (líquido de troco)" : "") + "</small><b>" + brl(r.porForma[f]) + "</b></div>"; }).join("") +
        '<div class="card"><small>Dinheiro esperado na gaveta</small><b>' + brl(r.dinheiroEsperado) + '</b></div></div>' +
        '<div class="panel"><h3>Movimentos (abertura: ' + brl(cx.trocoInicial) + ")</h3>" + (cx.movimentos.length ? '<table><tr><th>Hora</th><th>Tipo</th><th>Motivo</th><th class="n">Valor</th></tr>' + cx.movimentos.map(function (m) { return "<tr><td>" + hr(m.data) + "</td><td>" + (m.tipo === "sangria" ? "Sangria" : "Suprimento") + "</td><td>" + esc(m.motivo) + '</td><td class="n">' + (m.tipo === "sangria" ? "-" : "+") + brl(m.valor) + "</td></tr>"; }).join("") + "</table>" : '<p class="muted">Sem movimentos.</p>') + "</div>";
    }
    var hist = st.caixas.filter(function (c) { return c.fechadoEm; }).slice(-10).reverse();
    h += '<div class="panel" style="margin-top:1rem"><h3>Caixas fechados (últimos 10)</h3>' + (hist.length ? '<div class="scroll"><table><tr><th>#</th><th>Operador</th><th>Abertura</th><th>Fechamento</th><th class="n">Vendido</th><th class="n">Esperado</th><th class="n">Contado</th><th class="n">Diferença</th></tr>' +
      hist.map(function (c) { return "<tr><td>" + c.id + "</td><td>" + esc(c.operador) + "</td><td>" + dt(c.abertoEm) + "</td><td>" + dt(c.fechadoEm) + '</td><td class="n">' + brl(c.resumo.total) + '</td><td class="n">' + brl(c.esperado) + '</td><td class="n">' + brl(c.contado) + '</td><td class="n ' + (c.diferenca < 0 ? "bad" : c.diferenca > 0 ? "warn" : "ok") + '">' + brl(c.diferenca) + "</td></tr>"; }).join("") + "</table></div>" : '<p class="muted">Nenhum ainda.</p>') + "</div>";
    view.innerHTML = h; bindAbrir();
    if (!cx) return;
    $("#bSup").onclick = function () { movModal("suprimento"); }; $("#bSang").onclick = function () { movModal("sangria"); }; $("#bFechar").onclick = fecharModal;
  }
  function movModal(tipo) {
    openModal("<h2>" + (tipo === "sangria" ? "Sangria (retirada)" : "Suprimento (entrada)") + '</h2><div class="stack"><label>Valor R$<input id="mv" inputmode="decimal"></label><label>Motivo<input id="mm" autocomplete="off"></label><div class="err" id="me"></div><div class="row" style="justify-content:flex-end"><button class="btn" id="mc">Voltar</button><button class="btn gold" id="mo">Confirmar</button></div></div>');
    $("#mc").onclick = closeModal;
    $("#mo").onclick = function () { try { Core.movimento(st, tipo, num($("#mv").value), $("#mm").value); log(tipo, brl(num($("#mv").value)) + " — " + $("#mm").value); save(); closeModal(); render(); toast("Registrado"); } catch (e) { $("#me").textContent = e.message; } };
  }
  function fecharModal() {
    var cx = Core.caixaAberto(st), r = Core.resumoCaixa(st, cx);
    if (!isAdmin() && cx.usuario && cx.usuario !== user.usuario) return toast("Só quem abriu o caixa (" + cx.operador + ") ou um administrador pode fechá-lo.", true);
    if (ui.cart.length) return toast("Finalize ou cancele a venda em andamento antes de fechar.", true);
    openModal('<h2>Fechar caixa</h2><div class="tot"><span>Vendido</span><span>' + brl(r.total) + '</span></div><div class="tot big"><span>Dinheiro esperado</span><b>' + brl(r.dinheiroEsperado) + '</b></div>' +
      '<label>Dinheiro contado na gaveta R$<input id="fc" inputmode="decimal"></label><div class="tot" id="fd" style="margin-top:.5rem"></div><div class="err" id="fe"></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:.5rem"><button class="btn" id="fx">Voltar</button><button class="btn danger" id="fok">Fechar caixa</button></div>');
    $("#fc").oninput = function () { var d = Core.round2(num($("#fc").value) - r.dinheiroEsperado); $("#fd").innerHTML = "<span>Diferença</span><b class='" + (d < 0 ? "bad" : d > 0 ? "warn" : "ok") + "'>" + brl(d) + "</b>"; };
    $("#fx").onclick = closeModal;
    $("#fok").onclick = function () {
      if ($("#fc").value.trim() === "") { $("#fe").textContent = "Informe o dinheiro contado."; return; }
      var c = tryDo(function () { return Core.fecharCaixa(st, num($("#fc").value)); }); if (!c) return;
      log("fechar caixa", "#" + c.id + " diferença " + brl(c.diferenca)); save(); var txt = cupomFechamento(c);
      openModal('<h2>Caixa fechado</h2><div class="panel"><pre style="font:12px/1.35 monospace;white-space:pre-wrap">' + esc(txt) + '</pre></div><div class="row" style="justify-content:flex-end;margin-top:.75rem"><button class="btn" id="zc">Fechar</button><button class="btn gold" id="zp">Imprimir</button></div>');
      $("#zc").onclick = function () { closeModal(); render(); }; $("#zp").onclick = function () { imprimir(txt); }; render();
    };
  }
  function cupomFechamento(c) {
    var r = c.resumo, L = [ctr("FECHAMENTO DE CAIXA #" + c.id), "-".repeat(W), "Operador: " + c.operador, "Abertura: " + dt(c.abertoEm), "Fechamento: " + dt(c.fechadoEm), "-".repeat(W), lr("Vendas", r.vendas), lr("Total vendido", brl(r.total))];
    Core.FORMAS.forEach(function (f) { L.push(lr(FL[f], brl(r.porForma[f]))); });
    L.push("-".repeat(W), lr("Troco inicial", brl(r.trocoInicial)), lr("Suprimentos", brl(r.suprimentos)), lr("Sangrias", "-" + brl(r.sangrias)), lr("Esperado", brl(c.esperado)), lr("Contado", brl(c.contado)), lr("DIFERENÇA", brl(c.diferenca)));
    return L.join("\n").replace(/\u00a0/g, " ");
  }

  /* =========================== ESTOQUE =========================== */
  function vEstoque() {
    var baixo = Core.estoqueBaixo(st), q = Core.norm(ui.estoqueQ);
    var lista = st.produtos.filter(function (p) {
      return (!q || Core.norm(p.nome + " " + p.codigo + " " + p.barras).indexOf(q) > -1) && (ui.estCat === "todos" || p.categoria === ui.estCat) && (!ui.soBaixo || (!Core.ehCombo(p) && p.estoque <= p.minimo));
    });
    view.innerHTML = '<div class="row sp"><h2>Catálogo e estoque</h2><div class="row"><button class="btn gold" id="eNovo">+ Produto</button><button class="btn gold" id="eCombo">+ Combo</button><button class="btn" id="eLote">Promoção em lote</button><button class="btn" id="eImp">Importar JSON</button><input type="file" id="eFile" accept=".json,application/json" hidden><button class="btn" id="eSite">Publicar no site (catalog.js)</button><button class="btn" id="eCsv">Exportar CSV</button></div></div>' +
      '<div class="row" style="margin-bottom:.75rem"><input id="eq" placeholder="Buscar produto, código ou barras…" style="max-width:300px" value="' + esc(ui.estoqueQ) + '" aria-label="Buscar"><select id="eCat" style="width:auto" aria-label="Categoria"><option value="todos">Todas as categorias</option>' + Core.CATEGORIAS.map(function (c) { return '<option value="' + c + '"' + (ui.estCat === c ? " selected" : "") + ">" + CATL[c] + "</option>"; }).join("") + '</select><label style="flex-direction:row;align-items:center;gap:.4rem"><input type="checkbox" id="eBaixo" style="width:auto"' + (ui.soBaixo ? " checked" : "") + "> só estoque baixo (" + baixo.length + ")</label></div>" +
      '<div class="panel scroll"><table><tr><th>Cód.</th><th>Produto</th><th>Categoria</th><th class="n">Custo</th><th class="n">Preço</th><th class="n">Estoque</th><th class="n">Mín.</th><th></th></tr>' +
      (lista.map(function (p) {
        var combo = Core.ehCombo(p), disp = Core.disponivel(st, p);
        return "<tr" + (p.ativo === false ? ' style="opacity:.5"' : "") + "><td>" + esc(p.codigo) + "</td><td>" + esc(p.nome) + (combo ? ' <span class="tag">combo</span>' : "") + (p.ativo === false ? ' <span class="tag">inativo</span>' : "") + (combo ? '<div class="small muted">' + esc(compText(p)) + "</div>" : "") + "</td><td>" + esc(CATL[p.categoria] || p.categoria) + '</td><td class="n">' + brl(Core.custoItem(st, p)) + '</td><td class="n">' +
          (Core.emPromo(p) ? '<del class="muted small">' + brl(p.preco) + "</del><br>" + brl(p.precoPromocional) + ' <span class="tag warn">oferta</span>' : brl(p.preco)) + '</td><td class="n ' + (disp <= 0 ? "bad" : (!combo && disp <= p.minimo) ? "warn" : "") + '">' + (combo ? "disp. " : "") + disp + '</td><td class="n">' + (combo ? "—" : p.minimo) + '</td><td class="right">' +
          (combo ? "" : '<button class="btn sm" data-ent="' + p.id + '">Entrada</button> ') + '<button class="btn sm" data-ed="' + p.id + '">Editar</button> <button class="btn sm danger" data-del="' + p.id + '" aria-label="Excluir ' + esc(p.nome) + '">Excluir</button></td></tr>';
      }).join("") || '<tr><td colspan="8" class="muted">Nenhum item. Use “+ Produto” ou “+ Combo”.</td></tr>') + "</table></div>";
    $("#eq").oninput = function (e) { ui.estoqueQ = e.target.value; var pos = e.target.selectionStart; vEstoque(); var n = $("#eq"); n.focus(); n.setSelectionRange(pos, pos); };
    $("#eCat").onchange = function (e) { ui.estCat = e.target.value; vEstoque(); };
    $("#eBaixo").onchange = function (e) { ui.soBaixo = e.target.checked; vEstoque(); };
    $("#eNovo").onclick = function () { prodModal(null, "simples"); };
    $("#eCombo").onclick = function () { prodModal(null, "combo"); };
    $("#eLote").onclick = loteModal;
    view.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return; if (b.dataset.ed) prodModal(+b.dataset.ed); if (b.dataset.ent) entradaModal(+b.dataset.ent);
      if (b.dataset.del) { var pid = +b.dataset.del, pr = Core.achar(st, pid); confirmar("Excluir " + pr.nome + "?", "O item some do PDV e do catálogo. Se já houver vendas dele, o sistema pede para desativar em vez de excluir.", "Excluir", function () { try { Core.excluirProduto(st, pid); log("excluir produto", pr.nome); save(); render(); toast("Item excluído"); } catch (er) { toast(er.message, true); } }, true); }
    };
    $("#eImp").onclick = function () { $("#eFile").click(); };
    $("#eFile").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () { try { var n = Core.importarCatalogo(st, JSON.parse(r.result)); log("importar catálogo", n + " produtos"); save(); render(); toast(n + " produtos importados. Estoque entra zerado: dê entrada em cada item."); } catch (er) { toast("Não foi possível importar: " + er.message, true); } };
      r.readAsText(f);
    };
    $("#eSite").onclick = function () { download("catalog.js", Core.catalogoSite(st), "text/javascript;charset=utf-8"); log("exportar catálogo do site", ""); toast("Substitua js/catalog.js do site por este arquivo e publique de novo"); };
    $("#eCsv").onclick = function () { download("estoque.csv", Core.csv([["Código", "Barras", "Produto", "Tipo", "Categoria", "Custo", "Preço", "Preço promocional", "Estoque/Disp.", "Mínimo"]].concat(st.produtos.map(function (p) { return [p.codigo, p.barras, p.nome, p.tipo || "simples", p.categoria, Core.custoItem(st, p), p.preco, p.precoPromocional || "", Core.disponivel(st, p), p.minimo]; }))), "text/csv;charset=utf-8"); };
  }

  function loteModal() {
    openModal('<h2>Promoção em lote</h2><p class="muted small">Aplica o desconto sobre o preço normal dos itens ativos da seleção. Você ainda pode ajustar item a item depois.</p><div class="stack"><label>Aplicar em<select id="lc"><option value="todos">Todos os itens</option>' + Core.CATEGORIAS.map(function (c) { return '<option value="' + c + '">' + CATL[c] + "</option>"; }).join("") + '</select></label><div class="grid3"><label>Desconto %<input id="lp" inputmode="decimal" value="10"></label><label>Início<input id="li" type="date"></label><label>Fim<input id="lf" type="date"></label></div><div class="err" id="le" role="alert"></div><div class="row sp"><button class="btn danger sm" id="lr">Remover promoções da seleção</button><div class="row"><button class="btn" id="lx">Voltar</button><button class="btn gold" id="lo">Aplicar promoção</button></div></div></div>');
    $("#lx").onclick = closeModal;
    $("#lo").onclick = function () { try { var n = Core.promocaoLote(st, { categoria: $("#lc").value, percent: num($("#lp").value), inicio: $("#li").value, fim: $("#lf").value }); log("promoção em lote", $("#lc").value + " -" + num($("#lp").value) + "% (" + n + " itens)"); save(); closeModal(); render(); toast("Promoção aplicada em " + n + " itens"); } catch (er) { $("#le").textContent = er.message; } };
    $("#lr").onclick = function () { var n = Core.limparPromocoes(st, $("#lc").value); log("remover promoções", $("#lc").value + " (" + n + ")"); save(); closeModal(); render(); toast(n + " promoções removidas"); };
  }

  function prodModal(id, tipoNovo) {
    var existente = id ? Core.achar(st, id) : null, combo = existente ? Core.ehCombo(existente) : tipoNovo === "combo";
    var p = existente || { nome: "", categoria: "outros", codigo: "", barras: "", preco: "", custo: "", estoque: 0, minimo: 0, desc: "", ativo: true, componentes: [] };
    var simples = st.produtos.filter(function (x) { return !Core.ehCombo(x) && x.ativo !== false; }).sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
    var titulo = (id ? "Editar " : "Novo ") + (combo ? "combo" : "produto");
    openModal("<h2>" + titulo + '</h2><div class="stack"><label>Nome<input id="pn" value="' + esc(p.nome) + '" placeholder="' + (combo ? "Ex.: Combo Churrasco" : "Ex.: Cerveja Pilsen 350ml") + '"></label>' +
      '<div class="grid2">' + (combo ? "" : '<label>Categoria<select id="pc">' + Core.CATEGORIAS.filter(function (c) { return c !== "combo"; }).map(function (c) { return '<option value="' + c + '"' + (p.categoria === c ? " selected" : "") + ">" + CATL[c] + "</option>"; }).join("") + "</select></label>") + '<label>Código interno<input id="pk" value="' + esc(p.codigo) + '" placeholder="automático"></label>' + (combo ? "" : '<label>Código de barras<input id="pb" value="' + esc(p.barras) + '"></label>') + "</div>" +
      (combo ? '<div class="panel"><h3>Itens do combo</h3><div id="cmpRows" class="stack"></div><button class="btn sm" id="cmpAdd" type="button" style="margin-top:.5rem">+ Adicionar item</button><div class="notice" id="cmpSum" style="margin-top:.75rem"></div></div>' : "") +
      '<div class="grid3"><label>' + (combo ? "Preço do combo R$" : "Preço R$") + '<input id="pp" inputmode="decimal" value="' + esc(p.preco) + '"></label>' + (combo ? "" : '<label>Custo R$<input id="pcu" inputmode="decimal" value="' + esc(p.custo) + '"></label><label>Estoque mínimo<input id="pm" inputmode="decimal" value="' + esc(p.minimo) + '"></label>') + "</div>" +
      (!combo && !id ? '<label>Estoque inicial<input id="pe" inputmode="decimal" value="0"></label>' : "") +
      '<div class="grid3"><label>Preço promocional R$<input id="ppr" inputmode="decimal" value="' + esc(p.precoPromocional || "") + '" placeholder="opcional"></label><label>Promoção: início<input id="pi" type="date" value="' + esc(p.promoInicio || "") + '"></label><label>Promoção: fim<input id="pf" type="date" value="' + esc(p.promoFim || "") + '"></label></div>' +
      '<label>Imagem (caminho ou URL, aparece no site)<input id="pim" value="' + esc(p.imagem || "") + '" placeholder="assets/produto.webp"></label>' +
      '<label>Descrição (aparece no site)<input id="pd" value="' + esc(p.desc || "") + '"></label><label class="check"><input type="checkbox" id="pa" style="width:auto"' + (p.ativo !== false ? " checked" : "") + "> ativo (aparece no PDV e no site)</label>" +
      '<div class="err" id="pe2" role="alert"></div><div class="row" style="justify-content:flex-end"><button class="btn" id="px">Voltar</button><button class="btn gold" id="ps">Salvar</button></div></div>');
    $("#px").onclick = closeModal;
    function rowHtml(c) {
      return '<div class="cmp-row"><select class="cs" aria-label="Produto">' + simples.map(function (x) { return '<option value="' + x.id + '"' + (c && c.produtoId === x.id ? " selected" : "") + ">" + esc(x.nome) + "</option>"; }).join("") + '</select><input class="cq" inputmode="numeric" value="' + (c ? c.qtd : 1) + '" aria-label="Quantidade"><button class="btn sm danger cx" type="button" aria-label="Remover item">✕</button></div>';
    }
    function lerComps() { return $$(".cmp-row", modal).map(function (r) { return { produtoId: +$(".cs", r).value, qtd: num($(".cq", r).value) }; }); }
    function resumo() {
      if (!combo) return;
      var cs = lerComps(), avulso = 0, custo = 0;
      cs.forEach(function (c) { var q = Core.achar(st, c.produtoId); if (q) { avulso += Core.precoAtual(q) * c.qtd; custo += q.custo * c.qtd; } });
      var pr = num($("#pp").value), econ = avulso - pr;
      $("#cmpSum").innerHTML = "Soma dos itens avulsos: <b>" + brl(avulso) + "</b> · Custo: <b>" + brl(custo) + "</b>" + (pr > 0 ? " · Preço do combo: <b>" + brl(pr) + "</b> · " + (econ >= 0 ? "Cliente economiza <b class=\"ok\">" + brl(econ) + "</b>" : '<b class="bad">Combo mais caro que avulso em ' + brl(-econ) + "</b>") + " · Lucro bruto: <b>" + brl(pr - custo) + "</b>" : "");
    }
    if (combo) {
      if (!simples.length) { $("#cmpRows").innerHTML = '<p class="muted">Cadastre produtos simples antes de montar combos.</p>'; $("#cmpAdd").disabled = true; }
      else (p.componentes && p.componentes.length ? p.componentes : [null]).forEach(function (c) { $("#cmpRows").insertAdjacentHTML("beforeend", rowHtml(c)); });
      $("#cmpAdd").onclick = function () { $("#cmpRows").insertAdjacentHTML("beforeend", rowHtml(null)); resumo(); };
      modal.oninput = resumo; modal.onchange = resumo;
      $("#cmpRows").onclick = function (e) { var b = e.target.closest(".cx"); if (b) { b.closest(".cmp-row").remove(); resumo(); } };
      resumo();
    }
    $("#ps").onclick = function () {
      try {
        Core.salvarProduto(st, { id: id || null, tipo: combo ? "combo" : "simples", nome: $("#pn").value, categoria: combo ? "combo" : $("#pc").value, codigo: $("#pk").value, barras: combo ? "" : $("#pb").value, preco: num($("#pp").value), custo: combo ? 0 : num($("#pcu").value), minimo: combo ? 0 : num($("#pm").value), estoque: combo ? 0 : (id ? p.estoque : num($("#pe").value)), componentes: combo ? lerComps() : [], desc: $("#pd").value, ativo: $("#pa").checked, precoPromocional: num($("#ppr").value), promoInicio: $("#pi").value, promoFim: $("#pf").value, imagem: $("#pim").value });
        log(id ? "editar " + (combo ? "combo" : "produto") : "novo " + (combo ? "combo" : "produto"), $("#pn").value + (id && p.preco !== num($("#pp").value) ? " — preço " + brl(p.preco) + " → " + brl(num($("#pp").value)) : ""));
        save(); closeModal(); render(); toast(combo ? "Combo salvo" : "Produto salvo");
      } catch (e) { $("#pe2").textContent = e.message; }
    };
  }
  function entradaModal(id) {
    var p = Core.achar(st, id);
    openModal("<h2>Entrada / ajuste de estoque</h2><p class='muted'>" + esc(p.nome) + " — atual: <b>" + p.estoque + '</b></p><div class="stack"><label>Quantidade (use negativo para baixa/perda)<input id="eq1" inputmode="decimal" value="1"></label><label>Motivo<input id="eq2" placeholder="Compra, perda, quebra, contagem…"></label><div class="err" id="eq3"></div><div class="row" style="justify-content:flex-end"><button class="btn" id="eqx">Voltar</button><button class="btn gold" id="eqo">Confirmar</button></div></div>');
    $("#eqx").onclick = closeModal;
    $("#eqo").onclick = function () { try { Core.entradaEstoque(st, id, num($("#eq1").value), $("#eq2").value); log("estoque", p.nome + " " + num($("#eq1").value) + " — " + $("#eq2").value); save(); closeModal(); render(); toast("Estoque atualizado"); } catch (e) { $("#eq3").textContent = e.message; } };
  }

  /* =========================== VENDAS =========================== */
  function vVendas() {
    var cxa = Core.caixaAberto(st), vs = st.vendas.filter(function (v) { if (!isAdmin()) return !!cxa && v.caixaId === cxa.id; var d = new Date(v.data); return d >= dia(ui.vendasDia) && d <= dia(ui.vendasDia, true); }).reverse();
    view.innerHTML = '<div class="row sp"><h2>Vendas' + (isAdmin() ? "" : " do caixa atual") + "</h2>" + (isAdmin() ? '<input type="date" id="vd" value="' + ui.vendasDia + '" style="width:auto">' : "") + '</div><div class="panel scroll"><table><tr><th>#</th><th>Hora</th><th>Itens</th><th>Pagamento</th><th class="n">Total</th><th>Status</th><th></th></tr>' +
      (vs.map(function (v) { return "<tr><td>" + v.id + "</td><td>" + hr(v.data) + "</td><td>" + v.itens.reduce(function (s, i) { return s + i.qtd; }, 0) + "</td><td>" + v.pagamentos.map(function (p) { return FL[p.forma]; }).join(" + ") + '</td><td class="n">' + brl(v.total) + "</td><td>" + (v.status === "cancelada" ? '<span class="tag bad">cancelada</span>' : '<span class="tag">ok</span>') + '</td><td class="right"><button class="btn sm" data-ver="' + v.id + '">Ver</button>' + (v.status === "concluida" ? ' <button class="btn sm danger" data-can="' + v.id + '">Cancelar</button>' : "") + "</td></tr>"; }).join("") || '<tr><td colspan="7" class="muted">Nenhuma venda nesta data.</td></tr>') + "</table></div>";
    if (isAdmin()) $("#vd").onchange = function (e) { ui.vendasDia = e.target.value || hoje(); vVendas(); };
    view.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.ver) mostrarVenda(st.vendas.filter(function (v) { return v.id === +b.dataset.ver; })[0], false);
      if (b.dataset.can) {
        var id = +b.dataset.can;
        pedirAdmin("Cancelar a venda #" + id + " exige autorização de um administrador.", function (adm) { cancelarModal(id, adm); });
      }
    };
  }
  function cancelarModal(id, adm) {
    {
      {
        openModal("<h2>Cancelar venda #" + id + '</h2><p class="muted">Os itens voltam ao estoque. Só é possível com o caixa da venda ainda aberto.</p><label>Motivo<input id="cm" autocomplete="off"></label><div class="err" id="ce"></div><div class="row" style="justify-content:flex-end;margin-top:.5rem"><button class="btn" id="cx1">Voltar</button><button class="btn danger" id="cx2">Cancelar venda</button></div>');
        $("#cx1").onclick = closeModal;
        $("#cx2").onclick = function () { try { Core.cancelarVenda(st, id, $("#cm").value); log("cancelar venda", "#" + id + " — " + $("#cm").value + " (autorizado por " + adm.usuario + ")"); save(); closeModal(); render(); toast("Venda cancelada"); } catch (er) { $("#ce").textContent = er.message; } };
      }
    }
  }

  /* =========================== RELATÓRIOS =========================== */
  function periodo() {
    var d = new Date(), fim = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999), ini;
    if (ui.relPeriodo === "hoje") ini = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    else if (ui.relPeriodo === "7") ini = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
    else if (ui.relPeriodo === "30") ini = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29);
    else ini = new Date(d.getFullYear(), d.getMonth(), 1);
    return [ini, fim];
  }
  function vRel() {
    var p = periodo(), r = Core.relatorio(st, p[0], p[1]);
    view.innerHTML = '<div class="row sp"><h2>Relatórios</h2><div class="row"><select id="rp" style="width:auto"><option value="hoje">Hoje</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="mes">Mês atual</option></select><button class="btn" id="rcsv">Exportar vendas (CSV)</button></div></div>' +
      '<div class="cards"><div class="card"><small>Vendas</small><b>' + r.qtdVendas + '</b></div><div class="card"><small>Faturamento</small><b>' + brl(r.total) + '</b></div><div class="card"><small>Lucro bruto (preço − custo)</small><b>' + brl(r.lucro) + '</b></div><div class="card"><small>Ticket médio</small><b>' + brl(r.ticket) + '</b></div><div class="card"><small>Descontos</small><b>' + brl(r.descontos) + "</b></div></div>" +
      '<div class="grid2"><div class="panel"><h3>Por forma de pagamento</h3><table>' + Core.FORMAS.map(function (f) { return "<tr><td>" + FL[f] + '</td><td class="n">' + brl(r.porForma[f]) + "</td></tr>"; }).join("") + '</table></div><div class="panel"><h3>Mais vendidos</h3><table><tr><th>Produto</th><th class="n">Qtd</th><th class="n">Receita</th></tr>' +
      (r.top.slice(0, 10).map(function (t) { return "<tr><td>" + esc(t.nome) + '</td><td class="n">' + t.qtd + '</td><td class="n">' + brl(t.receita) + "</td></tr>"; }).join("") || '<tr><td colspan="3" class="muted">Sem vendas no período.</td></tr>') + "</table></div></div>" +
      (Core.estoqueBaixo(st).length ? '<div class="panel" style="margin-top:1rem"><h3>Reposição necessária</h3><table>' + Core.estoqueBaixo(st).map(function (x) { return "<tr><td>" + esc(x.nome) + '</td><td class="n ' + (x.estoque <= 0 ? "bad" : "warn") + '">' + x.estoque + " (mín. " + x.minimo + ")</td></tr>"; }).join("") + "</table></div>" : "");
    $("#rp").value = ui.relPeriodo; $("#rp").onchange = function (e) { ui.relPeriodo = e.target.value; vRel(); };
    $("#rcsv").onclick = function () {
      var rows = [["Venda", "Data", "Operador", "Itens", "Subtotal", "Desconto", "Total", "Pagamentos", "Troco"]];
      r.vendas.forEach(function (v) { rows.push([v.id, dt(v.data), v.operador, v.itens.map(function (i) { return i.qtd + "x " + i.nome; }).join(" | "), v.subtotal, v.desconto, v.total, v.pagamentos.map(function (x) { return FL[x.forma] + " " + x.valor; }).join(" | "), v.troco]); });
      download("vendas.csv", Core.csv(rows), "text/csv;charset=utf-8");
    };
  }

  /* =========================== CONFIG =========================== */
  function vConfig() {
    var us = Auth.listar(), aud = st.auditoria.slice(-40).reverse();
    view.innerHTML = '<h2>Configurações</h2><div class="stack" style="max-width:820px">' +
      '<div class="panel stack"><h3>Loja e regras</h3><div class="grid2"><label>Nome no cupom<input id="cl" value="' + esc(st.config.loja) + '"></label><label>Desconto máximo do vendedor (%)<input id="cdm" inputmode="decimal" value="' + esc(st.config.descontoMaxVendedor) + '"></label></div><p class="muted small">Acima desse desconto, o vendedor precisa da senha de um administrador.</p><button class="btn gold" id="cls">Salvar</button></div>' +
      '<div class="panel stack"><div class="row sp"><h3>Usuários</h3><div class="row"><button class="btn sm" id="uMy">Alterar minha senha</button><button class="btn sm gold" id="uNew">+ Novo usuário</button></div></div><div class="scroll"><table><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Status</th><th></th></tr>' +
      us.map(function (u) { return "<tr><td>" + esc(u.nome) + "</td><td>" + esc(u.usuario) + "</td><td>" + Auth.PAPEIS[u.papel] + "</td><td>" + (u.ativo ? '<span class="tag">ativo</span>' : '<span class="tag bad">desativado</span>') + '</td><td class="right"><button class="btn sm" data-rs="' + u.id + '">Redefinir senha</button> ' + (u.id === user.id ? "" : '<button class="btn sm ' + (u.ativo ? "danger" : "") + '" data-tg="' + u.id + '">' + (u.ativo ? "Desativar" : "Reativar") + "</button>") + "</td></tr>"; }).join("") + '</table></div></div>' +
      '<div class="panel stack"><h3>Publicar catálogo no site</h3><p class="muted small">1) Edite produtos, preços e promoções em <b>Estoque</b>. 2) Clique em <b>Publicar no site (catalog.js)</b>. 3) Substitua o arquivo <code>js/catalog.js</code> do site e envie de novo para a hospedagem. Clientes só veem a mudança depois desse envio.</p><button class="btn" id="goEst">Ir para Estoque</button></div>' +
      '<div class="panel stack"><h3>Registro de atividades (últimas 40)</h3><div class="scroll"><table><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr>' + (aud.map(function (a) { return "<tr><td>" + dt(a.data) + "</td><td>" + esc(a.usuario) + "</td><td>" + esc(a.acao) + "</td><td>" + esc(a.detalhe) + "</td></tr>"; }).join("") || '<tr><td colspan="4" class="muted">Sem registros.</td></tr>') + '</table></div></div>' +
      '<div class="panel stack"><h3>Backup</h3><p class="muted small">Os dados ficam neste navegador. O backup inclui produtos, vendas, caixas e registros — <b>não</b> inclui usuários e senhas.</p><div class="row"><button class="btn" id="bk">Baixar backup (.json)</button><label class="btn" style="flex-direction:row;cursor:pointer">Restaurar backup<input type="file" id="rs" accept=".json,application/json" hidden></label></div></div>' +
      '<div class="panel stack"><h3>Zona de perigo</h3><p class="muted small">Apaga produtos de exemplo, vendas e caixas deste navegador. Baixe um backup antes.</p><button class="btn danger" id="wipe">Apagar tudo</button></div></div>';
    $("#cls").onclick = function () { var m = num($("#cdm").value); if (m < 0 || m > 100) return toast("Desconto máximo deve ficar entre 0 e 100.", true); st.config.loja = $("#cl").value.trim() || "Adega Prime"; st.config.descontoMaxVendedor = m; log("config", "loja/desconto máx " + m + "%"); save(); toast("Salvo"); };
    $("#goEst").onclick = function () { ui.tab = "estoque"; render(); };
    $("#uNew").onclick = userModal; $("#uMy").onclick = minhaSenhaModal;
    view.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.rs) resetModal(+b.dataset.rs);
      if (b.dataset.tg) { var id = +b.dataset.tg, alvo = us.filter(function (x) { return x.id === id; })[0]; try { Auth.setAtivo(id, !alvo.ativo, user.id); log(alvo.ativo ? "desativar usuário" : "reativar usuário", alvo.usuario); save(); render(); } catch (er) { toast(er.message, true); } }
    };
    $("#bk").onclick = function () { log("backup", "download"); save(); download("backup-adega-pdv-" + hoje() + ".json", JSON.stringify(st), "application/json"); };
    $("#rs").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { try { var s = JSON.parse(rd.result); if (!s || !s.versao || !Array.isArray(s.produtos) || !Array.isArray(s.vendas)) throw 0; confirmar("Restaurar backup?", "Isso substitui TODOS os dados atuais (produtos, vendas e caixas) pelos do arquivo.", "Restaurar", function () { st = Object.assign(Core.novoEstado(), s); log("restaurar backup", ""); save(); ui.cart = []; render(); toast("Backup restaurado"); }, true); } catch (er) { toast("Arquivo de backup inválido", true); } };
      rd.readAsText(f);
    };
    $("#wipe").onclick = function () {
      openModal('<h2>Apagar tudo</h2><p class="muted">Digite <b>APAGAR</b> para confirmar.</p><input id="wc" autocomplete="off"><div class="row" style="justify-content:flex-end;margin-top:.75rem"><button class="btn" id="w1">Voltar</button><button class="btn danger" id="w2">Apagar</button></div>');
      $("#w1").onclick = closeModal;
      $("#w2").onclick = function () { if ($("#wc").value.trim() !== "APAGAR") return; st = Core.novoEstado(); log("apagar tudo", ""); save(); ui.cart = []; closeModal(); render(); toast("Dados apagados"); };
    };
  }
  function userModal() {
    openModal('<h2>Novo usuário</h2><form id="fU" class="stack" novalidate><label>Nome<input id="unm" autocomplete="off"></label><div class="grid2"><label>Usuário (login)<input id="uus" autocomplete="off" autocapitalize="none"></label><label>Perfil<select id="upf"><option value="vendedor">Vendedor</option><option value="admin">Administrador</option></select></label></div><label>Senha (mín. 8 caracteres)<input id="upw" type="password" autocomplete="new-password"></label><label class="check"><input type="checkbox" id="ush" style="width:auto"> mostrar senha</label><p class="muted small">O vendedor vende, abre/fecha caixa e vê as vendas do caixa atual. Não vê custos, lucro, estoque, relatórios nem configurações.</p><div class="err" id="ue" role="alert"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="ux">Voltar</button><button class="btn gold" type="submit" id="uok">Criar usuário</button></div></form>');
    $("#ush").onchange = function (e) { $("#upw").type = e.target.checked ? "text" : "password"; };
    $("#ux").onclick = closeModal;
    $("#fU").onsubmit = function (e) {
      e.preventDefault(); var b = $("#uok"); b.disabled = true;
      Auth.criarUsuario({ nome: $("#unm").value, usuario: $("#uus").value, papel: $("#upf").value, senha: $("#upw").value, _autorizado: true })
        .then(function (u) { log("criar usuário", u.usuario + " (" + Auth.PAPEIS[u.papel] + ")"); save(); closeModal(); render(); toast("Usuário criado"); })
        .catch(function (er) { $("#ue").textContent = er.message; b.disabled = false; });
    };
  }
  function resetModal(id) {
    var alvo = Auth.listar().filter(function (x) { return x.id === id; })[0];
    openModal("<h2>Redefinir senha</h2><p class=\"muted\">" + esc(alvo.nome) + " (" + esc(alvo.usuario) + ')</p><form id="fR" class="stack" novalidate><label>Nova senha (mín. 8 caracteres)<input id="rpw" type="password" autocomplete="new-password"></label><div class="err" id="re" role="alert"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="rx">Voltar</button><button class="btn gold" type="submit" id="rok">Salvar senha</button></div></form>');
    $("#rx").onclick = closeModal;
    $("#fR").onsubmit = function (e) { e.preventDefault(); $("#rok").disabled = true; Auth.redefinirSenha(id, $("#rpw").value).then(function () { log("redefinir senha", alvo.usuario); save(); closeModal(); toast("Senha redefinida"); }).catch(function (er) { $("#re").textContent = er.message; $("#rok").disabled = false; }); };
  }
  function minhaSenhaModal() {
    openModal('<h2>Alterar minha senha</h2><form id="fM" class="stack" novalidate><label>Senha atual<input id="mp0" type="password" autocomplete="current-password"></label><label>Nova senha (mín. 8 caracteres)<input id="mp1" type="password" autocomplete="new-password"></label><div class="err" id="me2" role="alert"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="mx">Voltar</button><button class="btn gold" type="submit" id="mok">Alterar</button></div></form>');
    $("#mx").onclick = closeModal;
    $("#fM").onsubmit = function (e) { e.preventDefault(); $("#mok").disabled = true; Auth.alterarMinhaSenha(user.id, $("#mp0").value, $("#mp1").value).then(function () { log("alterar própria senha", ""); save(); closeModal(); toast("Senha alterada"); }).catch(function (er) { $("#me2").textContent = er.message; $("#mok").disabled = false; }); };
  }

  function ajuda() {
    openModal('<h2>Ajuda rápida</h2><div class="stack small"><div><h3>Fluxo do dia</h3><p>1) <b>Caixa ▸ Abrir caixa</b> com o troco inicial · 2) <b>Venda</b>: bipe ou toque nos produtos e finalize · 3) <b>Caixa ▸ Fechar caixa</b> contando o dinheiro da gaveta.</p></div>' +
      '<div><h3>Atalhos (tela Venda)</h3><p><kbd>F1</kbd> ajuda · <kbd>F2</kbd> buscar/bipar · <kbd>F4</kbd> finalizar · <kbd>F8</kbd> descartar venda · <kbd>Enter</kbd> confirma pagamento · <kbd>Esc</kbd> fecha janelas</p><p>Quantidade rápida: digite <kbd>3*código</kbd> e Enter.</p></div>' +
      '<div><h3>Errou?</h3><p>Item removido: toque em <b>Desfazer</b>. Venda já feita: <b>Vendas ▸ Cancelar</b> (devolve ao estoque, só com o caixa aberto). Contagem errada: <b>Estoque ▸ Entrada</b> com quantidade negativa.</p></div>' +
      '<div><h3>Seus dados</h3><p>Ficam só neste navegador. Baixe o backup em <b>Config</b> todo dia.</p></div></div><div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn gold" id="hOk">Entendi</button></div>');
    $("#hOk").onclick = closeModal;
  }
  $("#btnAjuda").onclick = ajuda;
  window.addEventListener("beforeunload", function (e) { if (ui.cart.length) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Atalhos ---------- */
  document.addEventListener("keydown", function (e) {
    if (!user) return;
    if (e.key === "F1") { e.preventDefault(); return ajuda(); }
    if (e.key === "Escape" && !modalBg.hidden) return closeModal();
    if (!modalBg.hidden || ui.tab !== "venda" || !Core.caixaAberto(st)) return;
    if (e.key === "F2") { e.preventDefault(); $("#busca").focus(); }
    if (e.key === "F4") { e.preventDefault(); finalizar(); }
    if (e.key === "F8") { e.preventDefault(); limparVenda(); }
  });

  render();
})();
