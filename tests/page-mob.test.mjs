/**
 * **O ADAPTADOR DA PLATAFORMA NOVA** — o que estes testes travam e cada ponto em que eu quase
 * escrevi hipotese e a medicao desmentiu.
 *
 * Rode: node tests/page-mob.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { check, grupo, fim } from './_harness.mjs';
import * as adaptador from '../src/lib/page-mob.js';
import { lerSessao, HOST } from '../src/lib/mob.js';
import { regraDeEncaixe, MIN_WIDTH, MAX_WIDTH } from '../src/lib/dock.js';
import * as adaptadorApi from '../src/lib/api-mob.js';
import { grafiasDaEtiqueta, filtroDeEtiqueta, getMessageTemplates } from '../src/lib/api-mob.js';
import { podeMandar, entregou } from '../src/lib/api-mob.js';
import { entradaDeEtiqueta } from '../src/lib/api-mob.js';
import {
  chaveDaEtiqueta,
  etiquetasDoContato,
  contatoDoBanco,
  ehForaDoRS,
  estadoDaConversa,
  ABERTO,
  EM_ATENDIMENTO,
  RESOLVIDO,
  perguntarAoGancho,
  getState,
  canalForaDoAr,
  sendText,
  setComposerText,
  numeroDoCanal,
  esperarOsDoisSinais,
  ehRecusaPorSinalFraco,
  MARCA_SINAL_FRACO,
  queuePreview,
  textoDoComposer,
  openQueueSession,
  canaisFrescos,
  clickIniciar,
  clickConcluir,
  clickReiniciar,
  sendMessageTemplate,
  enviarImagem,
  learnStart,
  learnStatus,
  closeOverlay,
  temConversaAnterior,
  carregarMaisDaFila,
} from '../src/lib/page-mob.js';

grupo('a armadilha do rotulo repetido VOLTOU, com outra cara');
{
  /**
   * Medido na base dele em 27/10/2026: 87 rotulos distintos em 439 contatos, e entre eles o
   * MESMO conceito escrito de tres jeitos. Comparar o texto cru faria a rodada aplicar de novo
   * uma etiqueta que o contato ja tem.
   */
  check(chaveDaEtiqueta('⛔ 1 SEM RETORNO') === chaveDaEtiqueta('⛔ 1 Sem Retorno'), 'emoji e caixa nao fazem duas etiquetas');
  check(chaveDaEtiqueta('METROPOLITANO DELTA DO JACUÍ') === chaveDaEtiqueta('Metropolitano Delta do Jacuí'), 'acento e caixa tambem nao');
  check(chaveDaEtiqueta('SERRA ') === chaveDaEtiqueta('SERRA'), 'espaco no fim nao faz etiqueta nova — e ele EXISTE na base');
  check(chaveDaEtiqueta('🔴PROCURA EMPREGO OU DINHEIRO') === chaveDaEtiqueta('1. PROCURA EMPREGO OU DINHEIRO'), 'o enfeite de ordenacao (emoji ou numero) nao e parte do nome');

  /** E o que e DIFERENTE continua diferente — senao a normalizacao viraria um apagador. */
  check(chaveDaEtiqueta('VALE DO RIO DOS SINOS') !== chaveDaEtiqueta('VALE DO RIO PARDO'), 'dois COREDEs parecidos continuam dois');
  check(chaveDaEtiqueta('CONTEÚDO FLÁVIO') !== chaveDaEtiqueta('CONTEÚDO ZUCCO'), 'dois conteudos continuam dois');
  check(chaveDaEtiqueta('') === '' && chaveDaEtiqueta(null) === '', 'vazio e vazio');

  const linha = { tags: ['⛔ 1 SEM RETORNO', '⛔ 1 Sem Retorno', 'SERRA ', '  ', null] };
  const e = etiquetasDoContato(linha);
  check(e.length === 2, 'as duas grafias viram UMA etiqueta, e o lixo nao entra');
  check(e[0].name === '⛔ 1 SEM RETORNO', 'o `name` guarda a GRAFIA DO BANCO — e ela que volta numa escrita futura');
  check(e.some((t) => t.name === 'SERRA'), 'o espaco do fim sai do nome, mas o nome continua sendo o dele');
  check(etiquetasDoContato({}).length === 0 && etiquetasDoContato(null).length === 0, 'sem tags, lista vazia');
}

grupo('o contato, na forma que o painel ja le');
{
  // Dados FICTICIOS: nenhum telefone ou nome de eleitor entra em arquivo do repositorio.
  const linha = {
    id: 'bd-1',
    nome: 'Marta Fictinha',
    name: 'Marta Fictinha',
    telefone: '5551999990000',
    phone: '5551999990000',
    cidade: 'Caxias do Sul',
    city: 'Caxias do Sul',
    estado: 'RS',
    bairro: 'Centro',
    observacoes: 'anotacao interna',
    notes: null,
    tags: ['SERRA', 'CONTEÚDO FLÁVIO'],
    nao_perturbe: false,
    created_at: '2026-09-01T10:00:00Z',
  };

  const c = contatoDoBanco(linha);
  check(c.id === 'bd-1' && c.name === 'Marta Fictinha', 'id e nome');
  check(c.tagsId.length === 2 && c.tagsId.includes('serra'), 'as etiquetas viram ids normalizados, que e como o painel compara');

  /**
   * `fields.readValues` le `customFieldValues` no formato `{customFieldId, valueString}`. Na
   * plataforma velha esse formato custou o `contract.js` inteiro — um contrato APRENDIDO, porque
   * a API respondia 200 e ignorava o valor fora do formato. Aqui sao colunas, e o adaptador so
   * precisa vesti-las com o nome que o painel espera.
   */
  const porCampo = Object.fromEntries(c.customFieldValues.map((v) => [v.customFieldId, v.valueString]));
  check(porCampo.Cidade === 'Caxias do Sul', 'a coluna `cidade` chega como o campo Cidade');
  check(porCampo.Observacoes === 'anotacao interna', 'e `observacoes` como Observacoes');
  check(!('Profissao' in porCampo), 'coluna vazia nao vira campo vazio — vira ausencia');

  /**
   * **`notes` tem 0 preenchidos e `observacoes` tem 30** (medido). Os outros pares sao espelho
   * perfeito, este NAO e: quem gravasse em `notes` escreveria num campo que a plataforma nao le.
   */
  check(contatoDoBanco({ ...linha, observacoes: null, notes: 'so em notes' })
    .customFieldValues.every((v) => v.customFieldId !== 'Observacoes'), 'o adaptador le `observacoes`, nunca `notes`');

  check(contatoDoBanco(null) === null, 'sem linha, sem contato — e isso e o caso NORMAL: metade das conversas nao tem contato no CRM');
}

grupo('nao_perturbe: a protecao que a plataforma velha nao tinha');
{
  const base = { id: 'bd-2', nome: 'Jose Exemplo', tags: [] };
  check(contatoDoBanco({ ...base, nao_perturbe: true }).naoPerturbe === true, 'marcado, a rodada tem de saber');
  check(contatoDoBanco({ ...base, nao_perturbe: true, nao_perturbe_motivo: 'pediu' }).naoPerturbeMotivo === 'pediu', 'com o motivo junto');
  check(contatoDoBanco(base).naoPerturbe === false, 'sem a coluna, nao e "nao perturbe"');

  /** `null` nao e `true`: ausencia de informacao nunca vira a afirmacao mais forte. */
  check(contatoDoBanco({ ...base, nao_perturbe: null }).naoPerturbe === false, 'nulo nao marca ninguem');
}

grupo('de fora do RS: a coluna responde, e o vazio nao afirma nada');
{
  check(ehForaDoRS('SC') === true && ehForaDoRS('sp') === true, 'outro estado e de fora');
  check(ehForaDoRS('RS') === false && ehForaDoRS('Rio Grande do Sul') === false, 'o nosso nao');
  /**
   * Medido: 556 RS, 41 de fora, **3 vazios**. Vazio e desconhecido, e desconhecido tratado como
   * "de fora" tiraria tres pessoas do filtro estadual sem ninguem ter decidido isso.
   */
  check(ehForaDoRS('') === false && ehForaDoRS(null) === false, 'vazio e desconhecido, nao e "de fora"');
}

grupo('o estado da tela: tres status, e quem responde "acabou?" e o status');
{
  const aberta = (status, extra = {}) => ({
    conversa: { id: 'c-1', status, total_mensagens: 7, ultima_mensagem_em: '2026-10-27T09:00:00Z', ...extra },
    por: 'os-dois',
  });

  const pendente = estadoDaConversa(aberta(ABERTO));
  check(pendente.sessionId === 'c-1', 'o id da conversa aberta vira o sessionId');
  check(pendente.isPending === true && pendente.concluded === false, 'aberto = pendente');

  check(estadoDaConversa(aberta(EM_ATENDIMENTO)).isPending === false, 'em atendimento nao e pendente');
  check(estadoDaConversa(aberta(RESOLVIDO)).concluded === true, 'resolvido e concluido');

  /**
   * **`resolvido_em` NAO decide isso, e medir foi o que salvou:** das 11 conversas resolvidas,
   * **1** tinha `resolvido_em` preenchido. Quem lesse a coluna veria dez atendimentos fechados
   * como abertos, e a rodada voltaria a mexer neles.
   */
  check(estadoDaConversa(aberta(RESOLVIDO, { resolvido_em: null })).concluded === true, 'resolvida SEM resolvido_em continua resolvida — e sao 10 de 11');
  check(estadoDaConversa(aberta(ABERTO, { resolvido_em: '2026-10-01' })).concluded === false, 'e resolvido_em preenchido nao fecha o que o status diz estar aberto');

  /** O sinal de conversa muda quando chega mensagem — e o que faz o painel reanalisar na hora. */
  const antes = estadoDaConversa(aberta(ABERTO)).conversation;
  const depois = estadoDaConversa(aberta(ABERTO, { total_mensagens: 8 })).conversation;
  check(antes !== depois, 'mensagem nova muda o sinal');

  /** Nada aberto e um estado legitimo, nao um erro. */
  const nada = estadoDaConversa(null);
  check(nada.sessionId === null && nada.concluded === false, 'sem conversa aberta, o painel sabe que nao ha nada');
  check(nada.porQuantosSinais === 'nenhum', 'e diz que nao foi por sinal nenhum');

  /**
   * **O painel carrega POR QUANTOS SINAIS soube.** Com um sinal so a tela esta num estado que
   * ninguem mediu, e quem le precisa poder desconfiar — a mesma disciplina do `nao-da-para-saber`
   * do canal removido.
   */
  check(estadoDaConversa({ ...aberta(ABERTO), por: 'so-um-sinal' }).porQuantosSinais === 'so-um-sinal', 'um sinal so chega marcado');

  /**
   * `semControles` fica FALSO de proposito: na plataforma velha ele era a rede de seguranca para
   * o rotulo do botao mudar de nome. Aqui quem responde e o `status`, que e dado — e inventar um
   * terceiro estado sem ter medido seria a hipotese que este projeto nao aceita.
   */
  check(estadoDaConversa(aberta(ABERTO)).semControles === false, 'semControles nao e afirmado');

  /** Dando para ler a tela, a tela ganha: se da para digitar sem assumir NAO foi medido. */
  check(estadoDaConversa(aberta(ABERTO), { hasComposer: true }).hasComposer === true, 'a leitura da tela vence o palpite pelo status');
  check(estadoDaConversa(aberta(ABERTO)).hasComposer === false, 'sem leitura, cai no status');
}

grupo('a ponte ate o gancho: toda pergunta tem relogio');
{
  const ORIGEM = 'https://mobiliza.me';

  /** Um `window` falso que responde como o gancho responderia. */
  function janelaFalsa({ responde = true, origem = ORIGEM, fonteCerta = true, atrasaMs = 0, pedidoDaResposta = null } = {}) {
    const ouvintes = [];
    const j = {
      addEventListener: (t, fn) => { if (t === 'message') ouvintes.push(fn); },
      removeEventListener: (t, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        if (!responde) return;
        const entregar = () => {
          const ev = {
            source: fonteCerta ? j : { outro: true },
            origin: origem,
            data: {
              __whatsfill: 'mob-page',
              type: 'aberta',
              payload: { pedido: pedidoDaResposta ?? msg.payload.pedido, por: 'os-dois', conversa: { id: 'c-1', status: 'aberto', numero: '5551999990000' }, dark: true },
            },
          };
          for (const fn of [...ouvintes]) fn(ev);
        };
        if (atrasaMs) setTimeout(entregar, atrasaMs); else entregar();
      },
    };
    return j;
  }

  const r1 = await perguntarAoGancho('aberta', {}, { janela: janelaFalsa() });
  check(r1?.payload?.conversa?.id === 'c-1', 'pergunta e resposta se encontram');

  /** As tres guardas da ponte, iguais as do gancho. */
  check(await perguntarAoGancho('aberta', {}, { janela: janelaFalsa({ origem: 'https://evil.example' }), prazoMs: 30 }) === null,
    'resposta de outra ORIGEM nao e resposta');
  check(await perguntarAoGancho('aberta', {}, { janela: janelaFalsa({ fonteCerta: false }), prazoMs: 30 }) === null,
    'resposta de outra JANELA nao e resposta');
  check(await perguntarAoGancho('aberta', {}, { janela: janelaFalsa({ pedidoDaResposta: 'p-de-outra' }), prazoMs: 30 }) === null,
    'resposta de OUTRA PERGUNTA nao serve — duas no ar ao mesmo tempo e o normal');

  /**
   * **Sem relogio o painel espera para sempre.** O gancho pode nao ter subido (a pagina e React,
   * e o painel monta antes dela terminar), e e a licao do timeout da IA entre mundos: *"nao
   * abriu" se mostra na tela; silencio, nao*.
   */
  check(await perguntarAoGancho('aberta', {}, { janela: janelaFalsa({ responde: false }), prazoMs: 30 }) === null,
    'gancho mudo desiste no prazo, em vez de pendurar');
  check(await perguntarAoGancho('aberta', {}, { janela: janelaFalsa({ atrasaMs: 200 }), prazoMs: 30 }) === null,
    'resposta que chega tarde demais nao conta');
  check(await perguntarAoGancho('aberta', {}, { janela: null }) === null, 'sem janela nenhuma, nao estoura');

  /** A ponte solta o ouvinte: o laco do painel pergunta a cada 500ms, e vazar aqui e acumular. */
  const j = janelaFalsa();
  let presos = 0;
  const addOrig = j.addEventListener;
  j.addEventListener = (t, fn) => { presos++; addOrig(t, fn); };
  const rmOrig = j.removeEventListener;
  j.removeEventListener = (t, fn) => { presos--; rmOrig(t, fn); };
  await perguntarAoGancho('aberta', {}, { janela: j });
  check(presos === 0, 'o ouvinte sai quando a resposta chega');
}

grupo('getState: gancho mudo NAO e "nenhuma conversa aberta"');
{
  const ORIGEM = 'https://mobiliza.me';
  const janelaQueResponde = (conversa, extra = {}) => {
    const ouvintes = [];
    const j = {
      addEventListener: (t, fn) => { if (t === 'message') ouvintes.push(fn); },
      removeEventListener: (t, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por: conversa ? 'os-dois' : '', conversa, ...extra } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  };

  const comConversa = await getState({ janela: janelaQueResponde({ id: 'c-1', status: 'aberto', total_mensagens: 3 }) });
  check(comConversa.sessionId === 'c-1' && comConversa.isPending === true, 'a conversa aberta chega inteira');
  check(comConversa.ganchoRespondeu === true, 'e o painel sabe que o gancho falou');

  const semNada = await getState({ janela: janelaQueResponde(null) });
  check(semNada.sessionId === null && semNada.ganchoRespondeu === true, 'nenhuma conversa aberta: o gancho falou e disse que nao ha');

  /**
   * **Os dois casos nao podem se confundir:** "nenhuma" faz o painel pedir que ele abra uma;
   * "nao sei" tem de faze-lo calar. E a mesma regra do `nao-da-para-saber` do canal removido.
   */
  const mudo = await getState({ janela: null });
  check(mudo.sessionId === null && mudo.ganchoRespondeu === false, 'gancho mudo chega marcado como mudo, e nao como "nao ha nada"');

  /** As leituras de tela atravessam. */
  const escuro = await getState({ janela: janelaQueResponde({ id: 'c-1', status: 'em_atendimento' }, { dark: true, hasComposer: true }) });
  check(escuro.dark === true && escuro.hasComposer === true, 'tema e campo de mensagem vem do gancho');
}

grupo('o numero caiu? — e os TRES estados, nunca dois');
{
  const canal = (conexao, numero = '5551999990000') => ({ id: 'i-1', nome: 'Martim', numero, provedor: 'zapi', conexao, ativo: true });

  const caiu = await canalForaDoAr('', { canais: [canal('disconnected')] });
  check(caiu && caiu.caiu === true, 'desconectado e caiu');
  check(await canalForaDoAr('', { canais: [canal('ok')] }) === false, 'conectado nao caiu');

  /**
   * **Ausencia de informacao nao e evidencia** — a licao do `undefined !== 'CONNECTED'` (01/10),
   * que travou a rodada dele num numero que estava no ar. `null` nao e "caiu" nem "esta no ar",
   * e quem chama tem de tratar os tres.
   */
  check(await canalForaDoAr('', { canais: [canal(null)] }) === null, 'campo que a plataforma nao mandou devolve NAO SEI');
  check(await canalForaDoAr('', { canais: [] }) === null, 'sem canal nenhum, tambem nao sei');

  /** `FLAGGED` nao impede a mensagem de CHEGAR: avisa, nao barra. */
  check(await canalForaDoAr('', { canais: [canal('flagged')] }) === false, 'sinalizado como spam ainda entrega — isso e aviso, nao barreira');
}

grupo('o que ainda nao foi medido RECUSA, e nunca finge que fez');
{
  /**
   * **`sendText` SAIU desta lista em 27/10/2026, e e a unica que saiu.** Ela deixou de recusar
   * porque a funcao de borda foi **medida ao vivo** no contato de teste dele: duas mensagens,
   * com releitura confirmando `envio_status: "enviado"`. O que destrava uma recusa aqui nunca e
   * alguem achar que ja da — e a sonda.
   */
  const naoMedidos = [
    ['sendMessageTemplate', sendMessageTemplate],
    ['enviarImagem', enviarImagem],
  ];

  for (const [nome, fn] of naoMedidos) {
    let recusou = false;
    let msg = '';
    try { await fn(); } catch (e) { recusou = true; msg = String(e.message); }
    check(recusou, `${nome} recusa em vez de fingir`);
    check(msg.includes('sonda'), `${nome} diz o que destrava: a sonda no contato de teste`);
  }

  /**
   * **O que MORRE responde "desnecessario", e nao erro.** Falhar faria a tela pedir que ele
   * aprenda um contrato que nao existe mais — o pre-requisito que envelhece junto com o desenho
   * que o criou (26/09), e que ja barrou a fila inteira uma vez.
   */
  /**
   * **Quatro nomes sairam desta lista em 27/10/2026**, e nenhum saiu porque alguem achou que ja
   * dava: `sendText` pela sonda no contato de teste dele, e `clickIniciar`/`clickConcluir`/
   * `clickReiniciar` porque ele abriu uma conversa e autorizou os cliques — assumir, resolver e
   * reabrir foram GRAVADOS, e o estado original foi devolvido no fim.
   */
  for (const [nome, fn] of [['sendText', sendText], ['clickIniciar', clickIniciar], ['clickConcluir', clickConcluir], ['clickReiniciar', clickReiniciar]]) {
    check(typeof fn === 'function', `${nome} existe e NAO esta na lista acima: foi medido`);
    let msg = '';
    try { await fn({ janela: null }); } catch (e) { msg = String(e.message); }
    check(!msg.includes('sonda'), `${nome} nao recusa mais por falta de sonda`);
  }

  check((await learnStart()).desnecessario === true, 'o contrato de escrita nao tem mais o que aprender');
  check((await learnStatus()).estado === 'desnecessario', 'e a tela sabe disso');
  check((await closeOverlay()) === true, 'nao ha overlay do Material para fechar');
  check((await temConversaAnterior()) === false, 'nao existe conversa anterior: a conversa e UMA linha com o historico inteiro');
  check((await carregarMaisDaFila()).jaVemTudo === true, 'nao ha "ver mais": a consulta ja pede o limite');
}

grupo('A COSTURA: todo nome que o page.js desvia tem de existir aqui');
{
  /**
   * **O buraco que este teste existe para impedir.**
   *
   * `page.js` desvia com `NA_PLATAFORMA_NOVA ? mobPage.X : ...`. Acrescentar um `export const Y`
   * la e esquecer o `Y` aqui nao quebra nada na hora: `mobPage.Y` e `undefined`, e o painel so
   * estoura **quando aquela linha rodar** — no meio de uma rodada, na tela dele, com a mensagem
   * `mobPage.Y is not a function`.
   *
   * E a mesma classe do `perfilAtivo is not defined` (25/09) e do campo acrescentado ao retorno
   * que ninguem desestruturou (02/10): **nenhum verificador pega**, porque sintaticamente esta
   * tudo certo. O que pega e comparar as duas listas, e e isso que esta escrito aqui.
   *
   * O arquivo e lido como TEXTO de proposito — o mesmo idioma do teste do gancho do mundo MAIN:
   * importar `page.js` exigiria `location` e `chrome`, que nao existem no Node.
   */
  const fonte = readFileSync(new URL('../src/lib/page.js', import.meta.url), 'utf8');
  /**
   * **A LINHA INTEIRA, e nao o trecho** — a primeira versao deste teste casava
   * `? mobPage.<nome>` em qualquer lugar e leu a PROSA do cabecalho do `page.js`, onde o desvio
   * esta escrito como exemplo. Acusou um nome `X` que nao existe e nunca existiu. E a armadilha
   * do `soCodigo` por outra porta: comentario nao e codigo, e casar trecho le os dois.
   */
  const desviados = [...fonte.matchAll(/^\s*\? mobPage\.([a-zA-Z]+)$/gm)].map((m) => m[1]);

  check(desviados.length >= 20, `o page.js desvia ${desviados.length} nomes para o adaptador`);

  const faltando = desviados.filter((n) => typeof adaptador[n] !== 'function');
  check(faltando.length === 0, `todo nome desviado existe no adaptador${faltando.length ? ' — FALTA: ' + faltando.join(', ') : ''}`);

  /**
   * **E o contrario tambem conta:** `page.js` nao pode continuar mandando para o mobiliza.app um
   * nome que o adaptador ja sabe fazer — seria o painel falando com a plataforma errada.
   */
  const aindaNaoDesviados = ['getState', 'queuePreview', 'openQueueSession', 'canalForaDoAr', 'temConversaAnterior']
    .filter((n) => !desviados.includes(n));
  check(aindaNaoDesviados.length === 0, `os nomes que o adaptador ja resolve estao desviados${aindaNaoDesviados.length ? ' — FALTA desviar: ' + aindaNaoDesviados.join(', ') : ''}`);

  /**
   * **A rota da API velha nao pode passar.** `/core/v1/...` e `/chat/v1/...` sao do mobiliza.app;
   * deixar passar faria o painel pedir ao Supabase um caminho que ele nao conhece e ler o 404
   * como "o contato esta vazio" — a armadilha do `isToIncludeCustomFields`, em que a API
   * respondia 200 e a extensao concluia que todo contato nao tinha nada.
   */
  check(/export const api = NA_PLATAFORMA_NOVA/.test(fonte), 'o transporte da API antiga tambem e desviado');

  /**
   * **A OUTRA METADE DA COSTURA: o `api.js`.** E ele que o `load()` chama em todo contato
   * aberto, e o buraco e identico — um `mobApi.Y` que nao existe e `undefined`, e so estoura
   * quando aquela linha rodar. Aqui o desvio e por EARLY RETURN dentro de cada funcao, com o
   * corpo do mobiliza.app intocado embaixo.
   */
  const fonteApi = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');
  const desviadosApi = [...fonteApi.matchAll(/^\s*if \(NA_PLATAFORMA_NOVA\) return mobApi\.([a-zA-Z]+)\(/gm)].map((m) => m[1]);

  check(desviadosApi.length >= 20, `o api.js desvia ${desviadosApi.length} nomes para o adaptador`);
  const faltamApi = desviadosApi.filter((n) => typeof adaptadorApi[n] !== 'function');
  check(faltamApi.length === 0, `todo nome desviado do api.js existe no api-mob${faltamApi.length ? ' — FALTA: ' + faltamApi.join(', ') : ''}`);

  /**
   * **Os que o `load()` chama em todo contato tem de estar desviados**, senao o painel montaria
   * no mobiliza.me e pediria ao Supabase uma rota do mobiliza.app — lendo o 404 como "o contato
   * esta vazio", que e a armadilha do `isToIncludeCustomFields` de volta.
   */
  const doLoad = ['getContact', 'getConversation', 'getSession', 'getCustomFields', 'getTags'];
  const esquecidos = doLoad.filter((n) => !desviadosApi.includes(n));
  check(esquecidos.length === 0, `o que o load() chama esta desviado${esquecidos.length ? ' — FALTA: ' + esquecidos.join(', ') : ''}`);

  /** E o corpo antigo continua la: desviar nao e apagar o mobiliza.app, que ainda esta no ar. */
  check(fonteApi.includes("const BASE = 'https://api.mobiliza.app'"), 'o caminho do mobiliza.app continua inteiro embaixo do desvio');
  check(fonte.includes('nao existe no ${mob.HOST}'), 'e ele RECUSA dizendo por que, em vez de chamar');
}

grupo('o nome do campo da sessao tem UM dono — e eu ja errei este');
{
  /**
   * **O erro que este teste existe para impedir, e que eu cometi escrevendo o adaptador.**
   *
   * `mob.lerSessao` NORMALIZA a sessao do Supabase: o que entra tem `access_token` e `user`, e o
   * que sai tem **`token`** e **`usuarioId`** — ela descarta nome e e-mail de proposito. Eu
   * montei `Bearer ${sessao.access_token}` em dois lugares, e o cabecalho sairia
   * **`Bearer undefined`**: TODA chamada voltaria 401, com a tela dizendo que a sessao venceu
   * quando ela estava boa.
   *
   * **O conserto nao foi trocar o nome nos dois lugares: foi deixar de ter dois.** Toda leitura
   * passa pelo `mob.buscar`, que e quem sabe o nome do campo. Sobra uma unica excecao, a
   * contagem — ela precisa do cabecalho `Prefer: count=exact`, que o `buscar` nao tem.
   */
  const semComentario = (s) =>
    s
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');

  const codigo = ['page-mob.js', 'api-mob.js']
    .map((f) => semComentario(readFileSync(new URL('../src/lib/' + f, import.meta.url), 'utf8')))
    .join('\n');

  check(!codigo.includes('access_token'), 'nenhum arquivo do adaptador monta cabecalho com `access_token` — quem normaliza e o mob.lerSessao');
  check(!codigo.includes('.user?.') && !codigo.includes('sessao.user'), 'nem le `user` da sessao: o que sobrevive a normalizacao e o `usuarioId`');

  /** E a forma que `lerSessao` devolve, travada aqui, porque e dela que o adaptador depende. */
  const sessao = lerSessao(JSON.stringify({ access_token: 'tok', expires_at: 2000000000, user: { id: 'u-1', email: 'x@y.z' } }));
  check(sessao.token === 'tok', 'lerSessao devolve `token`');
  check(sessao.usuarioId === 'u-1', 'e `usuarioId`');
  check(!('access_token' in sessao) && !('user' in sessao), 'e NAO devolve os nomes crus — por isso o adaptador nao pode usa-los');

  /**
   * **Quantos `fetch` de mao existem no adaptador?** Um, e com motivo escrito. Cada um a mais e
   * outro lugar que pode divergir do `mob.js` sobre como se autentica.
   */
  const deMao = (codigo.match(/await fetch\(/g) || []).length;
  check(deMao === 3, `tres requisicoes de mao, e so estas (achei ${deMao}): a CONTAGEM (precisa do cabecalho Prefer), o ENVIO (POST na funcao de borda) e o rpc() (POST nas funcoes do banco). Toda LEITURA passa pelo mob.buscar, que e quem sabe o nome do campo da sessao`);
}

grupo('GRAFIAS: um disparo filtrado por "SERRA" alcancaria NINGUEM');
{
  /**
   * **A medicao, com a contagem exata do servidor (27/10/2026):**
   *
   * ```
   * tags cs {"SERRA"}  ->     0     <- a grafia OBVIA, a que ele digitaria
   * tags cs {"SERRA "} ->   504     <- com espaco no fim
   * tags cs {"Serra"}  ->   423
   * ```
   *
   * Na plataforma velha a armadilha do rotulo repetido produzia contagem ERRADA (1293 contatos
   * marcados errado). **Aqui ela produz ZERO, em silencio** — e isso e pior, porque numero
   * errado alguem estranha e zero parece resposta.
   */
  const catalogo = [
    { id: 'serra', name: 'SERRA ', grafias: ['SERRA ', 'Serra'] },
    { id: 'producao', name: 'PRODUÇÃO', grafias: ['PRODUÇÃO', 'Produção'] },
    { id: 'conteudo flavio', name: 'CONTEÚDO FLÁVIO', grafias: ['CONTEÚDO FLÁVIO'] },
  ];

  const g = grafiasDaEtiqueta('SERRA', catalogo);
  check(g.includes('SERRA ') && g.includes('Serra'), 'digitando "SERRA" ele alcanca as duas grafias que existem no banco');
  check(g.includes('SERRA'), 'e a que ele digitou vai junto — o catalogo e AMOSTRA, nao a base inteira');

  const f = filtroDeEtiqueta(g);
  check(typeof f.or === 'string' && f.or.includes('SERRA ') && f.or.includes('Serra'), 'varias grafias viram um `or=` so — medido: 504, a soma das duas');
  check(!('tags' in f), 'e nao sobra um filtro de grafia unica junto, que anularia o `or`');

  /** Uma grafia so nao precisa de `or`: a consulta mais simples e a que menos tem como errar. */
  const uma = filtroDeEtiqueta(grafiasDaEtiqueta('CONTEÚDO FLÁVIO', catalogo));
  check(uma.tags === 'cs.{"CONTEÚDO FLÁVIO"}', 'grafia unica vai direto no `cs`');

  /** Acento e caixa tambem reencontram: `Produção` e `PRODUÇÃO` sao a mesma etiqueta. */
  check(grafiasDaEtiqueta('producao', catalogo).includes('PRODUÇÃO'), 'sem acento e sem caixa reencontra a grafia do banco');

  /**
   * **Aspas no rotulo quebrariam o filtro** — `cs.{"a"b"}` e sintaxe invalida, e o PostgREST
   * devolve 400. Etiqueta e campo LIVRE: ninguem impede uma aspa ali.
   */
  check(filtroDeEtiqueta(['di"to']).tags === 'cs.{"dito"}', 'aspas saem do valor antes de montar o filtro');
  /**
   * **O ESPACO DO FIM E SIGNIFICATIVO, e aparar e recriar o defeito.** Eu escrevi `.trim()` em
   * cada grafia para descartar as vazias, e isso transformaria `"SERRA "` (504 contatos) em
   * `"SERRA"` (ZERO) — o conserto desfazendo exatamente o que ele existe para evitar. Quem tem
   * de sair e a grafia que e SO espaco.
   */
  check(filtroDeEtiqueta(['SERRA ']).tags === 'cs.{"SERRA "}', 'o espaco do fim sobrevive: e ele que casa no banco');
  check(filtroDeEtiqueta([]) === null && filtroDeEtiqueta(null) === null, 'sem grafia nenhuma nao se monta filtro');
  check(filtroDeEtiqueta(['', '  ']) === null, 'nem com grafias vazias');

  /** Etiqueta que o catalogo nao conhece devolve so a digitada — nunca lista vazia disfarcada. */
  const desconhecida = grafiasDaEtiqueta('NOVA ETIQUETA', catalogo);
  check(desconhecida.length === 1 && desconhecida[0] === 'NOVA ETIQUETA', 'etiqueta fora do catalogo consulta a propria grafia');
  check(grafiasDaEtiqueta('', catalogo).length === 0, 'rotulo vazio nao consulta nada');
}

grupo('nao existe modelo aprovado aqui — e devolver vazio e a resposta CERTA');
{
  /**
   * Medido: `whatsapp_templates` tem `name`, `content`, `atalho`, `categoria`, `ordem` — e **nao
   * tem `instance_id`**. E a tabela das respostas rapidas DELE, nao a dos modelos aprovados
   * ligados a um canal.
   *
   * E faz sentido: o canal e **zapi**, que o proprio app chama de *"WhatsApp (nao oficial)"*, e
   * para esses nao ha janela de 24h nem modelo aprovado (27/09). A primeira versao disto
   * filtrava por `instance_id` — coluna que nao existe —, o que daria **400 no primeiro contato
   * aberto**.
   */
  const modelos = await getMessageTemplates({ canalId: 'i-1' });
  check(Array.isArray(modelos) && modelos.length === 0, 'nenhum modelo aprovado, e sem estourar');

  /**
   * **Codigo, nunca a prosa — terceira vez desta armadilha hoje.** O comentario logo acima
   * explica que `instance_id` NAO existe, entao casar o arquivo cru acusaria a explicacao do
   * proprio conserto. E a mesma licao do `soCodigo`.
   */
  const soCodigo = readFileSync(new URL('../src/lib/api-mob.js', import.meta.url), 'utf8')
    .split(String.fromCharCode(10))
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join(String.fromCharCode(10));
  /**
   * **O invariante e estreito de proposito:** `instance_id` E um campo legitimo do CORPO do
   * envio (medido: `{instance_id, numero, conversa_id, tipo, conteudo}`). O que nao pode existir
   * e um FILTRO por ele — `instance_id: 'eq.'` —, porque a coluna nao existe em
   * `whatsapp_templates` e daria 400. A primeira versao desta assercao proibia a palavra inteira
   * e passou a acusar o envio; afrouxa-la seria perder a guarda, entao ela foi ESTREITADA.
   */
  check(!soCodigo.includes("instance_id: 'eq."), 'nenhuma consulta FILTRA por `instance_id`: a coluna nao existe em whatsapp_templates');
  check(soCodigo.includes('instance_id: c.instance_id'), 'e o envio continua mandando `instance_id` no corpo, que e onde ele e exigido');
}

grupo('O ENVIO — medido ao vivo em 27/10/2026, no contato de teste dele');
{
  /**
   * **Ate hoje este caminho recusava**, porque a funcao de borda estava *"lida no pacote, nunca
   * executada"*. Ela **nao foi adivinhada**: o corpo e de propriedades abreviadas e minificadas
   * no pacote, entao ler nao dava os nomes — o que deu foi **gravar a propria plataforma
   * enviando uma vez e copiar**, que e o que o `recorder.js` sempre fez no mobiliza.app.
   *
   * ```
   * POST /functions/v1/enviar-mensagem-atendimento
   *   corpo:    { instance_id, numero, conversa_id, tipo, conteudo }
   *   resposta: { ok, conversa_id, mensagem_id, provider }  -> 200, provider "zapi"
   *   releitura: envio_status "enviado", external_message_id preenchido
   * ```
   */
  const pessoa = { id: 'c-1', numero: '5551999990000', instance_id: 'i-1', external_chat_id: '5551999990000@s.whatsapp.net' };

  check(podeMandar(pessoa, 'oi').ok === true, 'conversa de pessoa, com canal e numero: pode');

  /**
   * **A GUARDA DO GRUPO NO PONTO DE ENVIO.** Sao 134 conversas de grupo na base dele, e
   * `grupo_id` e NULO em todas — quem responde e o `external_chat_id`. Uma lista montada certo
   * que passe por um caminho novo continua barrada aqui, e e de proposito: deixar de atender
   * alguem custa uma passada; publicar resposta de atendimento dentro de um grupo de dezenas de
   * pessoas, com o nome dele em cima, nao tem volta.
   */
  const grupo = { ...pessoa, external_chat_id: '120363000000000000@g.us' };
  check(podeMandar(grupo, 'oi').ok === false, 'GRUPO nao recebe, mesmo com tudo o mais certo');
  check(podeMandar(grupo, 'oi').motivo.includes('GRUPO'), 'e o motivo diz qual foi');
  check(podeMandar({ ...pessoa, external_chat_id: '123@newsletter' }, 'oi').ok === false, 'canal (@newsletter) tambem nao');
  check(podeMandar({ ...pessoa, external_chat_id: '123@broadcast' }, 'oi').ok === false, 'lista de transmissao tambem nao');

  /** **Na duvida e grupo:** `external_chat_id` ilegivel fica de fora. */
  check(podeMandar({ ...pessoa, external_chat_id: '' }, 'oi').ok === false, 'endereco de chat ilegivel nao recebe — na duvida, e grupo');

  /** Mensagem vazia CHEGA como mensagem — o WhatsApp nao filtra espaco em branco por nos. */
  check(podeMandar(pessoa, '   ').ok === false, 'texto so de espaco nao sai');
  check(podeMandar(pessoa, '').ok === false, 'nem texto vazio');
  check(podeMandar(pessoa, null).ok === false, 'nem texto nenhum');

  /** O corpo medido EXIGE o canal e o numero: faltando, a funcao de borda nao tem para onde mandar. */
  check(podeMandar({ ...pessoa, instance_id: null }, 'oi').ok === false, 'sem canal nao manda');
  check(podeMandar({ ...pessoa, numero: '' }, 'oi').ok === false, 'sem numero nao manda');
  check(podeMandar(null, 'oi').ok === false && podeMandar({}, 'oi').ok === false, 'sem conversa nao manda');

  /**
   * **TRES ESTADOS NA CONFERENCIA, nunca dois.** Medido: a mensagem que acabou de sair volta com
   * `envio_status: "enviado"`; **mensagem antiga volta com `null`**, porque a coluna so passou a
   * ser preenchida depois. Colapsar "nao sei" em "saiu" faria a rodada marcar como entregue o
   * que ficou pelo caminho; em "falhou", faria mandar duas vezes.
   */
  check(await entregou(null) === 'nao-da-para-saber', 'sem id de mensagem, nao da para saber');
}

grupo('ENVIAR exige saber a conversa por DOIS sinais');
{
  const ORIGEM = 'https://mobiliza.me';
  const janelaQue = (conversa, por) => {
    const ouvintes = [];
    const j = {
      addEventListener: (t, fn) => { if (t === 'message') ouvintes.push(fn); },
      removeEventListener: (t, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por, conversa } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  };
  const erro = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

  /**
   * **Errar a conversa aqui nao e mostrar a pessoa errada na tela: e mandar a mensagem de uma
   * pessoa para OUTRA**, e isso nao tem volta. Por isso `so-um-sinal`, que basta para o painel
   * LER, nao basta para escrever.
   */
  // `prazoMs: 0` porque aqui o assunto e a RECUSA, nao a espera — ela tem grupo proprio, com
  // relogio injetado. Sem isto cada assercao destas paga os 4s de verdade.
  const umSinal = await erro(() => sendText('oi', { prazoMs: 0, janela: janelaQue({ id: 'c-1', status: 'em_atendimento' }, 'so-um-sinal') }));
  check(umSinal && umSinal.includes('UM sinal'), 'um sinal so NAO envia, e diz por que');

  const mudo = await erro(() => sendText('oi', { janela: null }));
  check(mudo && mudo.includes('as cegas'), 'gancho mudo nao envia as cegas');

  const semConversa = await erro(() => sendText('oi', { janela: janelaQue(null, '') }));
  check(semConversa && semConversa.includes('Nenhuma conversa aberta'), 'sem conversa aberta, pede que ele abra');
}

grupo('AS RPCs DE ESTADO — gravadas, e o estado original devolvido no fim');
{
  /**
   * **As quatro, medidas em 27/10/2026 observando a plataforma**, porque a assinatura nao dava
   * para descobrir: corpo vazio devolve 404 PGRST202 e o PostgREST **nao sugere os parametros**,
   * e no pacote os nomes estao minificados.
   *
   * ```
   * assumir_conversa  { p_conversa_id } -> { ok }   status -> em_atendimento
   * resolver_conversa { p_conversa_id } -> { ok }   status -> resolvido
   * reabrir_conversa  { p_conversa_id } -> { ok }   status -> em_atendimento
   * liberar_conversa  { p_conversa_id } -> { ok }   status -> aberto, sem atendente
   * ```
   *
   * **TODAS tem a mesma assinatura, e e so o id** — nao ha motivo nem classificacao. Na
   * plataforma velha a outra opcao do menu ("Classificar e concluir") levava `statusReasonId`;
   * **aqui ela nao existe**. E RESOLVER NAO ABRE DIALOGO: medido, `[role="dialog"]` nao aparece
   * — contra os dois cliques mais o aviso de "mensagens pendentes serao canceladas" da antiga,
   * que custou uma rodada parada em todo contato (01/09).
   */
  const fonte = readFileSync(new URL('../src/lib/api-mob.js', import.meta.url), 'utf8');
  for (const nome of ['assumir', 'resolver', 'reabrir', 'liberar']) {
    check(fonte.includes(`mob.RPCS.${nome}, { p_conversa_id`), `${nome} manda { p_conversa_id }, como foi gravado`);
  }

  /**
   * **MEXER NO ATENDIMENTO EXIGE DOIS SINAIS, como enviar.** Assumir ou resolver a conversa
   * errada mexe no atendimento de OUTRA pessoa — tira da fila quem ninguem atendeu, ou toma o
   * caso de outro operador. A leitura que basta para o painel classificar nao basta aqui.
   */
  const ORIGEM = 'https://mobiliza.me';
  const janelaQue = (conversa, por) => {
    const ouvintes = [];
    const j = {
      addEventListener: (t, fn) => { if (t === 'message') ouvintes.push(fn); },
      removeEventListener: (t, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por, conversa } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  };
  const erro = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };

  for (const [nome, fn] of [['Assumir', clickIniciar], ['Resolver', clickConcluir], ['Reabrir', clickReiniciar]]) {
    const um = await erro(() => fn({ prazoMs: 0, janela: janelaQue({ id: 'c-1', status: 'aberto' }, 'so-um-sinal') }));
    check(um.includes('UM sinal'), `${nome} recusa com um sinal so`);
    const mudo = await erro(() => fn({ janela: null }));
    check(mudo.includes('as cegas'), `${nome} recusa quando o gancho nao responde`);
    const vazio = await erro(() => fn({ janela: janelaQue(null, '') }));
    check(vazio.includes('Nenhuma conversa aberta'), `${nome} recusa sem conversa aberta`);
  }

  /**
   * **Assumir devolve o estado da TELA, nao a sonda do banco** (28/10/2026). A sonda e
   * `{ ok, estado, temAtendente }` — sem `hasComposer`. A rodada dos Novos lia a ausencia
   * como "o campo nao apareceu" e parava no primeiro contato, depois de ja ter assumido.
   */
  const fonteIniciar = readFileSync(new URL('../src/lib/page-mob.js', import.meta.url), 'utf8');
  const corpoIniciar = fonteIniciar.slice(fonteIniciar.indexOf('export async function clickIniciar'));
  const ateProxima = corpoIniciar.slice(0, corpoIniciar.indexOf('\nexport async function clickConcluir'));
  check(ateProxima.includes('hasComposer'), 'clickIniciar espera o campo de mensagem');
  check(ateProxima.includes("'assumir'"), 'clickIniciar aperta o botao Assumir da tela');
  check(ateProxima.includes('getState'), 'clickIniciar devolve o estado da tela');
  check(!/return assumirConversa\(/.test(ateProxima), 'clickIniciar nao devolve mais a sonda do banco');

  /**
   * **"Abrir atendimento" para quem NUNCA escreveu continua recusando — e isso e um buraco no
   * DISPARO, nao um detalhe.** La `PUT /chat/v1/session` CRIAVA a sessao, e era assim que a
   * rodada alcancava quem nunca falou. Aqui a conversa nasce da mensagem da pessoa, e a funcao
   * de envio exige `conversa_id`. Devolver qualquer coisa faria o disparo percorrer a lista
   * inteira sem mandar nada e contar como enviado.
   */
  let m = '';
  try { await adaptadorApi.abrirAtendimento(); } catch (e) { m = e.message; }
  check(m.includes('nunca escreveu'), 'abrir atendimento para quem nunca escreveu recusa, dizendo o que falta');
}

grupo('O MANIFESTO: o painel monta no mobiliza.me, e o resto nao e tocado');
{
  const manifesto = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const scripts = manifesto.content_scripts;
  const paraMe = scripts.filter((c) => c.matches.some((m) => m.includes('mobiliza.me')));

  /**
   * **O gancho do mundo MAIN e o painel sao DOIS scripts, e tem de ser.**
   *
   * `__reactFiber$<hash>` e expando, e expando **nao atravessa mundo isolado no Chrome**: um
   * content script comum ve o mesmo `<button>` da fila e nao ve a chave. Entao quem le o estado
   * do React roda no mundo da PAGINA, e o painel — que precisa de `chrome.runtime` — roda no
   * isolado. Um so nao da conta dos dois lados.
   */
  const gancho = paraMe.find((c) => c.js[0].includes('mob-hook'));
  const painel = paraMe.find((c) => c.js[0].includes('content.js'));
  check(!!gancho, 'o gancho do React esta registrado no mobiliza.me');
  check(gancho?.world === 'MAIN', 'e ele roda no mundo MAIN — sem isso nao enxerga o fiber');
  check(!!painel, 'e o carregador do painel tambem');
  check(painel?.world !== 'MAIN', 'o painel fica no mundo ISOLADO, que e onde `chrome.runtime` existe');

  /**
   * **O gancho sobe ANTES do painel.** O painel pergunta a ele desde o primeiro tique do laco de
   * 500ms; subindo depois, as primeiras perguntas voltariam vazias e o painel diria "nao sei
   * qual conversa esta aberta" numa tela que tem uma aberta.
   */
  check(gancho?.run_at === 'document_start', 'o gancho sobe em document_start');
  check(scripts.indexOf(gancho) < scripts.indexOf(painel), 'e antes do painel na lista');

  /** Sem isto o `import()` do `main.js` falha, e o painel nao abre. */
  const recursos = manifesto.web_accessible_resources.find((w) => w.matches.some((m) => m.includes('mobiliza.me')));
  check(!!recursos && recursos.resources.includes('src/main.js'), 'os arquivos do painel sao alcancaveis a partir do mobiliza.me');

  /**
   * **A ABA DO FACEBOOK NAO E TOCADA** — a correcao dele de 26/10, travada aqui: *"a aba facebook
   * era pra plataforma do facebook... e deixar intocada a aba do facebook"*. E o mobiliza.app
   * tambem continua inteiro, porque aquela plataforma ainda esta no ar.
   */
  const doFacebook = scripts.filter((c) => c.matches.some((m) => m.includes('facebook.com')));
  check(doFacebook.length === 1 && doFacebook[0].js[0] === 'src/facebook-content.js', 'o Facebook continua com UM script, o dele');
  const doApp = scripts.filter((c) => c.matches.some((m) => m.includes('mobiliza.app')));
  check(doApp.length === 2, 'o mobiliza.app continua com os dois (gancho do Bearer + painel)');
  check(doApp.some((c) => c.js[0] === 'src/page-hook.js' && c.world === 'MAIN'), 'inclusive o page-hook, que intercepta o Bearer');

  /**
   * **Arquivo que o manifesto cita e nao existe DERRUBA A EXTENSAO INTEIRA**, e o erro aponta
   * para o manifesto e nao para o codigo — parece que o manifesto quebrou. Ja aconteceu neste
   * projeto (01/09), com um `_s.cjs` esquecido na raiz.
   */
  const faltando = scripts.flatMap((c) => c.js).filter((f) => !existsSync(new URL('../' + f, import.meta.url)));
  check(faltando.length === 0, `todo script citado existe no disco${faltando.length ? ' — FALTA: ' + faltando.join(', ') : ''}`);
}

grupo('A etiqueta tem de passar pelo filtro de QUEM A LE');
{
  /**
   * **O defeito que este teste existe para impedir, e que eu cometi:** `tags.loadTags` faz
   *
   * ```js
   * arr.filter((t) => t.active !== false && t.message)
   * ```
   *
   * porque a API velha devolvia `{id, message, bgColor, textColor}`. Minha primeira versao
   * devolvia so `name` — e o filtro jogaria **tudo** fora. Nenhuma etiqueta reconhecida, cidade
   * e COREDE sem aplicar, `temEtiquetaDeCidade` sempre falso, a protecao de "sem interesse"
   * nunca disparando. **Em silencio, porque lista vazia nao e erro.**
   *
   * Terceira vez que o adaptador erra assim (depois do `access_token` e do nome da tabela): ele
   * so vale pelos nomes que QUEM CHAMA realmente le.
   */
  const e = entradaDeEtiqueta('serra', 'SERRA ');

  // o filtro REAL, lido do `tags.js` e copiado aqui
  const passaNoFiltroDoTags = (t) => t.active !== false && t.message;
  check(!!passaNoFiltroDoTags(e), 'a entrada sobrevive ao filtro do tags.loadTags');
  check(e.message === 'SERRA ', 'e `message` carrega a grafia do banco, com o espaco e tudo');
  check(e.id === 'serra', 'o id continua sendo a chave normalizada, que e como o painel compara');

  /**
   * E o filtro esta COPIADO deste teste de proposito: se alguem mexer no `tags.js` e o filtro
   * mudar, esta assercao continua passando e mente. Por isso ela e conferida contra a fonte.
   */
  const fonteTags = readFileSync(new URL('../src/lib/tags.js', import.meta.url), 'utf8');
  check(fonteTags.includes('t.active !== false && t.message'), 'o filtro do tags.js continua sendo este — se mudar, esta copia tem de mudar junto');
}

grupo('O ADAPTADOR SO VALE PELOS NOMES QUE QUEM CHAMA LE');
{
  /**
   * **Errei isto TRES vezes escrevendo este adaptador**, e as tres falhariam em silencio:
   *
   * 1. `Bearer ${sessao.access_token}` — `lerSessao` normaliza para `token`: **401 em tudo**;
   * 2. `getTags` sem `message` — `tags.loadTags` filtra por ele: **lista vazia**, e com ela a
   *    classificacao inteira degradando sem erro;
   * 3. `contarMeuDia` devolvendo `concluidos` — o painel desestrutura `concluidosHoje`:
   *    **contador vazio**.
   *
   * Nenhum verificador pega: sintaticamente esta tudo certo, e `undefined` nao estoura — ele
   * vira "nao tem". O que pega e **comparar os dois lados**, e e isso que esta escrito aqui.
   */
  const fontePanel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
  const fonteApiMob = readFileSync(new URL('../src/lib/api-mob.js', import.meta.url), 'utf8');

  // o que o painel DESESTRUTURA de cada chamada, copiado da fonte dele
  const contratos = [
    ['contarMeusAbertos', ['total']],
    ['contarMeuDia', ['abertos', 'concluidosHoje']],
  ];

  for (const [nome, campos] of contratos) {
    // lado do PAINEL: ele ainda desestrutura exatamente isto?
    // sem regex de proposito: o escape de barra ja se perdeu uma vez na edicao por script
    const marca = 'await api.' + nome + '(';
    const pos = fontePanel.indexOf(marca);
    const antes = pos < 0 ? '' : fontePanel.slice(Math.max(0, pos - 120), pos);
    const ini = antes.lastIndexOf('{');
    const fim = antes.lastIndexOf('}');
    const m = pos >= 0 && ini >= 0 && fim > ini ? [null, antes.slice(ini + 1, fim)] : null;
    check(!!m, `o painel continua desestruturando api.${nome}()`);
    if (m) {
      const lidos = m[1].split(',').map((x) => x.trim()).filter(Boolean);
      for (const c of campos) check(lidos.includes(c), `o painel le \`${c}\` de ${nome}`);
      for (const c of lidos) check(campos.includes(c), `e nao le nada alem de ${campos.join(', ')} (achei \`${c}\`)`);
    }
    // lado do ADAPTADOR: ele devolve esses nomes?
    for (const c of campos) {
      check(fonteApiMob.includes(c + ':'), `o adaptador devolve \`${c}\``);
    }
  }

  /** O contato: `fields.readValues` le `customFieldId` e `valueString`, e nada mais. */
  const fonteFields = readFileSync(new URL('../src/lib/fields.js', import.meta.url), 'utf8');
  check(fonteFields.includes('item.customFieldId'), 'fields.readValues le `customFieldId`');
  check(fonteFields.includes('item.valueString'), 'e `valueString`');
  const fontePageMob = readFileSync(new URL('../src/lib/page-mob.js', import.meta.url), 'utf8');
  check(fontePageMob.includes('customFieldId: campo') && fontePageMob.includes('valueString:'), 'e o adaptador monta o contato com os dois');
}

grupo('O EMPURRAO — por que o padding no html nao alcanca a plataforma nova');
{
  /**
   * Relato dele: *"sobrepos em vez de empurrar"*. **Medido ao vivo em 27/10/2026: o padding
   * estava sendo aplicado certo e nao alcancava nada** — a tela de conversas e
   * `position: fixed; inset: 0`, e elemento `fixed` resolve contra a VIEWPORT, nunca contra a
   * caixa do `html`. Com 380px de padding, a tela continuava com os 1708px da janela inteira.
   */
  const regra = regraDeEncaixe('mobiliza.me', 380);

  check(regra.includes('#root'), 'na plataforma nova o alvo e o #root');
  check(regra.includes('position: fixed'), 'ele vira fixed');
  check(regra.includes('right: 380px'), 'com right na largura do painel');

  /**
   * **`contain: layout` e a peca que faz o resto funcionar:** sem ela, os `fixed` de dentro
   * continuam resolvendo contra a viewport e o encolhimento do #root nao os alcanca. Medido:
   * #root 1328x791, a tela 1328x791 em x=0, zero elementos transbordando, sem barra horizontal.
   */
  check(regra.includes('contain: layout'), 'e ganha contain: layout — e ela que prende os fixed de dentro');

  /**
   * **A ASSERCAO QUE IMPORTA: o alvo NUNCA pode ser o `body`.**
   *
   * E a "simplificacao" obvia para quem mexer aqui depois, e ela encolheria O PAINEL junto: ele
   * e pendurado em `document.body` (`main.js`), entao `contain` no body o tornaria filho do
   * bloco contenedor e ele iria parar 380px a esquerda de onde deveria. O `#root` e IRMAO do
   * `#whatsfill-host` — e por isso que da para prender um sem prender o outro.
   */
  check(!/html\.\S+\s+body\s*\{/.test(regra), 'e NUNCA o body — o painel e filho dele e encolheria junto');
  const fonteMain = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  check(fonteMain.includes('document.body.append(host)'), 'o painel continua pendurado no body (o que torna a regra acima obrigatoria)');

  /** **Tabela de PERMISSAO:** quem nao esta nela recebe so o padding, que e o que sempre funcionou. */
  check(regraDeEncaixe('mobiliza.app', 380) === '', 'a plataforma velha nao recebe regra extra');
  check(regraDeEncaixe('facebook.com', 380) === '', 'o Facebook tambem nao — la o cabecalho e static e o padding basta');
  check(regraDeEncaixe('', 380) === '' && regraDeEncaixe(null, 380) === '', 'hostname ilegivel nao inventa regra');

  check(regraDeEncaixe('www.mobiliza.me', 380).includes('#root'), 'o www nao esconde a plataforma');

  /** A largura passa pelo mesmo `clamp` do padding — senao os dois discordariam na borda. */
  check(regraDeEncaixe('mobiliza.me', 99999).includes('right: ' + MAX_WIDTH + 'px'), 'largura absurda e limitada igual ao padding');
  check(regraDeEncaixe('mobiliza.me', 10).includes('right: ' + MIN_WIDTH + 'px'), 'e a largura minima tambem');

  /**
   * **Dois lugares escrevendo o mesmo hostname divergem na primeira troca.** Se o `HOST` do
   * `mob.js` mudar e a tabela daqui nao, o painel volta a sobrepor — e o defeito aparece so
   * quando ele abre a plataforma.
   */
  check(regraDeEncaixe(HOST, 380).includes('#root'), 'a tabela do dock e o HOST do mob.js falam da MESMA plataforma');
}

grupo('POR O TEXTO NO CAMPO — e por que isto nao esta na lista das recusas');
{
  /**
   * **`setComposerText` saiu da lista das recusas em 28/10/2026, e nao por alguem achar que ja
   * dava.** Recusa ali significa *"eu estaria adivinhando e a adivinhacao seria INVISIVEL"* — e o
   * que entrega o texto aqui nao e hipotese nova: e a receita MEDIDA do `composer.js` (setter
   * nativo do prototipo + evento `input`), com a releitura DEPOIS de dois quadros como prova.
   *
   * Nao escrevendo, isto ESTOURA com o motivo na tela dele. Nenhuma das duas funcoes que ficaram
   * na lista tem isso: `sendMessageTemplate` e `enviarImagem` mandariam para o eleitor sem volta.
   */
  const jaFoi = globalThis.Event;
  globalThis.Event = class { constructor(ti, o = {}) { this.type = ti; Object.assign(this, o); } };

  function campo(placeholder) {
    const el = Object.create({ get value() { return this._v; }, set value(v) { this._v = String(v); } });
    Object.assign(el, {
      _v: '',
      placeholder,
      isContentEditable: false,
      eventos: [],
      getAttribute: () => null,
      getBoundingClientRect: () => ({ width: 300, height: 40 }),
      focus() {},
      dispatchEvent(ev) { this.eventos.push(ev?.type); return true; },
    });
    return el;
  }
  const tela = (campos) => ({ querySelectorAll: () => campos });

  const alvo = campo('Digite uma mensagem...');
  check(await setComposerText('bom dia', { raiz: tela([alvo]) }) === true, 'devolve `true`, como o caminho do mobiliza.app');
  check(alvo.value === 'bom dia', 'e o texto esta no campo');

  /**
   * **A conversa aberta NAO e exigida por dois sinais aqui, ao contrario do `sendText`** — e e
   * deliberado: este texto nao sai de lugar nenhum. O que estiver escrito esta na tela dele, na
   * conversa que ele esta vendo, e quem aperta enviar e ele (a escolha de 26/10).
   */
  const semGancho = campo('Digite uma mensagem...');
  check(await setComposerText('ok', { raiz: tela([semGancho]), janela: null }) === true, 'sem o gancho responder, ainda escreve: nada sai da tela');

  /** Conversa `aberto` (a tela medida): a mensagem diz O QUE FAZER, porque o conserto e um clique. */
  const soAnotacoes = tela([campo('Nota interna da conversa (só a equipe vê)...'), campo('Anotações sobre este contato...')]);
  let msg = '';
  try { await setComposerText('bom dia', { raiz: soAnotacoes }); } catch (e) { msg = String(e.message); }
  check(/ASSUMIR|Iniciar/.test(msg), 'conversa nao assumida: manda assumir, em vez de dizer so que falhou');
  check(!/anota|Nota/i.test(msg), 'e nao oferece escrever na anotacao');

  let vazia = '';
  try { await setComposerText('bom dia', { raiz: tela([]) }); } catch (e) { vazia = String(e.message); }
  check(/Abra uma conversa/.test(vazia), 'tela sem nada editavel: manda abrir uma conversa');

  /**
   * **O React que apaga o texto nao pode virar "escrevi".** Sem isto o painel diria que pos a
   * mensagem no campo e ele veria o campo vazio — a armadilha mais antiga daqui (*a API responde
   * 200 e IGNORA*) na forma de DOM.
   */
  const apaga = campo('Digite uma mensagem...');
  const proto = Object.getPrototypeOf(apaga);
  Object.defineProperty(proto, 'value', { get() { return ''; }, set() {}, configurable: true });
  let sumiu = '';
  try { await setComposerText('bom dia', { raiz: tela([apaga]) }); } catch (e) { sumiu = String(e.message); }
  check(/apagou/.test(sumiu), 'texto que a plataforma apagou estoura, e nao devolve `true`');
  check(/me avise|defeito do adaptador/i.test(sumiu), 'e a mensagem diz que o defeito e nosso, nao dele');

  globalThis.Event = jaFoi;
}

grupo('O NUMERO DO CANAL — e nao o numero do CONTATO');
{
  /**
   * **A primeira versao devolvia `conversa.numero`, que e o telefone da PESSOA do outro lado.**
   * Quem consome isso e `perfis.situacaoDoCanal`, a barreira que impede a rodada de responder com
   * o nome do candidato errado (25/09) — entao ela comparava a coisa errada nos dois sentidos:
   * nunca reconhecia o canal dele (e pulava todo contato), e **podia dizer `meu` por acidente** se
   * o telefone de um eleitor coincidisse com um numero cadastrado. Essa e a direcao perigosa:
   * ai a mensagem SAI com o nome do candidato errado.
   *
   * Na plataforma velha a funcao irma lia *"o numero da INSTANCIA que atende a conversa aberta"*
   * — coisa completamente diferente do numero do contato.
   */
  const ORIGEM = 'https://mobiliza.me';
  const CANAL = '11c6063d-0000-0000-0000-000000000001';
  const DO_CANAL = '5551990000001';
  const DO_CONTATO = '5551990000002';
  const canais = [{ id: CANAL, nome: 'Instancia 1', numero: DO_CANAL }];

  const janelaQue = (conversa) => {
    const ouvintes = [];
    const j = {
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por: 'os-dois', conversa } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  };

  const n = await numeroDoCanal({ janela: janelaQue({ id: 'c-1', numero: DO_CONTATO, instance_id: CANAL }), canais });
  check(n === DO_CANAL, 'devolve o numero da INSTANCIA');
  check(n !== DO_CONTATO, 'e nunca o numero do contato — e esse o defeito que isto trava');

  /** Conversa sem canal nao vira palpite: a barreira cai no uuid, que e identidade de verdade. */
  const semCanal = await numeroDoCanal({ janela: janelaQue({ id: 'c-1', numero: DO_CONTATO }), canais });
  check(semCanal === null, 'conversa sem `instance_id` devolve NAO SEI, nunca o numero do contato');

  const outro = await numeroDoCanal({ janela: janelaQue({ id: 'c-1', instance_id: 'uuid-que-nao-esta-na-conta' }), canais });
  check(outro === null, 'canal que nao esta na conta tambem e "nao sei"');

  const mudo = await numeroDoCanal({ janela: null, canais });
  check(mudo === null, 'gancho mudo nao vira numero nenhum');

  /**
   * **O cache existe porque isto roda a cada contato aberto**, e uma requisicao por `load()` e o
   * que derruba esta API (a licao do `contarMeuDia`, 24/09). Lista ja conhecida nao vira pedido.
   */
  let pedidos = 0;
  const contando = { get length() { pedidos++; return canais.length; }, find: (f) => canais.find(f) };
  await canaisFrescos({ canais: contando });
  check(pedidos === 0, 'lista injetada nao vira requisicao');
}

grupo('A RODADA TRAVADA — "ver mais" que mente faz o laco girar vinte vezes');
{
  /**
   * **Relato dele (28/10/2026): *"travou e ficou parado sem fazer nenhuma acao"*.** Eram tres
   * defeitos somados, e este e o que produzia o sintoma exato.
   *
   * `percorrerFila`, quando nao consegue abrir o item, chama `carregarMaisDaFila` — e `ok: true`
   * significa *"pedi mais fila, tente a MESMA posicao de novo"*. Como aqui nao ha nada a
   * carregar, o laco repetia a mesma falha **vinte vezes (`MAX_CARREGAMENTOS`), com pausa entre
   * cada uma**, sem abrir nada e sem escrever nada util. Na tela: uma rodada parada.
   */
  const r = await carregarMaisDaFila();
  check(r.ok === false, 'nao ha "ver mais" aqui, e isso NAO e sucesso');
  check(typeof r.reason === 'string' && r.reason.length > 10, 'e diz por que, para o veredito nao ficar mudo');

  /**
   * **O contrato e o que `percorrerFila` LE, e a primeira versao devolvia outra coisa.** Ela
   * respondia `{ ok: false, motivo: 'fila-acabou' }`, e quem chama faz `interrompida =
   * aberto.reason` — ou seja, a rodada parava com `undefined` e o veredito nao dizia nada.
   *
   * **Ao escrever adaptador, leia o CONSUMIDOR** — a mesma licao que custou `getTags` sem
   * `message` e `contarMeuDia` com `concluidos`.
   */
  const fonte = readFileSync(new URL('../src/lib/page-mob.js', import.meta.url), 'utf8');
  const corpo = fonte.slice(fonte.indexOf('export async function openQueueSession'));
  const ate = corpo.slice(0, corpo.indexOf('\nexport async function openNextSession'));
  for (const campo of ['reason', 'total', 'sessionId', 'avisoAba']) {
    check(ate.includes(campo + ':'), `openQueueSession devolve \`${campo}\`, que e o que percorrerFila le`);
  }
  check(!/motivo:\s*'fila-acabou'/.test(ate), 'e NAO devolve mais o codigo seco que a rodada nao sabia ler');
}

grupo('A FILA CHEGA INTEIRA — o `.map` a mais a esvaziava em TODA rodada');
{
  /**
   * **O defeito que produziu os dois relatos dele.** `mob.fila` ja devolve as linhas convertidas
   * e sem grupo; `queuePreview` convertia **de novo**, e a segunda passada perde o
   * `external_chat_id` — entao `ehGrupo` respondia `true` para TODO MUNDO e o filtro esvaziava a
   * lista.
   *
   * Com a fila vazia, `openQueueSession` nao tinha o que abrir. Antes isso virava vinte voltas do
   * laco (`carregarMaisDaFila` mentindo `ok: true`); consertado aquilo, virou **"abre e fecha
   * sozinho"**.
   */
  const linhas = [
    { id: 'c-1', nome: 'Primeira', grupo: false },
    { id: 'c-2', nome: 'Segunda', grupo: false },
  ];
  let limitePedido = 0;
  const fila = async (opcoes) => {
    limitePedido = opcoes.limite;
    return linhas;
  };

  const vista = await queuePreview(5, { fila });
  check(vista.length === 2, 'as duas conversas chegam — nenhuma some no caminho');
  check(limitePedido > 5, 'a consulta pede folga alem do que a rodada vai usar — a primeira linha pode ser grupo');
  check(vista[0].id === 'c-1', 'e na ordem em que a consulta devolveu');

  /** Quem filtra grupo e a consulta, UMA vez: filtrar de novo aqui foi o defeito. */
  const comGrupo = await queuePreview(5, { fila: async () => [{ id: 'g', grupo: true }] });
  check(comGrupo.length === 1, 'queuePreview nao refiltra: quem decide grupo e `mob.fila`, num lugar so');

  /**
   * E a ponta de cima: `openQueueSession` abre a conversa da posicao pedida, com a fila injetada.
   */
  const ORIGEM = 'https://mobiliza.me';
  const cliques = [];
  const janela = (() => {
    const ouvintes = [];
    const j = {
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        cliques.push(msg.payload.id);
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'abriu',
          payload: { pedido: msg.payload.pedido, ok: true, por: 'id' } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  })();

  const janelaQuePulaAPrimeira = (() => {
    const ouvintes = [];
    const j = {
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        const ok = msg.payload.id !== 'c-1';
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'abriu',
          payload: { pedido: msg.payload.pedido, ok, motivo: ok ? '' : 'nao-esta-na-tela', por: 'id' } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  })();
  const pulou = await openQueueSession(0, { fila, janela: janelaQuePulaAPrimeira });
  check(pulou.ok === true && pulou.sessionId === 'c-2', 'a primeira fora da tela nao encerra a rodada: abre a seguinte');

  /**
   * **Minhas so desenha quem ja foi assumido** (28/10/2026). A rodada dos Novos pede aberto,
   * ninguem da janela esta na tela, e parar mandando "role a fila" nao resolve: o filtro tirou
   * essa gente. Trocar para Todas e tentar de novo.
   */
  const tipos = [];
  let trocou = false;
  const janelaNaAbaErrada = (() => {
    const ouvintes = [];
    const j = {
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        tipos.push(msg.type);
        if (msg.type === 'aba') trocou = true;
        const ok = msg.type === 'aba' || msg.type === 'topo' || (msg.type === 'abrir' && trocou && msg.payload.id === 'c-1');
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: msg.type === 'abrir' ? 'abriu' : msg.type,
          payload: { pedido: msg.payload.pedido, ok, motivo: ok ? '' : 'nao-esta-na-tela', por: 'id' } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  })();
  const depoisDaAba = await openQueueSession(0, { aba: 'Novos', fila, janela: janelaNaAbaErrada });
  check(depoisDaAba.ok === true && depoisDaAba.sessionId === 'c-1', 'lista na aba errada: troca para Todas e abre a primeira');
  check(tipos.includes('aba'), 'e pediu a aba da tela ao gancho');

  const r = await openQueueSession(1, { fila, janela });
  check(r.ok === true && r.sessionId === 'c-2', 'a posicao 1 abre a SEGUNDA conversa');
  check(cliques[0] === 'c-2', 'e foi ela que o gancho recebeu para abrir');
  check(r.total === 2, 'o total da fila volta junto — e o que o veredito usa para dizer quantas restaram');

  const acabou = await openQueueSession(9, { fila, janela });
  check(acabou.ok === false && /acabou/.test(acabou.reason), 'posicao alem do fim diz que a fila acabou, com a contagem');
}

grupo('ESPERAR OS DOIS SINAIS — a recusa estava certa, a pressa e que estava errada');
{
  /**
   * **Relato dele (28/10/2026): *"comecar pelas nao atendidas tem dado erro"*.** A rodada clicava
   * a linha e chamava `clickIniciar` **na hora**; nesse instante so um dos dois sinais tinha
   * redesenhado (a linha da fila ja `ativa`, o painel da direita ainda nao), `conversaDaTela` lia
   * UMA vez, via `so-um-sinal` e recusava. O painel traduzia a excecao em `erro`, e `erro` PARA a
   * rodada inteira.
   *
   * **A guarda NAO afrouxou:** `os-dois` continua obrigatorio. O que mudou e dar tempo de os dois
   * concordarem, em vez de decidir no primeiro quadro.
   */
  const ORIGEM = 'https://mobiliza.me';

  /** Uma janela que responde `so-um-sinal` nas N primeiras perguntas e `os-dois` depois. */
  function janelaQueFirmaApos(n) {
    let perguntas = 0;
    const ouvintes = [];
    const j = {
      perguntas: () => perguntas,
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        perguntas++;
        const por = perguntas > n ? 'os-dois' : 'so-um-sinal';
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por, conversa: { id: 'c-1', status: 'aberto' } } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  }

  /** Relogio e sono injetados: o teste nao pode pagar 4 segundos de verdade. */
  const semDormir = { espera: async () => {}, agora: (() => { let n = 0; return () => (n += 50); })() };

  const firmou = janelaQueFirmaApos(2);
  const st = await esperarOsDoisSinais({ janela: firmou, ...semDormir, agora: (() => { let n = 0; return () => (n += 50); })() });
  check(st.porQuantosSinais === 'os-dois', 'espera ate os dois concordarem');
  check(firmou.perguntas() === 3, 'e perguntou tres vezes — a primeira e as duas ate firmar');

  /**
   * **Nao esperar para sempre:** o prazo e curto de proposito, e quem estoura devolve o que viu
   * para quem chama recusar com o nome certo.
   */
  const nuncaFirma = janelaQueFirmaApos(999);
  let voltas = 0;
  const desistiu = await esperarOsDoisSinais({
    janela: nuncaFirma,
    espera: async () => { voltas++; },
    agora: (() => { let n = 0; return () => (n += 1500); })(),
  });
  check(desistiu.porQuantosSinais === 'so-um-sinal', 'estourando o prazo, devolve o que viu');
  check(voltas > 0 && voltas < 10, `e nao fica preso no laco (${voltas} voltas)`);

  /** Gancho mudo nao vira espera: nao ha o que firmar, e quem chama tem outra mensagem para ele. */
  const mudo = await esperarOsDoisSinais({ janela: null, prazoMs: 0 });
  check(mudo.ganchoRespondeu === false, 'gancho mudo sai na hora');

  /**
   * **A MARCA e o texto porque e so o texto que atravessa a ponte:** no modo janela a excecao
   * viaja por `rpc` e vira mensagem, perdendo qualquer propriedade pendurada nela.
   */
  const recusa = await (async (f) => { try { await f(); return ''; } catch (e) { return String(e.message); } })(() => clickIniciar({ prazoMs: 0, janela: janelaQueFirmaApos(999) }));
  check(recusa.includes(MARCA_SINAL_FRACO), 'a recusa carrega a marca que o painel reconhece');
  check(ehRecusaPorSinalFraco(recusa) === true, 'e o detector a reconhece');

  check(ehRecusaPorSinalFraco('Nenhuma conversa aberta na tela — abra a conversa antes.') === false,
    'conversa nenhuma aberta NAO e sinal fraco — e outro caso, com outro desfecho');
  check(ehRecusaPorSinalFraco('Failed to fetch') === false, 'nem erro de rede');
  check(ehRecusaPorSinalFraco('') === false && ehRecusaPorSinalFraco(null) === false, 'e vazio nao vira nada');

  /**
   * **E a prova que importa: `conversaDaTela` USA a espera.** Testar `esperarOsDoisSinais`
   * sozinha nao pega o defeito — ele era a funcao ser chamada UMA vez. Aqui a janela firma na
   * terceira pergunta, e o que se exige e que o guarda tenha sido ATRAVESSADO: o erro que sobra e
   * o do passo seguinte (a rede, que nao existe no teste), nunca a recusa por sinal fraco.
   */
  const firmaNaTerceira = janelaQueFirmaApos(2);
  const depois = await (async (f) => { try { await f(); return ''; } catch (e) { return String(e.message); } })(
    () => clickIniciar({ janela: firmaNaTerceira, espera: async () => {}, agora: (() => { let n = 0; return () => (n += 50); })() })
  );
  check(firmaNaTerceira.perguntas() >= 3, `perguntou ate firmar (${firmaNaTerceira.perguntas()} vezes)`);
  check(!ehRecusaPorSinalFraco(depois), 'e o guarda foi ATRAVESSADO — nao recusou por sinal fraco');

  /**
   * **O painel tem de separar os dois**, senao a recusa de um contato para a rodada inteira. Aqui
   * isso se prova no texto do painel: e o unico lugar em que ele decide `pulado` em vez de `erro`.
   */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
  check(/page\.ehRecusaPorSinalFraco\(err\.message\)/.test(painel), 'o painel consulta o detector antes de chamar de erro');
  const trecho = painel.slice(painel.indexOf('page.ehRecusaPorSinalFraco'));
  check(trecho.slice(0, 400).includes("resultado: 'pulado'"), 'e o desfecho e PULAR, nao parar a rodada');
}

grupo('A TELA DESENHA DEPOIS DO CLIQUE — e quem le antes conclui que a aba trocou');
{
  /**
   * **Print dele (28/10/2026): *"Parei em contato: a aba trocou de atendimento no meio do
   * caminho"*.** O clique na linha volta na hora; o React desenha depois. `processarNovo` compara
   * `getState().sessionId` com o id que a rodada abriu, e nesse instante a tela ainda mostra a
   * conversa ANTERIOR — o painel concluia que a aba tinha trocado, que e `erro`, e `erro` para a
   * rodada inteira.
   *
   * **E a mesma causa do `so-um-sinal` (v3.222) num ponto mais ACIMA**, e por isso aquele
   * conserto nao bastou: ele vive em `conversaDaTela`, que roda DEPOIS desta checagem.
   * **Consertar o sintoma onde ele aparece nao conserta quem le a tela antes.**
   */
  const ORIGEM = 'https://mobiliza.me';

  /**
   * Uma janela que responde a conversa ANTIGA nas N primeiras perguntas e a nova depois — que e
   * exatamente o que a plataforma faz entre o clique e o desenho.
   */
  function janelaQueDesenhaApos(n, { antigo = 'c-velha', novo = 'c-nova' } = {}) {
    let perguntas = 0;
    const ouvintes = [];
    const j = {
      perguntas: () => perguntas,
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        const tipo = msg.payload && 'id' in msg.payload ? 'abriu' : 'aberta';
        if (tipo === 'abriu') {
          const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'abriu',
            payload: { pedido: msg.payload.pedido, ok: true, por: 'id' } } };
          for (const fn of [...ouvintes]) fn(ev);
          return;
        }
        perguntas++;
        const qual = perguntas > n ? novo : antigo;
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por: 'os-dois', conversa: { id: qual, status: 'aberto' } } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  }

  const relogio = () => { let n = 0; return () => (n += 50); };
  const fila = async () => [{ id: 'c-nova', nome: 'Fulana', grupo: false }];

  const janela = janelaQueDesenhaApos(2);
  const r = await openQueueSession(0, { fila, janela, espera: async () => {}, agora: relogio() });
  check(r.ok === true, 'a conversa abriu');
  check(r.firmou === true, 'e a TELA confirmou — e isso que faz `processarNovo` nao gritar "a aba trocou"');
  check(r.naTela === 'c-nova', 'a tela mostra quem a rodada clicou');
  check(janela.perguntas() >= 3, `esperou a tela desenhar (${janela.perguntas()} leituras)`);

  /**
   * **Nao firmando, `openQueueSession` continua devolvendo `ok` — e diz que nao firmou.**
   * Devolver `!ok` aqui PARARIA a rodada (`percorrerFila` faz `interrompida = reason; break`), e
   * uma conversa que demorou demais e um contato a pular, nao uma rodada a encerrar.
   */
  const lerda = janelaQueDesenhaApos(999);
  const r2 = await openQueueSession(0, { fila, janela: lerda, espera: async () => {}, agora: (() => { let n = 0; return () => (n += 1500); })() });
  check(r2.ok === true, 'tela que nao desenhou a tempo NAO derruba a abertura');
  check(r2.firmou === false, 'mas `firmou` diz a verdade');
  check(r2.naTela === 'c-velha', 'e diz quem estava na tela — o painel usa isso no motivo');

  /**
   * **Esperar "nenhuma conversa aberta" so faz sentido quando se espera ALGUEM.** Sem `id`, essa
   * e a resposta final (e o caso de quem chama sem ter clicado em nada); com `id`, e o estado
   * normal logo depois do clique, enquanto o React nao desenhou.
   */
  function janelaVaziaDepoisCheia(n, qual) {
    let perguntas = 0;
    const ouvintes = [];
    const j = {
      perguntas: () => perguntas,
      addEventListener: (ti, fn) => { if (ti === 'message') ouvintes.push(fn); },
      removeEventListener: (ti, fn) => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); },
      postMessage(msg) {
        perguntas++;
        const conversa = perguntas > n ? { id: qual, status: 'aberto' } : null;
        const ev = { source: j, origin: ORIGEM, data: { __whatsfill: 'mob-page', type: 'aberta',
          payload: { pedido: msg.payload.pedido, por: conversa ? 'os-dois' : '', conversa } } };
        for (const fn of [...ouvintes]) fn(ev);
      },
    };
    return j;
  }

  const vazia = janelaVaziaDepoisCheia(2, 'c-nova');
  const comId = await esperarOsDoisSinais({ id: 'c-nova', janela: vazia, espera: async () => {}, agora: relogio() });
  check(comId.sessionId === 'c-nova', 'com `id`, espera a conversa aparecer');

  const vazia2 = janelaVaziaDepoisCheia(2, 'c-nova');
  const semId = await esperarOsDoisSinais({ janela: vazia2, espera: async () => {}, agora: relogio() });
  check(semId.sessionId === null && vazia2.perguntas() === 1, 'sem `id`, "nenhuma aberta" e resposta final — nao espera');

  /** O painel tem de separar as duas causas, senao a rodada morre no primeiro desenho atrasado. */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
  // Ancora no CODIGO e nao no texto: o comentario logo acima cita a mesma frase, e o
  // `indexOf` caia nele — o teste falhava apontando para a prosa, nao para o ramo.
  const i = painel.indexOf("resultado: 'erro', motivo: 'a aba trocou");
  check(i > 0, 'o ramo de erro continua existindo — a aba que VOCE trocou ainda para a rodada');
  const antes = painel.slice(Math.max(0, i - 1500), i);
  check(antes.includes('firmou === false'), 'o painel olha `firmou` antes de chamar de "a aba trocou"');
  check(antes.includes("resultado: 'pulado'"), 'e nesse caso o desfecho e PULAR');
  check(/processar\(aberto\.sessionId, \{ contatosTratados, aberto \}\)/.test(painel), 'e o `aberto` chega em quem processa');
}

grupo('"SO ESCREVER": o campo esvaziar e o sinal de que ELE mandou');
{
  /**
   * **Pedido dele (28/10/2026): *"a extensao devia ter uma opcao de so escrever sem enviar e eu
   * mandava no final"*** — e, perguntado o que a rodada faz depois: *"quero que escreva na caixa,
   * eu reviso e quando eu der enter ela conclui e vai pro proximo contato"*.
   *
   * **A opcao ja existia e nao servia para a rodada**, e o motivo estava escrito nas proprias
   * travas: *"sem ele o texto so e inserido, e concluir fecharia o atendimento sem a pergunta ter
   * saido"*. O no se desfaz esperando: a conclusao passa a vir DEPOIS de o campo esvaziar.
   *
   * **O sinal e o campo, e nao ha mais barato.** O contador de mensagens do React nao foi medido,
   * e perguntar ao banco a cada tique e rajada contra a API.
   */
  function campoCom(valor, { editavel = false } = {}) {
    const el = Object.create({ get value() { return this._v; }, set value(v) { this._v = String(v); } });
    Object.assign(el, {
      _v: valor,
      placeholder: 'Digite uma mensagem...',
      isContentEditable: editavel,
      textContent: valor,
      getAttribute: () => null,
      getBoundingClientRect: () => ({ width: 300, height: 40 }),
    });
    return el;
  }
  const tela = (campos) => ({ querySelectorAll: () => campos });

  check(textoDoComposer({ raiz: tela([campoCom('bom dia')]) }) === 'bom dia', 'le o que esta escrito no campo');
  check(textoDoComposer({ raiz: tela([campoCom('')]) }) === '', 'campo vazio le vazio — e o sinal de que saiu');

  /**
   * **Sem campo na tela tambem e vazio, e isso e deliberado:** conversa trocada significa, para
   * quem espera, a mesma coisa que *"o texto que eu escrevi nao esta mais la"*.
   */
  check(textoDoComposer({ raiz: tela([]) }) === '', 'sem campo na tela devolve vazio, nao estoura');

  /** A nota NAO e o campo de mensagem — ler dela faria a rodada esperar para sempre. */
  const soNota = tela([campoCom('rascunho da equipe')]);
  soNota.querySelectorAll = () => {
    const n = campoCom('rascunho da equipe');
    n.placeholder = 'Nota interna da conversa (só a equipe vê)...';
    return [n];
  };
  check(textoDoComposer({ raiz: soNota }) === '', 'o texto da ANOTACAO nao conta como campo de mensagem');

  /**
   * **E a ponte do painel:** quem espera chama `page.textoDoComposer`, e ele tem de existir nos
   * dois modos — encaixado e janela. Sem a linha na ponte, o modo janela chamaria um nome que o
   * outro lado nao atende, e a espera morreria com "nao consegui ler o campo".
   */
  const ponte = readFileSync(new URL('../src/lib/rpc-host.js', import.meta.url), 'utf8');
  check(/textoDoComposer:/.test(ponte), 'a ponte do modo janela atende `textoDoComposer`');

  const fachada = readFileSync(new URL('../src/lib/page.js', import.meta.url), 'utf8');
  check(/export const textoDoComposer/.test(fachada), 'e o `page.js` o expoe nas duas plataformas');

  /**
   * **O painel so espera DENTRO da rodada.** Fora dela ele clicou em "Inserir", o texto esta la e
   * nao ha o que esperar — esperar ali travaria o botao.
   */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
  check(/if \(send && !state\.settings\.autoSend && state\.auto\.rodando\) \{/.test(painel),
    'a espera e condicionada a rodada estar andando');
  const i = painel.indexOf('async function esperarVoceEnviar');
  check(i > 0, '`esperarVoceEnviar` existe');
  const corpo = painel.slice(i, i + 1800);
  check(corpo.includes('state.auto.parar'), 'e o botao Parar da rodada corta a espera');

  /**
   * **O DISPARO mantem a trava**, e isso e deliberado: la a peca sai pela API, que nao olha a
   * caixa do envio automatico — rodar com ela desligada mandaria tudo assim mesmo, com a tela
   * dizendo que nao manda.
   */
  check(/o disparo manda pela API, nao pelo campo/.test(painel), 'o disparo continua exigindo o envio automatico, e diz por que');
}

grupo('O BOX DO MODO DE ENVIO — uma chave so, mostrada em dois lugares');
{
  /**
   * **Pedido dele (28/10/2026): *"crie o box que para mandar com enter ou automatico"*.**
   *
   * O interruptor ja existia (`settings.autoSend`) e nao dizia o modo: chamava-se *"Enviar
   * automatico (um clique manda a mensagem)"*, o que nao descreve o que acontece numa RODADA, e
   * vivia na Config — longe do botao "Comecar" (a licao de 06/09: controle longe do botao que o
   * usa e controle que ninguem encontra).
   *
   * **A chave e a MESMA, e e isso que este teste trava.** Uma segunda chave divergiria em
   * silencio: a tela dizendo um modo e a rodada fazendo outro.
   */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');

  const gravacoes = (painel.match(/salvarAjuste\(\{ autoSend:/g) || []).length;
  check(gravacoes === 1, `so UM lugar grava o modo de envio (achei ${gravacoes})`);
  check(/function boxDoModoDeEnvio\(/.test(painel), 'e ele e o box');

  // `sufixo:` com dois-pontos: sem isso a DECLARACAO (`{ sufixo = '' }`) entra na conta.
  const usos = (painel.match(/boxDoModoDeEnvio\(\{ sufixo: /g) || []).length;
  check(usos === 2, `o MESMO box aparece nos dois lugares — rodadas e Config (achei ${usos})`);

  /**
   * **`radio` e nao duas caixas:** duas caixas deixam marcar as duas (ou nenhuma), e aqui nao
   * existe meio-termo — ou ele manda com Enter, ou a extensao manda.
   */
  const i = painel.indexOf('function escolha(');
  const corpo = painel.slice(i, i + 900);
  check(/type: 'radio'/.test(corpo), 'a escolha e por radio');
  check(/name: nome/.test(corpo), 'com `name` compartilhado, que e o que faz o navegador cuidar do ou/ou');

  /**
   * **O `name` leva sufixo porque o painel redesenha e os DOIS lugares podem estar na pagina.**
   * Dois grupos com o mesmo nome brigariam pela marcacao.
   */
  check(/sufixo/.test(painel.slice(painel.indexOf('function boxDoModoDeEnvio'), painel.indexOf('function boxDoModoDeEnvio') + 500)),
    'e o grupo recebe sufixo, para os dois lugares nao brigarem');

  /** A caixa antiga saiu: duas telas para a mesma chave divergem na primeira correcao. */
  check(!/Enviar automático \(um clique manda a mensagem\)/.test(painel),
    'a caixa antiga da Config saiu — nao ha dois controles para a mesma chave');

  /** O aviso mostra o preco do modo ESCOLHIDO, nao os dois ao mesmo tempo. */
  const box = painel.slice(painel.indexOf('function boxDoModoDeEnvio'), painel.indexOf('function boxDoModoDeEnvio') + 2600);
  check(/state\.settings\.autoSend\s*\n?\s*\?/.test(box) || box.includes('state.settings.autoSend'),
    'o aviso depende do modo escolhido');
  check(/APAGAR o texto sem enviar/.test(box), 'e no modo Enter ele diz o risco de apagar sem mandar');
  check(/Disparo/.test(box), 'e avisa que o Disparo nao entra nesta escolha');

  /** A classe nova nao pode colidir com a janela de escolha da IA. */
  const css = readFileSync(new URL('../src/panel/panel.css', import.meta.url), 'utf8');
  check(/\.wf-radios/.test(css), 'a classe nova tem estilo proprio');
  check(/wf-radios/.test(painel) && !/class: 'wf-escolha' \}\);\n\s*for \(const op/.test(painel),
    'e nao reusa `wf-escolha`, que ja e da janela da IA');
}

grupo('A ABA AUTOMATIZADO: um interruptor, um lugar, e a ordem do trabalho');
{
  /**
   * **Relato dele (28/10/2026): *"ficou pela metade, comecar pelas nao atendidas ficou sem a
   * opcao (...) devia estar primeiro os novos e em seguida as minhas, revise o painel"*.**
   *
   * Eu tinha posto o box DENTRO do cartao dos Meus — e a doutrina ja estava escrita no proprio
   * arquivo, sobre a caixa da IA: *"um interruptor, um lugar, acima dos dois botoes de comecar"*.
   * `settings.autoSend` vale para as DUAS filas; dentro de um cartao ela parece ser daquela fila,
   * que e o defeito de 06/09 repetido.
   */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
  // Ate o proximo `function render` de modulo: a aba cresceu com os comentarios, e um numero
  // fixo de caracteres cortava antes das chamadas que este grupo compara.
  const inicio = painel.indexOf('function renderAutomatizado');
  const aba = painel.slice(inicio, painel.indexOf('\n  function render', inicio + 10));

  const iBox = aba.indexOf('boxDoModoDeEnvio(');
  const iNovos = aba.indexOf('renderCartaoNovos(');
  const iMeus = aba.indexOf('renderCartaoRespondidos(');

  check(iBox > 0 && iNovos > 0 && iMeus > 0, 'os tres estao na aba');
  check(iBox < iNovos && iBox < iMeus, 'o box fica ACIMA dos dois botoes de comecar, como a caixa da IA');
  check(iNovos < iMeus, 'e as nao atendidas vem ANTES das minhas — a ordem do trabalho, pedido dele');

  /** E ele NAO pode estar dentro de nenhum dos dois cartoes: tres copias na tela convidam a "consertar" uma. */
  const cartaoMeus = painel.slice(painel.indexOf('function renderCartaoRespondidos'), painel.indexOf('function renderCartaoRespondidos') + 2500);
  check(!cartaoMeus.includes('boxDoModoDeEnvio'), 'o box NAO mora dentro do cartao das minhas');
  const cartaoNovos = painel.slice(painel.indexOf('function renderCartaoNovos'), painel.indexOf('function renderCartaoNovos') + 2500);
  check(!cartaoNovos.includes('boxDoModoDeEnvio'), 'nem dentro do cartao das nao atendidas');

  /**
   * **A prosa da aba tambem envelheceu com a plataforma:** no mobiliza.app a rodada andava pela
   * lista da esquerda do jeito que ele a filtrasse; aqui ela CONSULTA por aba. Dizer o contrario
   * mandaria ele filtrar a tela para mudar a rodada — e nada mudaria.
   */
  check(/A fila vem da consulta, não do filtro/.test(painel), 'a tela diz de onde a fila vem nesta plataforma');
  check(/A fila sai da consulta à plataforma, por aba/.test(painel), 'e o cartao da fila tambem');
  check(/Não atendidas: começar a conversa/.test(painel), 'o TITULO do cartao fala a lingua da plataforma');
  check(/Minhas: conferir e responder/.test(painel), 'e o da outra fila tambem');
}

grupo('O MODO "EU MANDO" NAO PODE SER IMPEDIMENTO DE TELA');
{
  /**
   * **Print dele (28/10/2026): *"bloqueando o modo novo"*, com o botao das nao atendidas apagado
   * e a tarja *"Precisa do Enviar automatico ligado (acima)"*.**
   *
   * As travas sairam das FUNCOES na v3.224 e **ficaram nos CARTOES** — e no cartao dos Novos a
   * trava nao so avisa: ela **desabilita o botao**. O modo que ele acabou de pedir ficava
   * inalcancavel justamente na fila que ele mais usa.
   *
   * **A licao: ao destravar um caminho, procure as travas da TELA tambem.** Uma trava que nao
   * deixa apertar e mais forte que a que recusa depois do clique — e e a que nao aparece quando
   * se procura pelo texto do erro.
   */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');

  const corte = (nome) => {
    const i = painel.indexOf('function ' + nome);
    return i < 0 ? '' : painel.slice(i, painel.indexOf(chr10 + '  function ', i + 10));
  };
  const chr10 = String.fromCharCode(10);

  for (const cartao of ['renderCartaoNovos', 'renderCartaoRespondidos']) {
    const corpo = corte(cartao);
    check(corpo.length > 100, cartao + ': achei o cartao');
    check(!/impedimentos\.push\('Precisa do "Enviar automático"/.test(corpo),
      cartao + ' nao trava mais pelo modo de envio');
  }

  /** E o botao continua desabilitando pelo que DEVE desabilitar: a rodada ja andando. */
  check(/comecar\.disabled = state\.auto\.rodando/.test(painel), 'o botao so desabilita com a rodada andando');

  /**
   * **O DISPARO continua travado, e agora diz por que.** La a peca sai pela API, que nao passa
   * pelo campo — nao ha onde ele dar Enter.
   */
  check(/O disparo manda pela API, nao pelo campo/.test(painel), 'o disparo explica, em vez de so exigir');

  /**
   * **E a tarja do Ritmo parou de mandar desfazer.** Ela dizia *"sem ele nada e enviado de
   * verdade"*, exato ate a v3.224 — hoje a mensagem SAI (quem manda e ele) e a conclusao vem
   * depois. Mantida, ela mandaria desligar o modo que ele pediu.
   */
  check(!/sem ele nada é enviado de verdade/.test(painel), 'a tarja que mandava desfazer saiu');
  check(/quem dá o ritmo é você/.test(painel), 'e no lugar dela ficou o que continua sendo verdade');
}

fim();
