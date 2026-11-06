/* Produtos de EXEMPLO para testar o PDV (Config ▸ "Apagar tudo" remove). Troque pelos seus. */
window.SEED_PRODUTOS = [
  { nome: "Cerveja Pilsen lata 350ml", categoria: "cerveja", preco: 4.5, custo: 3.2, estoque: 120, minimo: 24, barras: "7890000000011" },
  { nome: "Cerveja Pilsen long neck 330ml", categoria: "cerveja", preco: 7, custo: 4.8, estoque: 60, minimo: 12, barras: "7890000000028" },
  { nome: "Cerveja Premium garrafa 600ml", categoria: "cerveja", preco: 12, custo: 8.5, estoque: 36, minimo: 12 },
  { nome: "Cerveja IPA lata 473ml", categoria: "cerveja", preco: 16, custo: 10.5, estoque: 24, minimo: 6 },
  { nome: "Whisky 8 anos 1L", categoria: "whisky", preco: 89.9, custo: 64, estoque: 8, minimo: 3 },
  { nome: "Whisky 12 anos 1L", categoria: "whisky", preco: 159.9, custo: 118, estoque: 4, minimo: 2 },
  { nome: "Vinho tinto seco 750ml", categoria: "vinho", preco: 39.9, custo: 24, estoque: 18, minimo: 6 },
  { nome: "Vinho branco seco 750ml", categoria: "vinho", preco: 39.9, custo: 24, estoque: 12, minimo: 6 },
  { nome: "Espumante brut 750ml", categoria: "espumante", preco: 49.9, custo: 31, estoque: 12, minimo: 4 },
  { nome: "Vodka 1L", categoria: "destilado", preco: 34.9, custo: 22, estoque: 15, minimo: 5 },
  { nome: "Gin 750ml", categoria: "destilado", preco: 79.9, custo: 52, estoque: 7, minimo: 3 },
  { nome: "Cachaça 700ml", categoria: "destilado", preco: 19.9, custo: 11, estoque: 20, minimo: 6 },
  { nome: "Gelo 5kg", categoria: "outros", preco: 12, custo: 5, estoque: 40, minimo: 10 },
  { nome: "Refrigerante 2L", categoria: "outros", preco: 10, custo: 6.5, estoque: 30, minimo: 8 },
  { nome: "Energético lata 250ml", categoria: "outros", preco: 9, custo: 5.5, estoque: 30, minimo: 8 }
];

/* Combos de EXEMPLO (preço do combo menor que a soma dos avulsos). Edite em Estoque ▸ Editar. */
window.SEED_COMBOS = [
  { nome: "Combo Cerveja + Gelo", preco: 55, desc: "12 latas de cerveja + 1 saco de gelo", itens: [{ nome: "Cerveja Pilsen lata 350ml", qtd: 12 }, { nome: "Gelo 5kg", qtd: 1 }] },
  { nome: "Combo Drinks", preco: 109.9, desc: "Vodka + energético (4) + gelo", itens: [{ nome: "Vodka 1L", qtd: 1 }, { nome: "Energético lata 250ml", qtd: 4 }, { nome: "Gelo 5kg", qtd: 1 }] }
];
