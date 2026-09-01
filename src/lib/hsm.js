/**
 * hsm.js — modelos de mensagem salvos (templates aprovados do WhatsApp).
 *
 * Duas metades:
 *
 *  - LISTAR vem da API (`GET /chat/v5/template`), leitura pura. É o que permite o painel
 *    mostrar os modelos disponíveis sem abrir diálogo nenhum.
 *  - ENVIAR dirige o diálogo nativo da plataforma, pelo mesmo motivo que o composer.js não
 *    faz POST direto: o modelo carrega mídia aprovada (a maioria aqui tem imagem de ~1,4 MB),
 *    vínculo com o canal e regra de janela. Reproduzir isso contra uma API não documentada
 *    seria adivinhar exatamente o que o recorder.js foi criado para evitar.
 *
 * Por que isso importa além da comodidade: com a janela de 24h expirada, template aprovado é
 * o ÚNICO envio que o WhatsApp aceita. Até aqui o painel só sabia recusar nessa situação.
 *
 * Os seletores moram em dom.js, como todo o resto que conhece a plataforma.
 */

import * as dom from './dom.js';
import { getMessageTemplates } from './api.js';

/**
 * Um cache POR CANAL, não uma vaga só.
 *
 * Era `cache` + `cacheKey`: um canal de cada vez. A conta tem várias instâncias (números de
 * WhatsApp), e os atendimentos da fila se alternam entre elas — então cada contato aberto num
 * canal diferente do anterior descartava o cache e rebuscava **100 modelos aprovados**. Ir e
 * voltar entre duas instâncias significava essa busca em TODO contato aberto, que é volume de
 * rede em cima da plataforma sem nada em troca: os modelos de um canal não mudam entre um
 * clique e outro.
 *
 * `Map` porque a conta tem um punhado de instâncias, não milhares — não precisa de poda.
 */
const cachePorCanal = new Map();

/**
 * Modelos disponíveis, em forma enxuta e serializável (atravessa a ponte de mensagens no
 * modo janela separada).
 */
export async function list({ channelId, force = false } = {}) {
  const key = channelId || '(sem canal)';
  if (!force && cachePorCanal.has(key)) return cachePorCanal.get(key);

  const itens = await getMessageTemplates({ channelId });
  const lista = itens.map((t) => ({
    id: t.id,
    name: t.name,
    text: t.text || '',
    headerText: t.headerText || '',
    footerText: t.footerText || '',
    fileType: t.fileType || null,
    status: t.status,
    params: Array.isArray(t.params) ? t.params : [],
  }));
  cachePorCanal.set(key, lista);
  return lista;
}

export function invalidate() {
  cachePorCanal.clear();
}

/**
 * O modelo que casa com o TEXTO que a pessoa mandou.
 *
 * Pedido dele (01/09): *"não será feito etiqueta a etiqueta para os anúncios, agora é só ads; o
 * padrão para casar o modelo deve ser o texto (Olá! Eu apoio as Escolas Cívico-Militares = modelo)"*.
 *
 * **Por que isto existe em vez de mais etiquetas.** A etiqueta ADS diz que a pessoa veio de anúncio,
 * não de QUAL anúncio, e o caminho antigo (texto → etiqueta → modelo) exigiria uma etiqueta nova no
 * CRM por anúncio — rótulo permanente na base de eleitores para transportar uma informação que já
 * está escrita na mensagem. Aqui o texto vai direto ao modelo.
 *
 * **Compara sem acento e sem caixa** (`semAcento`, que este módulo reserva justamente para valor
 * digitado à mão): "Civico" digitado tem de casar com "Cívico" da mensagem.
 *
 * **Casa por trecho CONTIDO, não por igualdade:** a mensagem do anúncio chega com emoji e às vezes
 * com o que a pessoa acrescentou depois ("…Escolas Cívico-Militares 🤙 olá Capitão Martins…").
 * Exigir igualdade não casaria nunca.
 *
 * **A entrada MAIS ESPECÍFICA ganha** — o trecho mais longo. Sem isso, "eu apoio" cadastrado para um
 * modelo genérico venceria "eu apoio as escolas" pela ordem de digitação, e ordem de digitação não é
 * uma decisão.
 *
 * @param {string[]} textos  o que a pessoa mandou
 * @param {object} mapa      { "trecho do texto": "nome do modelo" }
 * @param {object[]} modelos os modelos aprovados da plataforma
 * @returns {{modelo?:object, erro?:string, trecho?:string}|null} `null` = nenhum trecho casou
 */
export function modeloPorTexto(textos, mapa, modelos) {
  const entradas = Object.entries(mapa || {}).filter(([trecho]) => semAcento(trecho));
  if (!entradas.length) return null;

  const conversa = (textos || []).map((t) => semAcento(t)).join(' | ');
  if (!conversa) return null;

  const casaram = entradas
    .filter(([trecho]) => conversa.includes(semAcento(trecho)))
    .sort((a, b) => semAcento(b[0]).length - semAcento(a[0]).length);
  if (!casaram.length) return null;

  const [trecho, nome] = casaram[0];
  const nomes = (modelos || []).filter((m) => achatar(m.name) === achatar(nome));

  if (!nomes.length) {
    return {
      erro: `O texto casou com "${trecho}", mas o modelo "${nome}" não está entre os aprovados da plataforma.`,
      trecho,
    };
  }
  if (nomes.length > 1) {
    return {
      erro: `Há ${nomes.length} modelos chamados "${nome}". Renomeie um deles na plataforma.`,
      trecho,
    };
  }
  return { modelo: nomes[0], trecho };
}

/**
 * Editor em texto da tabela TEXTO → modelo: uma linha por par, `trecho = Modelo`.
 *
 * Separado do `parseContentTemplates` porque a chave aqui **não é achatada na gravação**: o que ele
 * digita é o trecho como aparece na conversa ("Olá! Eu apoio as Escolas Cívico-Militares"), e mostrar
 * isso de volta em minúsculas e sem acento seria mostrar outra coisa. O achatamento acontece só na
 * COMPARAÇÃO, dentro de `modeloPorTexto`.
 *
 * O primeiro `=` separa: nome de modelo pode conter `=`, trecho de anúncio raramente contém.
 */
export function parseModeloPorTexto(texto) {
  const out = {};
  for (const linha of String(texto || '').split('\n')) {
    const t = linha.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const trecho = t.slice(0, i).trim();
    const modelo = t.slice(i + 1).trim();
    if (!trecho || !modelo) continue;
    out[trecho] = modelo;
  }
  return out;
}

/** O inverso, para a tela: uma linha por par. */
export function formatModeloPorTexto(mapa) {
  return Object.entries(mapa || {})
    .map(([trecho, modelo]) => `${trecho} = ${modelo}`)
    .join('\n');
}

/**
 * Qual modelo atende o conteúdo que o contato pediu.
 *
 * O caminho é: a mensagem casa com uma regra ("zucco"), a regra dá a etiqueta
 * ("Conteúdo Zucco"), e a tabela de Config diz qual modelo aprovado corresponde. Nada é
 * adivinhado — sem mapeamento, devolve o motivo para o painel explicar.
 *
 * @param {string} etiqueta rótulo da etiqueta de conteúdo que casou
 * @param {object} mapa     etiqueta normalizada → nome do modelo
 * @param {Array}  modelos  modelos disponíveis (de list())
 * @returns {{modelo?:object, erro?:string}}
 */
export function templateParaConteudo(etiqueta, mapa, modelos) {
  const nome = mapa?.[achatar(etiqueta)];
  if (!nome) {
    return { erro: `Nenhum modelo mapeado para "${etiqueta}". Cadastre na aba Config → "Modelo por conteúdo".` };
  }

  const casam = (modelos || []).filter((m) => achatar(m.name) === achatar(nome));
  if (!casam.length) {
    return { erro: `O modelo "${nome}" não está na lista de modelos aprovados da plataforma.` };
  }
  // Nomes repetidos existem ("Flávio" e "Flávio"): sem saber qual, não arrisca enviar.
  if (casam.length > 1) {
    return {
      erro: `Há ${casam.length} modelos chamados "${nome}". Renomeie um deles na plataforma para o WhatsFill saber qual enviar.`,
    };
  }
  return { modelo: casam[0] };
}

/**
 * Qual conteúdo responder quando a mensagem casa com mais de uma regra.
 *
 * Acontece o tempo todo porque as regras são casadas também contra a **campanha do anúncio**:
 * um anúncio que cita dois nomes faz o contato casar com os dois, mesmo sem ele ter pedido
 * nada. Bloquear nesse caso era desperdício — na dúvida vale o conteúdo preferido da campanha.
 *
 * As etiquetas continuam sendo aplicadas **todas**: o desempate é só sobre qual modelo enviar.
 *
 * @param {Array<{nome:string}>} conteudos sugestões de origem "conteúdo"
 * @param {string} preferido rótulo a preferir no empate
 */
/**
 * A rodada pode fechar este contato sozinha, ou tem que parar e perguntar?
 *
 * Vale só para quem tem a **última mensagem nossa** — ou seja, já foi respondido. A rodada
 * concluía todos esses sem perguntar, e isso tratava igual dois casos bem diferentes:
 *
 * - respondi **há uma hora**: a pessoa ainda está com a conversa aberta, pode responder a
 *   qualquer momento. Fechar é o certo, e perguntar seria teclar à toa;
 * - respondi **anteontem** e ela nunca voltou: essa saía da fila em silêncio sem nunca ter
 *   mandado os dados. Foi o relato — *"está pulando pessoas que estão sem responder há mais de
 *   um dia"*.
 *
 * Passou do limite, a rodada **pergunta**. Quem decide o que mandar (a mensagem do momento, um
 * modelo, ou nada) é ele, na caixa da rodada: mensagem automática para quem está calado há dias
 * é justamente o envio que não pode sair sem autorização.
 *
 * Puro e testado: decide se um atendimento de gente real fecha sem ninguém olhar.
 *
 * @param {object} ctx
 * @param {number} ctx.horasDesdeMinha horas desde a última mensagem NOSSA
 * @param {number} ctx.limiteHoras     a partir de quantas horas a rodada para e pergunta
 * @returns {{acao:'perguntar'|'concluir', motivo:string}}
 */
export function decidirSemResposta({ horasDesdeMinha = 0, limiteHoras = 12 } = {}) {
  if (!(horasDesdeMinha >= limiteHoras)) {
    return { acao: 'concluir', motivo: 'a última mensagem já era minha' };
  }

  const silencio =
    horasDesdeMinha >= 48
      ? `${Math.floor(horasDesdeMinha / 24)} dias sem resposta`
      : `${Math.floor(horasDesdeMinha)}h sem resposta`;
  return { acao: 'perguntar', motivo: `${silencio} desde a minha última mensagem` };
}

/**
 * Já mandamos alguma coisa para este contato agora há pouco?
 *
 * O anti-duplicata por MODELO guarda "contato X recebeu o modelo Y" e não pegou o caso real: o
 * contato recebeu a resposta pronta numa rodada e o modelo aprovado na seguinte, 32 min depois.
 * Chaves diferentes, nenhuma duplicata, duas mensagens na cara da pessoa.
 *
 * A trava de "contato já tratado" que existe no laço também não pega: ela é um `Set` que nasce
 * vazio a cada rodada, e o caso real são DUAS rodadas. Uma cobre o mesmo item voltando ao topo
 * da lista; esta cobre a próxima rodada começando justo por ele. As duas juntas, não uma no
 * lugar da outra.
 *
 * A pergunta certa não é "já mandei ESTE texto?", é **"já falei com esta pessoa agora há
 * pouco?"** — e quem responde isso é a conversa, não o nosso registro: ela inclui o que foi
 * mandado à mão, por outra rodada, ou por outro operador.
 *
 * O limite é de horas, e não "nunca repetir", porque esta fila é de quem **não responde**: a
 * última mensagem ser nossa é a regra, não a exceção. Quem recebeu há três dias é alvo legítimo
 * de uma segunda tentativa; quem recebeu há trinta minutos, não.
 *
 * @param {object} ctx
 * @param {boolean} ctx.ultimaFoiNossa a última mensagem da conversa é nossa?
 * @param {number} ctx.horasDesdeUltima horas desde essa mensagem
 * @param {number} ctx.limiteHoras      janela em que não se repete
 * @returns {{acao:'enviar'|'pular', motivo:string}}
 */
export function decidirReenvio({ ultimaFoiNossa = false, horasDesdeUltima = Infinity, limiteHoras = 48 } = {}) {
  if (!ultimaFoiNossa) return { acao: 'enviar', motivo: '' };
  if (!(horasDesdeUltima < limiteHoras)) return { acao: 'enviar', motivo: '' };

  const quando =
    horasDesdeUltima < 1
      ? `${Math.max(1, Math.round(horasDesdeUltima * 60))} min`
      : `${Math.floor(horasDesdeUltima)}h`;
  return { acao: 'pular', motivo: `já recebeu mensagem nossa há ${quando} — não vou mandar de novo` };
}

export function escolherConteudo(conteudos, preferido) {
  const todos = conteudos || [];
  if (!todos.length) return { erro: 'nenhum conteúdo reconhecido' };

  /**
   * **Conteúdo específico vence o de ÚLTIMO RECURSO, e isso não passa pelo preferido.**
   *
   * A etiqueta de anúncio (`fallback: true`) diz que a pessoa veio de anúncio, não de QUAL
   * anúncio. Print da Seura (31/08): ela clicou no anúncio das Escolas Cívico-Militares, e o
   * modelo que saía era o genérico — *"eu tenho um modelo pra escolas civico militares mas a
   * etiqueta ads não faz distinção"*.
   *
   * O desempate por `preferido` continua existindo, mas só **entre iguais**: com ADS na Config
   * como preferido, ele vencia até "CONTEÚDO FLÁV" e "CONTEÚDO ZUC", que são temas de verdade.
   * Origem não desempata com tema; origem espera que nenhum tema apareça.
   */
  const especificos = todos.filter((c) => !c.fallback);
  const lista = especificos.length ? especificos : todos;

  if (lista.length === 1) return { conteudo: lista[0], desempatado: lista.length !== todos.length };

  // Sem acento aqui, diferente do resto do módulo: este valor é **digitado à mão** na Config,
  // e "Conteudo Flavio" não pode deixar de desempatar por causa de um til.
  const alvo = semAcento(preferido);
  if (!alvo) {
    return { erro: `casou com ${lista.length} conteúdos e não há preferido definido na Config` };
  }

  const achado = lista.find((c) => semAcento(c.nome) === alvo);
  if (!achado) {
    return {
      erro: `casou com ${lista.length} conteúdos (${lista.map((c) => c.nome).join(', ')}), nenhum deles o preferido "${preferido}"`,
    };
  }
  return { conteudo: achado, desempatado: true };
}

/** Editor em texto: uma linha por conteúdo, "Etiqueta = Modelo". */
export function parseContentTemplates(texto) {
  const out = {};
  for (const linha of String(texto || '').split('\n')) {
    const t = linha.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const etiqueta = t.slice(0, i).trim();
    const modelo = t.slice(i + 1).trim();
    if (!etiqueta || !modelo) continue;
    out[achatar(etiqueta)] = modelo;
  }
  return out;
}

export function formatContentTemplates(mapa) {
  return Object.entries(mapa || {})
    .map(([etiqueta, modelo]) => `${etiqueta} = ${modelo}`)
    .join('\n');
}

export const PARAMS_NAO_APRENDIDOS =
  'tem parâmetro, e o WhatsFill ainda não aprendeu a tela de parâmetros da plataforma. ' +
  'Nenhum dos modelos cadastrados hoje usa parâmetro — quando o primeiro aparecer, é preciso ' +
  'uma passada de captura para ensinar o preenchimento. Envie este pela plataforma.';

/**
 * Escolhe o modelo no diálogo e, se `send`, clica em "Enviar mensagem".
 *
 * Com `send: false` o diálogo fica **aberto na tela de parâmetros, com o modelo já
 * selecionado** — é o equivalente do "Só inserir" do composer: você confere e clica.
 *
 * @param {{id:string,name:string,text:string,params:any[]}} template
 * @param {{send?:boolean}} opts
 */
export async function sendTemplate(template, { send = false } = {}) {
  if (!template?.name) throw new Error('Modelo sem nome.');

  // Regra do projeto: melhor travar do que mandar parâmetro vazio para o contato.
  if (template.params?.length) {
    throw new Error(`O modelo "${template.name}" ${PARAMS_NAO_APRENDIDOS}`);
  }

  await abrirDialogo();
  await escolher(template);

  const continuar = dom.getDialogButton('Continuar');
  if (!continuar) throw new Error('O botão Continuar sumiu do diálogo.');
  if (continuar.disabled) throw new Error('Continuar segue desabilitado — o modelo não ficou selecionado.');
  continuar.click();

  const enviar = await waitFor(() => {
    const b = dom.getDialogButton('Enviar mensagem');
    return b && !b.disabled ? b : null;
  }, 8000);
  if (!enviar) {
    throw new Error('A tela de parâmetros não apareceu. O diálogo ficou aberto para você concluir à mão.');
  }

  // Se a plataforma pediu algum parâmetro que a API não anunciou, para aqui em vez de enviar.
  const pedidos = camposDeParametro();
  if (pedidos.length) {
    throw new Error(
      `A plataforma pediu ${pedidos.length} parâmetro(s) que não vieram na API. ` +
        'Deixei o diálogo aberto para você preencher e enviar.'
    );
  }

  if (!send) return { prepared: true, sent: false };

  enviar.click();

  const fechou = await waitFor(() => (dom.getDialog() ? null : true), 10000);
  if (!fechou) {
    throw new Error('Cliquei em "Enviar mensagem" mas o diálogo não fechou. Confira a conversa antes de repetir.');
  }
  return { prepared: true, sent: true };
}

/** Campos de preenchimento na tela de parâmetros (a busca e os rádios da lista não contam). */
function camposDeParametro() {
  const dlg = dom.getDialog();
  if (!dlg) return [];
  return [...dlg.querySelectorAll('input,textarea')].filter(
    (el) => !['radio', 'checkbox', 'file'].includes(el.type) && el !== dom.getTemplateSearchInput()
  );
}

async function abrirDialogo() {
  if (dom.getDialog()) return; // já estava aberto

  const clipe = dom.getAnexoButton();
  if (!clipe) {
    throw new Error('Não achei o clipe do rodapé. O atendimento precisa estar em andamento.');
  }
  clipe.click();

  try {
    const item = await waitFor(() => dom.getMenuItem(dom.MENU_MODELO_MENSAGEM), 4000);
    if (!item) throw new Error('O menu do clipe não trouxe "Modelo de mensagem".');
    item.click();

    const dlg = await waitFor(() => dom.getDialog(), 8000);
    if (!dlg) throw new Error('O diálogo de modelos não abriu.');
    await waitFor(() => (dom.getTemplateRows().length ? true : null), 8000);
  } catch (err) {
    // Fomos nós que abrimos o menu: se o fluxo morreu no meio, fechamos o que abrimos. Overlay
    // do Material esquecido aberto fica POR CIMA do painel (z-index 1000 contra 998) e, quando
    // é diálogo, é modal — o painel inteiro parava de responder até recarregar a aba.
    fecharOverlayAberto();
    throw err;
  }
}

/** Escape é como o Material fecha menu e diálogo; não mexe em nada mais da página. */
function fecharOverlayAberto() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

/**
 * A lista é virtualizada (só ~6 linhas no DOM de uma vez), então rolar não resolve: quem
 * traz o modelo para a tela é o campo de busca, que refaz a consulta no servidor.
 */
async function escolher(template) {
  const busca = dom.getTemplateSearchInput();
  if (!busca) throw new Error('Não achei o campo de busca do diálogo.');

  setNativo(busca, template.name);

  // A busca refaz a consulta no servidor. Casar durante o repinte devolve linha transitória,
  // então espera a lista PARAR de mudar antes de escolher.
  await esperarListaEstavel();

  const alvo = achaLinha(template);
  if (!alvo) {
    throw new Error(
      `Não achei o modelo "${template.name}" na lista do diálogo. ` +
        'Se houver outro com o mesmo nome e texto parecido, o WhatsFill não arrisca escolher — ' +
        'envie pela plataforma.'
    );
  }

  alvo.row.click();

  // Confere no DOM que a linha marcada é mesmo a pedida. Sem esta conferência, um repinte
  // entre o casamento e o clique manda o modelo errado — foi o que aconteceu no teste ao vivo.
  const confere = await waitFor(() => (selecaoConfere(template) ? true : null), 4000);
  if (!confere) {
    throw new Error(
      `Não consegui confirmar que "${template.name}" ficou selecionado no diálogo. ` +
        'Não vou arriscar enviar o modelo errado — escolha pela plataforma.'
    );
  }
  return alvo;
}

/** A linha marcada é a do modelo pedido? Reusa a mesma regra de casamento, sem atalho. */
function selecaoConfere(template) {
  const marcadas = dom
    .getTemplateRows()
    .filter((l) => l.radio.classList.contains('mat-radio-checked'));
  if (marcadas.length !== 1) return false;
  return pickRow(marcadas, template) === marcadas[0];
}

/** Espera a lista ficar parada — a virtualização repinta várias vezes depois da busca. */
async function esperarListaEstavel({ quietoMs = 600, timeoutMs = 9000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let assinatura = null;
  let desde = 0;

  while (Date.now() < deadline) {
    const atual = dom
      .getTemplateRows()
      .map((l) => `${l.name}|${l.preview.slice(0, 40)}`)
      .join('\n');
    if (atual !== assinatura) {
      assinatura = atual;
      desde = Date.now();
    } else if (atual && Date.now() - desde >= quietoMs) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

function achaLinha(template) {
  return pickRow(dom.getTemplateRows(), template);
}

/**
 * Escolhe a linha certa entre as visíveis. Puro e testado de propósito: é o ponto onde um erro
 * manda o modelo errado para um contato real.
 *
 * Nome sozinho não basta — a conta tem modelos repetidos ("A" e "A", "Flávio" e "Flávio").
 * O começo do texto desempata. Continuou ambíguo? Devolve null, e o chamador recusa em vez de
 * chutar.
 *
 * @param {Array<{name:string, preview:string}>} linhas linhas visíveis no diálogo
 * @param {{name:string, text:string}} template modelo vindo da API
 */
export function pickRow(linhas, template) {
  const candidatas = (linhas || []).filter((l) => achatar(l.name) === achatar(template?.name));
  if (!candidatas.length) return null;

  const alvo = achatar(template?.text);

  // Sem texto de referência não há como conferir: só aceita se não houver ambiguidade nenhuma.
  if (alvo.length < MIN_PREFIXO) return candidatas.length === 1 ? candidatas[0] : null;

  // Candidato único NÃO é aceito pelo nome: enquanto a busca repinta a lista, existe um
  // instante com um só "Flávio" na tela — e no teste ao vivo era o Flávio errado. O texto é
  // que manda, sempre.
  //
  // Prefixo fixo também não serve: os dois "Flávio" da conta abrem com a mesma frase longa e
  // só divergem depois. Quem decide é qual linha acompanha o texto por mais tempo.
  const pontuadas = candidatas
    .map((linha) => {
      const preview = achatar(linha.preview);
      const n = prefixoComum(preview, alvo);
      // Cobertura, não tamanho absoluto: os dois "Flávio" compartilham 39 caracteres de
      // abertura, então um piso fixo baixo aceitaria o errado. O prefixo comum tem que
      // cobrir quase toda a string mais curta.
      const cobertura = n / Math.max(1, Math.min(preview.length, alvo.length));
      return { linha, n, cobertura };
    })
    .sort((a, b) => b.n - a.n);

  const [melhor, segunda] = pontuadas;
  if (melhor.n < MIN_PREFIXO || melhor.cobertura < COBERTURA_MINIMA) return null;
  if (segunda && segunda.n === melhor.n) return null; // empate: não arrisca
  return melhor.linha;
}

const MIN_PREFIXO = 12;
const COBERTURA_MINIMA = 0.8;

function prefixoComum(a, b) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function achatar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Como `achatar`, e ainda sem acento. Só para valor digitado à mão pelo usuário. */
function semAcento(texto) {
  return achatar(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Angular não enxerga `input.value = x`: precisa do setter nativo + evento, igual composer.js. */
function setNativo(input, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  input.focus();
  setter.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function waitFor(fn, timeoutMs, stepMs = 120) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}
