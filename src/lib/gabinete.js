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
  const texto = (Array.isArray(mensagens) ? mensagens : [mensagens])
    .filter(Boolean)
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
  // Eleição e cargo
  /\beleic|\bcandidat|\bdeputad|\bgovernador|\bsenador|\bprefeit|\bvereador|\bchapa\b|\bmandato\b/,
  // Partido e sigla
  /\bpartido\b|\bsigla\b|\brepublicanos\b|\bpl\b|\bpp\b|\bnovo\b|\bpodemos\b|\bcoligac/,
  // Os nomes da chapa e do mandato
  /\bmartim\b|\bzucco\b|\bcovatti\b|\bcapitao\b/,
  // Pergunta sobre quem é quem
  /\bquem (e|sao|eh)\b|\bconhec(e|o)\b|\bapoi(a|o|ar)\b.*\bquem\b/,
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
export async function paraOPrompt(mensagens) {
  const cfg = await store.get('ia');
  const doTexto = String(cfg?.gabinete || '').trim();

  const pede = mensagens === undefined || precisaDoDossie(mensagens);
  const doArquivo = cfg?.dossieAtivo && pede ? await lerArquivo() : '';

  return [doArquivo, doTexto].filter(Boolean).join('\n\n');
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
