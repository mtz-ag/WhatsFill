/**
 * descobrir-listagem.js — descobre como a API lista contatos, para a categorização por cidade.
 *
 * COLE ISTO NO CONSOLE (F12) da aba do mobiliza, com a tela de Contatos aberta.
 *
 * **Só leitura.** Nenhum POST, PUT ou PATCH: nada é escrito, nada é criado, nada é apagado.
 * A única coisa que ele faz é ler e contar.
 *
 * Responde as perguntas que decidem se a categorização é viável e a que custo:
 *  1. Qual a rota de listagem de contatos, e ela é paginada como as outras?
 *  2. **A listagem traz a CIDADE?** É a pergunta que vale a tarefa inteira: se trouxer, ler a base
 *     custa ~580 requisições; se não, custa 57.855 (uma por contato) — a diferença entre uma hora
 *     de trabalho e derrubar a plataforma.
 *  3. A listagem traz as ETIQUETAS? (mesmo motivo)
 *  4. Dá para pedir ao servidor só quem tem etiqueta/cidade, em vez de baixar tudo e filtrar aqui?
 *  5. Quantas etiquetas de cidade já existem, e quantas faltariam criar.
 *
 * O relatório sai no console e também fica em `window.__wfRelatorio` para copiar inteiro.
 */

(async () => {
  const BASE = 'https://api.mobiliza.app';
  const rel = { em: new Date().toISOString(), achados: {}, erros: [] };

  // --- token -----------------------------------------------------------------
  // A API valida `Origin`, então isto só funciona rodando DENTRO da aba do mobiliza — que é
  // exatamente onde este script é colado. O token é o do app: não criamos sessão nova.
  function acharToken() {
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const chave = store.key(i);
        const valor = store.getItem(chave) || '';
        // Ou o JWT cru, ou dentro de um JSON qualquer que o app tenha guardado.
        const jwt = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/.exec(valor);
        if (jwt) return { token: `Bearer ${jwt[0]}`, onde: `${store === localStorage ? 'local' : 'session'}Storage.${chave}` };
      }
    }
    return null;
  }

  const achado = acharToken();
  if (!achado) {
    console.error(
      '%c[WhatsFill] Não achei o token no storage.',
      'color:#dc2626;font-weight:bold',
      '\nO app deve guardar em memória. Faça assim: deixe esta aba aberta, aperte F5, e cole o' +
        ' script DE NOVO logo depois de a lista de contatos aparecer.'
    );
    return;
  }
  console.log('%c[WhatsFill] token encontrado em ' + achado.onde, 'color:#059669');
  rel.achados.tokenEm = achado.onde;

  async function get(path) {
    const res = await fetch(BASE + path, { headers: { Authorization: achado.token } });
    const texto = await res.text();
    let corpo = null;
    try { corpo = JSON.parse(texto); } catch (_) { corpo = texto.slice(0, 200); }
    return { status: res.status, ok: res.ok, corpo };
  }

  // --- 1. a rota de listagem -------------------------------------------------
  // O padrão do resto da API é `/core/v1/<recurso>?page=&pageSize=`. Testa a hipótese em vez de
  // presumir — e testa com pageSize=2, para não puxar base nenhuma durante a descoberta.
  console.log('%c1/5 procurando a rota de listagem…', 'color:#4f46e5');
  const candidatas = [
    '/core/v1/contact?page=1&pageSize=2',
    '/core/v1/contact?page=1&pageSize=2&isToIncludeCustomFields=true&isToIncludeTags=true',
  ];
  let listagem = null;
  for (const rota of candidatas) {
    const r = await get(rota);
    console.log(`   ${r.status} ${rota}`);
    if (r.ok && r.corpo && (Array.isArray(r.corpo) || Array.isArray(r.corpo.items))) {
      listagem = { rota, corpo: r.corpo };
      break;
    }
  }

  if (!listagem) {
    rel.erros.push('Nenhuma rota de listagem respondeu. Veja o passo manual no fim.');
    console.error(
      '%c[WhatsFill] A listagem não respondeu nas rotas esperadas.',
      'color:#dc2626;font-weight:bold',
      '\nFaça o passo manual: aba Network (F12), filtre por "contact", recarregue a tela de' +
        ' Contatos e me mande a URL que aparece.'
    );
    window.__wfRelatorio = rel;
    return;
  }

  const itens = Array.isArray(listagem.corpo) ? listagem.corpo : listagem.corpo.items;
  const total = listagem.corpo.totalItems ?? listagem.corpo.total ?? '(não informado)';
  rel.achados.rotaListagem = listagem.rota;
  rel.achados.totalContatos = total;
  rel.achados.envelope = Array.isArray(listagem.corpo) ? 'array puro' : Object.keys(listagem.corpo).join(', ');
  console.log(`%c   ✓ ${listagem.rota} — total: ${total}`, 'color:#059669');

  // --- 2 e 3. a listagem traz cidade e etiquetas? ----------------------------
  // A PERGUNTA QUE VALE A TAREFA. Sem cidade na listagem, cada contato exige um GET próprio.
  console.log('%c2/5 a listagem traz CIDADE e ETIQUETAS?', 'color:#4f46e5');
  const amostra = itens[0] || {};
  rel.achados.camposDoItem = Object.keys(amostra);
  const temCustom = 'customFieldValues' in amostra;
  const temTags = 'tagsId' in amostra || 'tags' in amostra;
  rel.achados.listagemTrazCustomFields = temCustom;
  rel.achados.listagemTrazEtiquetas = temTags;
  console.log(`   customFieldValues na listagem: ${temCustom ? '✓ SIM' : '✗ NÃO'}`);
  console.log(`   etiquetas na listagem:         ${temTags ? '✓ SIM' : '✗ NÃO'}`);
  console.log('   campos do item:', rel.achados.camposDoItem.join(', '));

  if (temCustom) {
    const comValor = itens.find((i) => (i.customFieldValues || []).length);
    rel.achados.exemploCustomFieldValues = (comValor?.customFieldValues || []).slice(0, 4);
    console.log('   exemplo de customFieldValues:', rel.achados.exemploCustomFieldValues);
  }

  // --- 4. dá para o SERVIDOR filtrar? ---------------------------------------
  // Se der, não precisa baixar 57 mil contatos para descobrir quais interessam.
  console.log('%c3/5 o servidor aceita filtro?', 'color:#4f46e5');
  const filtros = [
    ['tagsId', '/core/v1/contact?page=1&pageSize=2&tagsId=QUALQUER'],
    ['hasTags', '/core/v1/contact?page=1&pageSize=2&hasTags=true'],
    ['searchableText', '/core/v1/contact?page=1&pageSize=2&searchableText=teste'],
    ['orderBy', '/core/v1/contact?page=1&pageSize=2&orderBy=name'],
  ];
  rel.achados.filtros = {};
  for (const [nome, rota] of filtros) {
    const r = await get(rota);
    // Aceito ≠ respeitado: 200 pode significar que o parâmetro foi ignorado. Vale como pista.
    rel.achados.filtros[nome] = r.status;
    console.log(`   ${r.status} ${nome}`);
  }

  // --- 5. etiquetas de cidade que já existem --------------------------------
  console.log('%c4/5 etiquetas já cadastradas…', 'color:#4f46e5');
  const tags = await get('/core/v1/tag?page=1&pageSize=500');
  const lista = (Array.isArray(tags.corpo) ? tags.corpo : tags.corpo?.items || [])
    .filter((t) => t.active !== false && t.message)
    .map((t) => String(t.message).trim());
  rel.achados.totalEtiquetas = lista.length;
  rel.achados.etiquetas = lista;
  console.log(`   ${lista.length} etiqueta(s) ativa(s)`);
  console.log('   todas:', lista.join(' | '));

  // --- 6. o campo Cidade no schema ------------------------------------------
  console.log('%c5/5 o campo Cidade no schema…', 'color:#4f46e5');
  const campos = await get('/core/v1/custom-field?page=1&pageSize=100');
  const arr = Array.isArray(campos.corpo) ? campos.corpo : campos.corpo?.items || [];
  const cidade = arr.find((c) => String(c.name || '').trim().toLowerCase() === 'cidade');
  rel.achados.campoCidade = cidade ? { id: cidade.id, name: cidade.name, type: cidade.type } : null;
  console.log('   campo Cidade:', rel.achados.campoCidade);

  // --- veredito -------------------------------------------------------------
  const custoLeitura = temCustom
    ? `~${Math.ceil((Number(total) || 0) / 100)} requisições (pageSize 100)`
    : `${total} requisições — UMA POR CONTATO`;
  rel.achados.custoDeLeitura = custoLeitura;

  console.log('%c\n===== VEREDITO =====', 'font-weight:bold;font-size:14px');
  console.log(`Rota de listagem: ${listagem.rota}`);
  console.log(`Total de contatos: ${total}`);
  console.log(`Cidade vem na listagem: ${temCustom ? 'SIM' : 'NÃO'}`);
  console.log(`Custo para ler a base inteira: ${custoLeitura}`);
  if (!temCustom) {
    console.warn(
      'ATENÇÃO: sem cidade na listagem, ler a base custa uma requisição por contato. ' +
        'Isso é o que derruba a API — o plano tem que mudar de forma.'
    );
  }
  console.log('\nCopie o relatório inteiro com:  copy(JSON.stringify(window.__wfRelatorio, null, 2))');

  window.__wfRelatorio = rel;
  return rel;
})();
