/* =========================================================
   ADEGA PRIME PDV — LOGIN (admin / vendedor)
   Senhas guardadas só como hash PBKDF2-SHA256 (150 mil iterações + sal).
   ATENÇÃO: roda no navegador. Separa funções e evita uso casual,
   mas NÃO substitui autenticação de servidor (veja LEIA-ME).
   ========================================================= */
(function (root) {
  "use strict";
  var USERS_KEY = "adega_auth_v1", LOCK_KEY = "adega_auth_lock", SESS_KEY = "adega_sessao";
  var ITER = 150000, SESSAO_H = 10, MAX_FALHAS = 5;
  var Auth = { PAPEIS: { admin: "Administrador", vendedor: "Vendedor" } };
  Auth._pbkdf2Js = function (senha, saltHex, iter) { return hex(pbkdf2Js(new TextEncoder().encode(senha), unhex(saltHex), iter)); };
  Auth._store = { local: root.localStorage, session: root.sessionStorage };

  function rd(area, k) { try { return JSON.parse(Auth._store[area].getItem(k)); } catch (e) { return null; } }
  function wr(area, k, v) { Auth._store[area].setItem(k, JSON.stringify(v)); }
  function db() { var d = rd("local", USERS_KEY); return d && Array.isArray(d.users) ? d : { users: [], seq: 1 }; }
  function webcrypto() {
    var c = root.crypto && root.crypto.getRandomValues ? root.crypto : (typeof require !== "undefined" ? require("crypto").webcrypto : null);
    if (!c) throw new Error("Seu navegador não oferece gerador aleatório seguro. Atualize o navegador.");
    return c;
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  /* ---- PBKDF2-HMAC-SHA256 em JS puro: usado quando o navegador não oferece crypto.subtle
     (abrir por file:// ou por http://IP-da-rede). Resultado idêntico ao do navegador. ---- */
  var K256 = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var IV256 = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var W256 = new Int32Array(64);
  function compress(H, blk, off) {            // blk: Uint8Array; atualiza H (Int32Array(8))
    var i, w = W256, a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7], t1, t2;
    for (i = 0; i < 16; i++) w[i] = (blk[off + 4 * i] << 24) | (blk[off + 4 * i + 1] << 16) | (blk[off + 4 * i + 2] << 8) | blk[off + 4 * i + 3];
    for (i = 16; i < 64; i++) {
      var x = w[i - 15], y = w[i - 2];
      w[i] = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) + w[i - 7] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + w[i - 16] | 0;
    }
    for (i = 0; i < 64; i++) {
      t1 = h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K256[i] + w[i] | 0;
      t2 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
      h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
    }
    H[0] = H[0] + a | 0; H[1] = H[1] + b | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0; H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
  }
  function finish(H0, tail, totalLen) {       // H0: estado após blocos completos; tail: bytes restantes
    var H = new Int32Array(H0), n = tail.length, pad = new Uint8Array(n + 9 + ((64 - ((n + 9) % 64)) % 64));
    pad.set(tail); pad[n] = 0x80; var bits = totalLen * 8, L = pad.length;
    pad[L - 4] = bits >>> 24 & 255; pad[L - 3] = bits >>> 16 & 255; pad[L - 2] = bits >>> 8 & 255; pad[L - 1] = bits & 255;
    for (var o = 0; o < L; o += 64) compress(H, pad, o);
    var out = new Uint8Array(32); for (var i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = H[i] >>> 16 & 255; out[4 * i + 2] = H[i] >>> 8 & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }
  function pbkdf2Js(passBytes, saltBytes, iter) {
    var key = new Uint8Array(64); if (passBytes.length > 64) throw new Error("Senha muito longa."); key.set(passBytes);
    var ip = new Uint8Array(64), op = new Uint8Array(64); for (var i = 0; i < 64; i++) { ip[i] = key[i] ^ 0x36; op[i] = key[i] ^ 0x5c; }
    var Hi = new Int32Array(IV256), Ho = new Int32Array(IV256); compress(Hi, ip, 0); compress(Ho, op, 0);
    function hmac(msg) { var inner = finish(Hi, msg, 64 + msg.length); return finish(Ho, inner, 64 + 32); }
    var s1 = new Uint8Array(saltBytes.length + 4); s1.set(saltBytes); s1[s1.length - 1] = 1;
    var U = hmac(s1), T = new Uint8Array(U);
    for (var n = 1; n < iter; n++) { U = hmac(U); for (var j = 0; j < 32; j++) T[j] ^= U[j]; }
    return T;
  }
  function derive(senha, saltHex, iter) {
    if (!(root.crypto && root.crypto.subtle) && typeof require === "undefined") {
      return new Promise(function (res) { setTimeout(function () { res(hex(pbkdf2Js(new TextEncoder().encode(senha), unhex(saltHex), iter))); }, 20); });
    }
    return deriveWeb(senha, saltHex, iter);
  }
  function deriveWeb(senha, saltHex, iter) {
    var c = webcrypto(), enc = new TextEncoder();
    if (!c.subtle) return Promise.resolve(hex(pbkdf2Js(enc.encode(senha), unhex(saltHex), iter)));
    return c.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return c.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: iter }, k, 256);
    }).then(hex);
  }
  function igual(a, b) { if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
  function pub(u) { return { id: u.id, nome: u.nome, usuario: u.usuario, papel: u.papel, ativo: u.ativo, criadoEm: u.criadoEm }; }
  function validarSenha(senha, usuario) {
    if (String(senha || "").length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    if (String(senha).toLowerCase() === String(usuario || "").toLowerCase()) throw new Error("A senha não pode ser igual ao usuário.");
  }
  function checarLock() {
    var l = rd("local", LOCK_KEY) || { falhas: 0, ate: 0 }, rest = Math.ceil((l.ate - Date.now()) / 1000);
    if (rest > 0) throw new Error("Muitas tentativas. Aguarde " + (rest >= 60 ? Math.ceil(rest / 60) + " min" : rest + " s") + " para tentar de novo.");
  }
  function falhou() {
    var l = rd("local", LOCK_KEY) || { falhas: 0, ate: 0 }; l.falhas++;
    if (l.falhas >= MAX_FALHAS) l.ate = Date.now() + Math.min(900, 30 * Math.pow(2, l.falhas - MAX_FALHAS)) * 1000;
    wr("local", LOCK_KEY, l);
  }
  var MSG_INVALIDO = "Usuário ou senha incorretos.";

  Auth.temAdmin = function () { return db().users.some(function (u) { return u.papel === "admin" && u.ativo; }); };
  Auth.listar = function () { return db().users.map(pub); };

  Auth.criarUsuario = function (d) {
    var nome = String(d.nome || "").trim(), usuario = String(d.usuario || "").trim().toLowerCase();
    if (!nome) return Promise.reject(new Error("Informe o nome."));
    if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) return Promise.reject(new Error("Usuário: 3 a 20 letras minúsculas, números, ponto, hífen ou _."));
    if (!Auth.PAPEIS[d.papel]) return Promise.reject(new Error("Perfil inválido."));
    try { validarSenha(d.senha, usuario); } catch (e) { return Promise.reject(e); }
    var data = db();
    if (data.users.some(function (u) { return u.usuario === usuario; })) return Promise.reject(new Error("Esse usuário já existe."));
    if (d.papel === "admin" && data.users.some(function (u) { return u.papel === "admin"; }) && !d._autorizado) return Promise.reject(new Error("Só um administrador logado pode criar outro administrador."));
    var salt = hex(webcrypto().getRandomValues(new Uint8Array(16)));
    return derive(d.senha, salt, ITER).then(function (h) {
      data = db();
      var u = { id: data.seq++, nome: nome, usuario: usuario, papel: d.papel, salt: salt, hash: h, iter: ITER, ativo: true, criadoEm: new Date().toISOString() };
      data.users.push(u); wr("local", USERS_KEY, data); return pub(u);
    });
  };

  function verificar(usuario, senha) {
    try { checarLock(); } catch (e) { return Promise.reject(e); }
    var u = db().users.filter(function (x) { return x.usuario === String(usuario || "").trim().toLowerCase(); })[0];
    var salt = u ? u.salt : "00".repeat(16), iter = u ? u.iter : ITER;   // custo igual para usuário inexistente
    return derive(String(senha || ""), salt, iter).then(function (h) {
      if (!u || !u.ativo || !igual(h, u.hash)) { falhou(); throw new Error(MSG_INVALIDO); }
      wr("local", LOCK_KEY, { falhas: 0, ate: 0 }); return u;
    });
  }
  Auth.login = function (usuario, senha) {
    return verificar(usuario, senha).then(function (u) {
      wr("session", SESS_KEY, { id: u.id, exp: Date.now() + SESSAO_H * 3600e3 }); return pub(u);
    });
  };
  Auth.verificarAdmin = function (usuario, senha) {
    return verificar(usuario, senha).then(function (u) { if (u.papel !== "admin") throw new Error("Esse usuário não é administrador."); return pub(u); });
  };
  Auth.sessao = function () {
    var s = rd("session", SESS_KEY); if (!s || s.exp < Date.now()) return null;
    var u = db().users.filter(function (x) { return x.id === s.id && x.ativo; })[0]; return u ? pub(u) : null;
  };
  Auth.sair = function () { try { Auth._store.session.removeItem(SESS_KEY); } catch (e) {} };

  Auth.redefinirSenha = function (id, nova) { // chamada só pelo admin (a UI garante)
    var data = db(), u = data.users.filter(function (x) { return x.id === id; })[0];
    if (!u) return Promise.reject(new Error("Usuário não encontrado."));
    try { validarSenha(nova, u.usuario); } catch (e) { return Promise.reject(e); }
    var salt = hex(webcrypto().getRandomValues(new Uint8Array(16)));
    return derive(nova, salt, ITER).then(function (h) { data = db(); u = data.users.filter(function (x) { return x.id === id; })[0]; u.salt = salt; u.hash = h; u.iter = ITER; wr("local", USERS_KEY, data); });
  };
  Auth.alterarMinhaSenha = function (id, atual, nova) {
    var u = db().users.filter(function (x) { return x.id === id; })[0]; if (!u) return Promise.reject(new Error("Usuário não encontrado."));
    return verificar(u.usuario, atual).then(function () { return Auth.redefinirSenha(id, nova); });
  };
  Auth.setAtivo = function (id, ativo, euId) {
    var data = db(), u = data.users.filter(function (x) { return x.id === id; })[0];
    if (!u) throw new Error("Usuário não encontrado.");
    if (!ativo && id === euId) throw new Error("Você não pode desativar o próprio acesso.");
    if (!ativo && u.papel === "admin" && data.users.filter(function (x) { return x.papel === "admin" && x.ativo; }).length < 2) throw new Error("É preciso manter ao menos um administrador ativo.");
    u.ativo = !!ativo; wr("local", USERS_KEY, data);
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Auth; else root.Auth = Auth;
})(typeof window !== "undefined" ? window : globalThis);
