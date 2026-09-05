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
  { id: 'anuncioReconhecido', rotulo: 'Reconheci de QUAL anúncio ela veio', nao: 'Não reconheci o anúncio' },
  { id: 'jaRespondemosAntes', rotulo: 'Já entregamos algo antes (é retorno)', nao: 'Nunca entregamos nada (é primeira vez)' },
  { id: 'jaPediramDados', rotulo: 'Já pedimos o nome e a cidade dela', nao: 'Nunca pedimos o nome e a cidade dela' },
  { id: 'temEtiquetaDeCidade', rotulo: 'Já tem etiqueta de cidade', nao: 'Ainda não tem etiqueta de cidade' },
  { id: 'semInteresse', rotulo: 'Recusou ou veio hostilizar (hater)', nao: 'Não recusou nem hostilizou' },
  { id: 'etiquetaQueDispensa', rotulo: 'Tem a etiqueta que dispensa da fila', nao: 'Não tem a etiqueta que dispensa' },
  { id: 'pedeRespostaPessoal', rotulo: 'Áudio sem transcrição, arquivo ou texto longo', nao: 'Não é áudio, arquivo nem texto longo' },
  { id: 'respondeuComoAjudar', rotulo: 'Respondeu à nossa pergunta "em que posso ajudar?"', nao: 'Não é resposta à nossa pergunta' },
  { id: 'respondeuOsDados', rotulo: 'Respondeu o nome ou a cidade que pedimos', nao: 'Não respondeu o nome nem a cidade' },
  { id: 'confirmouPresenca', rotulo: 'Disse que VAI ao evento', nao: 'Não confirmou presença no evento' },
  { id: 'informouEndereco', rotulo: 'Mandou o endereço, ou já tem a etiqueta de material', nao: 'Não é caso de material a enviar' },
  { id: 'pedeAlgoIndefinido', rotulo: 'Pediu algo e não disse o quê', nao: 'Não pediu nada em aberto' },
  { id: 'pedeAjudaFinanceira', rotulo: 'Pediu dinheiro, cesta básica ou remédio', nao: 'Não pediu dinheiro nem o básico' },
  { id: 'pedeEmprego', rotulo: 'Perguntou como trabalhar no mandato', nao: 'Não perguntou sobre trabalhar aqui' },
  { id: 'pedeLigacao', rotulo: 'Pediu que a gente ligasse para ela', nao: 'Não pediu ligação' },
  { id: 'soCortesia', rotulo: 'Só cumprimentou (e nada mais)', nao: 'Escreveu mais que um cumprimento' },
  { id: 'ultimaEhNossa', rotulo: 'A última mensagem é nossa (ou ela não escreveu nada)', nao: 'Ela falou por último' },
  { id: 'etiquetaSoConclui', rotulo: 'Tem a etiqueta que só conclui (assessor)', nao: 'Não é da casa' },
  { id: 'ultimaEhDespedida', rotulo: 'Só se despediu ("amém", "é nós", "abraço")', nao: 'Não foi despedida' },
  { id: 'ultimaEhSoReacao', rotulo: 'Só figura, emoji, sticker ou link', nao: 'Escreveu alguma coisa' },
  { id: 'rajadaEhSoRepasse', rotulo: 'Só repassa link e vídeo de outras pessoas', nao: 'Não é só repasse' },
  { id: 'perguntaAberta', rotulo: 'Fez uma pergunta de razão ou de posição', nao: 'Não fez pergunta' },
  { id: 'soExpressaApoio', rotulo: 'Só apoio, sem pergunta e sem pedido', nao: 'Não é só apoio' },
  { id: 'voltouPorOutroAnuncio', rotulo: 'Voltou clicando em outro anúncio', nao: 'Não voltou por anúncio' },
  { id: 'nomeSemSentido', rotulo: 'O nome do cadastro não serve', nao: 'O nome do cadastro serve' },
  { id: 'respondidoHoje', rotulo: 'Você já respondeu hoje', nao: 'Você ainda não respondeu hoje' },
  { id: 'deOutroDia', rotulo: 'A última mensagem dela é de outro dia', nao: 'Ela escreveu hoje' },
  { id: 'momentoJaEnviado', rotulo: 'A mensagem do momento já saiu para ela', nao: 'A mensagem do momento ainda não saiu' },
  { id: 'pedidoHoje', rotulo: 'Pedimos o nome e a cidade HOJE', nao: 'Não pedimos o nome e a cidade hoje' },
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
  /**
   * **A EXCEÇÃO vale antes de tudo, e vale também para as caixas de REGRA.**
   *
   * Pedido dele (03/09/2026): *"algo que notei que está faltando nos ramos e em geral: condição de
   * mandar mensagem e exceção"*.
   *
   * Ele está apontando o buraco mais caro do quadro livre, o mesmo que o `problemas` já acusava
   * sem poder resolver: a caixa dele **parece** a regra do código e tem o mesmo desfecho na tela,
   * mas não tem as guardas que a regra carrega (`!enviadoHoje && !modeloJaNaConversa`). Antes
   * disto, a única forma de expressar "mande, mas não quando X" era não usar a caixa.
   *
   * Vale para caixa de regra **de propósito**: até aqui a condição das regras do código era o
   * único lugar do quadro que ele não podia tocar, e a exceção é a forma segura de tocar —
   * ela só **estreita** o que a regra alcança, nunca amplia. Nenhuma mensagem passa a sair por
   * causa de uma exceção; algumas deixam de sair, que é o lado barato de errar.
   */
  const exc = no.excecao || {};
  const temExcecao = !!exc.sinal || (exc.palavras || []).length > 0;
  if (temExcecao && condicaoCasa(exc, ctx)) return false;

  if (regra) {
    try {
      return !!regra.quando(ctx || {});
    } catch (_) {
      // Regra quebrada não derruba a rodada: ela simplesmente não casa.
      return false;
    }
  }

  return condicaoCasa(no.condicao || {}, ctx);
}

/**
 * Uma condição (sinal + palavras) descreve este contato?
 *
 * Uma função só porque a caixa tem DUAS: a que a faz casar e a exceção que a impede. Duas cópias
 * divergiriam na primeira vez que o formato ganhasse um campo — e a exceção decide o que **não**
 * sai para eleitor, que é o lado em que divergir custa caro.
 */
function condicaoCasa(cond, ctx) {
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
  /**
   * **"A IA assume e responde"** — pedido dele (01/09/2026).
   *
   * Até aqui a IA só entrava onde NENHUM ramo resolvia, o que a tornava o desfecho do que ninguém
   * previu. Ele quer o contrário também: apontar uma situação e dizer *"esta aqui eu confio nela"*.
   * São coisas diferentes — uma é o resto, a outra é uma escolha.
   *
   * O que sai daqui é só a marca; quem chama a IA é o painel, com as mesmas travas de sempre
   * (`validarDecisao`, os `RESTRITOS`, o teto de gasto). A árvore não fala com a API.
   */
  if (acao.ia) return { tecla: null, resposta: null, ia: true, motivo: motivoDele(no, ctx) };
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
/**
 * **As protecoes que valem MESMO QUE NAO ESTEJAM NO QUADRO DELE.**
 *
 * O quadro de trabalho e uma COPIA do padrao, e nada entra nele sozinho — decisao de desenho, e
 * certa: no quadro a posicao e a prioridade, e enfiar caixa por conta propria mudaria a rodada sem
 * ninguem escolher onde.
 *
 * O preco apareceu em 03/09/2026. Ele reportou duas vezes no mesmo dia o mesmo defeito -- conversa
 * em que so nos falamos recebendo mensagem --, eu criei a regra `ultima-e-nossa`, e ela **nao podia
 * decidir nada** para ele: existe so no padrao. A caixa iria aparecer no cartao "O padrao mudou?" e
 * ficaria esperando ele encaixar, enquanto a mensagem continuava saindo para eleitor.
 *
 * A saida e a distincao entre **preferencia** e **protecao**. Onde mandar o modelo, o que mandar,
 * em que ordem: preferencia, e e dele. "Nao mande nada": protecao, e nao ha ordem em que ela seja
 * outra coisa -- ela nunca compete com as outras caixas, porque o desfecho dela e o silencio.
 *
 * Esta lista e curta de proposito, e o criterio para entrar e duro: **a regra tem que ter efeito
 * `silencio` na tabela, e nao pode enviar nada em nenhum ramo.** Quem esta aqui continua podendo
 * aparecer no quadro (e aparece no padrao), e la ele posiciona; a lista so garante que a ausencia
 * nao vira envio.
 */
const PROTECOES = ['sem-interesse', 'etiqueta-so-conclui', 'ultima-e-nossa', 'confirmou-presenca-evento', 'informou-endereco'];

export function decidir(ctx, arvore, fluxo) {
  const fixadas = fluxo?.teclas || {};
  const c = ctx || {};

  /**
   * As protecoes primeiro, e so as que o quadro dele NAO tem.
   *
   * Tendo a caixa, ela decide pelo quadro como sempre -- inclusive desligada, que continua sendo
   * escolha dele. O que a lista impede e o buraco: protecao que o codigo ganhou e o quadro nunca
   * recebeu.
   */
  const noQuadro = new Set(todosOsNos(arvore).map(({ no }) => no.regra).filter(Boolean));
  const desligadas = new Set(fluxo?.desligadas || []);
  for (const id of PROTECOES) {
    if (noQuadro.has(id) || desligadas.has(id)) continue;
    const regra = REGRAS.find((r) => r.id === id);
    if (!regra || !regra.quando(c)) continue;
    const tecla = typeof regra.tecla === 'function' ? regra.tecla(c) : regra.tecla;
    return {
      id: 'protecao:' + id,
      tecla,
      resposta: null,
      ia: false,
      motivo: regra.motivo(c),
      caminho: ['protecao do codigo'],
    };
  }

  const andar = (nos, trilha) => {
    for (const no of nos || []) {
      if (!casa(no, c)) continue;
      const daqui = [...trilha, no.id];

      // Filho primeiro: o mais específico vence o mais geral, que é o ponto de ter árvore.
      const doFilho = andar(no.filhos, daqui);
      if (doFilho) return doFilho;

      const acao = acaoDoNo(no, c, fixadas);
      if (acao) {
        return { id: no.id, tecla: acao.tecla, resposta: acao.resposta, ia: !!acao.ia, motivo: acao.motivo, caminho: daqui };
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
    /**
     * **"Exceto quando…"** — a condição que IMPEDE esta caixa de decidir.
     *
     * Pedido dele (03/09/2026): *"falta condição de mandar mensagem e exceção"*. É o que permite
     * uma caixa dele carregar a guarda que a regra do código carrega sozinha — "mande o modelo,
     * exceto quando o modelo já está na conversa" — e é a única forma de estreitar uma caixa de
     * regra sem mexer no código.
     *
     * Vazia (sem sinal e sem palavras) não faz nada, que é como toda caixa nasce.
     */
    excecao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
    acao: null,
    /**
     * O que ele quer que MUDE neste ramo — escrito para mim, não para a extensão.
     *
     * Pedido dele (01/09/2026): *"preciso que cada caixa tenha um input para botar observações que
     * vou escrever para você modificar depois, principalmente as com código não editáveis"*. É a
     * saída para o único lugar do quadro que ele não pode mexer: a condição dos ramos respaldados
     * por regra, que fica no código porque decide o que sai para eleitor. Em vez de me descrever
     * de memória qual regra estava errada, ele escreve na própria caixa.
     *
     * **Nada aqui muda o comportamento da rodada.** É texto, e é de propósito: se a observação
     * mudasse alguma coisa sozinha, ela deixaria de ser um recado e viraria uma condição sem teste.
     */
    nota: '',
    desligado: false,
    filhos: [],
  };
}

/**
 * **O catalogo das regras do codigo — o que o painel do lado oferece para pôr de volta no quadro.**
 *
 * Pedido dele (01/09/2026): *"quando regras são apagadas tem que ter uma opção ou uma aba ali com
 * a lista de regras para arrastar pro fluxo novamente"*. Antes disto, apagar uma caixa "do codigo"
 * era **irreversivel na pratica**: a regra continuava viva no codigo, mas o unico jeito de traze-la
 * de volta era resetar o quadro inteiro para o padrao — que joga fora o arranjo dele. Apagar duas
 * caixas custava o trabalho de uma tarde.
 *
 * Devolve TODAS as regras, e nao so as que faltam, com `quantasNoQuadro` dizendo quantas caixas ja
 * apontam para cada uma. Sao duas coisas diferentes e as duas importam: sumir da lista assim que
 * entra no quadro esconderia que **pôr a mesma regra em dois lugares e legitimo** — o proprio
 * padrao faz isso, com as sete caixas que se repetem dos dois lados da bifurcacao de cidade.
 */
export function catalogoDeRegras(arvore) {
  const quantas = new Map();
  for (const { no } of todosOsNos(arvore)) {
    if (no.regra) quantas.set(no.regra, (quantas.get(no.regra) || 0) + 1);
  }
  return REGRAS.map((r) => ({
    id: r.id,
    rotulo: SOBRE[r.id]?.rotulo || r.id,
    efeito: SOBRE[r.id]?.efeito || '',
    quando: SOBRE[r.id]?.quando || '',
    quantasNoQuadro: quantas.get(r.id) || 0,
  }));
}

/**
 * Uma caixa de regra com id que ainda nao existe no quadro.
 *
 * `noDeRegra` cunha o id a partir da propria regra (`r:sem-interesse`), o que basta enquanto cada
 * regra aparece uma vez. No catalogo ela pode entrar de novo estando ja no quadro — e id repetido e
 * defeito de verdade, nao cosmetico: `problemas` acusa, e na janela um clique abriria as duas
 * caixas de uma vez. O sufixo numerado e o mesmo formato que `fluxoPadrao` ja usa (`r:id:onde`).
 */
export function noDeRegraLivre(arvore, regra, extras) {
  const usados = new Set(todosOsNos(arvore).map(({ no }) => no.id));
  const base = noDeRegra(regra);
  let id = base.id;
  for (let n = 2; usados.has(id); n += 1) id = `r:${regra}:${n}`;
  return { ...base, id, ...(extras || {}) };
}

function noDeRegra(id) {
  return {
    id: `r:${id}`,
    rotulo: SOBRE[id]?.rotulo || id,
    regra: id,
    condicao: null,
    acao: null,
    nota: '',
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
 * **O FLUXO PADRAO — o que o botao "Resetar para o padrao" devolve.**
 *
 * Combinado com ele em 01/09/2026: *"preciso de um reset para o padrao do fluxo atual, quando eu
 * mandar aqui voce atualiza o padrao"*. Ou seja, esta funcao e um DOCUMENTO mantido por mim a
 * partir do que ele escreve nas observacoes das caixas. Ele mexe no quadro a vontade sabendo que
 * o caminho de volta existe; quando quiser que o padrao mude, manda as observacoes e eu edito
 * aqui.
 *
 * **Nao mexa nisto por conta propria.** O padrao e o estado ao qual ele volta quando o quadro
 * ficou confuso — se eu o alterar sem ele pedir, o "volta ao que funcionava" devolve outra coisa,
 * e e justamente nesse momento que ele nao vai conferir ramo por ramo.
 *
 * Nasceu do desenho do quadro dele, virado arvore.
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
export function fluxoPadrao() {
  /**
   * Atalho: um ramo que é só uma regra do código.
   *
   * `onde` entra no ID porque a mesma regra aparece nos dois lados da bifurcação, e id repetido é
   * o que `problemas` acusa — na janela, faria um clique abrir as duas caixas de uma vez.
   */
  const r = (id, rotulo, onde) => ({
    ...noDeRegra(id),
    ...(onde ? { id: `r:${id}:${onde}` } : {}),
    ...(rotulo ? { rotulo } : {}),
  });

  /** Atalho: um ramo dele, que casa por PALAVRAS na última mensagem. */
  const porPalavras = (rotulo, palavras, acao) => ({
    ...noVazio(rotulo),
    condicao: { sinal: '', negar: false, palavras, onde: 'ultima' },
    acao,
  });

  /** Atalho: uma caixa que só agrupa — quem decide são os ramos de dentro. */
  const grupo = (rotulo, condicao, filhos) => ({ ...noVazio(rotulo), condicao, filhos });

  const SEM_CONDICAO = { sinal: '', negar: false, palavras: [], onde: 'ultima' };

  /**
   * **UMA lista só, de cima para baixo — o quadro deixou de ter dois ramos em 04/09/2026.**
   *
   * Pergunta dele: *"a questão é se realmente tem necessidade de duas árvores que seguem
   * praticamente as mesmas regras"*. Não tinha. O quadro anterior era **três cópias** da mesma
   * lista — a chegada, o lado "sem etiqueta de cidade" e o lado "com etiqueta" —, e **21 das 24
   * regras apareciam mais de uma vez**: 36 caixas duplicadas em 69.
   *
   * O que a duplicação custava não era espaço: era o defeito que este arquivo registra **quatro
   * vezes** — regra que existe num ramo e não no outro decide para metade da base e ninguém vê.
   * Aconteceu com a etiqueta que dispensa, com o apoio, com o grupo que escondia caixas e com a
   * chegada inteira, que ia do bloco de perguntas direto ao modelo.
   *
   * **A bifurcação de cidade não decidia nada**: os dois lados eram idênticos menos uma caixa, e a
   * cidade já é testada dentro da condição de cada regra. Medido em 4.000 contextos sorteados,
   * juntá-los muda 0,13% das decisões.
   *
   * **A chegada carregava uma decisão só**, e ela cabe aqui: o RECIBO do anúncio fica acima das
   * pendências neutras (figura, cumprimento, despedida) — decisão dele de 02/09. Funciona numa
   * lista única porque a condição do próprio recibo já significa "nunca mandamos nada"
   * (`!jaPediramDados && !modeloJaNaConversa && !temEtiquetaDeCidade`): para quem está voltando ele
   * não casa, e as pendências decidem como sempre.
   *
   * **Dá para separar de novo quando ele quiser:** `jaRespondemosAntes` continua na lista de
   * sinais, então um grupo com esse sinal recria a chegada a qualquer momento.
   */
  const atendimento = grupo('atendimento', SEM_CONDICAO, [
    /**
     * **AS PROTEÇÕES, no topo e sem exceção.** São as caixas cujo desfecho é o silêncio, e não há
     * ordem em que sejam outra coisa. Todas estão em `PROTECOES`, então valem mesmo antes de ele
     * importar o quadro.
     */
    r('sem-interesse', 'Recusou ou veio hostilizar'),
    r('etiqueta-so-conclui'),
    r('ultima-e-nossa'),
    r('confirmou-presenca-evento'),
    r('informou-endereco'),
    r('etiqueta-dispensa-da-fila'),

    /**
     * **AS TRÊS RESPOSTAS QUE NEGAM.** Vêm antes de tudo o que envia porque, nesses casos, mandar a
     * nossa mensagem primeiro **É** o dano — não o atraso. A de ajuda financeira voltou para cima
     * do modelo por decisão dele em 03/09 (anotação da Regina): o modelo não promete nada, mas
     * propaganda como primeira resposta a um pedido de socorro é a resposta errada mesmo assim.
     *
     * As três saem sozinhas por este caminho — decisão dele de 01/09 —, e a trava da IA
     * (`ia.RESTRITOS`) continua de pé: a IA segue sem poder escolhê-las.
     */
    { ...noVazio('pediu dinheiro, cesta basica ou remedio'),
      condicao: { sinal: 'pedeAjudaFinanceira', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-ajuda' } },
    { ...noVazio('quer trabalhar para o mandato'),
      condicao: { sinal: 'pedeEmprego', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-emprego' } },
    { ...noVazio('pediu que a gente ligasse'),
      condicao: { sinal: 'pedeLigacao', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-ligacao' } },

    /**
     * **O QUE PRECISA DE GENTE, e por isso fica acima do recibo.**
     *
     * *"Pedido é intenção, não forma de frase"* (03/09) — o caso fica com ele ou com a IA; pergunta
     * de razão ou de posição nenhuma resposta pronta responde; áudio sem transcrição e texto longo
     * só dá para responder lendo; e a denúncia respondida à NOSSA pergunta é o pior caso já
     * registrado aqui (material de campanha em cima de uma denúncia, 01/09).
     */
    r('pediu-algo-sem-dizer-o-que', 'pediu algo e não disse o quê'),
    r('pergunta-aberta'),
    r('ultima-pede-resposta-pessoal', 'áudio sem transcrição, arquivo, ou texto longo'),
    r('respondeu-nossa-pergunta'),

    /**
     * **O RECIBO DO ANÚNCIO — a única coisa que o ramo da chegada carregava.**
     *
     * Modelo + pedido de nome e cidade na mesma passada (a tecla `a`, a única do projeto que manda
     * duas mensagens — escolha dele em 02/09). Fica **acima** das pendências neutras logo abaixo,
     * porque pendência neutra custa um dia de atraso e o recibo é o que ela clicou para receber.
     */
    r('anuncio-modelo-e-dados', 'modelo + pedir os dados'),
    r('nada-legivel-dela', 'ela não mandou nada legível'),

    /**
     * **AS PENDÊNCIAS NEUTRAS**, abaixo do recibo — figura, cumprimento e despedida. Cada uma tem a
     * sua guarda: a do cumprimento não repete a mensagem do momento (`excecao: momentoJaEnviado`),
     * e a da reação olha `respondidoHoje` na própria tecla.
     */
    r('ultima-e-so-reacao', 'mandou figura, emoji, sticker ou link'),
    { ...noVazio('só cumprimentou, e nada mais'),
      condicao: { sinal: 'soCortesia', negar: false, palavras: [], onde: 'ultima' },
      excecao: { sinal: 'momentoJaEnviado', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: '5', resposta: null } },
    r('ultima-e-despedida'),

    /**
     * Voltou clicando em OUTRO anúncio: a mensagem do momento, e não o modelo de novo. Exige
     * `modeloJaNaConversa`, então só alcança quem já recebeu algo (anotação da Eroni, 03/09).
     *
     * Fica **acima** do anúncio reconhecido, que é quem mandaria o modelo, e **abaixo** das
     * pendências neutras: ela ENVIA, e quem se despediu não recebe mensagem por ter clicado.
     */
    r('voltou-por-outro-anuncio'),

    /**
     * **O anúncio que ele cadastrou decide o QUE sai, e ganha do critério de tempo**: clicar num
     * anúncio é pedir uma coisa específica, e escolha explícita dela não se substitui por dedução.
     */
    grupo('veio de um anúncio que eu reconheço', { sinal: 'anuncioReconhecido', negar: false, palavras: [], onde: 'ultima' }, [
      r('conteudo-pedido', 'manda o modelo daquele anúncio', 'anuncio'),
    ]),

    /**
     * **O TEMPO** — a última dela é de outro dia, então o contexto passou e o que há de novo é a
     * mensagem do momento (04/09) —, e então o que responde ao conteúdo.
     */
    r('contexto-de-outro-dia', 'a última dela é de outro dia'),
    r('respondeu-os-dados', 'respondeu o nome e a cidade'),
    r('so-expressa-apoio', 'apoio'),
    r('conteudo-pedido', 'pediu conteúdo e há modelo mapeado'),

    /**
     * **O fecho:** ainda não temos nome e cidade → pede; já entregamos algo antes → a mensagem do
     * momento, ou conclui. Esta última é a caixa mais genérica do quadro, e por isso fica no fim.
     */
    r('nunca-pediram-dados', 'ainda não temos nome e cidade'),
    r('ja-respondemos-antes', 'já entregamos algo antes'),
  ]);

  /**
   * **O que ele mandou descartar** (01/09/2026), e por quê:
   *
   *  - `nunca-perguntaram-interesse` — *"descarte também"*;
   *  - `nome-sem-sentido` — *"descarte, essa regra será refeita ou não de acordo com a necessidade"*;
   *  - `pedido-hoje-sem-resposta` — o que ela protegia (não repetir o pedido no mesmo dia) já está
   *    dentro de `nunca-pediram-dados`, que exige `!pedidoHoje`.
   *
   * As regras continuam no código: descartadas do QUADRO, não apagadas. Ele volta a pôr qualquer
   * uma pelo catálogo.
   */
  return [atendimento];
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

/**
 * Duplica um ramo — o nó e tudo que está dentro dele.
 *
 * Pedido dele (01/09/2026): *"preciso da opção de duplicar uma caixa"*. Montar um ramo dá
 * trabalho (condição, palavras, desfecho), e variação do mesmo ramo é o caso comum — "isto
 * aqui, mas com outras palavras".
 *
 * **Os filhos vão junto**, pela mesma razão que vão no `apagar`: um ramo é a condição MAIS o
 * que está dentro dela, e copiar só a casca daria um grupo vazio que não faz nada. A janela
 * diz quantos vão junto antes de duplicar.
 *
 * **Id novo em cada nó copiado, sem exceção.** Id repetido é o que `problemas` acusa e o que
 * `sanitizar` renomeia na importação — e, pior, faria a janela editar dois nós de uma vez.
 *
 * A cópia entra como o **irmão seguinte** e desce um pouco na tela. Entre irmãos a prioridade é
 * a altura, então nascer logo abaixo é nascer com a prioridade seguinte — que é o que se espera
 * de uma cópia. O deslocamento lateral é para ela não sumir atrás de um irmão que já estivesse
 * ali: cópia escondida parece cópia que não aconteceu.
 *
 * Devolve `{arvore, id}` em vez de só a árvore — diferente das vizinhas de propósito, porque
 * quem chama precisa SELECIONAR a cópia. Sem o id, a janela teria que adivinhar qual das duas
 * caixas iguais é a nova.
 *
 * @returns {{arvore: Array, id: string|null}}
 */
export function duplicar(arvore, id) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return { arvore, id: null };

  const copia = comIdsNovos(achado.no);
  copia.rotulo = texto(`${achado.no.rotulo || "ramo"} (cópia)`, 80);
  copia.x = (achado.no.x || 0) + 24;
  copia.y = (achado.no.y || 0) + CAIXA.altura + CAIXA.linhaVaga;

  achado.irmaos.splice(achado.i + 1, 0, copia);
  return { arvore: nova, id: copia.id };
}

/** Cópia funda de um ramo, com id novo em cada nó. */
export function comIdsNovos(no) {
  return {
    ...JSON.parse(JSON.stringify(no)),
    id: novoId(),
    filhos: (no.filhos || []).map((f) => comIdsNovos(f)),
  };
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

// ---- guardar, carregar e levar para fora ------------------------------------

/** O que um arquivo de fluxo é. A marca existe para recusar cedo o JSON que não é daqui. */
export const FORMATO = 'whatsfill-fluxo';
export const FORMATO_VERSAO = 1;

/** Limites de sanidade do que vem de arquivo. Não são regras de negócio: são o teto do absurdo. */
const LIMITES = { nos: 400, fundo: 8, palavras: 60, texto: 200, nota: 4000 };

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || LIMITES.texto) : '');

/**
 * Passa uma árvore vinda de FORA por uma peneira, campo a campo.
 *
 * **Isto é entrada não confiável.** Um arquivo de fluxo decide o que a rodada manda para eleitor
 * real; `JSON.parse` e usar seria aceitar que qualquer coisa num campo vire comportamento. A
 * peneira mantém só o que existe: regra que sumiu do código, sinal desconhecido e tecla inventada
 * são DESCARTADOS com aviso, em vez de virarem um ramo que nunca casa e ninguém entende.
 *
 * Também é o que protege de arquivo velho: exportar hoje e importar depois de eu renomear uma
 * regra dá um aviso na tela, e não um ramo morto e silencioso.
 *
 * @returns {{arvore: Array, avisos: string[]}}
 */
export function sanitizar(bruto) {
  const avisos = [];
  const usados = new Set();
  let quantos = 0;

  const limparNo = (cru, fundura) => {
    if (!cru || typeof cru !== 'object') return null;
    if (quantos >= LIMITES.nos) return null;
    quantos += 1;

    const nome = texto(cru.rotulo) || 'ramo sem nome';
    // A observacao e recado para mim, entao pode ser longa -- mas nao infinita.
    const nota = typeof cru.nota === 'string' ? cru.nota.trim().slice(0, LIMITES.nota) : '';

    let id = texto(cru.id, 60);
    if (!id || usados.has(id)) {
      const antigo = id;
      id = novoId();
      if (antigo) avisos.push(`"${nome}": id repetido (${antigo}) — recebeu um id novo`);
    }
    usados.add(id);

    const no = {
      id,
      rotulo: nome,
      regra: null,
      condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
      excecao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
      acao: null,
      nota,
      desligado: cru.desligado === true,
      x: Number.isFinite(cru.x) ? Math.round(cru.x) : 0,
      y: Number.isFinite(cru.y) ? Math.round(cru.y) : 0,
      filhos: [],
    };

    const regra = texto(cru.regra, 60);
    if (regra) {
      if (REGRAS.some((r) => r.id === regra)) no.regra = regra;
      else avisos.push(`"${nome}": a regra "${regra}" não existe mais no código — o ramo virou um agrupamento`);
    }

    /**
     * A EXCEÇÃO passa pela mesma peneira da condição — é entrada não confiável igual, e decide o
     * que a rodada manda para eleitor.
     */
    const exc = cru.excecao && typeof cru.excecao === 'object' ? cru.excecao : {};
    const sinalExc = texto(exc.sinal, 40);
    if (sinalExc) {
      if (sinalConhecido(sinalExc)) no.excecao.sinal = sinalExc;
      else avisos.push(`ramo "${no.rotulo}": exceção com sinal desconhecido "${sinalExc}" — descartada`);
    }
    no.excecao.negar = exc.negar === true;
    no.excecao.onde = exc.onde === 'qualquer' ? 'qualquer' : 'ultima';
    if (Array.isArray(exc.palavras)) {
      no.excecao.palavras = exc.palavras.map((x) => texto(x, 80)).filter(Boolean).slice(0, LIMITES.palavras);
    }

    const cond = cru.condicao && typeof cru.condicao === 'object' ? cru.condicao : {};
    const sinal = texto(cond.sinal, 60);
    if (sinal) {
      if (sinalConhecido(sinal)) no.condicao.sinal = sinal;
      else avisos.push(`"${nome}": o sinal "${sinal}" não existe — a condição dele foi descartada`);
    }
    no.condicao.negar = cond.negar === true;
    no.condicao.onde = cond.onde === 'qualquer' ? 'qualquer' : 'ultima';
    if (Array.isArray(cond.palavras)) {
      no.condicao.palavras = cond.palavras.map((p) => texto(p, 80)).filter(Boolean).slice(0, LIMITES.palavras);
    }

    const acao = cru.acao && typeof cru.acao === 'object' ? cru.acao : {};
    if (acao.ia === true) {
      no.acao = { tecla: null, resposta: null, ia: true };
    } else if (texto(acao.resposta, 60)) {
      no.acao = { tecla: null, resposta: texto(acao.resposta, 60) };
    } else if (texto(acao.tecla, 4)) {
      const t = texto(acao.tecla, 4);
      if (TECLAS[t]) no.acao = { tecla: t, resposta: null };
      else avisos.push(`"${nome}": a tecla "${t}" não existe — o desfecho foi descartado`);
    }

    if (Array.isArray(cru.filhos) && cru.filhos.length) {
      if (fundura >= LIMITES.fundo) {
        avisos.push(`"${nome}": os ramos de dentro passaram do nível ${LIMITES.fundo} e foram descartados`);
      } else {
        no.filhos = cru.filhos.map((f) => limparNo(f, fundura + 1)).filter(Boolean);
      }
    }
    return no;
  };

  const lista = Array.isArray(bruto) ? bruto : [];
  const arvore = lista.map((n) => limparNo(n, 0)).filter(Boolean);
  if (quantos >= LIMITES.nos) avisos.push(`o arquivo passou de ${LIMITES.nos} ramos — o excedente foi descartado`);
  return { arvore, avisos };
}

/** O conteúdo do arquivo que ele leva para fora. */
export function paraArquivo(fluxo, nome) {
  return {
    formato: FORMATO,
    versao: FORMATO_VERSAO,
    nome: texto(nome, 80) || 'fluxo',
    salvoEm: new Date().toISOString(),
    // As contagens de vitória ficam de fora: são medição desta máquina, não o fluxo.
    teclas: { ...(fluxo?.teclas || {}) },
    arvore: fluxo?.arvore || [],
  };
}

/**
 * Lê o texto de um arquivo de fluxo.
 *
 * Devolve o erro em vez de lançar: quem chama é a tela, e "não deu" com o motivo escrito é melhor
 * que uma exceção que vira janela em branco.
 *
 * @returns {{ok: boolean, erro?: string, nome?: string, arvore?: Array, teclas?: object, avisos?: string[]}}
 */
export function deArquivo(conteudo) {
  let dados;
  try {
    dados = JSON.parse(String(conteudo || ''));
  } catch (_) {
    return { ok: false, erro: 'o arquivo não é um JSON válido' };
  }
  if (!dados || typeof dados !== 'object') return { ok: false, erro: 'o arquivo está vazio' };
  if (dados.formato !== FORMATO) {
    return { ok: false, erro: 'este arquivo não é um fluxo do WhatsFill (falta a marca do formato)' };
  }
  if (Number(dados.versao) > FORMATO_VERSAO) {
    return { ok: false, erro: `o arquivo é de uma versão mais nova (${dados.versao}) — atualize a extensão` };
  }
  if (!Array.isArray(dados.arvore) || !dados.arvore.length) {
    return { ok: false, erro: 'o arquivo não tem nenhum ramo' };
  }

  const { arvore, avisos } = sanitizar(dados.arvore);
  if (!arvore.length) return { ok: false, erro: 'nenhum ramo do arquivo sobreviveu à conferência' };

  // As teclas fixadas só valem para regras que existem, senão viram lixo que ninguém vê.
  const teclas = {};
  for (const [id, tecla] of Object.entries(dados.teclas || {})) {
    if (REGRAS.some((r) => r.id === id) && TECLAS[tecla]) teclas[id] = tecla;
  }

  return { ok: true, nome: texto(dados.nome, 80) || 'fluxo importado', arvore, teclas, avisos };
}

/**
 * O fluxo inteiro em TEXTO, para ele colar numa conversa comigo.
 *
 * Nasceu torto: eu ia fazer um botão que copiava só as observações, e ele cortou na hora —
 * *"não faz sentido eu colar para você sem você ter a visão do fluxo"*. Está certo. A observação
 * *"essa aqui está pegando gente demais"* não diz nada sem o ramo, a condição, o desfecho e a
 * posição dele na árvore; eu responderia adivinhando.
 *
 * Então sai tudo: a hierarquia com numeração (`2.1.` é o primeiro filho do segundo ramo, e serve
 * para nós dois apontarmos para o mesmo lugar), a condição, o desfecho, o que está desligado, e a
 * observação no ramo a que ela pertence. É a mesma informação da tela, na forma que atravessa uma
 * caixa de texto.
 *
 * `opcoes.respostas` é a lista de respostas prontas, só para o desfecho sair pelo NOME em vez do
 * id — `pedido-ajuda` não diz o que é para quem lê de fora.
 */
export function paraTexto(arvore, opcoes) {
  const teclas = opcoes?.teclas || {};
  const respostas = opcoes?.respostas || [];
  const linhas = [];

  const nomeDaResposta = (id) => respostas.find((r) => r.id === id)?.name || id;

  const desfecho = (no) => {
    if (no.regra) {
      const regra = REGRAS.find((r) => r.id === no.regra);
      const fixa = teclas[no.regra];
      if (fixa) return `tecla ${fixa} · ${TECLAS[fixa]?.rotulo || '?'}  (VOCÊ FIXOU; o código escolheria sozinho)`;
      if (typeof regra?.tecla === 'function') {
        const ramos = SOBRE[no.regra]?.ramos || [];
        return ramos.length
          ? ramos.map((r) => `tecla ${r.tecla} · ${TECLAS[r.tecla]?.rotulo || '?'} (se ${r.se})`).join('  OU  ')
          : 'dois desfechos, conforme o contexto';
      }
      return `tecla ${regra?.tecla} · ${TECLAS[regra?.tecla]?.rotulo || '?'}`;
    }
    if (no.acao?.ia) return 'a IA assume e responde';
    if (no.acao?.resposta) return `manda "${nomeDaResposta(no.acao.resposta)}" e conclui`;
    if (no.acao?.tecla) return `tecla ${no.acao.tecla} · ${TECLAS[no.acao.tecla]?.rotulo || '?'}`;
    return (no.filhos || []).length ? '(só agrupa — quem decide são os ramos de dentro)' : '(NADA — este ramo não faz nada ainda)';
  };

  const condicao = (no) => {
    if (no.regra) return SOBRE[no.regra]?.quando || '(a condição está no código)';
    const cond = no.condicao || {};
    const partes = [];
    const sinal = SINAIS.find((s) => s.id === cond.sinal);
    if (sinal) partes.push(cond.negar ? sinal.nao : sinal.rotulo);
    if ((cond.palavras || []).length) {
      partes.push(`escreveu "${cond.palavras.join('", "')}"${cond.onde === 'qualquer' ? ' (em qualquer mensagem)' : ' (na última mensagem)'}`);
    }
    return partes.length ? partes.join(' E ') : 'qualquer contato que chegar aqui';
  };

  const anda = (nos, prefixo, recuo) => {
    (nos || []).forEach((no, i) => {
      const numero = prefixo ? `${prefixo}.${i + 1}` : String(i + 1);
      const pad = ' '.repeat(recuo);
      linhas.push('');
      linhas.push(`${pad}${numero}. ${no.rotulo || '(sem nome)'}${no.regra ? `   [regra do código: ${no.regra}]` : ''}${no.desligado ? '   *** DESLIGADO ***' : ''}`);
      linhas.push(`${pad}    quando: ${condicao(no)}`);
      const exc = no.excecao || {};
      if (exc.sinal || (exc.palavras || []).length) {
        const sinal = SINAIS.find((x) => x.id === exc.sinal);
        const partes = [];
        if (sinal) partes.push(exc.negar ? sinal.nao : sinal.rotulo);
        if ((exc.palavras || []).length) {
          partes.push(`escreveu ${exc.palavras.map((x) => `"${x}"`).join(' ou ')}` +
            (exc.onde === 'qualquer' ? ' (em qualquer mensagem)' : ' (na última)'));
        }
        linhas.push(`${pad}    EXCETO: ${partes.join(' e ')}`);
      }
      linhas.push(`${pad}    então:  ${desfecho(no)}`);
      // A observação é o motivo de tudo isto existir: ela vem por último e marcada, para saltar aos
      // olhos numa colagem de cem linhas.
      if (no.nota) {
        for (const l of String(no.nota).split('\n')) linhas.push(`${pad}    >> OBSERVAÇÃO: ${l}`);
      }
      anda(no.filhos, numero, recuo + 4);
    });
  };

  const total = todosOsNos(arvore).length;
  linhas.push('FLUXO DE ATENDIMENTO — WhatsFill+IA');
  linhas.push(`${total} ramos, ${quantosEnviam(arvore)} enviam mensagem. Gerado em ${new Date().toLocaleString('pt-BR')}.`);
  linhas.push('A rodada segue o PRIMEIRO ramo que descreve o contato; dentro dele, o primeiro filho que descreve.');
  linhas.push('Entre irmãos, a ordem abaixo é a prioridade.');
  anda(arvore, '', 0);
  linhas.push('');
  return linhas.join('\n');
}

/** Quantos ramos ENVIAM mensagem — o número que ele precisa ver antes de trocar o fluxo. */
export function quantosEnviam(arvore) {
  let conta = 0;
  for (const { no } of todosOsNos(arvore)) {
    if (no.desligado) continue;
    if (no.regra) {
      if (SOBRE[no.regra]?.efeito === 'envia') conta += 1;
      continue;
    }
    if (no.acao?.resposta) conta += 1;
    else if (no.acao?.tecla && TECLAS[no.acao.tecla]?.efeito === 'envia') conta += 1;
  }
  return conta;
}

// ---- conferência ------------------------------------------------------------

/**
 * O que está errado na árvore — o que a janela mostra em vermelho no topo.
 *
 * Não corrige nada: árvore é dele, e "consertar" sozinho o ramo pela metade que ele está no meio
 * de montar seria pior que avisar. O que existe aqui é o que faz um ramo NUNCA funcionar, e que
 * sem aviso pareceria "a extensão ignorou minha regra".
 */
/**
 * **Os sinais que o NOSSO próprio envio apaga** — os únicos que servem de guarda contra repetir.
 *
 * Todo o resto (`veioDeAnuncio`, `anuncioReconhecido`, `temEtiquetaDeCidade`, `semInteresse`…) é
 * estado do contato: continua verdadeiro depois de a gente mandar a mensagem, e uma caixa que casa
 * só por ele **casa de novo na passada seguinte**.
 *
 * A polaridade importa e está tratada em `repeteSozinha`: `jaRespondemosAntes` NEGADO ("nunca
 * entregamos nada") vira falso depois do envio e por isso é guarda; não negado, não é.
 */
/**
 * Sinais lidos da RAJADA — as mensagens dela depois da nossa última.
 *
 * Responder move a nossa última mensagem para a frente delas, e a rajada fica vazia: o sinal volta
 * a ser falso sozinho. São o oposto da lista de baixo, e por isso a caixa que os exige VERDADEIROS
 * já está protegida contra repetir.
 */
const SINAIS_QUE_A_RESPOSTA_APAGA = new Set([
  'pedeAjudaFinanceira',
  'soCortesia',
  'pedeEmprego',
  'pedeLigacao',
  'pedeAlgoIndefinido',
  'pedeRespostaPessoal',
  'perguntaAberta',
  'soExpressaApoio',
  'rajadaEhSoRepasse',
  'respondeuComoAjudar',
]);

const SINAIS_QUE_O_ENVIO_APAGA = new Set([
  'modeloJaNaConversa',
  'enviadoHoje',
  'pedidoHoje',
  'jaPediramDados',
  'momentoJaEnviado',
  'respondidoHoje',
  'interessePerguntado',
  'jaRespondemosAntes',
]);

/**
 * **Esta caixa manda mensagem e vai casar de novo na próxima passada?**
 *
 * Nasceu de um caso real (02/09/2026). Ele montou à mão uma caixa *"mandar modelo conforme o
 * anuncio"* com a condição "Reconheci de QUAL anúncio ela veio" e a **tecla 1 fixa** — e o motor
 * mostrou o modelo saindo em TODA passada, para sempre, porque:
 *
 *  - a condição é estado do contato: continua verdadeira depois de mandarmos;
 *  - **fixar a tecla não herda as guardas da regra do código.** `conteudo-pedido` exige
 *    `!enviadoHoje && !modeloJaNaConversa`; a caixa dele não exigia nada.
 *
 * É a armadilha central do quadro livre: a caixa parece a regra, tem o mesmo desfecho na tela, e
 * não tem a metade que impede repetir. Máquina de repetir mensagem para eleitor real é o defeito
 * que este projeto mais pagou.
 *
 * Só olha caixa DELE (`regra` nula): regra do código carrega as próprias guardas. Palavra na
 * ÚLTIMA mensagem conta como guarda — a última muda quando a pessoa escreve de novo.
 */
function repeteSozinha(no) {
  if (no.regra) return false;
  const acao = no.acao || {};
  if (!acao.tecla && !acao.resposta) return false;

  const efeito = acao.tecla ? TECLAS[acao.tecla]?.efeito : 'envia';
  if (efeito !== 'envia') return false;

  /**
   * **A EXCEÇÃO conta como guarda** — é para isso que ele a pediu (03/09/2026).
   *
   * "Mande o modelo, EXCETO quando o modelo já está na conversa" é exatamente a guarda que a
   * regra do código carrega, escrita do lado de fora. A polaridade é invertida em relação à
   * condição: aqui o envio tem que tornar a exceção VERDADEIRA, e aí a caixa deixa de casar.
   */
  const exc = no.excecao || {};
  if (exc.sinal && SINAIS_QUE_O_ENVIO_APAGA.has(exc.sinal) && !exc.negar) return false;
  if (exc.sinal && SINAIS_QUE_A_RESPOSTA_APAGA.has(exc.sinal) && exc.negar) return false;
  // Palavra na ÚLTIMA mensagem também: a última muda quando ela escreve de novo.
  if ((exc.palavras || []).length && exc.onde !== 'qualquer') return false;

  const cond = no.condicao || {};
  if ((cond.palavras || []).length && cond.onde !== 'qualquer') return false;

  if (!cond.sinal) return true;

  /**
   * **Sinal que só existe enquanto ela não foi respondida protege sozinho.**
   *
   * Estes são calculados sobre a RAJADA depois da nossa última mensagem: assim que respondemos,
   * as mensagens dela ficam para trás e o sinal volta a ser falso. A polaridade é o contrário da
   * lista de cima — aqui a caixa está protegida quando exige o sinal VERDADEIRO.
   *
   * Sem esta lista, `pedeAjudaFinanceira` foi acusada de repetir na primeira vez que virou caixa
   * do quadro (02/09/2026), e o aviso era falso: mandar a negativa apaga a condição.
   */
  if (SINAIS_QUE_A_RESPOSTA_APAGA.has(cond.sinal)) return !!cond.negar;

  if (!SINAIS_QUE_O_ENVIO_APAGA.has(cond.sinal)) return true;
  /**
   * A polaridade: todos estes viram VERDADE depois do envio, então a caixa só está protegida se
   * exigir o sinal FALSO. "O modelo não está na conversa" protege; "o modelo está" não protegeria
   * nada — casaria justamente depois de já ter saído.
   */
  return !cond.negar;
}

/**
 * O efeito de uma caixa, para a conferência: `envia`, `silencio`, `gente`, `depende` ou `''`.
 *
 * Caixa de regra pega do verbete (`SOBRE`); caixa dele, da tecla que ela dispara. Resposta pronta
 * é sempre envio.
 */
function efeitoDaCaixa(no) {
  if (no.regra) return SOBRE[no.regra]?.efeito || '';
  const acao = no.acao || {};
  if (acao.resposta) return 'envia';
  if (acao.tecla) return TECLAS[acao.tecla]?.efeito || '';
  return '';
}

/**
 * **Caixa que NÃO manda nada, com caixa que MANDA dentro dela.**
 *
 * É o erro mais caro do quadro livre, e já aconteceu **duas vezes** com a mesma forma:
 *
 *  - 01/09/2026: "mensagem padrão" caiu dentro de "Recusou ou veio hostilizar";
 *  - 02/09/2026: "mandar modelo conforme o anuncio" caiu no mesmo lugar. Medido no quadro que ele
 *    colou: **o hostil recebia o pedido de nome e cidade** e **a pessoa normal não recebia o
 *    modelo** — ela escapava para "pessoa retornando" e terminava agradecida por um apoio que nunca
 *    expressou.
 *
 * O motivo é o desenho do motor: **o filho é testado ANTES da ação do próprio nó**, e o filho só é
 * alcançado quando o PAI casa. Então pôr um remetente dentro de uma proteção significa, literalmente,
 * "quando eu reconhecer que não devo mandar nada, mande isto".
 *
 * Duas ocorrências do mesmo erro é problema de ferramenta, não de quem usa: o aninhamento não
 * anuncia essa inversão em lugar nenhum da tela. Agora anuncia.
 */
function remetenteDentroDeProtecao(no) {
  if (efeitoDaCaixa(no) !== 'silencio') return null;
  const dentro = todosOsNos(no.filhos).filter(({ no: f }) => efeitoDaCaixa(f) === 'envia');
  return dentro.length ? dentro.map(({ no: f }) => f.rotulo || f.id) : null;
}

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
    /**
     * **Remetente dentro de proteção** — o erro que já aconteceu duas vezes. Ver
     * `remetenteDentroDeProtecao`.
     *
     * Fica ACIMA do `continue` das caixas de regra de propósito: as proteções deste projeto **são**
     * regras do código (`sem-interesse`, `etiqueta-dispensa-da-fila`), e nas duas vezes foi dentro
     * de uma delas que o remetente caiu. Posta depois do `continue`, esta conferência nunca teria
     * visto o caso real — foi o que aconteceu na primeira versão dela.
     */
    const dentroDaProtecao = remetenteDentroDeProtecao(no);
    if (dentroDaProtecao) {
      achados.push(
        `"${nome}" NÃO manda nada, mas tem ${dentroDaProtecao.length} caixa(s) que MANDAM dentro ` +
          `dela (${dentroDaProtecao.map((x) => `"${x}"`).join(', ')}). O filho é olhado ANTES da ação ` +
          'do pai, e só é alcançado quando o pai casa — então quem esta caixa deveria proteger é ' +
          'justamente quem vai receber. Solte-as na raiz e ponha-as ABAIXO desta.'
      );
    }

    if (no.regra) continue;

    const cond = no.condicao || {};
    if (cond.sinal && !sinalConhecido(cond.sinal)) {
      achados.push(`"${nome}": o sinal "${cond.sinal}" não existe — este ramo nunca vai casar`);
    }
    const acao = no.acao || {};
    if (acao.tecla && !TECLAS[acao.tecla]) achados.push(`"${nome}": a tecla "${acao.tecla}" não existe`);

    const semCondicao = !cond.sinal && !(cond.palavras || []).length;
    const semAcao = !acao.tecla && !acao.resposta && !acao.ia;
    const semFilhos = !(no.filhos || []).length;
    /**
     * A caixa que manda mensagem e casa de novo na passada seguinte. Ver `repeteSozinha`: nasceu de
     * uma caixa dele que mandava o modelo em toda passada, porque fixar a tecla não herda as
     * guardas da regra do código.
     */
    if (repeteSozinha(no)) {
      achados.push(
        `"${nome}": manda mensagem e a condição continua verdadeira depois do envio — vai mandar de ` +
          'novo em toda passada. Acrescente uma guarda (ex.: "O modelo não está na conversa"), ou ' +
          'use a regra do código, que já traz as guardas.'
      );
    }

    if (semCondicao && semAcao && semFilhos) {
      achados.push(`"${nome}": sem condição, sem ação e sem ramo dentro — não faz nada`);
    } else if (semAcao && semFilhos) {
      achados.push(`"${nome}": casa mas não faz nada — o fluxo segue para os ramos de baixo`);
    }
    if (nivel > 6) achados.push(`"${nome}": fundo demais (nível ${nivel}) — ninguém vai achar este ramo na tela`);
  }
  return achados;
}

/**
 * A chave que diz "esta caixa é a mesma coisa que aquela", entre dois quadros diferentes.
 *
 * Não é o `id`: os ids do quadro dele nasceram em outro momento e não batem com os do padrão. O que
 * identifica uma caixa é **o que ela decide** — a regra do código que ela carrega, ou a condição que
 * ele montou (sinal + palavras).
 *
 * Caixa que só AGRUPA (sem regra, sem sinal e sem palavra) fica fora da comparação: ela é estrutura,
 * não decisão, e todas colidiriam na mesma chave.
 */
function chaveDeComparacao(no) {
  /**
   * A exceção entra na chave: "mande o modelo" e "mande o modelo exceto quando já mandamos" são
   * caixas diferentes, e tratá-las como a mesma faria o cartão "O padrão mudou?" dizer que ele já
   * tem uma guarda que não tem.
   */
  const exc = no.excecao || {};
  const excPalavras = (exc.palavras || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean).sort();
  const marca = exc.sinal || excPalavras.length
    ? `|exceto:${exc.sinal || ''}:${exc.negar ? 'nao' : 'sim'}:${excPalavras.join('|')}`
    : '';

  if (no.regra) return `regra:${no.regra}${marca}`;
  const cond = no.condicao || {};
  const palavras = (cond.palavras || []).map((p) => String(p).trim().toLowerCase()).filter(Boolean).sort();
  if (!cond.sinal && !palavras.length && !marca) return null;
  return `cond:${cond.sinal || ''}:${cond.negar ? 'nao' : 'sim'}:${palavras.join('|')}${marca}`;
}

/**
 * **O que mudou no padrão e não está no quadro dele.**
 *
 * Relato dele (02/09/2026), depois de eu reordenar a chegada pelo anúncio várias vezes num dia:
 * *"a ramificação não foi atualizada"*. Estava certo — e o problema é de desenho, não daquele dia:
 * `fluxoPadrao` é o que o botão "Resetar para o padrão" devolve, e o quadro de trabalho dele é uma
 * CÓPIA que nada atualiza. Toda melhoria no padrão era invisível para ele, e o único caminho de
 * volta ("resetar") joga fora o arranjo feito à mão — que é justamente o trabalho que ele não quer
 * perder.
 *
 * Devolve `{ faltando, sobrando }`, os dois como caixas. `faltando` é o que o padrão decide e o
 * quadro dele não; `sobrando` é o contrário — e é **informação, não erro**: ele monta ramos que o
 * padrão nunca teve, e essa é a razão da janela existir.
 *
 * **Não mexe em nada.** Quem decide o que entra é ele, caixa por caixa, porque no quadro a POSIÇÃO
 * é a prioridade: enfiar uma caixa nova por conta própria mudaria o que a rodada faz sem ninguém ter
 * escolhido onde.
 */
export function diferencaDoPadrao(arvore) {
  const doPadrao = todosOsNos(arrumar(fluxoPadrao()));
  const dele = todosOsNos(arvore || []);

  const chavesDele = new Set(dele.map(({ no }) => chaveDeComparacao(no)).filter(Boolean));
  const chavesDoPadrao = new Set(doPadrao.map(({ no }) => chaveDeComparacao(no)).filter(Boolean));

  const junta = (nos, jaTem) => {
    const vistos = new Set();
    const saida = [];
    for (const { no } of nos) {
      const chave = chaveDeComparacao(no);
      if (!chave || jaTem.has(chave) || vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(no);
    }
    return saida;
  };

  return { faltando: junta(doPadrao, chavesDele), sobrando: junta(dele, chavesDoPadrao) };
}
