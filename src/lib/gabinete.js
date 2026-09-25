/**
 * gabinete.js — o dossiê "quem é quem" que a IA usa como fonte.
 *
 * ## Por que virou arquivo
 *
 * O dossiê já existia como `store.ia.gabinete`, uma textarea na Config. Pedido dele (01/09/2026):
 * *"seria muita informação pra botar no espaço da extensão, teria que ser um arquivo tipo
 * claude.md que a ia leia e pegue de lá"*. Texto longo em textarea é ruim de escrever, ruim de
 * revisar e não tem histórico — em arquivo tem `git diff`, que para dado que chega a eleitor é o
 * que importa.
 *
 * A textarea **não morreu**: ela virou o espaço do que só o gabinete sabe. O que sai daqui é
 * `arquivo + textarea`, nessa ordem.
 *
 * ## A trava de revisão
 *
 * `ia.dossieAtivo` nasce **false**, e enquanto for false o arquivo não entra no prompt. Não é
 * excesso de zelo: o conteúdo veio de pesquisa na internet, e número de urna errado manda eleitor
 * votar em outra pessoa. Quem liga é ele, depois de conferir — foi o combinado
 * (*"vou revisar para não mandar algo errado pra ia da extensão"*).
 *
 * A textarea continua valendo mesmo com o dossiê desligado: o que ELE escreveu já foi revisado por
 * definição.
 *
 * ## Custo
 *
 * Vai no prompt de SISTEMA, que é o cacheado. Cuidado com o efeito de borda: o Haiku 4.5 só cacheia
 * prefixo de 4.096 tokens (ver `CACHE_MINIMO_TOKENS`), e o sistema hoje tem ~1.300 — o dossiê pode
 * **empurrar o prompt para dentro da faixa de cache** e sair mais barato por chamada do que a
 * conta ingênua sugere. A aba Config mostra os dois números; confira lá em vez de estimar.
 */

import * as store from './store.js';

const CAMINHO = 'src/data/gabinete.md';

/** Uma leitura por sessão: é arquivo empacotado, não muda enquanto a extensão roda. */
let cache = null;

/**
 * O texto do arquivo, sem o cabeçalho de instruções para humano.
 *
 * Falha de leitura devolve string vazia em vez de estourar: sem dossiê a IA escala mais, o que é o
 * comportamento seguro. Derrubar a avaliação inteira porque um `.md` não carregou seria trocar um
 * problema pequeno por um grande.
 */
export async function lerArquivo() {
  if (cache !== null) return cache;
  try {
    const url = chrome.runtime.getURL(CAMINHO);
    const texto = await fetch(url).then((r) => (r.ok ? r.text() : ''));
    cache = semBlocoDeRevisao(texto);
  } catch {
    cache = '';
  }
  return cache;
}

/**
 * Tira do texto o que é recado para humano, não contexto para a IA.
 *
 * O arquivo tem seções que só servem para quem edita (o aviso de status, as fontes, o espaço em
 * branco para ele preencher). Mandar isso no prompt gasta token e, pior, ensina a IA que existem
 * campos vazios a completar — que é exatamente o que ela não pode fazer.
 */
function semBlocoDeRevisao(md) {
  return String(md || '')
    .split('\n')
    .filter((l) => !l.startsWith('> '))
    .join('\n')
    .split('## Espaço do Thiago')[0]
    .split('## Fontes')[0]
    .trim();
}

/**
 * A conversa toca em gente, chapa, voto ou partido?
 *
 * Pedido dele (01/09/2026): *"o dossiê deve ser consultado somente quando for necessário"*. E ele
 * está certo pelo número: o dossiê custa ~1.284 tokens **em toda chamada**, e a esmagadora maioria
 * das conversas é "Amém", "obrigado", nome e cidade — nenhuma delas precisa saber quem é vice de
 * quem.
 *
 * É a mesma ordem que já vale para a IA inteira: **a regex decide antes, de graça**. Aqui ela
 * decide se vale pagar pelo contexto, e não o que responder.
 *
 * **Erra para o lado de INCLUIR.** Sem o dossiê a IA decide sobre nome que não conhece, que é o
 * problema que ele existe para resolver; incluir à toa custa meio centavo. Por isso os gatilhos
 * são largos: qualquer menção a voto, urna, número, partido, candidato, cargo ou aos nomes da
 * chapa liga o contexto.
 *
 * Pura e testável de propósito — é ela que decide onde o dinheiro é gasto.
 *
 * @param {string[]} mensagens o que o contato escreveu
 * @returns {boolean}
 */
export function precisaDoDossie(mensagens) {
  /**
   * Aceita string solta e `{texto, at}`.
   *
   * As mensagens ganharam o horário em 04/09/2026 (para a IA saber que dia é hoje), e sem esta
   * linha o `join` produziria `[object Object]`: o dossiê deixaria de ser pedido, em silêncio. É a
   * armadilha registrada no CLAUDE.md — função pura e testada não garante nada se quem chama
   * mudar a forma do que passa.
   */
  const texto = (Array.isArray(mensagens) ? mensagens : [mensagens])
    .filter(Boolean)
    .map((m) => (typeof m === 'string' ? m : String(m?.texto || '')))
    .join('\n')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!texto.trim()) return false;
  return GATILHOS.some((re) => re.test(texto));
}

/**
 * O que faz valer a pena pagar pelo dossiê.
 *
 * Sem `\b` antes de palavra acentuada — `\b` é fronteira de `w` e acento não é `w` (armadilha do
 * `CLAUDE.md`). Como o texto já vem sem acento, aqui é seguro; a regra fica registrada para quem
 * acrescentar termo acentuado depois.
 */
const GATILHOS = [
  // Voto, urna e número
  /\bvot(o|ar|ei|arei|acao)\b|\burna\b|\bnumero\b|\bteclar\b|\bdigit(o|ar)\b/,
  /**
   * **`colinha` é obrigatório desde 09/09/2026**, quando ele decidiu que quem a pede recebe a LISTA
   * digitada. Medido: *"me manda uma colinha dos candidatos"* já puxava o dossiê (por "candidat"),
   * mas *"quero a colinha"* e *"manda a colinha"* **não puxavam** — e sem a tabela no prompt a IA
   * escreveria os seis números de cabeça, que é exatamente o erro do Van Hattem (08/09).
   *
   * **Regra que manda a IA copiar um dado exige que o dado esteja no prompt.**
   */
  /\bcolinha\b/,
  // Eleição e cargo
  /\beleic|\bcandidat|\bdeputad|\bgovernador|\bsenador|\bprefeit|\bvereador|\bchapa\b|\bmandato\b/,
  // Partido e sigla
  /\bpartido\b|\bsigla\b|\brepublicanos\b|\bpl\b|\bpp\b|\bnovo\b|\bpodemos\b|\bcoligac/,
  // Os nomes da chapa e do mandato
  /\bmartim\b|\bzucco\b|\bcovatti\b|\bcapitao\b/,
  // Pergunta sobre quem é quem
  /\bquem (e|sao|eh)\b|\bconhec(e|o)\b|\bapoi(a|o|ar)\b.*\bquem\b/,
  /**
   * **Fé** — print de 08/09/2026: a contato perguntou *"É CRISTÃO OU COMUNISTA?"* e, na mensagem
   * seguinte, falou de partido. Foi o *"partido"* que puxou o dossiê; a pergunta da fé sozinha não
   * puxaria nada, e é a mais direta que existe nesta base.
   *
   * **`deus` e `fe` ficaram de FORA de propósito.** *"Deus abençoe"* e *"tenha fé"* são o fecho de
   * uma boa parte das mensagens daqui — com elas na lista o dossiê entraria em quase toda chamada,
   * e ele existe justamente para entrar só quando a conversa pede (pedido dele, 01/09).
   */
  /\bcristao\b|\bcatolic|\bevangelic|\breligi|\bigreja\b|\bpastor\b|\bpadre\b/,
  /**
   * **O que ele FOI** — print do Fernando Britto (10/09/2026): *"…bombeiros, foi cmt dos salva-vidas
   * no Imbé?"*, e o rascunho respondeu *"vou verificar se ele foi bombeiro e volto a responder"*. Ele:
   * *"essa informação não está no dossiê?"* — **está**: a carreira dele (Marinha, 2005–2020) é
   * `[CONFIRMADO]` desde 01/09. Medido: a pergunta sem o nome dele (*"ele era dos bombeiros?"*) **não
   * puxava o dossiê**, e a IA escreveu sem saber nada.
   *
   * **`militar` não pode vir depois de hífen:** o anúncio *"Escolas Cívico-Militares"* chega em
   * quase toda conversa, e puxaria o dossiê para todas. `policia` e `brigada` ficaram de fora pelo
   * mesmo motivo — segurança é a pauta dele, e aparecem em metade das falas.
   */
  /\bbombeir|\bmarinha\b|\bexercito\b|\bfuzileir|\bsalva.?vidas\b|\bcmt\b|\bcomandante\b|\bprofiss|\bcarreira\b|\btrajetoria\b|\bformad[oa] em\b|antes de ser (deputad|politic)|o que ele (fazia|fez|era|foi)\b|(^|[^-a-z])militar\b/,
  /**
   * **O que o mandato FEZ** — o dossiê ganhou emendas por cidade, leis e projetos (material do mandato,
   * 10/09/2026). Sem gatilho, *"tem alguma emenda pra minha cidade?"* não puxaria nada, e a IA
   * escreveria sem os dados. "lei" solto entra de propósito (erra para incluir): *"lei eleitoral"* puxa
   * o dossiê à toa, e isso custa centavos.
   */
  /\bemendas?\b|\bprojetos?\b|\bleis?\b|\bo que (o deputado|o mandato|voces|vcs) (fez|fizeram|faz|fazem)\b|\bfez (pel[ao]|por) /,
];

/**
 * O bloco "quem é quem" que vai para o prompt.
 *
 * O dossiê de arquivo entra **só quando a conversa pede** (ver `precisaDoDossie`). O texto que ELE
 * escreveu na Config vai sempre: é curto, é dele, e é onde ficam as instruções que valem para todo
 * atendimento.
 *
 * @param {string[]} [mensagens] o que o contato escreveu; omitir força a inclusão do dossiê
 * @returns {Promise<string>} vazio quando não há nada revisado a mandar
 */
export async function paraOPrompt(mensagens, { perfil = null } = {}) {
  const cfg = await store.get('ia');
  const doTexto = String(cfg?.gabinete || '').trim();

  const pede = mensagens === undefined || precisaDoDossie(mensagens);

  /**
   * **O dossiê de OUTRO candidato vem do perfil, nunca do arquivo empacotado** (24/09/2026).
   *
   * `src/data/gabinete.md` é o do Capitão Martim — carreira, fé, projetos, a chapa. Mandá-lo numa
   * conversa do Felipe Pedri seria a IA respondendo com a biografia de outra pessoa, que é pior
   * que não ter dossiê nenhum. **Perfil com o dossiê em branco vai SEM dossiê**: a IA escala, que
   * é o comportamento seguro e o mesmo de quando a leitura do arquivo falha.
   *
   * O texto livre da Config (`ia.gabinete`) continua compartilhado de propósito — ele é o recado
   * curto do momento ("estamos em Caxias nesta semana"), não a biografia de ninguém.
   */
  const outroCandidato = !!perfil?.id && perfil.id !== 'martim';
  const doArquivo = cfg?.dossieAtivo && pede && !outroCandidato ? await lerArquivo() : '';
  const doPerfil = pede && outroCandidato ? String(perfil?.dossie || '').trim() : '';

  return [doArquivo, doPerfil, doTexto].filter(Boolean).join('\n\n');
}

/** Para a aba Config mostrar o que está valendo, sem adivinhação. */
export async function estado() {
  const cfg = await store.get('ia');
  const arquivo = await lerArquivo();
  return {
    ativo: !!cfg?.dossieAtivo,
    temArquivo: !!arquivo,
    caracteresArquivo: arquivo.length,
    caracteresTextarea: String(cfg?.gabinete || '').trim().length,
  };
}

// ---------------------------------------------------------------------------
// A chapa, como DADO
// ---------------------------------------------------------------------------

/**
 * A tabela da "colinha" lida do próprio dossiê — cargo, nome e número, um por linha.
 *
 * **Por que sai daqui e não de uma constante:** o arquivo é a fonte, tem `git diff` e é ele que vai
 * no prompt. Uma segunda cópia em código divergiria na primeira vez que ele trocasse um nome, e a
 * cópia que ninguém olha é a que decide errado — é a armadilha registrada quatro vezes no
 * `CLAUDE.md` (duas listas separadas divergem).
 *
 * Falha em achar a tabela devolve lista vazia, e quem usa trata vazio como "não confere nada": sem
 * chapa não há como saber que um cargo está trocado, e inventar a resposta seria pior.
 */
export function chapaDoDossie(texto) {
  const linhas = String(texto || '').split('\n');
  const cabecalho = linhas.findIndex((l) => /^\|\s*cargo\s*\|\s*nome\s*\|\s*n[úu]mero\s*\|/i.test(l.trim()));
  if (cabecalho < 0) return [];

  const fora = [];
  for (let i = cabecalho + 2; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha.startsWith('|')) break; // a tabela acabou
    const celulas = linha.split('|').slice(1, -1).map((c) => c.replace(/\*/g, '').trim());
    if (celulas.length < 3) continue;
    const [cargo, nome, numero] = celulas;
    if (!cargo || !nome) continue;
    fora.push({ cargo, nome, numero: (String(numero).match(/\d+/) || [''])[0] });
  }
  return fora;
}

/** A chapa do arquivo empacotado. Não depende de `dossieAtivo` — ver `ia.conferirChapa`. */
export async function chapa() {
  return chapaDoDossie(await lerArquivo());
}
