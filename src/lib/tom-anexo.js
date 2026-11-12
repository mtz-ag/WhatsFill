/**
 * tom-anexo.js — arquivo anexado JUNTO com texto próprio (12/11/2026, o Tenente Fraga).
 *
 * Ele mandou *"Boa noite"*, *"Sucesso estamos juntos"*, a **Apresentação FT.ppt**, se apresentou
 * (*"Sou o Tenente Fraga do Litoral Norte"*, *"Fui o primeiro coordenador regional de defesa civil"*)
 * e fechou com *"Abração"*. A caixa mandou responder à mão: *"mandou um arquivo — só dá para
 * responder depois de abrir"*. O texto dele bastava para responder; o arquivo só precisa ser
 * AGRADECIDO, e quem não abriu o arquivo não pode dizer que leu.
 *
 * **O arquivo continua pedindo você em dois casos:** quando é o ÚNICO conteúdo, e quando o texto
 * pede alguma coisa sobre ele (*"veja o documento"*, *"o que acha desse projeto?"*). Por isso a
 * guarda olha o PEDIDO, e não o tamanho.
 *
 * Puro e sem dependência, como os outros `tom-*.js`.
 */

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O que é arquivo anexado. Figura e vídeo não: esses são repasse e têm caminho próprio. */
const TIPOS_DE_ANEXO = new Set(['DOCUMENT']);

/** O que continua pedindo você mesmo havendo texto: não dá para responder sem abrir. */
const OUTROS_QUE_PEDEM_VOCE = new Set(['AUDIO', 'CONTACT', 'LOCATION']);

const LINK = /https?:\/\/\S+|\bwww\.\S+/gi;

/**
 * O texto pede algo SOBRE o arquivo, ou pede qualquer coisa. Pergunta também conta: quem pergunta
 * espera resposta ao conteúdo, e o conteúdo do arquivo ninguém leu.
 */
const PEDE_ALGO = /\?|\b(?:veja|vejam|olha|olhe|olhem|leia|leiam|(?:da|de|deem) uma olhada|analis\w*|avali\w*|confira|confiram|revis\w*|que acha\w*|o que (?:voce|vc|vcs|voces|o senhor) acha\w*|opiniao|parecer|quero|queria|gostaria|preciso|precisamos|pode|podem|poderia|poderiam|peco|solicito|ajud[ae]\w*|mande|envie|me (?:diga|diz|fala|responde|explica))\b/;

/** Sobras que não são texto dela: o nome do arquivo e a linha que marca mídia sem conteúdo. */
function textoProprio(m) {
  const tipo = String(m?.tipo || 'TEXT').toUpperCase();
  if (TIPOS_DE_ANEXO.has(tipo) || m?.semConteudo || m?.sistema) return '';
  return String(m?.texto || '').replace(LINK, ' ').trim();
}

/**
 * Há arquivo anexado E texto próprio que basta para responder, sem pedido nenhum?
 *
 * Recebe a conversa do jeito que a IA a recebe (`{de, tipo, texto, semConteudo}`) ou as mensagens
 * dela do painel (`{tipo, texto}`, sem `de`): considera só o que veio depois da NOSSA última fala.
 */
export function contextoAnexo(mensagens = []) {
  let inicio = 0;
  (mensagens || []).forEach((m, i) => { if (m?.de === 'nos') inicio = i + 1; });
  const pendentes = (mensagens || []).slice(inicio)
    .filter((m) => m && m.de !== 'nos' && !m.anuncio && !m.geradaPeloAnuncio && !m.sistema);
  const temAnexo = pendentes.some((m) => TIPOS_DE_ANEXO.has(String(m?.tipo || '').toUpperCase()));
  const bloqueia = pendentes.some((m) =>
    OUTROS_QUE_PEDEM_VOCE.has(String(m?.tipo || '').toUpperCase()) && !(m?.transcrito && String(m.texto || '').trim()));
  const texto = pendentes.map(textoProprio).filter(Boolean).join('\n');
  // "Suficiente para responder": letras de verdade, além de um "ok". Quinze letras é uma frase curta.
  const suficiente = (normalizar(texto).match(/[a-z]/g) || []).length >= 15;
  const pede = PEDE_ALGO.test(normalizar(texto));
  return { ativo: temAnexo && !bloqueia && suficiente && !pede, temAnexo, pede, texto };
}

export const TOM_ANEXO =
  'ANEXO: ela mandou um ARQUIVO junto com texto próprio, e o conteúdo do arquivo NÃO chegou até você. ' +
  'Não diga que leu, viu, abriu ou analisou o arquivo, e não comente o que há nele. Responda ao que ela ' +
  'ESCREVEU (apresentação, apoio, despedida), na primeira pessoa do candidato, e agradeça por ela enviar ' +
  'o material ("muito obrigado pelo apoio e por enviar o material"). Sem pergunta, sem o nome dela, sem ' +
  '"equipe", sem promessa de levar ao deputado. Feche com "um grande abraço". No máximo 4 frases.';

/** O rascunho cumpriu o ANEXO? Devolve o que falhou, para a reescrita que já existe. */
export function falhasTomAnexo(texto, contexto) {
  if (!contexto?.ativo) return [];
  const t = normalizar(texto);
  const falhas = [];
  const OBJETO = '(?:arquivo|documento|apresentac\\w*|material|anexo|pdf|projeto|slides?)';
  const leu = new RegExp(`\\b(?:li|lido|lida|vi|visto|vista|abri|olhei|analisei|examinei|conferi|estudei)\\b.{0,40}\\b${OBJETO}\\b`);
  const comentou = new RegExp(`\\b${OBJETO}\\b.{0,30}\\b(?:muito bo[ma]|excelente|otim[oa]|interessante|bem feit[oa]|completo|caprichad[oa])\\b`);
  if (leu.test(t) || comentou.test(t)) falhas.push('não diga que leu nem comente o arquivo: o conteúdo dele não chegou');
  if (/\?/.test(t)) falhas.push('não faça pergunta');
  if (!/\b(?:obrigad[oa]|agradec\w*)\b/.test(t) || !/\b(?:material|arquivo|apresentac\w*|documento|enviar|envio|mandar)\b/.test(t)) {
    falhas.push('agradeça por enviar o material');
  }
  if (!/\babraco\b/.test(t)) falhas.push('encerre com um grande abraço');
  if ((String(texto).match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter((v) => v.trim()).length > 4) falhas.push('máximo de 4 frases');
  return falhas;
}
