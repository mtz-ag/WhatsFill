/**
 * **O GANCHO DO MUNDO MAIN, E A REPETICAO QUE NAO PODE DIVERGIR.**
 *
 * `mob-hook.js` repete ~15 linhas do `dom-mob.js` por um motivo sem contorno: script de mundo MAIN
 * registrado no manifesto e CLASSICO (nao aceita `import`), e no mundo da pagina nao existe
 * `chrome.runtime` para descobrir a URL do modulo. As alternativas — injetar `<script type=module>`
 * ou `import()` de URL da extensao a partir do MAIN — esbarram na CSP da pagina e **nao foram
 * medidas**; hipotese ali e painel que nao abre.
 *
 * Entao a repeticao e travada aqui, e nao por promessa de comentario: este teste **carrega o
 * arquivo como TEXTO**, roda num `window` falso e exige que ele responda **exatamente o mesmo** que
 * `dom-mob.js` nas MESMAS fixtures. Mexeu num e nao no outro, cai.
 *
 * Trava tambem o protocolo, porque ele e o unico contrato entre dois mundos: mensagem de outra
 * origem e de iframe nao entra, gancho que estoura responde em vez de deixar o painel esperando
 * para sempre, e **abrir clica e para ai**.
 *
 * Rode: node tests/mob-hook.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim } from './_harness.mjs';
import { conversaDoNo, acharLinha, abrirConversa, conversaAberta } from '../src/lib/dom-mob.js';

const ORIGEM = 'https://mobiliza.me';

/** A mesma linha falsa dos testes do `dom-mob`: o React pendura o fiber no proprio no. */
function linhaFalsa(conversa, texto, { nivel = 1 } = {}) {
  let fiber = { memoizedProps: { conversa }, return: null };
  for (let i = 0; i < nivel; i++) fiber = { memoizedProps: { className: 'x' }, return: fiber };
  const no = {
    tagName: 'BUTTON',
    textContent: texto,
    cliques: 0,
    rolou: 0,
    click() { this.cliques++; },
    scrollIntoView() { this.rolou++; },
  };
  no['__reactFiber$no3p7ttmpym'] = fiber;
  return no;
}

/**
 * Sobe o gancho num mundo falso e devolve como conversar com ele.
 *
 * `new Function` com o TEXTO do arquivo e o que torna este teste honesto: ele exercita o codigo que
 * vai para o navegador dele, nao uma copia escrita aqui.
 */
function subirGancho(linhas, divs = []) {
  const fonte = readFileSync(new URL('../src/mob-hook.js', import.meta.url), 'utf8');
  const enviadas = [];
  let ouvinte = null;

  const janela = {
    location: { origin: ORIGEM },
    addEventListener(tipo, fn) { if (tipo === 'message') ouvinte = fn; },
    postMessage(msg) { enviadas.push(msg); },
  };
  // O seletor importa: a linha da fila e `button`, e o painel da direita e `div`.
  const documento = { querySelectorAll: (sel) => (sel === 'div' ? divs : linhas) };

  new Function('window', 'document', fonte)(janela, documento);

  return {
    enviadas,
    temOuvinte: () => typeof ouvinte === 'function',
    /** Manda uma mensagem como o painel mandaria, e devolve o que o gancho respondeu. */
    pedir(type, payload, { origin = ORIGEM, source = janela } = {}) {
      const antes = enviadas.length;
      ouvinte({ source, origin, data: { __whatsfill: 'mob-cs', type, payload } });
      return enviadas.slice(antes);
    },
    cru(data, { origin = ORIGEM, source = janela } = {}) {
      const antes = enviadas.length;
      ouvinte({ source, origin, data });
      return enviadas.slice(antes);
    },
  };
}

grupo('o gancho sobe e se anuncia');
{
  const g = subirGancho([]);
  check(g.temOuvinte(), 'registrou o ouvinte de mensagem');
  /**
   * **Avisar que subiu nao e enfeite:** o painel pode montar antes do gancho, e ai ele ficaria
   * esperando um pong que ninguem mandou.
   */
  check(g.enviadas[0]?.type === 'pronto', 'avisa "pronto" assim que sobe');
  check(g.enviadas[0]?.__whatsfill === 'mob-page', 'com a marca do canal dele');
}

grupo('a repeticao do dom-mob NAO pode divergir');
{
  const a = { id: 'c-1', nome: 'Marta Fictinha' };
  const b = { id: 'c-2', nome: 'Jose Exemplo' };

  /**
   * As mesmas fixtures nos dois lados. O que se compara e o RESULTADO, nao o texto do codigo: e
   * isso que pega a divergencia de verdade (um `NIVEIS` diferente, um `.id` que deixou de ser
   * exigido, a reserva que passou a aceitar empate).
   */
  const casos = [
    { nome: 'acha pelo id', linhas: () => [linhaFalsa(a, 'Marta Fictinha16:09'), linhaFalsa(b, 'Jose Exemplo15:02')], id: 'c-2', porNome: '' },
    { nome: 'id que nao esta na tela', linhas: () => [linhaFalsa(a, 'Marta Fictinha16:09')], id: 'c-404', porNome: '' },
    { nome: 'fiber fundo demais', linhas: () => [linhaFalsa(a, 'x', { nivel: 20 })], id: 'c-1', porNome: '' },
    { nome: 'conversa sem id', linhas: () => [linhaFalsa({ nome: 'Sem id' }, 'Sem id 10:00')], id: 'c-1', porNome: '' },
    { nome: 'reserva por nome', linhas: () => [{ tagName: 'BUTTON', textContent: 'Marta Fictinha16:09', click() {}, scrollIntoView() {} }], id: 'c-1', porNome: 'Marta Fictinha' },
    { nome: 'empate de nome', linhas: () => [{ tagName: 'BUTTON', textContent: 'Marta Fictinha16:09', click() {}, scrollIntoView() {} }, { tagName: 'BUTTON', textContent: 'Marta Fictinha14:00', click() {}, scrollIntoView() {} }], id: 'c-1', porNome: 'Marta Fictinha' },
    { nome: 'nome de uma letra', linhas: () => [{ tagName: 'BUTTON', textContent: 'Marta Fictinha16:09', click() {}, scrollIntoView() {} }], id: 'c-1', porNome: 'M' },
  ];

  for (const caso of casos) {
    const doModulo = abrirConversa(caso.id, { nome: caso.porNome, raiz: { querySelectorAll: () => caso.linhas() } });
    const [resposta] = subirGancho(caso.linhas()).pedir('abrir', { id: caso.id, nome: caso.porNome });
    const doGancho = resposta.payload;

    check(
      !!doModulo.ok === !!doGancho.ok && (doModulo.por || '') === (doGancho.por || '') && (doModulo.motivo || '') === (doGancho.motivo || ''),
      `gancho e dom-mob concordam: ${caso.nome} (modulo ${JSON.stringify(doModulo)} / gancho ${doGancho.ok}/${doGancho.por || doGancho.motivo})`
    );
  }

  // E a peca de baixo tambem, que e de onde a identidade sai.
  check(conversaDoNo(linhaFalsa(a, 'x'))?.id === 'c-1', 'o modulo le o fiber');
  check(acharLinha('c-1', { raiz: { querySelectorAll: () => [linhaFalsa(a, 'x')] } })?.por === 'id', 'e acha por identidade');
}

grupo('QUAL esta aberta: as duas copias tambem tem de concordar');
{
  const linhaAtiva = (conversa, ativa) => {
    const no = { tagName: 'BUTTON', textContent: conversa.nome || '', click() {}, scrollIntoView() {} };
    no['__reactFiber$k'] = { memoizedProps: { conversa, ativa }, return: null };
    return no;
  };
  const painel = (conversa) => {
    const no = { tagName: 'DIV' };
    no['__reactFiber$k'] = { memoizedProps: { conversa, onStatusChange() {}, onClose() {} }, return: null };
    return no;
  };
  const a = { id: 'c-1', nome: 'Marta Fictinha', numero: '5551999990000', external_chat_id: '5551999990000@s.whatsapp.net' };
  const b = { id: 'c-2', nome: 'Jose Exemplo' };

  const casos = [
    { nome: 'os dois concordam', botoes: [linhaAtiva(a, true), linhaAtiva(b, false)], divs: [painel(a)] },
    { nome: 'os dois DISCORDAM', botoes: [linhaAtiva(a, true)], divs: [painel(b)] },
    { nome: 'so o painel', botoes: [linhaAtiva(a, false)], divs: [painel(a)] },
    { nome: 'so a lista', botoes: [linhaAtiva(a, true)], divs: [] },
    { nome: 'nada aberto', botoes: [linhaAtiva(a, false)], divs: [] },
    { nome: 'duas ativas', botoes: [linhaAtiva(a, true), linhaAtiva(b, true)], divs: [] },
  ];

  for (const caso of casos) {
    const doModulo = conversaAberta({ raiz: { querySelectorAll: (s) => (s === 'div' ? caso.divs : caso.botoes) } });
    const [resp] = subirGancho(caso.botoes, caso.divs).pedir('aberta', {});
    const doGancho = resp.payload;

    const idModulo = doModulo?.conversa?.id || null;
    const idGancho = doGancho.conversa?.id || null;
    check(
      idModulo === idGancho && (doModulo?.por || '') === (doGancho.por || ''),
      `gancho e dom-mob concordam sobre a aberta: ${caso.nome} (${idModulo || 'nenhuma'} / ${doModulo?.por || '-'})`
    );
  }

  /**
   * **Pela ponte vai so o que o painel precisa.** A linha inteira do banco carrega telefone e nome
   * de eleitor que nao fazem falta do outro lado — campo que ninguem usa e campo que vaza no
   * primeiro log.
   */
  const [resp] = subirGancho([linhaAtiva(a, true)], [painel(a)]).pedir('aberta', {});
  check(Object.keys(resp.payload.conversa).sort().join(',') === 'external_chat_id,id,nome,numero',
    'e atravessa a ponte so id, nome, numero e o chat');
}

grupo('abrir CLICA E PARA AI');
{
  const no = linhaFalsa({ id: 'c-1', nome: 'Marta Fictinha' }, 'Marta Fictinha16:09');
  const g = subirGancho([no]);
  const [r] = g.pedir('abrir', { id: 'c-1', pedido: 'p-7' });

  check(r.type === 'abriu' && r.payload.ok === true, 'respondeu que abriu');
  check(r.payload.por === 'id', 'por identidade');
  check(no.cliques === 1 && no.rolou === 1, 'um clique, e rolou ate a linha antes');

  /**
   * **O `pedido` volta junto.** Sem ele, duas aberturas em sequencia (ele clicando rapido na lista
   * do painel) nao teriam como ser distinguidas, e o painel escreveria na tela o resultado da
   * errada.
   */
  check(r.payload.pedido === 'p-7', 'o id do pedido volta, para a resposta nao ser confundida com outra');
  check(r.payload.linhas === 1, 'e diz quantas linhas o gancho esta enxergando');

  /** Nada alem de clicar e rolar foi chamado no no. */
  const metodos = Object.keys(no).filter((k) => typeof no[k] === 'function');
  check(metodos.length === 2, 'nao marcou lida, nao assumiu, nao digitou');
}

grupo('o protocolo: quem pode falar com o gancho');
{
  const no = linhaFalsa({ id: 'c-1', nome: 'Marta' }, 'Marta16:09');

  const deOutraOrigem = subirGancho([no]).pedir('abrir', { id: 'c-1' }, { origin: 'https://exemplo.invalido' });
  check(deOutraOrigem.length === 0, 'mensagem de outra origem nao e atendida');

  const deIframe = subirGancho([no]).pedir('abrir', { id: 'c-1' }, { source: { outro: true } });
  check(deIframe.length === 0, 'mensagem que nao veio desta janela (iframe) nao e atendida');

  const semMarca = subirGancho([no]).cru({ type: 'abrir', payload: { id: 'c-1' } });
  check(semMarca.length === 0, 'mensagem sem a marca do canal nao e atendida');

  const deOutroCanal = subirGancho([no]).cru({ __whatsfill: 'cs', type: 'abrir', payload: { id: 'c-1' } });
  check(deOutroCanal.length === 0, 'e o canal do painel ANTIGO nao fala com este gancho');

  check(no.cliques === 0, 'nenhuma delas chegou a clicar em nada');

  const [pong] = subirGancho([no]).pedir('ping', {});
  check(pong?.type === 'pong' && pong.payload.linhas === 1, 'o ping responde com quantas linhas ha na tela');

  const desconhecido = subirGancho([no]).pedir('acao-que-nao-existe', {});
  check(desconhecido.length === 0, 'tipo desconhecido nao faz nada — lista de permissao, como em todo lugar aqui');
}

grupo('gancho que estoura RESPONDE, em vez de deixar o painel esperando');
{
  const explosivo = {
    tagName: 'BUTTON',
    textContent: 'Marta16:09',
    get __reactFiber$x() { throw new Error('o React mudou as entranhas'); },
    click() {},
    scrollIntoView() {},
  };
  // `Object.keys` ja dispara o getter? Nao — mas a leitura dentro do laco dispara.
  const g = subirGancho([explosivo]);
  const [r] = g.pedir('abrir', { id: 'c-1', nome: 'Marta' });

  check(!!r, 'respondeu alguma coisa');
  check(r.payload.ok === false, 'e a resposta e que nao abriu');
}

fim();
