/* =========================================================
   ADEGA PRIME — CONFIGURAÇÃO DO SITE
   Edite aqui: número, horário, endereço e entrega.
   ========================================================= */
window.ADEGA = {
  nome: "Adega Prime",
  // DDI 55 + DDD + número, só dígitos. (O número antigo estava sem o 55.)
  whatsapp: "5575992137295",
  horario: { abre: "10:00", fecha: "02:00" },   // fecha < abre = vira a madrugada
  endereco: "# 468 Av. José Hemetério de Carvalho, Glória, Bahia",
  mapsLink: "https://www.google.com/maps/search/?api=1&query=468+Av.+Jos%C3%A9+Hemet%C3%A9rio+de+Carvalho%2C+Gl%C3%B3ria%2C+Bahia",
  instagram: "",                                 // ex.: "https://instagram.com/suaadega"
  taxaEntrega: 0,                                // 0 = "a combinar" (não soma no total)
  pedidoMinimo: 0,
  formasPagamento: ["Pix", "Cartão (na entrega)", "Dinheiro"]
};
// Teste de usabilidade (opcional): ID do projeto Microsoft Clarity (grava mapas de calor/sessões).
// Deixe vazio para desativar. Se preencher, o site pede consentimento antes de carregar (LGPD).
window.ADEGA.clarityId = "";
