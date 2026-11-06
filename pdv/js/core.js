/* =========================================================
   ADEGA PRIME PDV — LÓGICA (sem interface)
   Dinheiro em reais com 2 casas (round2). Dados em localStorage.
   ========================================================= */
(function (root) {
  "use strict";
  var Core = {};
  var round2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };
  Core.round2 = round2;
  Core.brl = function (n) { return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  Core.FORMAS = ["dinheiro", "pix", "debito", "credito"];
  Core.FORMA_LABEL = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };
  Core.CATEGORIAS = ["combo", "cerveja", "whisky", "vinho", "destilado", "espumante", "outros"];

  Core.novoEstado = function () {
    return { versao: 1, produtos: [], vendas: [], caixas: [], caixaAtual: null, estoqueLog: [], auditoria: [], seq: { venda: 1, produto: 1, caixa: 1 }, config: { loja: "Adega Prime", operador: "", descontoMaxVendedor: 10 } };
  };

  /* ---------- Totais e pagamento ---------- */
  Core.calcDesconto = function (subtotal, d) {
    if (!d || !(d.valor > 0)) return 0;
    var v = d.tipo === "percent" ? subtotal * Math.min(d.valor, 100) / 100 : d.valor;
    return round2(Math.min(v, subtotal));
  };
  Core.totais = function (itens, desconto) {
    var subtotal = round2(itens.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0));
    var desc = Core.calcDesconto(subtotal, desconto);
    return { subtotal: subtotal, desconto: desc, total: round2(subtotal - desc) };
  };
  // Troco só pode sair do dinheiro recebido.
  Core.resumoPagamento = function (total, pagamentos) {
    var pago = round2(pagamentos.reduce(function (s, p) { return s + p.valor; }, 0));
    var dinheiro = round2(pagamentos.filter(function (p) { return p.forma === "dinheiro"; }).reduce(function (s, p) { return s + p.valor; }, 0));
    var restante = round2(Math.max(0, total - pago));
    var excedente = round2(Math.max(0, pago - total));
    var troco = excedente <= dinheiro ? excedente : 0;
    var ok = pago >= total && excedente <= dinheiro && total > 0;
    return { pago: pago, restante: restante, troco: troco, ok: ok, erro: (pago > total && excedente > dinheiro) ? "Excedente só pode ser troco de dinheiro." : null };
  };

  /* ---------- Preço / promoção ---------- */
  Core.hojeStr = function (d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  Core.emPromo = function (p, hoje) {
    hoje = hoje || Core.hojeStr(); var pr = Number(p.precoPromocional);
    return pr > 0 && pr < p.preco && (!p.promoInicio || hoje >= p.promoInicio) && (!p.promoFim || hoje <= p.promoFim);
  };
  Core.precoAtual = function (p, hoje) { return Core.emPromo(p, hoje) ? round2(p.precoPromocional) : p.preco; };

  /* ---------- Auditoria ---------- */
  Core.audit = function (st, usuario, acao, detalhe) {
    st.auditoria.push({ data: new Date().toISOString(), usuario: usuario || "-", acao: acao, detalhe: detalhe || "" });
    if (st.auditoria.length > 1000) st.auditoria.splice(0, st.auditoria.length - 1000);
  };

  /* ---------- Produtos ---------- */
  Core.achar = function (st, id) { return st.produtos.filter(function (p) { return p.id === id; })[0]; };
  Core.buscar = function (st, termo) {
    var t = norm(termo); if (!t) return st.produtos.filter(function (p) { return p.ativo !== false; });
    return st.produtos.filter(function (p) { return p.ativo !== false && norm([p.nome, p.codigo, p.barras].join(" ")).indexOf(t) > -1; });
  };
  // Código de barras / código interno exato (para leitor)
  Core.porCodigo = function (st, cod) {
    cod = String(cod || "").trim(); if (!cod) return null;
    return st.produtos.filter(function (p) { return p.ativo !== false && (String(p.barras) === cod || String(p.codigo).toLowerCase() === cod.toLowerCase()); })[0] || null;
  };
  Core.salvarProduto = function (st, d) {
    var nome = String(d.nome || "").trim();
    if (!nome) throw new Error("Informe o nome do produto.");
    var combo = d.tipo === "combo";
    var preco = round2(d.preco), custo = combo ? 0 : round2(d.custo || 0), est = combo ? 0 : Number(d.estoque || 0), min = combo ? 0 : Number(d.minimo || 0);
    if (!(preco > 0)) throw new Error("Informe um preço maior que zero.");
    if (!isFinite(est) || !isFinite(min)) throw new Error("Estoque inválido.");
    var cod = String(d.codigo || "").trim(), bar = String(d.barras || "").trim();
    var dup = st.produtos.filter(function (p) { return p.id !== d.id && ((cod && p.codigo === cod) || (bar && p.barras === bar)); })[0];
    if (dup) throw new Error("Código/barras já usado por: " + dup.nome);
    var promo = d.precoPromocional ? round2(d.precoPromocional) : 0;
    if (promo && promo >= preco) throw new Error("O preço promocional deve ser menor que o preço normal.");
    var ini = d.promoInicio || "", fim = d.promoFim || "";
    if (ini && fim && fim < ini) throw new Error("O fim da promoção não pode ser antes do início.");
    var comps = [];
    if (combo) {
      var mapa = {};
      (d.componentes || []).forEach(function (c) {
        var id = Number(c.produtoId), q = Number(c.qtd), pr = Core.achar(st, id);
        if (!pr) throw new Error("Um item do combo não existe mais.");
        if (pr.tipo === "combo" || id === d.id) throw new Error("Um combo não pode conter outro combo.");
        if (!(q > 0) || Math.floor(q) !== q) throw new Error("Quantidade inválida no combo: " + pr.nome + " (use número inteiro).");
        mapa[id] = (mapa[id] || 0) + q;
      });
      comps = Object.keys(mapa).map(function (k) { return { produtoId: Number(k), qtd: mapa[k] }; });
      if (!comps.length) throw new Error("Adicione ao menos um item ao combo.");
    }
    var p = d.id ? Core.achar(st, d.id) : null;
    if (d.id && !p) throw new Error("Produto não encontrado.");
    if (p && p.tipo === "combo" && !combo) throw new Error("Não é possível transformar combo em produto simples. Crie um novo produto.");
    if (p && p.tipo !== "combo" && combo && st.vendas.some(function (v) { return v.itens.some(function (it) { return it.produtoId === p.id; }); })) throw new Error("Este produto já tem vendas; não pode virar combo.");
    if (!p) { p = { id: st.seq.produto++ }; st.produtos.push(p); }
    p.tipo = combo ? "combo" : "simples"; p.componentes = comps;
    p.codigo = cod || String(p.id); p.barras = bar; p.nome = nome; p.categoria = combo ? "combo" : (d.categoria && d.categoria !== "combo" ? d.categoria : "outros");
    p.precoPromocional = promo || null; p.promoInicio = promo ? ini || null : null; p.promoFim = promo ? fim || null : null; p.imagem = String(d.imagem || "").trim() || null;
    p.desc = String(d.desc || "").trim(); p.preco = preco; p.custo = custo; p.estoque = est; p.minimo = min; p.ativo = d.ativo !== false;
    return p;
  };
  /* ---------- Combos / disponibilidade ---------- */
  Core.ehCombo = function (p) { return p && p.tipo === "combo"; };
  Core.disponivel = function (st, p) {
    if (!Core.ehCombo(p)) return p.estoque;
    var min = Infinity;
    (p.componentes || []).forEach(function (c) { var q = Core.achar(st, c.produtoId); min = Math.min(min, q && q.ativo !== false ? Math.floor(q.estoque / c.qtd) : 0); });
    return isFinite(min) ? Math.max(0, min) : 0;
  };
  Core.custoCombo = function (st, p) { return round2((p.componentes || []).reduce(function (s, c) { var q = Core.achar(st, c.produtoId); return s + (q ? q.custo * c.qtd : 0); }, 0)); };
  Core.valorAvulso = function (st, p) { return round2((p.componentes || []).reduce(function (s, c) { var q = Core.achar(st, c.produtoId); return s + (q ? Core.precoAtual(q) * c.qtd : 0); }, 0)); };
  Core.custoItem = function (st, p) { return Core.ehCombo(p) ? Core.custoCombo(st, p) : p.custo; };
  // quanto de cada produto SIMPLES o carrinho consome
  Core.demanda = function (st, itens) {
    var d = {};
    itens.forEach(function (i) {
      var p = Core.achar(st, i.produtoId); if (!p) return;
      if (Core.ehCombo(p)) p.componentes.forEach(function (c) { d[c.produtoId] = (d[c.produtoId] || 0) + c.qtd * i.qtd; });
      else d[p.id] = (d[p.id] || 0) + i.qtd;
    });
    return d;
  };
  Core.verificarEstoque = function (st, itens) {
    var d = Core.demanda(st, itens);
    Object.keys(d).forEach(function (id) { var q = Core.achar(st, Number(id)); if (!q || q.estoque < d[id]) throw new Error("Estoque insuficiente: " + (q ? q.nome : "item removido") + " (restam " + (q ? q.estoque : 0) + ")"); });
  };
  /* ---------- Promoção em lote ---------- */
  Core.promocaoLote = function (st, o) {
    var pct = Number(o.percent); if (!(pct >= 1 && pct <= 90)) throw new Error("Informe um desconto entre 1% e 90%.");
    if (o.inicio && o.fim && o.fim < o.inicio) throw new Error("O fim da promoção não pode ser antes do início.");
    var n = 0;
    st.produtos.forEach(function (p) {
      if (p.ativo === false) return; if (o.categoria && o.categoria !== "todos" && p.categoria !== o.categoria) return;
      var pr = round2(p.preco * (1 - pct / 100)); if (pr > 0 && pr < p.preco) { p.precoPromocional = pr; p.promoInicio = o.inicio || null; p.promoFim = o.fim || null; n++; }
    });
    if (!n) throw new Error("Nenhum produto encontrado para essa seleção.");
    return n;
  };
  Core.limparPromocoes = function (st, categoria) {
    var n = 0; st.produtos.forEach(function (p) { if (p.precoPromocional && (!categoria || categoria === "todos" || p.categoria === categoria)) { p.precoPromocional = null; p.promoInicio = null; p.promoFim = null; n++; } }); return n;
  };
  Core.excluirProduto = function (st, id) {
    var p = Core.achar(st, id); if (!p) throw new Error("Produto não encontrado.");
    if (st.vendas.some(function (v) { return v.itens.some(function (i) { return i.produtoId === id; }); })) throw new Error("Este produto tem vendas registradas. Desative-o em vez de excluir.");
    var uso = st.produtos.filter(function (x) { return Core.ehCombo(x) && x.componentes.some(function (c) { return c.produtoId === id; }); })[0];
    if (uso) throw new Error("Este produto faz parte do combo “" + uso.nome + "”. Remova-o do combo primeiro.");
    st.produtos = st.produtos.filter(function (x) { return x.id !== id; }); return p;
  };
  // Importa JSON no formato do catálogo (nome, categoria, preco, desc, precoPromocional…). Estoque entra zerado.
  Core.importarCatalogo = function (st, arr) {
    if (!Array.isArray(arr) || arr.some(function (x) { return !x || !x.nome || !(Number(x.preco) > 0); })) throw new Error("Formato inválido: cada item precisa de nome e preço.");
    var n = 0;
    arr.forEach(function (x) {
      var ex = st.produtos.filter(function (p) { return Core.norm(p.nome) === Core.norm(x.nome); })[0];
      if (x.combo) return; Core.salvarProduto(st, { id: ex ? ex.id : null, tipo: "simples", nome: x.nome, categoria: Core.CATEGORIAS.indexOf(x.categoria) > -1 ? x.categoria : "outros", preco: Number(x.preco), custo: ex ? ex.custo : 0, estoque: ex ? ex.estoque : 0, minimo: ex ? ex.minimo : 0, desc: x.desc, precoPromocional: x.precoPromocional, promoInicio: x.promoInicio, promoFim: x.promoFim, imagem: x.imagem, ativo: x.disponivel !== false, codigo: ex ? ex.codigo : "", barras: ex ? ex.barras : "" }); n++;
    });
    return n;
  };
  Core.entradaEstoque = function (st, id, qtd, motivo) {
    var p = Core.achar(st, id); if (!p) throw new Error("Produto não encontrado.");
    if (Core.ehCombo(p)) throw new Error("Combo não tem estoque próprio: dê entrada nos produtos que o compõem.");
    qtd = Number(qtd); if (!isFinite(qtd) || qtd === 0) throw new Error("Quantidade inválida.");
    if (p.estoque + qtd < 0) throw new Error("Estoque ficaria negativo.");
    p.estoque += qtd;
    st.estoqueLog.push({ data: new Date().toISOString(), produtoId: id, nome: p.nome, qtd: qtd, motivo: motivo || (qtd > 0 ? "Entrada" : "Ajuste") });
    return p;
  };

  /* ---------- Caixa ---------- */
  Core.caixaAberto = function (st) { return st.caixas.filter(function (c) { return c.id === st.caixaAtual && !c.fechadoEm; })[0] || null; };
  Core.abrirCaixa = function (st, operador, troco) {
    if (Core.caixaAberto(st)) throw new Error("Já existe um caixa aberto.");
    operador = String(operador || "").trim(); if (!operador) throw new Error("Informe o operador.");
    troco = round2(troco || 0); if (troco < 0) throw new Error("Valor inicial inválido.");
    var c = { id: st.seq.caixa++, operador: operador, abertoEm: new Date().toISOString(), trocoInicial: troco, movimentos: [], fechadoEm: null };
    st.caixas.push(c); st.caixaAtual = c.id; st.config.operador = operador; return c;
  };
  Core.movimento = function (st, tipo, valor, motivo) { // tipo: sangria | suprimento
    var c = Core.caixaAberto(st); if (!c) throw new Error("Abra o caixa primeiro.");
    valor = round2(valor); if (!(valor > 0)) throw new Error("Valor inválido.");
    if (!String(motivo || "").trim()) throw new Error("Informe o motivo.");
    if (tipo === "sangria" && valor > Core.resumoCaixa(st, c).dinheiroEsperado) throw new Error("Sangria maior que o dinheiro em caixa.");
    var m = { tipo: tipo, valor: valor, motivo: String(motivo).trim(), data: new Date().toISOString() };
    c.movimentos.push(m); return m;
  };
  Core.resumoCaixa = function (st, c) {
    var vendas = st.vendas.filter(function (v) { return v.caixaId === c.id && v.status === "concluida"; });
    var porForma = { dinheiro: 0, pix: 0, debito: 0, credito: 0 }, total = 0, descontos = 0;
    vendas.forEach(function (v) {
      total += v.total; descontos += v.desconto;
      v.pagamentos.forEach(function (p) { porForma[p.forma] += p.valor; });
      porForma.dinheiro -= v.troco; // troco devolvido sai do dinheiro
    });
    Core.FORMAS.forEach(function (f) { porForma[f] = round2(porForma[f]); });
    var sup = 0, sang = 0;
    c.movimentos.forEach(function (m) { if (m.tipo === "suprimento") sup += m.valor; else sang += m.valor; });
    var dinheiroEsperado = round2(c.trocoInicial + porForma.dinheiro + sup - sang);
    return { vendas: vendas.length, total: round2(total), descontos: round2(descontos), porForma: porForma, suprimentos: round2(sup), sangrias: round2(sang), trocoInicial: c.trocoInicial, dinheiroEsperado: dinheiroEsperado };
  };
  Core.fecharCaixa = function (st, contado) {
    var c = Core.caixaAberto(st); if (!c) throw new Error("Nenhum caixa aberto.");
    contado = round2(contado); if (!(contado >= 0)) throw new Error("Valor contado inválido.");
    var r = Core.resumoCaixa(st, c);
    c.fechadoEm = new Date().toISOString(); c.contado = contado; c.esperado = r.dinheiroEsperado; c.diferenca = round2(contado - r.dinheiroEsperado); c.resumo = r;
    st.caixaAtual = null; return c;
  };

  /* ---------- Vendas ---------- */
  Core.finalizarVenda = function (st, itens, desconto, pagamentos, usuario) {
    var cx = Core.caixaAberto(st); if (!cx) throw new Error("Abra o caixa para vender.");
    if (!itens.length) throw new Error("Carrinho vazio.");
    var linhas = itens.map(function (i) {
      var p = Core.achar(st, i.produtoId); if (!p) throw new Error("Produto removido: " + i.nome);
      if (!(i.qtd > 0)) throw new Error("Quantidade inválida: " + p.nome);
      var l = { produtoId: p.id, codigo: p.codigo, nome: p.nome, qtd: i.qtd, preco: Core.precoAtual(p), custo: Core.custoItem(st, p) };
      if (Core.ehCombo(p)) l.componentes = p.componentes.map(function (c) { return { produtoId: c.produtoId, qtd: c.qtd }; });
      return l;
    });
    Core.verificarEstoque(st, linhas);
    var t = Core.totais(linhas, desconto);
    var pg = pagamentos.map(function (p) { return { forma: p.forma, valor: round2(p.valor) }; }).filter(function (p) { return p.valor > 0; });
    pg.forEach(function (p) { if (Core.FORMAS.indexOf(p.forma) < 0) throw new Error("Forma de pagamento inválida."); });
    var r = Core.resumoPagamento(t.total, pg);
    if (r.erro) throw new Error(r.erro);
    if (!r.ok) throw new Error("Pagamento insuficiente. Falta " + Core.brl(r.restante) + ".");
    var dem = Core.demanda(st, linhas); Object.keys(dem).forEach(function (id) { Core.achar(st, Number(id)).estoque -= dem[id]; });
    var v = { id: st.seq.venda++, data: new Date().toISOString(), caixaId: cx.id, operador: cx.operador, usuario: usuario || cx.operador, itens: linhas, subtotal: t.subtotal, desconto: t.desconto, total: t.total, pagamentos: pg, troco: r.troco, status: "concluida" };
    st.vendas.push(v); return v;
  };
  Core.cancelarVenda = function (st, id, motivo) {
    var v = st.vendas.filter(function (x) { return x.id === id; })[0];
    if (!v) throw new Error("Venda não encontrada.");
    if (v.status !== "concluida") throw new Error("Venda já cancelada.");
    if (!String(motivo || "").trim()) throw new Error("Informe o motivo do cancelamento.");
    var cx = st.caixas.filter(function (c) { return c.id === v.caixaId; })[0];
    if (cx && cx.fechadoEm) throw new Error("O caixa dessa venda já foi fechado.");
    v.itens.forEach(function (i) {
      if (i.componentes) i.componentes.forEach(function (c) { var q = Core.achar(st, c.produtoId); if (q) q.estoque += c.qtd * i.qtd; });
      else { var p = Core.achar(st, i.produtoId); if (p) p.estoque += i.qtd; }
    });
    v.status = "cancelada"; v.cancelamento = { data: new Date().toISOString(), motivo: String(motivo).trim() };
    return v;
  };

  /* ---------- Relatórios ---------- */
  Core.relatorio = function (st, de, ate) { // de/ate: Date (inclusive)
    var vs = st.vendas.filter(function (v) { var d = new Date(v.data); return v.status === "concluida" && d >= de && d <= ate; });
    var porForma = { dinheiro: 0, pix: 0, debito: 0, credito: 0 }, total = 0, custo = 0, itens = {}, desc = 0;
    vs.forEach(function (v) {
      total += v.total; desc += v.desconto;
      v.pagamentos.forEach(function (p) { porForma[p.forma] += p.valor; });
      porForma.dinheiro -= v.troco;
      v.itens.forEach(function (i) {
        custo += i.custo * i.qtd;
        var k = i.produtoId; itens[k] = itens[k] || { nome: i.nome, qtd: 0, receita: 0 };
        itens[k].qtd += i.qtd; itens[k].receita += i.preco * i.qtd;
      });
    });
    var top = Object.keys(itens).map(function (k) { return itens[k]; }).sort(function (a, b) { return b.qtd - a.qtd; });
    Core.FORMAS.forEach(function (f) { porForma[f] = round2(porForma[f]); });
    return { vendas: vs, qtdVendas: vs.length, total: round2(total), custo: round2(custo), lucro: round2(total - custo), descontos: round2(desc), ticket: vs.length ? round2(total / vs.length) : 0, porForma: porForma, top: top };
  };
  Core.estoqueBaixo = function (st) { return st.produtos.filter(function (p) { return p.ativo !== false && !Core.ehCombo(p) && p.estoque <= p.minimo; }); };

  /* ---------- Exportações ---------- */
  Core.csv = function (linhas) {
    return "\ufeff" + linhas.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\r\n");
  };
  // Gera o conteúdo do js/catalog.js do site
  Core.catalogoSite = function (st) {
    var lista = st.produtos.filter(function (p) { return p.ativo !== false; }).map(function (p) {
      var o = { id: p.id, categoria: p.categoria, nome: p.nome, desc: p.desc || "", preco: p.preco, disponivel: Core.disponivel(st, p) > 0 };
      if (Core.ehCombo(p)) { o.combo = true; o.itens = p.componentes.map(function (c) { var q = Core.achar(st, c.produtoId); return { nome: q ? q.nome : "?", qtd: c.qtd }; }); o.valorAvulso = Core.valorAvulso(st, p); }
      if (p.precoPromocional) { o.precoPromocional = p.precoPromocional; if (p.promoInicio) o.promoInicio = p.promoInicio; if (p.promoFim) o.promoFim = p.promoFim; }
      if (p.imagem) o.imagem = p.imagem; return o;
    });
    return "/* Gerado pelo PDV em " + new Date().toLocaleString("pt-BR") + " — substitui site/js/catalog.js */\nwindow.CATALOGO = " + JSON.stringify(lista, null, 2) + ";\n";
  };

  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  Core.norm = norm;

  if (typeof module !== "undefined" && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== "undefined" ? window : this);
