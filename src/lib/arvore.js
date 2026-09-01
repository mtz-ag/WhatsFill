/**
 * arvore.js — o fluxo de atendimento como ÁRVORE, que é como ele desenhou.
 *
 * Pedido dele (01/09/2026), com o diagrama no quadro: a decisão não é uma lista que se lê de cima
 * para baixo, é uma árvore que ramifica por SITUAÇÃO — "anúncio, pessoa nova" de um lado, "pessoa
 * retornando" do outro — e só depois por tipo de mensagem, até a ação. E: *"está incompleto ainda
 * o fluxo, ele precisa ser incrementado de acordo com a demanda"*, ou seja, quem acrescenta ramo
 * é ele, quando a situação aparecer, sem esperar por mim.
 *
 * ## A fronteira que mantém isso seguro
 *
 * **Ele monta a árvore; ele não escreve condição em texto livre.** Escolha dele entre as três
 * opções que ofereci (01/09): a condição de um ramo é (a) um SINAL da lista — coisas que o código
 * já sabe reconhecer e que têm teste — e/ou (b) palavras que ele digita. Nunca uma expressão
 * inventada na hora. O motivo é o mesmo de sempre: o que decide isto sai para eleitor real, em
 * nome de um mandato, e mensagem de WhatsApp não volta.
 *
 * ## Como a árvore anda
 *
 * Percorre os irmãos em ordem; o primeiro que CASA é seguido. Dentro dele, os filhos, recursivo.
 *
 * **Nó que casa mas não resolve NÃO engole o contato**: se ele não tem ação e nenhum filho dele
 * casou, a busca continua nos irmãos de baixo. Parar ali seria um buraco silencioso — o ramo pela
 * metade (que vai existir, porque a árvore cresce "de acordo com a demanda") faria o contato sair
 * da rodada sem nada acontecer, e ninguém descobriria olhando a tela. A janela marca esses nós.
 *
 * ## Compatibilidade com a tabela de regras
 *
 * Um nó pode ser **respaldado por uma regra do código** (`regra: 'sem-interesse'`): a condição e a
 * tecla saem de `REGRAS`, com os testes que elas já têm. `arvorePadrao()` devolve exatamente a
 * tabela de hoje, achatada, e o teste exige que ela decida **igual** a `sugerirAcao` — ligar a
 * árvore não muda nada até ele mexer. As dezesseis regras continuam sendo o miolo; a árvore é
 * onde ele as organiza e acrescenta o que falta.
 *
 * Puro e sem dependência de navegador, como tudo que decide sobre gente real neste projeto.
 */

import { REGRAS, SOBRE, TECLAS } from './sugestao.js';

/**
 * Os SINAIS que um ramo pode usar como condição — o menu que ele vê ao criar um nó.
 *
 * Cada um é uma chave que o painel já calcula e põe no contexto. É por isso que a lista é
 * fechada: sinal novo aqui exige alguém calcular a coisa lá, com teste. `rotulo` é o que aparece
 * no menu; `nao` é como se lê a versão negada, porque "não é hater" e "não veio de anúncio" são
 * condições legítimas e ler `NÃO <rótulo>` fica torto em português.
 */
export const SINAIS = [
  { id: 'veioDeAnuncio', rotulo: 'Veio de um anúncio', nao: 'Não veio de anúncio' },
  { id: 'jaRespondemosAntes', rotulo: 'Já entregamos algo antes (é retorno)', nao: 'Nunca entregamos nada (é primeira vez)' },
  { id: 'jaPediramDados', rotulo: 'O formulário já saiu para ela', nao: 'O formulário nunca saiu' },
  { id: 'temEtiquetaDeCidade', rotulo: 'Já tem etiqueta de cidade', nao: 'Ainda não tem etiqueta de cidade' },
  { id: 'semInteresse', rotulo: 'Recusou ou veio hostilizar (hater)', nao: 'Não recusou nem hostilizou' },
  { id: 'etiquetaQueDispensa', rotulo: 'Tem a etiqueta que dispensa da fila', nao: 'Não tem a etiqueta que dispensa' },
  { id: 'pedeRespostaPessoal', rotulo: 'Áudio sem transcrição, arquivo ou texto longo', nao: 'Não é áudio, arquivo nem texto longo' },
  { id: 'respondeuComoAjudar', rotulo: 'Respondeu à nossa pergunta "em que posso ajudar?"', nao: 'Não é resposta à nossa pergunta' },
  { id: 'pedeAlgoIndefinido', rotulo: 'Pediu algo e não disse o quê', nao: 'Não pediu nada em aberto' },
  { id: 'ultimaEhDespedida', rotulo: 'Só se despediu ("amém", "é nós", "abraço")', nao: 'Não foi despedida' },
  { id: 'ultimaEhSoReacao', rotulo: 'Só figura, emoji, sticker ou link', nao: 'Escreveu alguma coisa' },
  { id: 'rajadaEhSoRepasse', rotulo: 'Só repassa link e vídeo de outras pessoas', nao: 'Não é só repasse' },
  { id: 'perguntaAberta', rotulo: 'Fez uma pergunta de razão ou de posição', nao: 'Não fez pergunta' },
  { id: 'soExpressaApoio', rotulo: 'Só apoio, sem pergunta e sem pedido', nao: 'Não é só apoio' },
  { id: 'voltouPorOutroAnuncio', rotulo: 'Voltou clicando em outro anúncio', nao: 'Não voltou por anúncio' },
  { id: 'nomeSemSentido', rotulo: 'O nome do cadastro não serve', nao: 'O nome do cadastro serve' },
  { id: 'respondidoHoje', rotulo: 'Você já respondeu hoje', nao: 'Você ainda não respondeu hoje' },
  { id: 'momentoJaEnviado', rotulo: 'A mensagem do momento já saiu para ela', nao: 'A mensagem do momento ainda não saiu' },
  { id: 'pedidoHoje', rotulo: 'O formulário saiu hoje', nao: 'O formulário não saiu hoje' },
  { id: 'enviadoHoje', rotulo: 'Já mandamos o modelo hoje', nao: 'Não mandamos modelo hoje' },
  { id: 'modeloJaNaConversa', rotulo: 'O modelo já está na conversa', nao: 'O modelo não está na conversa' },
  { id: 'interessePerguntado', rotulo: 'Já perguntamos se ela quer conteúdo', nao: 'Nunca perguntamos o interesse' },
  { id: 'podeEnviar', rotulo: 'Há conteúdo reconhecido com modelo mapeado', nao: 'Não há modelo mapeado' },
];

/** O sinal existe? Ramo que aponta para sinal inexistente nunca casaria, e calado. */
export function sinalConhecido(id) {
  return SINAIS.some((s) => s.id === id);
}

/**
 * Minúsculas e sem acento, para as palavras dele casarem com o que a pessoa escreveu.
 *
 * Local de propósito: `cities.semAcentoNemCaixa` faria este arquivo puxar a lista do IBGE inteira
 * por seis linhas de código.
 */
function achatar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * As palavras casam no texto?
 *
 * `onde: 'ultima'` olha só a última mensagem dela — é o padrão, porque o fluxo é sobre o que a
 * pessoa ACABOU de fazer. `onde: 'qualquer'` varre a conversa toda, para o caso de ela ter dito a
 * coisa três mensagens atrás.
 *
 * Casa por CONTEÚDO e não por palavra inteira: ele vai digitar "bom dia" e "boa tarde", e exigir
 * fronteira de palavra quebraria em pontuação colada, que é como a base escreve.
 */
function alvoDoTexto(ctx, onde) {
  return onde === 'qualquer'
    ? achatar((ctx.textos || []).join(' \n '))
    : achatar(ctx.ultimoTexto || (ctx.textos || []).slice(-1)[0] || '');
}

/**
 * QUAL palavra casou — e não se alguma casou.
 *
 * O motivo vai para a caixa da rodada, em cima da decisão, e é o que ele lê antes de apertar a
 * tecla. Listar as cinco palavras do ramo ("escreveu ajuda financeira, cesta basica, remedio…")
 * não diz o que a pessoa escreveu; diz o que o ramo procura, que é outra coisa e é inútil na hora
 * de decidir. A frase que serve nomeia a palavra que bateu.
 */
export function palavraQueCasou(palavras, ctx, onde) {
  const alvo = alvoDoTexto(ctx || {}, onde);
  for (const p of palavras || []) {
    const chata = achatar(p);
    if (chata && alvo.includes(chata)) return p;
  }
  return null;
}

function palavrasCasam(palavras, ctx, onde) {
  const lista = (palavras || []).filter(Boolean);
  if (!lista.length) return true;
  return !!palavraQueCasou(lista, ctx, onde);
}

/** A regra do código que respalda este nó, se houver. */
function regraDoNo(no) {
  return no.regra ? REGRAS.find((r) => r.id === no.regra) || null : null;
}

/**
 * Este nó descreve o contato?
 *
 * Nó respaldado por regra usa a condição do CÓDIGO — é o que preserva os testes das dezesseis.
 * Nó dele soma sinal e palavras com E: os dois têm que valer. Nenhum dos dois preenchido é um nó
 * de agrupamento, que casa sempre (uma pasta, não uma decisão).
 */
export function casa(no, ctx) {
  if (!no || no.desligado) return false;

  const regra = regraDoNo(no);
  if (regra) {
    try {
      return !!regra.quando(ctx || {});
    } catch (_) {
      // Regra quebrada não derruba a rodada: ela simplesmente não casa.
      return false;
    }
  }

  const cond = no.condicao || {};
  if (cond.sinal) {
    if (!sinalConhecido(cond.sinal)) return false;
    const valor = !!(ctx || {})[cond.sinal];
    if (cond.negar ? valor : !valor) return false;
  }
  return palavrasCasam(cond.palavras, ctx || {}, cond.onde);
}

/**
 * A ação deste nó, já contando a tecla que ele fixou na janela.
 *
 * Devolve `null` quando o nó não resolve nada — e isso é normal: nó de agrupamento existe para
 * ramificar, não para decidir.
 */
export function acaoDoNo(no, ctx, fixadas) {
  const regra = regraDoNo(no);
  if (regra) {
    const fixa = fixadas?.[regra.id];
    const tecla = fixa || (typeof regra.tecla === 'function' ? regra.tecla(ctx || {}) : regra.tecla);
    if (!tecla) return null;
    let motivo = '';
    try {
      motivo = regra.motivo(ctx || {});
    } catch (_) {
      motivo = SOBRE[regra.id]?.rotulo || regra.id;
    }
    return { tecla, resposta: null, motivo };
  }

  const acao = no.acao || {};
  if (acao.resposta) return { tecla: null, resposta: acao.resposta, motivo: motivoDele(no, ctx) };
  if (acao.tecla) return { tecla: acao.tecla, resposta: null, motivo: motivoDele(no, ctx) };
  return null;
}

/** A frase que aparece em cima da caixa da rodada, para um ramo que é dele. */
function motivoDele(no, ctx) {
  const cond = no.condicao || {};
  const sinal = SINAIS.find((s) => s.id === cond.sinal);
  const partes = [];
  if (sinal) partes.push(cond.negar ? sinal.nao.toLowerCase() : sinal.rotulo.toLowerCase());
  const casou = palavraQueCasou(cond.palavras, ctx || {}, cond.onde);
  if (casou) partes.push(`escreveu "${casou}"`);
  const porque = partes.join(' e ');
  return porque ? `${no.rotulo || 'ramo do fluxo'}: ${porque}.` : `${no.rotulo || 'ramo do fluxo'}.`;
}

/**
 * A decisão da árvore, ou `null` quando nenhum ramo resolve.
 *
 * `null` é resposta legítima e comum — é o que manda o caso para a IA, exatamente como a tabela
 * fazia. O `caminho` volta junto porque a janela acende os nós percorridos, e porque o log da
 * rodada tem que dizer POR ONDE a decisão passou: "veio de anúncio → mensagem padrão → pedir
 * dados" explica-se sozinho; "regra 8" não.
 *
 * @returns {{id:string, tecla:string|null, resposta:string|null, motivo:string, caminho:string[]}|null}
 */
export function decidir(ctx, arvore, fluxo) {
  const fixadas = fluxo?.teclas || {};
  const c = ctx || {};

  const andar = (nos, trilha) => {
    for (const no of nos || []) {
      if (!casa(no, c)) continue;
      const daqui = [...trilha, no.id];

      // Filho primeiro: o mais específico vence o mais geral, que é o ponto de ter árvore.
      const doFilho = andar(no.filhos, daqui);
      if (doFilho) return doFilho;

      const acao = acaoDoNo(no, c, fixadas);
      if (acao) {
        return { id: no.id, tecla: acao.tecla, resposta: acao.resposta, motivo: acao.motivo, caminho: daqui };
      }
      // Casou e não resolveu: continua nos irmãos. Ver o cabeçalho — parar aqui seria um buraco.
    }
    return null;
  };

  return andar(arvore, []);
}

// ---- construção -------------------------------------------------------------

let contador = 0;
/** Id de nó. Curto porque aparece no log da rodada e em `store`, que não é infinito. */
export function novoId() {
  contador += 1;
  return `n${Date.now().toString(36)}${contador.toString(36)}`;
}

/** Um nó vazio, do jeito que a janela cria quando ele clica em "novo ramo". */
export function noVazio(rotulo) {
  return {
    id: novoId(),
    rotulo: rotulo || 'ramo novo',
    regra: null,
    condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
    acao: null,
    desligado: false,
    filhos: [],
  };
}

function noDeRegra(id) {
  return {
    id: `r:${id}`,
    rotulo: SOBRE[id]?.rotulo || id,
    regra: id,
    condicao: null,
    acao: null,
    desligado: false,
    filhos: [],
  };
}

/**
 * A árvore de partida: a tabela de hoje, achatada, **na ordem que ele já tinha salvo**.
 *
 * Tem que decidir IGUAL a `sugerirAcao` — há teste exigindo isso —, senão abrir a janela mudaria
 * o comportamento da rodada sem ninguém pedir. Por isso ela nasce plana: agrupar já é uma
 * decisão, e decisão é dele.
 *
 * A ordem e as desligadas que ele tinha na versão de lista vêm junto. Sem isso, semear a árvore
 * jogaria fora o trabalho dele em silêncio — a lista voltaria à ordem do código.
 */
export function arvorePadrao(fluxo) {
  const desligadas = new Set(fluxo?.desligadas || []);
  const vistos = new Set();
  const salva = (fluxo?.ordem || []).filter((id) => REGRAS.some((r) => r.id === id) && !vistos.has(id) && vistos.add(id));

  let ids = REGRAS.map((r) => r.id);
  if (salva.length) {
    // Mesma regra do `ordenar`: id que a ordem salva não conhece herda a posição do vizinho de
    // cima. Regra nova do código não pode nascer no fim da árvore dele.
    const pos = new Map(salva.map((id, i) => [id, i]));
    let herdada = -1;
    const chave = new Map();
    REGRAS.forEach((r, i) => {
      if (pos.has(r.id)) herdada = pos.get(r.id);
      chave.set(r.id, pos.has(r.id) ? pos.get(r.id) : herdada + 0.001 * (i + 1));
    });
    ids = ids.slice().sort((a, b) => chave.get(a) - chave.get(b));
  }

  return ids.map((id) => ({ ...noDeRegra(id), desligado: desligadas.has(id) }));
}

/**
 * O desenho do quadro dele, virado árvore.
 *
 * Duas coisas que o desenho não tinha e que entram aqui de propósito:
 *
 * 1. **As protecões ficam ACIMA da bifurcação.** Recusa, denúncia respondida, despedida, pergunta
 *    aberta e a etiqueta que dispensa valem para pessoa nova e para quem retorna — o próprio
 *    desenho dele repete "hater xingando" nos dois lados, que é a mesma coisa dita duas vezes.
 *    Sem isto, carregar este preset apagaria a regra que impede material de campanha em cima de
 *    denúncia (o erro de 01/09) e a que impede etiquetar como sem interesse quem só disse que não
 *    podia ir ao evento.
 * 2. **Os dois ramos que ele desenhou e o código não tinha**: saudação escrita ("bom dia") de quem
 *    está voltando, e o pedido de ajuda financeira com a resposta pronta.
 */
export function arvoreDoQuadro() {
  const protecoes = [
    'sem-interesse',
    'etiqueta-dispensa-da-fila',
    'ultima-pede-resposta-pessoal',
    'respondeu-nossa-pergunta',
    'ultima-e-despedida',
    'pergunta-aberta',
  ].map(noDeRegra);

  const novaPessoa = {
    ...noVazio('anúncio — pessoa nova'),
    condicao: { sinal: 'jaRespondemosAntes', negar: true, palavras: [], onde: 'ultima' },
    filhos: [
      { ...noVazio('pediu algo e não disse o quê'), regra: 'pediu-algo-sem-dizer-o-que', condicao: null },
      { ...noVazio('mensagem do anúncio + apoio'), regra: 'so-expressa-apoio', condicao: null },
      { ...noVazio('mensagem padrão do anúncio'), regra: 'nunca-pediram-dados', condicao: null },
      { ...noVazio('o nome do cadastro não serve'), regra: 'nome-sem-sentido', condicao: null },
    ],
  };

  const retornando = {
    ...noVazio('pessoa retornando'),
    condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
    filhos: [
      {
        ...noVazio('só mandou bom dia, boa tarde ou boa noite'),
        condicao: { sinal: '', negar: false, palavras: ['bom dia', 'boa tarde', 'boa noite', 'bom domingo'], onde: 'ultima' },
        acao: { tecla: '5', resposta: null },
      },
      {
        ...noVazio('pediu ajuda financeira'),
        condicao: { sinal: '', negar: false, palavras: ['ajuda financeira', 'preciso de dinheiro', 'me ajuda com', 'cesta basica', 'remedio'], onde: 'ultima' },
        acao: { tecla: null, resposta: 'pedido-ajuda' },
      },
      { ...noVazio('voltou por outro anúncio'), regra: 'voltou-por-outro-anuncio', condicao: null },
      { ...noVazio('mandou figura, emoji, sticker ou link'), regra: 'ultima-e-so-reacao', condicao: null },
      { ...noVazio('respondeu com os dados'), regra: 'conteudo-pedido', condicao: null },
      { ...noVazio('já entregamos algo antes'), regra: 'ja-respondemos-antes', condicao: null },
    ],
  };

  const resto = ['nunca-perguntaram-interesse', 'pedido-hoje-sem-resposta'].map(noDeRegra);

  return [...protecoes, novaPessoa, retornando, ...resto];
}

// ---- edição (a janela mexe na árvore por aqui) ------------------------------

/** Todos os nós, achatados, na ordem em que aparecem. Útil para contar e para validar. */
export function todosOsNos(arvore) {
  const saida = [];
  const anda = (nos, pai, nivel) => {
    for (const no of nos || []) {
      saida.push({ no, pai, nivel });
      anda(no.filhos, no, nivel + 1);
    }
  };
  anda(arvore, null, 0);
  return saida;
}

/** O nó e a lista de irmãos onde ele mora — é o que toda edição precisa saber. */
export function localizar(arvore, id) {
  const anda = (nos, pai) => {
    for (let i = 0; i < (nos || []).length; i++) {
      if (nos[i].id === id) return { no: nos[i], irmaos: nos, i, pai };
      const dentro = anda(nos[i].filhos, nos[i]);
      if (dentro) return dentro;
    }
    return null;
  };
  return anda(arvore, null);
}

/** Cópia funda: toda edição devolve árvore nova, para o desenho nunca ver estado pela metade. */
const copiar = (arvore) => JSON.parse(JSON.stringify(arvore));

/** Sobe ou desce o nó ENTRE OS IRMÃOS. Prioridade é a ordem entre irmãos, não na árvore toda. */
export function mover(arvore, id, passo) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  const destino = achado.i + passo;
  if (destino < 0 || destino >= achado.irmaos.length) return arvore;
  const [tirado] = achado.irmaos.splice(achado.i, 1);
  achado.irmaos.splice(destino, 0, tirado);
  return nova;
}

/**
 * Aninhar: o nó vira filho do irmão de cima.
 *
 * É como se diz "isto só vale dentro daquilo" — o passo que transforma lista em árvore. Sem irmão
 * acima não há onde aninhar, e devolver a árvore intacta é melhor que inventar um pai.
 */
export function aninhar(arvore, id) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado || achado.i === 0) return arvore;
  const acima = achado.irmaos[achado.i - 1];
  const [tirado] = achado.irmaos.splice(achado.i, 1);
  acima.filhos = acima.filhos || [];
  acima.filhos.push(tirado);
  return nova;
}

/** Desaninhar: o nó sai de dentro do pai e vira irmão dele, logo abaixo. */
export function desaninhar(arvore, id) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado || !achado.pai) return arvore;
  const doPai = localizar(nova, achado.pai.id);
  if (!doPai) return arvore;
  const [tirado] = achado.irmaos.splice(achado.i, 1);
  doPai.irmaos.splice(doPai.i + 1, 0, tirado);
  return nova;
}

/** Acrescenta um filho ao nó (ou na raiz, com `id` nulo). */
export function acrescentar(arvore, id, no) {
  const nova = copiar(arvore);
  const novo = no || noVazio();
  if (!id) {
    nova.push(novo);
    return nova;
  }
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  achado.no.filhos = achado.no.filhos || [];
  achado.no.filhos.push(novo);
  return nova;
}

/**
 * Apaga o nó **e os filhos dele**.
 *
 * Os filhos vão junto de propósito: promover os filhos de um ramo apagado os solta numa condição
 * que não é mais a deles — "só mandou bom dia" fora de "pessoa retornando" passa a valer para
 * quem chegou agora. A janela avisa quantos vão junto antes de apagar.
 */
export function apagar(arvore, id) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  achado.irmaos.splice(achado.i, 1);
  return nova;
}

/** Troca campos de um nó. */
export function editar(arvore, id, mudancas) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  Object.assign(achado.no, mudancas);
  return nova;
}

// ---- o canvas: posição, religação e arrumação ------------------------------

/**
 * `id` está DENTRO de `possivelPai`?
 *
 * A guarda que impede o defeito clássico do editor de árvore: arrastar um ramo para dentro de um
 * filho dele mesmo. O pedaço arrastado sairia da árvore junto com o novo pai e sumiria da tela —
 * com os ramos dele, que continuariam gravados e invisíveis.
 */
export function ehDescendente(arvore, possivelPai, id) {
  const achado = localizar(arvore, possivelPai);
  if (!achado) return false;
  return arvoreTem(achado.no.filhos, id);
}

function arvoreTem(nos, id) {
  for (const no of nos || []) {
    if (no.id === id) return true;
    if (arvoreTem(no.filhos, id)) return true;
  }
  return false;
}

/**
 * Muda o PAI de um ramo — é o que acontece quando ele arrasta uma caixa em cima de outra.
 *
 * `paiId` nulo solta o ramo na raiz. Devolve a árvore intacta quando o movimento não faz sentido
 * (o nó dentro de si mesmo, ou dentro de um filho dele): recusar sem mexer é melhor que aceitar e
 * fazer sumir, porque na tela "sumiu" e "está no lugar errado" parecem a mesma coisa.
 */
export function reparentar(arvore, id, paiId) {
  if (id === paiId) return arvore;
  if (paiId && ehDescendente(arvore, id, paiId)) return arvore;

  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  const [tirado] = achado.irmaos.splice(achado.i, 1);

  if (!paiId) {
    nova.push(tirado);
    return nova;
  }
  const destino = localizar(nova, paiId);
  if (!destino) return arvore;
  destino.no.filhos = destino.no.filhos || [];
  destino.no.filhos.push(tirado);
  return nova;
}

/** Onde a caixa está no quadro. Move o ramo inteiro quando `comFilhos`. */
export function posicionar(arvore, id, x, y, comFilhos) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  const dx = Math.round(x) - (achado.no.x || 0);
  const dy = Math.round(y) - (achado.no.y || 0);
  const empurrar = (no) => {
    no.x = Math.round((no.x || 0) + dx);
    no.y = Math.round((no.y || 0) + dy);
    if (comFilhos) for (const f of no.filhos || []) empurrar(f);
  };
  empurrar(achado.no);
  return nova;
}

/**
 * A PRIORIDADE entre irmãos passa a ser a posição na tela: o mais alto é olhado primeiro.
 *
 * É a única regra que funciona num quadro livre. A alternativa — guardar uma ordem invisível ao
 * lado da posição — faria a tela mostrar um ramo acima do outro e a rodada obedecer o contrário,
 * e ele decide a prioridade OLHANDO. Chamada depois de todo arrasto.
 */
export function ordenarPorPosicao(arvore) {
  const nova = copiar(arvore);
  const anda = (nos) => {
    (nos || []).sort((a, b) => (a.y || 0) - (b.y || 0));
    for (const no of nos || []) anda(no.filhos);
  };
  anda(nova);
  return nova;
}

/** Largura e altura que a arrumação assume para uma caixa. A tela usa as mesmas. */
export const CAIXA = { largura: 260, altura: 96, colunaVaga: 90, linhaVaga: 26 };

/**
 * Arruma o quadro: uma COLUNA por nível, filhos empilhados à direita do pai.
 *
 * Da esquerda para a direita, e não de cima para baixo como no quadro dele, por um motivo de
 * espaço: em cima da mesa o desenho tinha dezoito nós e já ocupava a largura toda; "incrementado
 * de acordo com a demanda" quer dizer o dobro. Para o lado, a árvore cresce para BAIXO, que é onde
 * a tela rola. A leitura continua a mesma: situação → tipo de mensagem → ação.
 *
 * O pai fica centrado na altura dos filhos, que é o que faz um mapa parecer um mapa.
 */
export function arrumar(arvore) {
  const nova = copiar(arvore);
  const passoX = CAIXA.largura + CAIXA.colunaVaga;
  const passoY = CAIXA.altura + CAIXA.linhaVaga;
  let proximaLinha = 0;

  const colocar = (no, nivel) => {
    no.x = nivel * passoX;
    const filhos = no.filhos || [];
    if (!filhos.length) {
      no.y = proximaLinha * passoY;
      proximaLinha += 1;
      return no.y;
    }
    const ys = filhos.map((f) => colocar(f, nivel + 1));
    no.y = Math.round((ys[0] + ys[ys.length - 1]) / 2);
    return no.y;
  };

  for (const no of nova) colocar(no, 0);
  return nova;
}

/** O quadro já tem posição? Árvore vinda da versão em lista não tem, e precisa ser arrumada. */
export function precisaArrumar(arvore) {
  return todosOsNos(arvore).some(({ no }) => typeof no.x !== 'number' || typeof no.y !== 'number');
}

// ---- conferência ------------------------------------------------------------

/**
 * O que está errado na árvore — o que a janela mostra em vermelho no topo.
 *
 * Não corrige nada: árvore é dele, e "consertar" sozinho o ramo pela metade que ele está no meio
 * de montar seria pior que avisar. O que existe aqui é o que faz um ramo NUNCA funcionar, e que
 * sem aviso pareceria "a extensão ignorou minha regra".
 */
export function problemas(arvore) {
  const achados = [];
  const ids = new Set();

  for (const { no, nivel } of todosOsNos(arvore)) {
    const nome = no.rotulo || no.id;
    if (ids.has(no.id)) achados.push(`"${nome}": id repetido (${no.id}) — a janela não consegue editar os dois`);
    ids.add(no.id);

    if (no.regra && !REGRAS.some((r) => r.id === no.regra)) {
      achados.push(`"${nome}": aponta para a regra "${no.regra}", que não existe mais no código`);
      continue;
    }
    if (no.regra) continue;

    const cond = no.condicao || {};
    if (cond.sinal && !sinalConhecido(cond.sinal)) {
      achados.push(`"${nome}": o sinal "${cond.sinal}" não existe — este ramo nunca vai casar`);
    }
    const acao = no.acao || {};
    if (acao.tecla && !TECLAS[acao.tecla]) achados.push(`"${nome}": a tecla "${acao.tecla}" não existe`);

    const semCondicao = !cond.sinal && !(cond.palavras || []).length;
    const semAcao = !acao.tecla && !acao.resposta;
    const semFilhos = !(no.filhos || []).length;
    if (semCondicao && semAcao && semFilhos) {
      achados.push(`"${nome}": sem condição, sem ação e sem ramo dentro — não faz nada`);
    } else if (semAcao && semFilhos) {
      achados.push(`"${nome}": casa mas não faz nada — o fluxo segue para os ramos de baixo`);
    }
    if (nivel > 6) achados.push(`"${nome}": fundo demais (nível ${nivel}) — ninguém vai achar este ramo na tela`);
  }
  return achados;
}
