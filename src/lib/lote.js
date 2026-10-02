/**
 * lote.js — o ENVIO EM LOTE de **imagem + legenda**, revezando entre pares.
 *
 * Pedido dele (01/10/2026): *"preciso enviar uma imagem e um texto especifico fora do fluxo,
 * simplesmente vou mandar para os contatos; preciso que a automatizacao mande e va variando entre
 * umas 4 imagens e descricoes diferentes enquanto manda"*.
 *
 * **Por que FORA do quadro, e por que isso é seguro:** o quadro decide o que responder a quem
 * escreveu; aqui não há nada a responder — é ele mandando a mesma coisa para uma lista. Nenhuma
 * regra do `sugestao`/`arvore` é consultada. O que **continua valendo** são as PROTEÇÕES, que não
 * são preferência dele e sim "não mande nada": etiqueta de sem interesse, etiqueta de assessor e a
 * barreira do canal. A distinção é a de 03/09 (`arvore.PROTECOES`).
 *
 * **O par é IMAGEM + LEGENDA junto, e não 4 imagens cruzadas com 4 textos.** Cruzar daria 16
 * combinações, e a descrição de uma arte não serve para outra — sairia legenda falando de uma
 * imagem que não é a que foi. Par N = a arte N com o texto N, os dois ou nenhum.
 *
 * **A VARIAÇÃO é o que protege o número, e isso foi medido no caso dele** (26/09/2026, correção
 * dele: *"já derrubei o número ao mandar a mesma mensagem em sequência para menos de 10 pessoas"*).
 * Daí o revezamento ser do mecanismo e não um enfeite: `varianteIndex` é o mesmo ponteiro que as
 * respostas prontas usam, e ele **só anda depois que a mensagem sai de verdade** — queimar a
 * rotação num envio que falhou faria o par seguinte pular sozinho.
 */

/** Quantos pares a tela oferece. Quatro foi o número que ele pediu. */
export const QUANTOS_PARES = 4;

/** O ponteiro de revezamento vive no mesmo lugar das variantes das respostas prontas. */
export const ID_DA_ROTACAO = 'lote-imagem';

/** A chave dos BYTES da arte do par — passa por `perfis.chaveDeImagem`, como a do momento. */
export function chaveDaImagem(n) {
  return `imagemLoteArquivo${n}`;
}

/** O campo de link (opcional), irmão de `imagemMomento`. */
export function chaveDoLink(n) {
  return `imagemLote${n}`;
}

/** A legenda do par, dentro do `auto` — e por candidato, porque é o que o eleitor recebe. */
export function chaveDaLegenda(n) {
  return `legendaLote${n}`;
}

/** Todas as chaves que este arquivo cria dentro do `auto`, para a lista do perfil não divergir. */
export function chavesNoAuto() {
  const chaves = [];
  for (let n = 1; n <= QUANTOS_PARES; n++) chaves.push(chaveDoLink(n), chaveDaLegenda(n));
  return chaves;
}

/**
 * **Os pares que estão PRONTOS para sair** — e prontos quer dizer os dois lados preenchidos.
 *
 * Par com arte e sem texto sairia como imagem muda; par com texto e sem arte seria a rodada
 * mandando mensagem solta numa rodada que existe para mandar imagem. Nos dois casos o par
 * simplesmente não entra no revezamento, e a tela diz quais faltam.
 */
export function paresProntos({ cfg = {}, imagens = {}, chaveDeImagem = (nome) => nome } = {}) {
  const pares = [];
  for (let n = 1; n <= QUANTOS_PARES; n++) {
    const chave = chaveDeImagem(chaveDaImagem(n));
    const arquivo = imagens[chave] || null;
    const legenda = String(cfg[chaveDaLegenda(n)] || '').trim();
    if (!arquivo || !legenda) continue;
    pares.push({ n, chave, arquivo, legenda });
  }
  return pares;
}

/** O que falta em cada par incompleto, para a tela dizer em vez de o botão só ficar morto. */
export function oQueFalta({ cfg = {}, imagens = {}, chaveDeImagem = (nome) => nome } = {}) {
  const faltas = [];
  for (let n = 1; n <= QUANTOS_PARES; n++) {
    const temArte = !!imagens[chaveDeImagem(chaveDaImagem(n))];
    const temTexto = !!String(cfg[chaveDaLegenda(n)] || '').trim();
    if (temArte && temTexto) continue;
    if (!temArte && !temTexto) continue; // par vazio não é falta: é par que ele não usou
    faltas.push(temArte ? `o par ${n} tem a imagem e está sem a legenda` : `o par ${n} tem a legenda e está sem a imagem`);
  }
  return faltas;
}

/**
 * O par da vez, sem avançar nada — mesma disciplina de `templates.varianteAtual`: a tela e o
 * começo do envio têm que ver a MESMA coisa.
 */
export function parDaVez(pares, indice) {
  if (!Array.isArray(pares) || !pares.length) return null;
  const n = Number(indice) || 0;
  const i = ((n % pares.length) + pares.length) % pares.length;
  return pares[i];
}

function achatar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** O maior pedaço comparável de um texto nosso — o mesmo piso de 30 do `jaSaiuNaConversa`. */
function maiorPedaco(texto) {
  const pedacos = String(texto || '')
    .split(/\{\{[^}]*\}\}/g)
    .map((t) => achatar(t))
    .filter((t) => t.length >= 30);
  if (!pedacos.length) return '';
  return pedacos.sort((a, b) => b.length - a.length)[0];
}

/**
 * **Quem já recebeu QUALQUER UM dos pares está fora** — e é o conjunto inteiro, nunca o sorteado.
 *
 * É a armadilha registrada do modelo padrão com rodízio (02/09): `modeloJaNaConversa` olhava só o
 * que sairia agora, e bastava o ponteiro andar entre duas passadas para o mesmo contato receber
 * de novo. Aqui o conjunto são as quatro legendas, e elas dizem a mesma coisa de quatro jeitos:
 * ter recebido uma é ter recebido o lote.
 *
 * Pergunta à CONVERSA (`nossas`), nunca ao registro de envios — o registro só enxerga o que saiu
 * pelo painel, e ele manda à mão.
 */
export function jaRecebeu(pares, nossas = []) {
  const nossosTextos = (Array.isArray(nossas) ? nossas : [])
    .map((m) => achatar(typeof m === 'string' ? m : m?.texto))
    .filter(Boolean);
  if (!nossosTextos.length) return null;
  for (const par of Array.isArray(pares) ? pares : []) {
    const pedaco = maiorPedaco(par?.legenda);
    if (!pedaco) continue;
    if (nossosTextos.some((t) => t.includes(pedaco))) return par.n;
  }
  return null;
}

/**
 * **Por que este contato NAO recebe** — as duas memorias juntas, e a ordem importa.
 *
 * `jaRecebeu` pergunta a CONVERSA, e conversa e memoria da SESSAO: quem volta sozinho abre
 * atendimento novo e `nossas` nasce vazio (a armadilha da Rosa, 05/09). Entao quem recebeu a arte
 * na semana passada passaria batido e receberia de novo — exatamente o que o revezamento existe
 * para evitar.
 *
 * **A ETIQUETA e a memoria de verdade.** Ela e gravada no envio e nao depende da sessao: por isso
 * ela e consultada PRIMEIRO e e ela que carrega o lote adiante. A conversa continua valendo como
 * segunda rede, para o caso de a etiqueta nao estar configurada ou de ele ter mandado a mao.
 *
 * `tagDoLote` e `{ id, label }` ou nulo; `tagsDoContato` sao os ids que o contato JA tem no CRM —
 * `state.contact.tagsId`, nunca a lista da caixa da rodada, que e so o que a rodada sugere.
 */
export function porqueNaoMandar({ pares = [], nossas = [], tagsDoContato = [], tagDoLote = null } = {}) {
  const ids = Array.isArray(tagsDoContato) ? tagsDoContato : [];
  if (tagDoLote && tagDoLote.id && ids.includes(tagDoLote.id)) {
    return `ja tem a etiqueta "${tagDoLote.label || tagDoLote.id}" — ja recebeu este lote`;
  }
  const n = jaRecebeu(pares, nossas);
  if (n) return `ja recebeu o par ${n} deste lote`;
  return null;
}

/**
 * Quantos contatos cada par vai pegar, para o `confirm` dizer o que vai acontecer de verdade.
 * Com 4 pares e limite 40 são 10 cada — e é esse número que ele precisa ler antes de começar.
 */
export function comoVaiRevezar(quantosPares, limite) {
  const p = Math.max(0, Number(quantosPares) || 0);
  const n = Math.max(0, Number(limite) || 0);
  if (!p || !n) return [];
  const base = Math.floor(n / p);
  const sobra = n % p;
  return Array.from({ length: p }, (_, i) => base + (i < sobra ? 1 : 0));
}

/**
 * **O TETO POR NÚMERO, POR DIA** (pedido dele, 01/10/2026: *"limite de 45 por número; quando
 * chegar em 45 é para trocar por um número seguinte da lista que eu especificar"*).
 *
 * **Por DIA e não para sempre**, e isto é a única parte que ele não disse com estas palavras: o
 * teto que o WhatsApp cobra é o de conversas iniciadas nas últimas 24 horas (o `RESTRICTED`
 * registrado em 26/09), e contador vitalício queimaria o número no primeiro lote e nunca mais o
 * liberaria — com o `exceptTagsId` fazendo a lista de amanhã ser de gente nova, os números têm de
 * voltar a servir. **O corte é o DIA LOCAL**, que é o que ele lê na tela (a disciplina de 03/09).
 */
export const TETO_POR_NUMERO = 45;

/**
 * **O TETO É DELE, E PODE SER DESLIGADO** — relato dele (02/10/2026): *"a restrição dos contatos
 * deveria ser opcional, bote uma caixa para inserir o número desejado, acabou de me bloquear"*.
 *
 * O 45 nasceu da frase dele de 01/10 (*"limite de 45 por número"*) e virou **constante**, então a
 * rodada se recusava a começar sem ter como ele dizer outra coisa: o número que ele ditou num dia
 * passou a ser uma trava que ele não alcançava. `TETO_POR_NUMERO` continua sendo o PADRÃO —
 * `auto.tetoPorNumero` é o valor dele.
 *
 * **`0` é a escolha explícita de não ter teto**, e é o que "opcional" quer dizer aqui. O risco
 * continua escrito na tela (o `RESTRICTED` de 26/09 é o WhatsApp recusando por conversas iniciadas
 * em 24h), porque risco é decisão dele — a mesma disciplina do `FLAGGED`, que avisa e não barra.
 *
 * **Lixo no campo volta ao PADRÃO, nunca a "sem teto".** Campo com texto estragado desligando a
 * proteção em silêncio é o defeito oposto, e caro: só o `0` desliga.
 */
export const SEM_TETO = Infinity;

export function tetoDoCfg(cfg = {}) {
  const bruto = cfg?.tetoPorNumero;
  if (bruto === '' || bruto === null || bruto === undefined) return TETO_POR_NUMERO;
  const n = Number(bruto);
  if (!Number.isFinite(n)) return TETO_POR_NUMERO;
  if (n <= 0) return SEM_TETO;
  return Math.floor(n);
}

/** O teto do jeito que se escreve na tela: `45`, ou `sem teto`. */
export function textoDoTeto(teto) {
  return Number.isFinite(teto) ? String(teto) : 'sem teto';
}

/** `YYYY-MM-DD` do dia LOCAL — nunca `toISOString`, que é UTC e viraria o dia às 21h daqui. */
export function diaLocal(agora = new Date()) {
  const d = agora instanceof Date ? agora : new Date(agora);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * **A fila de números, na ordem dele** — e o número único antigo é o fallback.
 *
 * Sem este fallback, subir a versão desligaria o lote de quem já o tinha configurado: `loteCanais`
 * nasce vazio e `loteCanalId` é o que está gravado. Mesma razão pela qual a migração não reescreve
 * nada — o campo velho continua sendo a resposta certa enquanto ele não escolher a fila.
 */
export function filaDeNumeros(cfg = {}) {
  const lista = Array.isArray(cfg?.loteCanais) ? cfg.loteCanais : [];
  const limpa = [];
  for (const id of lista) {
    const s = String(id || '').trim();
    if (s && !limpa.includes(s)) limpa.push(s);
  }
  if (limpa.length) return limpa;
  const um = String(cfg?.loteCanalId || '').trim();
  return um ? [um] : [];
}

/** Quantos envios saíram por aquele número no dia informado. Dia diferente conta ZERO. */
export function usadosNoDia(envios, canalId, dia) {
  const r = envios?.[String(canalId || '')];
  if (!r || String(r.dia || '') !== String(dia || '')) return 0;
  return Math.max(0, Number(r.enviados) || 0);
}

/**
 * O saldo de cada número da fila, na ordem — é isto que o cartão mostra e o `confirm` soma.
 * Número que não está mais na conta continua na conta do dia, mas fora da fila: quem decide quais
 * números existem é a plataforma, e quem decide quais usar é ele.
 */
export function saldoDaFila({ fila = [], envios = {}, dia = '', teto = TETO_POR_NUMERO } = {}) {
  const limite = Math.max(0, Number(teto) || 0);
  return fila.map((canalId) => {
    const usados = usadosNoDia(envios, canalId, dia);
    return { canalId, usados, restam: Math.max(0, limite - usados) };
  });
}

/**
 * **Qual número usar AGORA: o primeiro da fila que ainda tem saldo.**
 *
 * É "o primeiro com saldo" e não "o próximo depois do último usado": assim o número que ele move
 * para o topo passa a ser usado na hora, e uma rodada interrompida recomeça onde parou sem guardar
 * ponteiro nenhum — o contador do dia já diz tudo.
 */
export function numeroDaVez({ fila = [], envios = {}, dia = '', teto = TETO_POR_NUMERO } = {}) {
  return saldoDaFila({ fila, envios, dia, teto }).find((n) => n.restam > 0) || null;
}

/** Quantos envios a fila inteira ainda aceita hoje. Zero = a rodada não pode começar. */
export function saldoTotal(args) {
  return saldoDaFila(args).reduce((soma, n) => soma + n.restam, 0);
}

/**
 * Soma UM envio ao número, devolvendo a contagem nova. **Só é chamado depois de a mensagem sair** —
 * a mesma disciplina do ponteiro do revezamento, e a razão é a mesma: contar o que não saiu
 * queimaria saldo do número por uma falha nossa.
 */
/**
 * **O que BARRA o número, e o que só avisa** (01/10/2026, print dele: a rodada se recusou a
 * começar porque `status` e `quality` chegaram `UNDEFINED` num canal **Z-API**).
 *
 * **Ausência de informação NÃO é evidência de que o número caiu** — foi esse o defeito: `!==
 * CONNECTED` dava verdadeiro para `undefined`, e a barreira travou a rodada num número que estava
 * no ar. É a lição de 25/09 outra vez (`donoDoCanal` devolvendo `null` para duas situações
 * opostas): **estados diferentes precisam de respostas diferentes.**
 *
 * **São DOIS campos, de mundos diferentes:**
 * - **`healthStatus`** é a conexão, e existe nos dois mundos — `DISCONNECTED` ("número de telefone
 *   foi desconectado") e `CRITICAL` ("crítica a conexão com o WhatsApp") são o número caído.
 * - **`status`** é da Cloud API e vem VAZIO em canal não oficial. `BANNED` e `DISCONNECTED` são o
 *   número fora; **`RESTRICTED`** é o teto de conversas iniciadas em 24h, e com ele a plataforma
 *   recusa — nos três a mensagem não chega, então os três barram.
 *
 * **`FLAGGED` não barra, e isso é escolha:** ele significa "sinalizado como enviando SPAM", e a
 * mensagem **continua chegando** — é risco, e risco é decisão dele, com o aviso vermelho no cartão.
 * Barrar aqui tiraria dele a escolha de mandar sabendo. `ALERT` e `CHECK` também só avisam: são
 * "em alerta" e "verificando conexão", não "caiu".
 */
export const SAUDE_QUE_BARRA = ['DISCONNECTED', 'CRITICAL'];
export const STATUS_QUE_BARRA = ['DISCONNECTED', 'BANNED', 'RESTRICTED'];
export const SAUDE_QUE_AVISA = ['ALERT', 'CHECK'];
export const STATUS_QUE_AVISA = ['FLAGGED'];

export function porqueNaoUsarONumero(canal) {
  // Número que sumiu da conta É evidência: não há por onde mandar.
  if (!canal) return { barra: true, motivo: 'nao esta mais na lista de numeros da conta', aviso: '' };

  const saude = String(canal.saude || '').trim().toUpperCase();
  const status = String(canal.status || '').trim().toUpperCase();

  if (SAUDE_QUE_BARRA.includes(saude)) return { barra: true, motivo: `a conexao esta ${saude}`, aviso: '' };
  if (STATUS_QUE_BARRA.includes(status)) return { barra: true, motivo: `o canal esta ${status}`, aviso: '' };

  const avisos = [];
  if (SAUDE_QUE_AVISA.includes(saude)) avisos.push(`a conexao esta ${saude}`);
  if (STATUS_QUE_AVISA.includes(status)) avisos.push(`o canal esta ${status} (sinalizado como SPAM)`);
  /**
   * **Nenhum dos dois campos veio: segue, dizendo que segue.** Barrar aqui era o defeito; calar
   * seria pior, porque a barreira existiria sem proteger e ninguém saberia (a família do aviso que
   * não envelhece com o que já foi feito).
   */
  if (!saude && !status) {
    avisos.push('a plataforma nao informou conexao nem status deste numero — nao da para conferir por aqui');
  }
  return { barra: false, motivo: '', aviso: avisos.join('; ') };
}

/**
 * A janela de 24h do canal. **Sem `typeDetails` o padrão é `-1` (SEM janela)**, que é o que o
 * próprio app faz (`typeDetails?.sessionDurationInMinutes ?? -1`) — e é o certo para canal não
 * oficial, onde `typeDetails` não vem. Ler `NaN` fazia a tela prometer a janela que não existe.
 */
export function janelaEmMinutos(canal) {
  const bruto = canal?.detalhes?.sessionDurationInMinutes;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : -1;
}

export function somarEnvio(envios, canalId, dia) {
  const id = String(canalId || '');
  if (!id) return { ...(envios || {}) };
  return { ...(envios || {}), [id]: { dia: String(dia || ''), enviados: usadosNoDia(envios, id, dia) + 1 } };
}

/**
 * **ONDE O ATENDIMENTO RECÉM-CRIADO CAIU** — pedido dele (02/10/2026): *"faça um modo só para abrir
 * o contato e deixar nos meus sem enviar nada"*.
 *
 * `PUT /chat/v1/session` **nunca foi executado** (o corpo foi lido no bundle em 01/10), então
 * *"abrir o atendimento deixa ele em Meus"* é hipótese, não medição — e é a hipótese em que este
 * modo inteiro se apoia: sem ficar em "Meus", o contato cai em "Novos" e ele teria que assumir cada
 * um à mão, o oposto do que pediu. Por isso a sessão é **RELIDA** depois de criada, e o que ela
 * responde decide se a rodada continua.
 *
 * **São QUATRO estados e não dois, e é a lição de 25/09** (`donoDoCanal` devolvendo `null` para
 * "ninguém cadastrou" e para "este número não é de ninguém") somada à de 01/10 (`undefined` não é
 * "o número caiu"): **ausência de informação não é evidência**, e colapsar "não sei" em "está tudo
 * bem" faria a rodada prometer "ficou em Meus" sobre um atendimento que ela não conseguiu ler.
 *
 *  - `meu` — `IN_PROGRESS` e o dono é você: é o que o modo promete;
 *  - `em-andamento` — `IN_PROGRESS` e a plataforma não disse de quem (ou não sabemos o seu usuário):
 *    segue, **dizendo que não deu para conferir**;
 *  - `de-outro` — `IN_PROGRESS` com outro operador: não entra no atendimento de alguém;
 *  - `pendente` — `PENDING`, que é a fila dos "Novos" (está escrito em `processarNovo`: *"contato em
 *    Novos está PENDENTE"*);
 *  - `concluido` — já fechado;
 *  - `desconhecido` — sem `status` nenhum, ou um status que não é nenhum dos três.
 */
/** Os três status de atendimento, repetidos aqui porque esta lib é pura e não importa a `api`. */
export const STATUS_EM_ANDAMENTO = 'IN_PROGRESS';
export const STATUS_PENDENTE = 'PENDING';
export const STATUS_CONCLUIDO = 'COMPLETED';

export const ONDE_MEU = 'meu';
export const ONDE_SEM_DONO = 'em-andamento';
export const ONDE_DE_OUTRO = 'de-outro';
export const ONDE_PENDENTE = 'pendente';
export const ONDE_CONCLUIDO = 'concluido';
export const ONDE_DESCONHECIDO = 'desconhecido';

/**
 * De quem é a sessão. O campo que a contagem de "Meus" usa é `userId` (vem de
 * `/core/v1/agent/me`), mas a rota de ler a sessão nunca foi executada — então os apelidos óbvios
 * são tentados antes de desistir. **Não achar devolve string vazia, nunca um palpite.**
 */
export function donoDaSessao(sessao) {
  const s = sessao || {};
  const candidatos = [s.userId, s.user?.id, s.user?.userId, s.agent?.userId, s.agent?.id, s.agentId];
  for (const c of candidatos) {
    const v = String(c || '').trim();
    if (v) return v;
  }
  return '';
}

export function ondeCaiuOAtendimento(sessao, meuUserId = '') {
  const status = String(sessao?.status || '').trim().toUpperCase();
  const dono = donoDaSessao(sessao);
  const meu = String(meuUserId || '').trim();
  const base = { status, dono };

  if (!sessao || typeof sessao !== 'object') {
    return { ...base, estado: ONDE_DESCONHECIDO, motivo: 'a plataforma nao devolveu o atendimento' };
  }
  if (!status) {
    return { ...base, estado: ONDE_DESCONHECIDO, motivo: 'a plataforma nao devolveu o status do atendimento' };
  }
  if (status === STATUS_CONCLUIDO) return { ...base, estado: ONDE_CONCLUIDO, motivo: 'o atendimento esta concluido' };
  if (status === STATUS_PENDENTE) {
    return { ...base, estado: ONDE_PENDENTE, motivo: 'o atendimento ficou PENDENTE — isso e a fila "Novos", nao "Meus"' };
  }
  if (status !== STATUS_EM_ANDAMENTO) {
    return { ...base, estado: ONDE_DESCONHECIDO, motivo: `a plataforma devolveu o status ${status}, que nao e nenhum dos tres conhecidos` };
  }
  if (!dono) {
    return { ...base, estado: ONDE_SEM_DONO, motivo: 'esta em andamento, e a plataforma nao disse de quem' };
  }
  if (!meu) {
    return { ...base, estado: ONDE_SEM_DONO, motivo: 'esta em andamento, e eu nao sei o seu usuario para comparar' };
  }
  if (dono !== meu) return { ...base, estado: ONDE_DE_OUTRO, motivo: 'esta em andamento com OUTRO operador' };
  return { ...base, estado: ONDE_MEU, motivo: 'esta em "Meus"' };
}

/**
 * **As CHAVES que a sessão trouxe, nunca os valores** — a disciplina de medir na API de verdade
 * (07/09): *"o que se registra é a FORMA (chaves, tamanhos), nunca o conteúdo"*. A sessão carrega
 * telefone e nome de eleitor; o que serve para saber o que a rota devolve são os nomes dos campos,
 * e é só isso que vai para a linha do Andamento.
 */
export function chavesDaSessao(sessao, quantas = 25) {
  if (!sessao || typeof sessao !== 'object') return '';
  const chaves = Object.keys(sessao);
  return chaves.slice(0, quantas).join(', ') + (chaves.length > quantas ? `, … (+${chaves.length - quantas})` : '');
}
