(function () {
  "use strict";
  var CFG = window.ADEGA || {};
  var PRODUCTS = (window.CATALOGO || []).slice();
  var CART_KEY = "adega_cart_v2", AGE_KEY = "adega_age_ok", CLI_KEY = "adega_cliente_v1", CONSENT_KEY = "adega_analytics_consent";

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var brl = function (n) { return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

  var CAT_LABEL = { combo: "Combo", cerveja: "Cerveja", whisky: "Whisky", vinho: "Vinho", destilado: "Destilado", espumante: "Espumante", outros: "Outros" };
  var ICONS = {
    vinho: '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M19 2h10v14c0 2 5 4 8 10 4 7 5 14 5 20 0 9-8 16-18 16S6 55 6 46c0-6 1-13 5-20 3-6 8-8 8-10z"/></svg>',
    cerveja: '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M20 4h8v14l4 4v34c0 3.3-2.7 6-6 6h-4c-3.3 0-6-2.7-6-6V22l4-4z"/></svg>',
    destilado: '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M17 2h14v8l-5 6v6h6c2.2 0 4 1.8 4 4v30c0 3.3-2.7 6-6 6H18c-3.3 0-6-2.7-6-6V26c0-2.2 1.8-4 4-4h6v-6l-5-6z"/></svg>'
  };
  ICONS.combo = ICONS.cerveja; ICONS.whisky = ICONS.destilado; ICONS.espumante = ICONS.vinho; ICONS.outros = ICONS.cerveja;

  /* ---------- Feedback (toast com ação "Desfazer") ---------- */
  var toastT;
  function toast(msg, actionLabel, onAction) {
    var t = $("#toast"), b = $("#toastAct");
    $("#toastMsg").textContent = msg;
    b.hidden = !actionLabel; b.textContent = actionLabel || ""; b.onclick = function () { if (onAction) onAction(); t.classList.remove("show"); };
    t.classList.add("show"); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("show"); }, actionLabel ? 6000 : 2200);
  }
  function waUrl(text) { return "https://wa.me/" + String(CFG.whatsapp || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text); }
  function openWA(text) { var u = waUrl(text); var w = window.open(u, "_blank", "noopener,noreferrer"); return u; }

  /* ---------- Verificação de idade ---------- */
  (function () {
    var gate = $("#agegate");
    if (lsGet(AGE_KEY) === "1") return;
    gate.hidden = false; document.body.style.overflow = "hidden";
    $("#ageYes").addEventListener("click", function () { lsSet(AGE_KEY, "1"); gate.hidden = true; document.body.style.overflow = ""; });
    $("#ageNo").addEventListener("click", function () {
      document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;text-align:center;padding:2rem;font-family:sans-serif;background:#0e0c09;color:#f3ecde"><p>Este site é destinado apenas a maiores de 18 anos.</p></div>';
    });
    $("#ageYes").focus();
  })();

  /* ---------- Menu mobile ---------- */
  var menuBtn = $("#menuBtn"), nav = $("#nav");
  function closeMenu() { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () { var o = nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(o)); });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", closeMenu); });

  /* ---------- Horário / informações ---------- */
  function toMin(hhmm) { var p = String(hhmm || "0:0").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function isOpenNow() {
    var h = CFG.horario; if (!h) return null;
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), a = toMin(h.abre), f = toMin(h.fecha);
    return a < f ? (m >= a && m < f) : (m >= a || m < f);
  }
  (function infos() {
    var h = CFG.horario, st = $("#status"), open = isOpenNow();
    if (h && open !== null) {
      st.hidden = false; st.className = "status " + (open ? "open" : "closed");
      st.textContent = open ? "Aberto agora · até " + h.fecha : "Fechado agora · abre às " + h.abre;
    }
    $("#infoHorario").textContent = h ? "Todos os dias, das " + h.abre + " às " + h.fecha + "." : "Consulte pelo WhatsApp.";
    $("#infoPagamento").textContent = (CFG.formasPagamento || []).join(", ") || "Consulte pelo WhatsApp.";
    var ent = [CFG.taxaEntrega > 0 ? "Taxa de entrega: " + brl(CFG.taxaEntrega) + "." : "Taxa de entrega informada no atendimento."];
    if (CFG.pedidoMinimo > 0) ent.push("Pedido mínimo: " + brl(CFG.pedidoMinimo) + ".");
    $("#infoEntrega").textContent = ent.join(" ");
    var loc = $("#infoLocal");
    if (CFG.endereco) {
      loc.textContent = CFG.endereco + " ";
      if (CFG.mapsLink) { var a = document.createElement("a"); a.href = CFG.mapsLink; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Ver no mapa"; loc.appendChild(a); }
    } else loc.textContent = "Endereço informado no atendimento.";
    $("#year").textContent = new Date().getFullYear();
  })();

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-wa]"); if (!el) return;
    e.preventDefault(); openWA(el.getAttribute("data-wa"));
  });

  /* ---------- Carrinho ---------- */
  var cart = {};
  try { cart = JSON.parse(lsGet(CART_KEY) || "{}") || {}; } catch (e) { cart = {}; }
  function saveCart() { lsSet(CART_KEY, JSON.stringify(cart)); }
  function precoAtual(p) {
    var hoje = new Date(), d = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") + "-" + String(hoje.getDate()).padStart(2, "0");
    var pr = Number(p.precoPromocional);
    return pr > 0 && pr < p.preco && (!p.promoInicio || d >= p.promoInicio) && (!p.promoFim || d <= p.promoFim) ? pr : p.preco;
  }
  function emPromo(p) { return precoAtual(p) < p.preco; }
  function byId(id) { return PRODUCTS.filter(function (p) { return String(p.id) === String(id); })[0]; }
  function cleanCart() { Object.keys(cart).forEach(function (id) { var p = byId(id); if (!p || p.disponivel === false || !(cart[id] > 0)) delete cart[id]; }); }
  function cartLines() { return Object.keys(cart).map(function (id) { var p = byId(id); return p ? { p: p, q: cart[id] } : null; }).filter(Boolean); }
  function subtotal() { return cartLines().reduce(function (s, l) { return s + precoAtual(l.p) * l.q; }, 0); }
  function isEntrega() { var r = $('input[name="tipo"]:checked', $("#checkout")); return !r || r.value === "entrega"; }
  function taxa() { return isEntrega() && CFG.taxaEntrega > 0 ? CFG.taxaEntrega : 0; }

  function setQty(id, q, silent) {
    id = String(id); var antes = cart[id] || 0;
    if (q <= 0) delete cart[id]; else cart[id] = Math.min(q, 99);
    if ((cart[id] || 0) > antes) bumpCart();
    saveCart(); renderCart(); renderCardFoot(id);
  }
  function renderCart() {
    var lines = cartLines(), n = lines.reduce(function (s, l) { return s + l.q; }, 0), sub = subtotal();
    $("#cartCount").textContent = n;
    $("#cartOpen").setAttribute("aria-label", "Abrir carrinho, " + n + (n === 1 ? " item" : " itens"));
    $("#cartEmpty").hidden = lines.length > 0;
    $("#checkout").hidden = lines.length === 0;
    $("#drawerFoot").hidden = lines.length === 0;
    $("#cartItems").innerHTML = lines.map(function (l) {
      return '<div class="line"><div><h4>' + esc(l.p.nome) + '</h4><small>' + brl(precoAtual(l.p)) + ' cada</small>' +
        '<div class="qty"><button type="button" data-q="-1" data-id="' + esc(l.p.id) + '" aria-label="Diminuir ' + esc(l.p.nome) + '">−</button><span aria-live="polite">' + l.q + '</span><button type="button" data-q="1" data-id="' + esc(l.p.id) + '" aria-label="Aumentar ' + esc(l.p.nome) + '">+</button></div></div>' +
        '<div class="lt">' + brl(precoAtual(l.p) * l.q) + '</div><button type="button" class="rm" data-rm="' + esc(l.p.id) + '">remover</button></div>';
    }).join("");
    $("#sumSub").textContent = brl(sub);
    $("#sumEntregaRow").hidden = !isEntrega();
    $("#sumEntrega").textContent = CFG.taxaEntrega > 0 ? brl(CFG.taxaEntrega) : "a combinar";
    $("#sumTotal").textContent = brl(sub + taxa());
    var mn = $("#minNotice");
    if (CFG.pedidoMinimo > 0 && sub < CFG.pedidoMinimo && lines.length) { mn.hidden = false; mn.textContent = "Faltam " + brl(CFG.pedidoMinimo - sub) + " para o pedido mínimo de " + brl(CFG.pedidoMinimo) + "."; }
    else mn.hidden = true;
    var bar = $("#cartBar"); bar.classList.toggle("has", n > 0);
    $("#cartBarTxt").textContent = "Ver carrinho · " + n + (n === 1 ? " item" : " itens"); $("#cartBarTotal").textContent = brl(sub);
    $("#sent").hidden = true;
  }
  $("#cartItems").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm) {
      var id = b.dataset.rm, prev = cart[id], p = byId(id);
      setQty(id, 0); toast((p ? p.nome : "Item") + " removido", "Desfazer", function () { setQty(id, prev); });
      return;
    }
    if (b.dataset.q) setQty(b.dataset.id, (cart[b.dataset.id] || 0) + (+b.dataset.q));
  });
  function limparCarrinho(comDesfazer) {
    var snap = JSON.parse(JSON.stringify(cart)); cart = {}; saveCart(); renderCart(); renderGrid();
    if (comDesfazer) toast("Carrinho limpo", "Desfazer", function () { cart = snap; saveCart(); renderCart(); renderGrid(); });
  }
  $("#clearCart").addEventListener("click", function () { limparCarrinho(true); });
  $("#sentClear").addEventListener("click", function () { limparCarrinho(false); closeCart(); toast("Carrinho limpo"); });

  /* Drawer com foco gerenciado */
  var drawer = $("#drawer"), overlay = $("#overlay"), lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement; drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
    overlay.classList.add("show"); document.body.style.overflow = "hidden"; $("#cartClose").focus();
  }
  function closeCart() {
    drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); overlay.classList.remove("show"); document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $("#cartOpen").addEventListener("click", openCart); $("#cartBar").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart); overlay.addEventListener("click", closeCart);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (drawer.classList.contains("open")) closeCart(); closeMenu(); }
    if (e.key === "Tab" && drawer.classList.contains("open")) {
      var f = $$("button,input,select,a[href],textarea", drawer).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Checkout ---------- */
  var pay = $("#pagamento"), form = $("#checkout");
  pay.innerHTML = (CFG.formasPagamento || ["Pix"]).map(function (f) { return "<option>" + esc(f) + "</option>"; }).join("");
  (function restore() {
    try {
      var c = JSON.parse(lsGet(CLI_KEY) || "null"); if (!c) return;
      form.elements.nome.value = c.nome || ""; form.elements.endereco.value = c.endereco || "";
      if (c.pagamento) pay.value = c.pagamento;
      if (c.tipo) { var r = $('input[name="tipo"][value="' + c.tipo + '"]', form); if (r) r.checked = true; }
    } catch (e) {}
  })();
  function syncCheckout() {
    $("#enderecoWrap").hidden = !isEntrega();
    $("#trocoWrap").hidden = !/dinheiro/i.test(pay.value);
    renderCart();
  }
  form.addEventListener("change", syncCheckout);
  function setErr(name, msg) {
    var el = form.elements[name], e = $("#e-" + name);
    if (el) el.classList.toggle("invalid", !!msg); if (el) el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (e) { e.textContent = msg || ""; e.classList.toggle("show", !!msg); }
  }
  ["nome", "endereco", "troco"].forEach(function (n) { form.elements[n].addEventListener("input", function () { setErr(n, ""); $("#orderError").textContent = ""; }); });
  function parseMoney(s) { var v = parseFloat(String(s).replace(/\./g, function (m, i, str) { return str.indexOf(",") > -1 ? "" : m; }).replace(",", ".")); return isFinite(v) ? v : NaN; }

  $("#sendOrder").addEventListener("click", function () {
    var err = $("#orderError"); err.textContent = ""; ["nome", "endereco", "troco"].forEach(function (n) { setErr(n, ""); });
    var lines = cartLines(); if (!lines.length) return;
    var f = form.elements, nome = f.nome.value.trim(), ent = isEntrega(), end = f.endereco.value.trim(), sub = subtotal(), bad = null;
    if (!nome) { setErr("nome", "Informe seu nome para identificarmos o pedido."); bad = bad || "nome"; }
    if (ent && !end) { setErr("endereco", "Informe o endereço para entrega (rua, número e bairro)."); bad = bad || "endereco"; }
    var trocoTxt = f.troco.value.trim(), trocoVal = null;
    if (/dinheiro/i.test(pay.value) && trocoTxt) {
      trocoVal = parseMoney(trocoTxt);
      if (isNaN(trocoVal) || trocoVal < sub + taxa()) { setErr("troco", "Informe um valor igual ou maior que o total (" + brl(sub + taxa()) + ")."); bad = bad || "troco"; }
    }
    if (CFG.pedidoMinimo > 0 && sub < CFG.pedidoMinimo) { err.textContent = "Pedido mínimo: " + brl(CFG.pedidoMinimo) + ". Adicione mais itens."; return; }
    if (bad) { f[bad].focus(); err.textContent = "Corrija os campos destacados."; return; }
    var t = taxa(), msg = ["*Novo pedido — " + (CFG.nome || "Adega") + "*", ""];
    lines.forEach(function (l) { msg.push(l.q + "x " + l.p.nome + " — " + brl(precoAtual(l.p) * l.q)); });
    msg.push("", "Subtotal: " + brl(sub));
    if (ent) msg.push("Entrega: " + (t > 0 ? brl(t) : "a combinar"));
    msg.push("*Total: " + brl(sub + t) + "*" + (ent && !t ? " (+ entrega)" : ""), "", "Nome: " + nome, ent ? "Entrega em: " + end : "Retirada no local", "Pagamento: " + pay.value);
    if (trocoVal) msg.push("Troco para: " + brl(trocoVal));
    if (f.obs.value.trim()) msg.push("Obs.: " + f.obs.value.trim());
    if (f.lembrar.checked) lsSet(CLI_KEY, JSON.stringify({ nome: nome, endereco: end, pagamento: pay.value, tipo: ent ? "entrega" : "retirada" }));
    var url = openWA(msg.join("\n"));
    $("#sentLink").href = url; $("#sent").hidden = false;
  });

  /* ---------- Catálogo ---------- */
  var state = { cat: "todos", q: "", sort: "padrao" };
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function comboInfo(p) {
    if (!p.combo || !p.itens) return "";
    var txt = p.itens.map(function (i) { return i.qtd + "× " + i.nome; }).join(" + "), econ = (Number(p.valorAvulso) || 0) - precoAtual(p);
    return '<p class="inclui">Inclui: ' + esc(txt) + "</p>" + (econ > 0.009 ? '<p class="economia">Economize ' + brl(econ) + "</p>" : "");
  }
  function footHtml(p) {
    var q = cart[String(p.id)] || 0, off = p.disponivel === false;
    if (off) return '<span class="price">' + (emPromo(p) ? "<del>" + brl(p.preco) + "</del>" : "") + brl(precoAtual(p)) + '</span><button class="add" disabled>Indisponível</button>';
    var ctl = q > 0
      ? '<span class="stepper"><button type="button" data-dec="' + esc(p.id) + '" aria-label="Diminuir ' + esc(p.nome) + '">−</button><span aria-live="polite">' + q + '</span><button type="button" data-inc="' + esc(p.id) + '" aria-label="Aumentar ' + esc(p.nome) + '">+</button></span>'
      : '<button class="add" data-add="' + esc(p.id) + '" aria-label="Adicionar ' + esc(p.nome) + ' ao carrinho">Adicionar</button>';
    return '<span class="price">' + (emPromo(p) ? "<del>" + brl(p.preco) + "</del>" : "") + brl(precoAtual(p)) + '</span>' + ctl;
  }
  function renderCardFoot(id) {
    var card = $('[data-card="' + id + '"]'); if (!card) return;
    var focusKey = document.activeElement && (document.activeElement.dataset.inc || document.activeElement.dataset.dec) ? "inc" : null;
    $(".card-foot", card).innerHTML = footHtml(byId(id));
    if (focusKey) { var b = $("[data-inc]", card) || $("[data-add]", card); if (b) b.focus(); }
  }
  function renderGrid() {
    var q = norm(state.q);
    var list = PRODUCTS.filter(function (p) { return (state.cat === "todos" || p.categoria === state.cat) && (!q || norm(p.nome + " " + (p.desc || "")).indexOf(q) > -1); });
    if (state.sort === "menor") list.sort(function (a, b) { return precoAtual(a) - precoAtual(b); });
    else if (state.sort === "maior") list.sort(function (a, b) { return precoAtual(b) - precoAtual(a); });
    else if (state.sort === "nome") list.sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
    $("#grid").innerHTML = list.map(function (p) {
      var off = p.disponivel === false;
      var img = p.imagem ? '<img src="' + esc(p.imagem) + '" alt="' + esc(p.nome) + '" loading="lazy">' : (ICONS[p.categoria] || ICONS.outros);
      return '<article class="card reveal' + (off ? " off" : "") + '" data-card="' + esc(p.id) + '"><div class="card-img">' + (emPromo(p) ? '<span class="badge-promo">OFERTA</span>' : p.combo ? '<span class="badge-promo">COMBO</span>' : "") + img + '</div><div class="card-body">' +
        '<span class="card-cat">' + esc(CAT_LABEL[p.categoria] || p.categoria) + '</span><h3>' + esc(p.nome) + '</h3>' + (p.desc ? "<p>" + esc(p.desc) + "</p>" : "") + comboInfo(p) +
        '<div class="card-foot">' + footHtml(p) + '</div></div></article>';
    }).join("");
    $$("#grid .card").forEach(function (c, i) { c.style.setProperty("--d", (i % 8) * 70 + "ms"); });
    observeReveals();
    $("#empty").hidden = list.length > 0;
    $("#count").textContent = list.length + (list.length === 1 ? " produto" : " produtos") + (state.cat !== "todos" || state.q ? " encontrados" : "");
  }
  $("#grid").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.add) { var id = b.dataset.add, p = byId(id); flyToCart(b); setQty(id, 1); toast((p ? p.nome : "Item") + " adicionado", "Ver carrinho", openCart); var n = $('[data-card="' + id + '"] [data-inc]'); if (n) n.focus(); }
    else if (b.dataset.inc) setQty(b.dataset.inc, (cart[b.dataset.inc] || 0) + 1);
    else if (b.dataset.dec) setQty(b.dataset.dec, (cart[b.dataset.dec] || 0) - 1);
  });
  $("#filters").addEventListener("click", function (e) {
    var c = e.target.closest(".chip"); if (!c) return;
    $$(".chip").forEach(function (x) { x.classList.toggle("active", x === c); x.setAttribute("aria-pressed", String(x === c)); });
    state.cat = c.dataset.cat; renderGrid();
  });
  $("#search").addEventListener("input", function (e) { state.q = e.target.value; renderGrid(); });
  $("#sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
  $("#clearFilters").addEventListener("click", function () {
    state = { cat: "todos", q: "", sort: "padrao" }; $("#search").value = ""; $("#sort").value = "padrao";
    $$(".chip").forEach(function (x) { x.classList.toggle("active", x.dataset.cat === "todos"); x.setAttribute("aria-pressed", String(x.dataset.cat === "todos")); }); renderGrid(); $("#search").focus();
  });
  $$(".chip").forEach(function (c) {
    c.setAttribute("aria-pressed", String(c.classList.contains("active")));
    if (c.dataset.cat !== "todos" && !PRODUCTS.some(function (p) { return p.categoria === c.dataset.cat; })) c.hidden = true;
  });

  /* ---------- Contato ---------- */
  var cf = $("#contactForm");
  function cErr(n, m) { var el = cf.elements[n], e = $("#e-c-" + n); el.classList.toggle("invalid", !!m); if (e) { e.textContent = m || ""; e.classList.toggle("show", !!m); } }
  ["nome", "tel", "msg"].forEach(function (n) { cf.elements[n].addEventListener("input", function () { cErr(n, ""); }); });
  cf.addEventListener("submit", function (e) {
    e.preventDefault(); var f = cf.elements, bad = null;
    ["nome", "tel", "msg"].forEach(function (n) { cErr(n, ""); });
    if (!f.nome.value.trim()) { cErr("nome", "Informe seu nome."); bad = bad || "nome"; }
    if (f.tel.value.replace(/\D/g, "").length < 10) { cErr("tel", "Informe o telefone com DDD."); bad = bad || "tel"; }
    if (!f.msg.value.trim()) { cErr("msg", "Conte o que você precisa."); bad = bad || "msg"; }
    if (bad) { f[bad].focus(); return; }
    var t = ["*Solicitação pelo site*", "", "Nome: " + f.nome.value.trim(), "Telefone: " + f.tel.value.trim()];
    if (f.local.value.trim()) t.push("Local: " + f.local.value.trim());
    t.push("", f.msg.value.trim()); openWA(t.join("\n")); cf.reset(); toast("Abrimos o WhatsApp com sua mensagem");
  });

  /* ---------- Menu: link ativo ---------- */
  if ("IntersectionObserver" in window) {
    var links = $$(".nav a"), io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) links.forEach(function (a) { var on = a.getAttribute("href") === "#" + en.target.id; a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); }); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    $$("main section[id]").forEach(function (s) { io.observe(s); });
  }

  /* ---------- Análise de uso opcional (Clarity) com consentimento ---------- */
  (function analytics() {
    var id = CFG.clarityId; if (!id) return;
    function load() { (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, "clarity", "script", id); }
    var c = lsGet(CONSENT_KEY); if (c === "1") return load(); if (c === "0") return;
    var b = document.createElement("div"); b.className = "consent"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Privacidade");
    b.innerHTML = '<p>Usamos uma ferramenta de análise para entender como o site é usado (cliques e navegação) e melhorá-lo. Não coletamos o conteúdo do que você digita.</p><button class="btn btn-gold btn-sm" id="cOk">Aceitar</button><button class="btn btn-ghost btn-sm" id="cNo">Recusar</button>';
    document.body.appendChild(b);
    $("#cOk").onclick = function () { lsSet(CONSENT_KEY, "1"); b.remove(); load(); };
    $("#cNo").onclick = function () { lsSet(CONSENT_KEY, "0"); b.remove(); };
  })();

  /* ---------- Tema claro/escuro ---------- */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setTheme(t) {
    document.documentElement.dataset.theme = t; lsSet("adega_theme", t);
    var m = $('meta[name="theme-color"]'); if (m) m.setAttribute("content", t === "light" ? "#fbf8f1" : "#0a0907");
  }
  setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  $("#themeBtn").addEventListener("click", function (e) {
    var next = document.documentElement.dataset.theme === "light" ? "dark" : "light", r = e.currentTarget.getBoundingClientRect();
    if (document.startViewTransition && !reduce) {
      document.documentElement.style.setProperty("--vx", Math.round(r.left + r.width / 2) + "px"); document.documentElement.style.setProperty("--vy", Math.round(r.top + r.height / 2) + "px");
      document.startViewTransition(function () { setTheme(next); });
    } else {
      document.documentElement.classList.add("theme-anim"); setTheme(next);
      setTimeout(function () { document.documentElement.classList.remove("theme-anim"); }, 520);
    }
  });

  /* ---------- Animações ---------- */
  var revealIO = null;
  function observeReveals() {
    var els = $$(".reveal:not(.in)");
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    revealIO = revealIO || new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); revealIO.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (e) { revealIO.observe(e); });
  }
  function bumpCart() {
    var c = $("#cartCount"); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
  }
  function flyToCart(btn) {
    if (reduce || !btn.animate) return;
    var from = btn.getBoundingClientRect(), target = ($("#cartBar").classList.contains("has") && getComputedStyle($("#cartBar")).display !== "none" ? $("#cartBar") : $("#cartOpen")).getBoundingClientRect();
    var x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = target.left + target.width / 2, y1 = target.top + target.height / 2;
    var dot = document.createElement("div"); dot.className = "fly"; dot.style.left = "-7px"; dot.style.top = "-7px"; document.body.appendChild(dot);
    var a = dot.animate([
      { transform: "translate(" + x0 + "px," + y0 + "px) scale(1)", opacity: 1 },
      { transform: "translate(" + (x0 + (x1 - x0) * 0.5) + "px," + (Math.min(y0, y1) - 70) + "px) scale(1.15)", opacity: 1, offset: 0.55 },
      { transform: "translate(" + x1 + "px," + y1 + "px) scale(.3)", opacity: .3 }
    ], { duration: 650, easing: "cubic-bezier(.4,.1,.3,1)" });
    a.onfinish = function () { dot.remove(); bumpCart(); };
  }
  // spotlight que segue o mouse nos cards
  $("#grid").addEventListener("pointermove", function (e) {
    var c = e.target.closest(".card"); if (!c) return; var r = c.getBoundingClientRect();
    c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px");
  });
  // cabeçalho, barra de progresso e parallax (1 rAF por rolagem)
  var ticking = false, hdr = $("#header"), prog = $("#progress"), heroBg = $(".hero-bg");
  function onScroll() {
    ticking = false; var y = window.scrollY || 0, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    hdr.classList.toggle("scrolled", y > 40); prog.style.transform = "scaleX(" + Math.min(1, y / max) + ")";
    if (!reduce && heroBg && y < window.innerHeight) heroBg.style.setProperty("--py", Math.round(y * 0.22) + "px");
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll(); observeReveals();

  cleanCart(); saveCart(); renderGrid(); syncCheckout();
})();
