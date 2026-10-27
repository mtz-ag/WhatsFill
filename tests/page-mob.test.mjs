/**
 * **O ADAPTADOR DA PLATAFORMA NOVA** — o que estes testes travam e cada ponto em que eu quase
 * escrevi hipotese e a medicao desmentiu.
 *
 * Rode: node tests/page-mob.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim } from './_harness.mjs';
import * as adaptador from '../src/lib/page-mob.js';
import { lerSessao } from '../src/lib/mob.js';
import * as adaptadorApi from '../src/lib/api-mob.js';
import { grafiasDaEtiqueta, filtroDeEtiqueta, getMessageTemplates } from '../src/lib/api-mob.js';
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
  const naoMedidos = [
    ['sendText', sendText],
    ['setComposerText', setComposerText],
    ['clickIniciar', clickIniciar],
    ['clickConcluir', clickConcluir],
    ['clickReiniciar', clickReiniciar],
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
  check(deMao === 1, `so a contagem monta requisicao de mao (achei ${deMao}) — o resto passa pelo mob.buscar`);
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
  check(!soCodigo.includes('instance_id'), 'nenhuma consulta filtra por `instance_id`: a coluna nao existe em whatsapp_templates');
}

fim();
