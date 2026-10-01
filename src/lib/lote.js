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
