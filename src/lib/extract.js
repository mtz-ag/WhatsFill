/**
 * extract.js — parser determinístico da resposta do contato. Zero IA, zero custo.
 *
 * Ele NÃO decide nada: devolve palpites com a origem (o trecho da mensagem que gerou o
 * valor) para o painel pré-preencher e você confirmar em um clique.
 *
 * A precisão vem principalmente do formato da pergunta: o template "pedir-dados" pede
 * "Nome completo / Cidade / Função", e o template de tema pede um número. Resposta
 * estruturada é o que torna a regra confiável — e é o que vai permitir automatizar depois.
 */

import * as cities from './cities.js';
import * as store from './store.js';

/**
 * O parser extrai **Nome e Cidade**, e mais nada.
 *
 * "Tema de Interesse", "Função" e "Partido" saíram em 01/09/2026 por pedido dele (*"não preciso
 * preencher isso"*). `temaField` era o segundo parâmetro daqui e sumiu junto — quem ainda passar
 * o objeto de opções não quebra, só é ignorado.
 *
 * @param {string[]} texts mensagens recebidas do contato, da mais antiga para a mais nova
 * @param {object} [opts]
 * @param {boolean} [opts.respostaAoPedido] a nossa última mensagem foi o pedido de dados
 * @returns {Promise<object>} palpites por campo
 */
export async function extract(texts, { respostaAoPedido = false } = {}) {
  const dicts = await store.get('dicts');
  const list = (texts || []).filter(Boolean);
  const joined = list.join('\n');

  const structured = await findStructured(list, isCityAlone);
  const guesses = {};

  /**
   * **Você acabou de perguntar, então o que veio é a resposta.**
   *
   * Pedido dele (31/08): *"se eu perguntei qual sua cidade e ela respondeu (maria cachoeirinha),
   * terá que identificar esse tipo de resposta"*. A pessoa não escreve "moro em" quando está
   * respondendo a uma pergunta — ela escreve o nome e a cidade, sem separador nenhum.
   *
   * É o contexto mais forte que existe aqui, e é NOSSO: quem chama sabe que a última mensagem
   * enviada foi o pedido de dados. Por isso dispensa pista e dispensa limite de tamanho.
   *
   * Fica FORA do `else` porque a seção do Nome também usa: é dela que sai o "maria" de
   * "maria cachoeirinha".
   */
  /**
   * **E a busca é MENSAGEM A MENSAGEM aqui também** — segunda cópia da armadilha de 02/09/2026.
   *
   * Este caminho olhava a conversa INTEIRA colada (`joined`), e a conferência logo abaixo exige que
   * o que sobra depois da cidade seja um nome de gente. Com duas mensagens na conversa — e quem
   * chega pelo anúncio tem sempre duas, porque o texto do anúncio é uma delas — a sobra passava a
   * ser o anúncio inteiro, e **nada era aceito**. Medido com as anotações de 04/09: a mesma
   * resposta que dá `Chuvisca` sozinha devolve vazio com a mensagem do anúncio junto.
   *
   * O outro caminho (`matchCityComContexto`) já tinha sido consertado assim; este ficou para trás,
   * que é o defeito de sempre quando o mesmo invariante mora em dois lugares.
   *
   * Da mais NOVA para a mais antiga: a resposta ao formulário é a última coisa que ela escreveu.
   * Mensagem que casa mas não passa na conferência do nome **não interrompe a busca** — antes ela
   * derrubava a passada inteira.
   */
  const daResposta = await (async () => {
    if (structured || !respostaAoPedido) return null;
    for (const texto of [...list].reverse()) {
      const bruta = await cities.matchCity(texto);
      if (!bruta) continue;
      const sobra = semConectorSolto(cities.semACidade(texto, bruta.city));
      if (!sobra || plausivelNome(sobra)) return { bruta, sobra };
    }
    return null;
  })();

  /**
   * O que sobra da resposta depois de tirar o município — deveria ser o nome, e só ele.
   *
   * Removido por `cities.semACidade`, que procura pelo mesmo `normalize` que casou. Antes isto
   * removia o nome OFICIAL do texto cru, e não achava nada quando ela escreveu um apelido: "POA"
   * virava o nome "Poa", e "Vera POA" virava "Vera Poa" com a cidade rebaixada a palpite
   * (relato dele, 02/09/2026).
   */
  const naRespostaBruta = daResposta?.bruta || null;
  const sobraDaResposta = daResposta?.sobra || '';

  /**
   * A resposta só conta se o que sobrou for **nome ou nada**.
   *
   * Você pediu "Nome / Cidade". Se veio um município e o resto não é nome de gente, aquilo não
   * é uma resposta — é outra coisa que por acaso cita um município. O caso real: quem responde
   * o formulário com o slogan do anúncio, *"Vamos juntos mudar o Rio Grande"*, que traria a
   * cidade Rio Grande e o "nome" Vamos Juntos Mudar O.
   */
  const naResposta = naRespostaBruta && (!sobraDaResposta || plausivelNome(sobraDaResposta)) ? naRespostaBruta : null;

  // --- Cidade -------------------------------------------------------------
  if (structured) {
    guesses.cidade = {
      value: structured.cidade,
      confidence: 'exata',
      source: structured.cidadeInformada,
      // A pessoa respondeu o formulário: esta cidade veio DELA, não de um trecho solto da
      // conversa. É o único caso em que o painel troca uma cidade que já estava no CRM.
      informada: true,
    };
  } else {
    /**
     * Mensagem que é **só o nome de um município** também é a pessoa informando a cidade.
     *
     * Caso real: o contato mandou uma única mensagem, `PORTO ALEGRE`. O cadastro dele estava
     * com "Santiago" — dado velho e errado —, e a regra "nunca sobrescrever o CRM" mantinha o
     * errado, porque só resposta com separador ("Nome / Cidade") contava como informada. Só que
     * uma mensagem inteira com o nome da cidade é a pessoa dizendo a cidade dela de forma **mais**
     * clara, não menos.
     *
     * As travas são as mesmas do resto: casamento exato e o nome COMPLETO do município. Prefixo
     * não vale — "Vitória" sozinho pode ser nome de gente, e trocar a cidade de um eleitor por
     * causa disso é pior do que deixar o campo como está.
     */
    /**
     * Sem resposta ao formulário, a cidade precisa de CONTEXTO — não basta o nome aparecer.
     *
     * Pedido dele (31/08): *"a cidade deve sair de um contexto, resposta a minha pergunta, ou a
     * pessoa falar (eu moro em (cidade), eu sou de (cidade))"*. O caso da print: a mensagem do
     * anúncio dizia *"Vamos juntos mudar o Rio Grande"* — o estado — e "Rio Grande" é município.
     *
     * Sobram então os três caminhos que são a pessoa dizendo onde mora: a resposta estruturada
     * (acima), a mensagem que é só o nome da cidade, e a menção precedida de pista ("moro em",
     * "sou de", "aqui em"…).
     */
    const soCidade = await cidadeSozinha(list);

    /**
     * **A busca por contexto é MENSAGEM A MENSAGEM, não na conversa junta.**
     *
     * Era `matchCityComContexto(joined)` — a conversa inteira colada num texto só. E dentro dela o
     * caminho *"texto curto é a própria resposta"* exige **30 caracteres**, então ele funcionava
     * apenas quando a conversa tinha UMA mensagem: qualquer segunda, mesmo um "oi", estourava o
     * limite e a cidade sumia.
     *
     * Medido em 02/09/2026 com os casos que ele anotou:
     *
     * | conversa                                            | antes | agora |
     * |---|---|---|
     * | `["Oi jeane Souza Novo Hamburgo"]`                  | Novo Hamburgo | Novo Hamburgo |
     * | `["oi", "Oi jeane Souza Novo Hamburgo"]`            | **nada** | Novo Hamburgo |
     * | a Silvia, com o texto do anúncio antes              | **nada** | Portão |
     *
     * O sintoma na tela é o campo Cidade vazio com a cidade escrita na conversa — o mesmo de três
     * anotações dele ("cidade vazia mas ela respondeu", "não pegou cidade", e a Silvia concluída em
     * silêncio). **Nenhum dos três caminhos mudou**: continuam sendo a resposta ao formulário, a
     * mensagem curta que é a cidade, e a menção depois de pista. O que muda é onde eles procuram.
     *
     * Da mais NOVA para a mais antiga, como `cidadeSozinha`: se ela corrigiu a cidade depois, vale
     * a correção. E procurar por mensagem também impede a pista de uma mensagem alcançar o texto da
     * seguinte, que a junção permitia.
     */
    const porContexto = await (async () => {
      for (const texto of [...list].reverse()) {
        const achado = await cities.matchCityComContexto(texto);
        if (achado) return achado;
      }
      return null;
    })();

    const hit = soCidade || naResposta || porContexto;
    if (hit) {
      guesses.cidade = {
        value: hit.city,
        confidence: hit.confidence,
        source: hit.matched,
        informada: !!soCidade,
        /**
         * **A UF, quando o município é de FORA do RS** — pedido dele (08/09/2026), print da
         * etiqueta *"Fora do RS"*. É o que faz `tags.suggest` marcar essa etiqueta em vez de criar
         * etiqueta de cidade e de COREDE, que são estaduais. Ausente para os 497 do RS.
         */
        ...(hit.foraDoRS ? { foraDoRS: hit.foraDoRS } : {}),
      };
    }
  }

  if (!guesses.cidade) {
    // Nenhum município reconhecido. Se a pessoa respondeu algo curto na posição da cidade,
    // mostramos como não reconhecido com sugestões — melhor pedir confirmação que ignorar.
    const naPosicao = cityPositionGuess(list);
    // Vocabulário da campanha nunca é oferecido como cidade, nem como palpite: "Zucco" virava
    // popup em toda mensagem de anúncio, porque os nomes vêm separados por vírgula.
    if (naPosicao && !(await cities.naoPodeSerCidade(naPosicao))) {
      guesses.cidade = {
        value: naPosicao,
        confidence: 'nao-reconhecida',
        source: naPosicao,
        suggestions: await cities.suggest(naPosicao, 3),
      };
    }
  }

  // --- Nome ---------------------------------------------------------------
  //
  // A limpeza de siglas roda de novo aqui, agora com o dicionário de partidos: `findStructured`
  // só conhece a lista fixa, e partido novo entra pela Config sem passar por código.
  const nomeMatch = /\bmeu nome (?:é|e)\s+([\p{L}][\p{L}\s'.-]{2,60})/iu.exec(joined);
  /**
   * Resposta ao pedido sem separador: o que sobra depois de tirar a cidade é o nome.
   *
   * "maria cachoeirinha" é o formato real da resposta — sem barra, sem vírgula. Tirar o trecho
   * que casou com o município deixa "maria", e `plausivelNome` decide se aquilo é nome de gente.
   */
  const nomeDaResposta = naResposta && plausivelNome(sobraDaResposta) ? sobraDaResposta : '';

  const nomeCru = structured?.nome || nomeDaResposta || (nomeMatch ? nomeMatch[1].trim() : '');
  const nomeLimpo = limparSiglas(nomeCru, dicts.partido);
  if (nomeLimpo) {
    guesses.nome = {
      value: titleCase(nomeLimpo),
      confidence: 'aproximada',
      // A origem é o trecho que gerou o valor, e são três caminhos possíveis agora. Sem isto,
      // nome vindo da resposta estourava em `nomeMatch[0]` — `nomeMatch` é null nesse caso.
      source: structured?.nome || nomeDaResposta || (nomeMatch ? nomeMatch[0] : nomeCru),
    };
  }

  // Função, Partido e Tema de Interesse SAÍRAM em 01/09/2026, a pedido dele (*"não preciso
  // preencher isso"*). Não foram só desligados na tela: deixar o parser extraindo o que ninguém
  // grava custa processamento a cada mensagem e, pior, deixa `guesses.partido` e companhia
  // atravessando o painel esperando um consumidor que não existe mais — é assim que campo removido
  // volta sozinho no primeiro caminho novo.
  //
  // A lista de siglas de partido CONTINUA existindo, e é usada logo acima: `limparSiglas` tira
  // "PL"/"PP" de dentro do nome ("Jeane do PL" → "Jeane"). Ela virou dicionário de limpeza de
  // nome, não fonte de um campo.

  return guesses;
}

/**
 * Aberturas e verbos que descartam um pedaço como candidato a nome de pessoa.
 *
 * O "sim"/"não" entrou quando a pergunta de interesse passou a pedir os dados junto: a resposta
 * vem como "Sim / Maria Silva / Palmares do Sul", e sem isto o **Sim** vira o nome do eleitor
 * sempre que ele escrever a cidade antes do nome.
 */
const NAO_E_NOME =
  /\b(oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad|quero|queria|sou|moro|resido|aceito|gostaria|pode|tenho|preciso|meu|minha|aqui|somos|sim|n[aã]o|claro|isso|ok|beleza|positivo|afirmativo|vamos|juntos|mudar|apoio|apoiar|escolho|voto|vote|luta|firme|lado)\b/i;

/**
 * Siglas que vêm coladas no nome e nunca são nome de gente.
 *
 * Duas entradas reais: "Jeane do PL" gravava o partido dentro do Nome, e "srn" (abreviação
 * digitada na posição do nome) virava o nome do eleitor — o agradecimento saía "Obrigado pela
 * atenção, Srn!". Partido tem campo próprio; aqui ele só atrapalha.
 */
const SIGLAS_FIXAS = new Set([
  'pl', 'pp', 'mdb', 'psdb', 'pt', 'pdt', 'psd', 'pv', 'psol', 'psb', 'prd', 'dc', 'prtb',
  'pcdob', 'rs', 'br', 'cac', 'mst', 'ong', 'cnpj', 'cpf',
]);

/** Partículas de nome composto, que sobram penduradas quando a sigla sai ("Jeane do ~~PL~~"). */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Nome de gente em português sempre tem vogal. É o que separa "srn", "jrn" e "kkk" de um nome
 * curto de verdade ("Ana", "Ivo") sem precisar de lista.
 */
function semVogal(texto) {
  return !/[aeiouáàâãéêíóôõúüy]/i.test(String(texto || ''));
}

function ehSigla(token, conhecidas) {
  const t = String(token || '').toLowerCase().replace(/[.'-]/g, '');
  if (!t) return true;
  if (conhecidas.has(t)) return true;
  // Curta e sem vogal: "PL", "srn", "MDB". Nome de gente com 5 letras sempre tem vogal.
  return t.length <= 5 && semVogal(t);
}

/**
 * Tira as siglas de um nome e devolve o que sobrou de nome de verdade.
 *
 * Devolve string vazia quando NADA sobra — é o que impede "srn" e "PL" de virarem o Nome do
 * eleitor no CRM. Quem chama trata vazio como "não achei nome", não como nome em branco.
 *
 * @param {string} nome
 * @param {string[]} [siglas] siglas extras (o dicionário de partidos, na prática)
 */
export function limparSiglas(nome, siglas = []) {
  const conhecidas = new Set([...SIGLAS_FIXAS, ...(siglas || []).map((s) => String(s).toLowerCase())]);
  const tokens = String(nome || '').trim().split(/\s+/).filter(Boolean);
  const limpos = tokens.filter((t) => !ehSigla(t, conhecidas));

  // "Jeane do PL" vira "Jeane do": a partícula pendurada sai junto.
  while (limpos.length && PARTICULAS.has(limpos[limpos.length - 1].toLowerCase())) limpos.pop();
  while (limpos.length && PARTICULAS.has(limpos[0].toLowerCase())) limpos.shift();

  const saida = limpos.join(' ').trim();
  return semVogal(saida) ? '' : saida;
}

/**
 * Resposta ao template "Nome / Cidade / Função".
 *
 * Na prática o contato responde do jeito dele: com barra, com vírgula, em linhas separadas, e
 * às vezes só "Nome, Cidade" (foi o que aconteceu no atendimento real que motivou isto).
 * Aceitar vírgula sem mais nenhum critério pegaria frase solta como "boa tarde, sou de
 * Cachoeira do Sul" e viraria nome="Boa Tarde".
 *
 * O critério que separa um do outro: um dos pedaços tem que ser SÓ o nome de um município do
 * RS. Isso indica que a pessoa está respondendo o formulário, e não conversando.
 *
 * @param {string[]} texts mensagens recebidas
 * @param {function} isCity (texto) => nome oficial do município, ou null
 */
export async function findStructured(texts, isCity) {
  for (const text of [...texts].reverse()) {
    /**
     * A ordem é a prioridade: quebra de linha, barra, ponto-e-vírgula, vírgula — e só então
     * **ponto** e **hífen cercado de espaço**.
     *
     * O ponto entrou em 01/09/2026, com o print da Nilza: ela respondeu o formulário como
     * `Nilza krumenauer . rolante RGS :` e **nada** foi extraído, porque ponto não separava. Com
     * barra ou vírgula a mesma frase sempre funcionou — foi a terceira vez no mesmo dia em que o
     * defeito era "a pessoa usou um separador que a gente não previu", e o sintoma é sempre o
     * mesmo: a rodada conclui que faltam dados e manda outra coisa.
     *
     * **Vêm por último de propósito**, e as travas de `findStructured` são o que os tornam
     * seguros: de 2 a 4 pedaços, cada um com no máximo 60 caracteres, e **um deles tem que ser
     * exatamente um município**. Frase comum quebrada no ponto não passa nesse último teste.
     * O ponto exige espaço de um dos lados para não partir abreviação — "Sto. Angelo" fica inteiro.
     */
    for (const separador of [/\n/, /\//, /[;|]/, /,/, /\s\.|\.\s/, /\s-\s/]) {
      const partes = text.split(separador).map((p) => p.trim()).filter(Boolean);
      if (partes.length < 2 || partes.length > 4) continue;
      if (partes.some((p) => p.length > 60)) continue;

      // Qual pedaço é exatamente uma cidade?
      let idx = -1;
      let cidade = null;
      for (let i = 0; i < partes.length; i++) {
        const achou = await isCity(partes[i]);
        if (achou) {
          idx = i;
          cidade = achou;
          break;
        }
      }
      if (idx < 0) continue;

      const anterior = idx > 0 ? partes[idx - 1] : null;

      // O pedaço DEPOIS da cidade continua sendo tolerado (a resposta em três partes ainda casa a
      // cidade), só não vira mais campo: era o "Função", removido em 01/09/2026.
      return {
        nome: plausivelNome(anterior) ? limparSiglas(anterior) : null,
        cidade,
        cidadeInformada: partes[idx],
        raw: text,
      };
    }
  }
  return null;
}

/**
 * A mensagem mais recente que é, sozinha, o nome completo de um município.
 *
 * Da mais nova para a mais antiga: se a pessoa mandou "Canoas" e depois corrigiu para "Porto
 * Alegre", vale a correção.
 */
async function cidadeSozinha(textos) {
  for (const texto of [...textos].reverse()) {
    const t = String(texto || '').trim();
    if (!t || t.length > 40) continue;

    const hit = await cities.matchCity(t);
    // Nome COMPLETO, não prefixo: "Vitória" pode ser gente, "Vitória das Missões" não.
    // A sigla do estado no fim sai antes de comparar: "Canoas RS" é a pessoa informando Canoas,
    // e sem isto a igualdade falhava e a cidade não contava como informada (01/09/2026).
    if (hit?.confidence === 'exata' && cities.formaCanonica(t) === cities.normalize(hit.city)) {
      return { city: hit.city, confidence: 'exata', matched: t };
    }
  }
  return null;
}

/**
 * O pedaço é SÓ o nome de um município? É o que distingue "Thiago, porto alegre" (resposta
 * ao formulário) de "boa tarde, sou de porto alegre e quero ajudar" (conversa).
 * @returns {Promise<string|null>} nome oficial do município
 */
async function isCityAlone(parte) {
  const hit = await cities.matchCity(parte);
  if (!hit) return null;
  const p = cities.formaCanonica(parte);
  if (p === cities.normalize(hit.city)) return hit.city;
  // Erro de digitação: aceita quando o pedaço INTEIRO foi o que casou, não um trecho dele.
  if (hit.confidence === 'aproximada' && cities.normalize(hit.matched || '') === p) return hit.city;
  return null;
}

/**
 * Último recurso para a cidade: a pessoa respondeu no formato pedido, mas escreveu algo que
 * não é município. Devolve o que ela pôs na posição da cidade, para o painel sugerir as
 * parecidas em vez de deixar o campo vazio.
 */
function cityPositionGuess(texts) {
  for (const text of [...texts].reverse()) {
    /**
     * **Ponto e hífen NÃO entram aqui**, ao contrário de `findStructured`.
     *
     * Lá o pedaço precisa ser **exatamente** um município para virar valor, e é essa trava que
     * torna seguro quebrar no ponto. Aqui não há trava nenhuma: o que sair vira palpite
     * "não-reconhecida" com sugestões, ou seja, **um popup pedindo confirmação**. Medido em
     * 01/09/2026: com o ponto, *"Vamos juntos mudar o Rio Grande. Conto contigo"* passava a
     * oferecer "Conto contigo" como cidade a confirmar.
     *
     * Alarme que toca à toa é alarme que se aprende a ignorar — a lista curta fica.
     */
    for (const separador of [/\n/, /\//, /[;|]/, /,/]) {
      const partes = text.split(separador).map((p) => p.trim()).filter(Boolean);
      if (partes.length < 2 || partes.length > 4) continue;
      const candidato = partes[1];
      if (!candidato || candidato.length < 3 || candidato.length > 30) continue;
      if (NAO_E_NOME.test(candidato)) continue;
      if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(candidato)) continue;
      return candidato;
    }
  }
  return null;
}

/**
 * Tira a preposição que ficou pendurada quando a cidade saiu do meio da frase.
 *
 * Anotação do Carlos (04/09/2026): *"Carlos Elci Bitencourt Alves **de** Minas do Leão"*. Tirando
 * o município sobra `Carlos Elci Bitencourt Alves de` — cinco palavras, e o limite do nome é
 * quatro; a resposta inteira era descartada por causa de um "de" que nem é do nome, é da cidade.
 *
 * Vale nas duas pontas: *"de Gravataí Maria"* deixa a preposição na frente.
 */
function semConectorSolto(parte) {
  let s = String(parte || '').trim();
  let antes = null;
  while (s !== antes) {
    antes = s;
    s = s
      .replace(/^(?:de|da|do|das|dos|em|no|na|nos|nas|e)\b[\s.,;:-]*/i, '')
      .replace(/[\s.,;:-]*\b(?:de|da|do|das|dos|em|no|na|nos|nas|e)\.?$/i, '')
      .trim();
  }
  return s;
}

function plausivelNome(parte) {
  if (!parte) return false;
  const s = parte.trim();
  if (s.length < 3 || s.length > 40) return false;
  if (NAO_E_NOME.test(s)) return false;
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(s)) return false; // só letras, espaço e pontuação de nome
  const palavras = s.split(/\s+/);
  if (palavras.length < 1 || palavras.length > 4) return false;
  // Só sigla ("PL", "srn") não é nome: se depois da limpeza não sobra nada, não era nome.
  return !!limparSiglas(s);
}

function titleCase(s) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return String(s)
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

/**
 * Rebaixa todo palpite para "espera clique", e diz de onde veio.
 *
 * **Existe para uma coisa só: o que sai de TRANSCRIÇÃO de áudio.** Nesta base muita gente
 * responde falando, e o painel dizia "Cidade: (vazia)" para quem tinha dito a cidade em voz.
 * Ler a transcrição resolve — e cria um risco novo, porque ninguém DIGITOU aquilo: é fala
 * passada por reconhecimento automático, com os erros disso.
 *
 * As duas marcas são o que tornam isso seguro, e cada uma fecha um caminho diferente:
 *
 *  - `confidence: 'aproximada'` mantém o valor **fora da gravação automática** — só `crm` e
 *    `exata` são gravados sozinhos;
 *  - `informada: false` impede **substituir o que já está no CRM** — a regra de "a pessoa
 *    informou outra cidade" exige texto escrito, e áudio ouvido por máquina não é isso.
 *
 * A origem sai na tela dizendo que veio do áudio, para dar para conferir antes de aceitar.
 *
 * @param {object} guesses o que `extract` devolveu
 * @returns {object} os mesmos palpites, rebaixados
 */
export function rebaixarParaPalpite(guesses) {
  const saida = {};
  for (const [chave, guess] of Object.entries(guesses || {})) {
    if (!guess || typeof guess !== 'object' || !guess.value) {
      saida[chave] = guess;
      continue;
    }
    saida[chave] = {
      ...guess,
      confidence: 'aproximada',
      informada: false,
      source: `${guess.source || guess.value} — ouvido no áudio`,
    };
  }
  return saida;
}
