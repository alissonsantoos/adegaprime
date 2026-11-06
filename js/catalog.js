/* =========================================================
   CATÁLOGO DO SITE  —  pode ser editado À MÃO ou gerado pelo PDV
   (PDV ▸ Estoque ▸ "Publicar no site (catalog.js)" e substituir este arquivo).

   >>> Os itens, preços e combos abaixo são EXEMPLOS. <<<

   Campos de cada item:
     id            número único
     categoria     combo | cerveja | whisky | vinho | destilado | espumante | outros
     nome          texto
     desc          texto curto (opcional)
     preco         preço normal, ex.: 7.50   (use ponto, não vírgula)
     disponivel    true | false  (false = aparece como "Indisponível")
     imagem        "assets/arquivo.webp" (opcional)

   PROMOÇÃO (opcional):
     precoPromocional  menor que "preco"
     promoInicio / promoFim   "AAAA-MM-DD" (opcional; sem datas = sempre ativa)

   COMBO (opcional):
     categoria: "combo", combo: true,
     itens: [ { nome: "Cerveja lata", qtd: 12 }, ... ]   // só para exibir "Inclui: ..."
     valorAvulso: soma dos itens avulsos (mostra "Economize R$ X")
     preco: preço do combo
   ========================================================= */
window.CATALOGO = [
  /* ---- COMBOS ---- */
  { id: 16, categoria: "combo", combo: true, nome: "Combo Cerveja + Gelo", desc: "Para a resenha", preco: 55.00, valorAvulso: 66.00, disponivel: true,
    itens: [{ nome: "Cerveja Pilsen lata 350ml", qtd: 12 }, { nome: "Gelo 5kg", qtd: 1 }] },
  { id: 17, categoria: "combo", combo: true, nome: "Combo Drinks", desc: "Vodka, energéticos e gelo", preco: 109.90, valorAvulso: 82.90, disponivel: true,
    itens: [{ nome: "Vodka 1L", qtd: 1 }, { nome: "Energético lata 250ml", qtd: 4 }, { nome: "Gelo 5kg", qtd: 1 }] },

  /* ---- PRODUTOS ---- */
  { id: 1,  categoria: "cerveja",   nome: "Cerveja Pilsen lata 350ml",        desc: "Gelada",                       preco: 4.50,  disponivel: true },
  { id: 2,  categoria: "cerveja",   nome: "Cerveja Pilsen long neck 330ml",   desc: "Gelada",                       preco: 7.00,  disponivel: true },
  { id: 3,  categoria: "cerveja",   nome: "Cerveja Premium garrafa 600ml",    desc: "Gelada",                       preco: 12.00, disponivel: true },
  { id: 4,  categoria: "cerveja",   nome: "Cerveja IPA lata 473ml",           desc: "Artesanal",                    preco: 16.00, precoPromocional: 13.90, disponivel: true },
  { id: 5,  categoria: "whisky",    nome: "Whisky 8 anos 1L",                 desc: "Blended",                      preco: 89.90, disponivel: true },
  { id: 6,  categoria: "whisky",    nome: "Whisky 12 anos 1L",                desc: "Blended",                      preco: 159.90, disponivel: true },
  { id: 7,  categoria: "vinho",     nome: "Vinho tinto seco 750ml",           desc: "Para jantar ou presentear",    preco: 39.90, disponivel: true },
  { id: 8,  categoria: "vinho",     nome: "Vinho branco seco 750ml",          desc: "Servir gelado",                preco: 39.90, disponivel: true },
  { id: 9,  categoria: "espumante", nome: "Espumante brut 750ml",             desc: "Para brindar",                 preco: 49.90, disponivel: true },
  { id: 10, categoria: "destilado", nome: "Vodka 1L",                         desc: "Para drinks",                  preco: 34.90, disponivel: true },
  { id: 11, categoria: "destilado", nome: "Gin 750ml",                        desc: "London dry",                   preco: 79.90, disponivel: true },
  { id: 12, categoria: "destilado", nome: "Cachaça 700ml",                    desc: "Prata",                        preco: 19.90, disponivel: true },
  { id: 13, categoria: "outros",    nome: "Gelo 5kg",                         desc: "Saco de gelo",                 preco: 12.00, disponivel: true },
  { id: 14, categoria: "outros",    nome: "Refrigerante 2L",                  desc: "Gelado",                       preco: 10.00, disponivel: true },
  { id: 15, categoria: "outros",    nome: "Energético lata 250ml",            desc: "Gelado",                       preco: 9.00,  disponivel: true }
];
