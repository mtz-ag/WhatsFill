const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const normalizarLugar = (s) => normalizar(s).replace(/\b(?:nosso estado|rio grande do sul|rs|gauch[oa]s?)\b/g, 'estado');
const TEMA = /\b(?:soluco\w*|clim\w*|estado|enchent\w*|governo|alagament\w*)\b/;

/**
 * **Quantas frases a resposta tem, sem contar a saudação** (17/11/2026, o Jandir: *"Boa tarde
 * Capitão Martins tá tudo bem com você abençoe abraço"* parou a rodada com "a IA não conseguiu
 * rascunhar (máximo de 3 frases)"). "Boa tarde!" contava como frase, e responder o "tudo bem?",
 * retribuir a bênção, agradecer o carinho e mandar o abraço não cabia em três — a reescrita falhava
 * igual e o rascunho saía vazio. Saudação e exclamação curta ("Amém!", "Graças a Deus!", até duas
 * palavras) não são frase de conteúdo.
 */
const SO_SAUDACAO = /^\s*(?:ol[áa]|oi|bo[am]\s+(?:dia|tarde|noite))[\s!.,]*$/i;
export function contarFrases(texto) {
  return (String(texto || '').match(/[^.!?]+(?:[.!?]+|$)/g) || [])
    .map((v) => v.trim())
    .filter((v) => v && !SO_SAUDACAO.test(v) && (v.match(/\p{L}+/gu) || []).length > 2)
    .length;
}

export function contextoCortesia(mensagens = []) {
  let inicio = 0;
  mensagens.forEach((m, i) => { if (m?.de === 'nos') inicio = i + 1; });
  const texto = mensagens.slice(inicio).filter(m => m && m.de !== 'nos' && !m.anuncio && !m.semConteudo).map(m => m.texto || '').join('\n');
  const t = normalizar(texto);
  // Só estas perguntas sociais são retiradas da análise; qualquer outra pergunta vence.
  const conteudo = t.replace(/\b(?:vamos madrugar com os galos)\s*\?/g, '');
  const demanda = /\?|\b(?:quero|queria|gostaria|qual|quais|por favor|me (?:diga|informe|explique)|pode[m]?|poderia[m]?|preciso|precisamos|peco|solicito|ajud[ae]|envie|mande|explique|informe|resolva|providencie)\b|(?:^|[\n.!])\s*(?:como|onde|quando|por que|quem|quanto)\b/.test(conteudo);
  const carinho = /\b(?:abenco\w*|deus|bencaos?|carinho|te desejo|ti deseja|tudo de bom|bom dia|boa tarde|boa noite|obrigad[oa]|agradeco|gratidao)\b/.test(t);
  // Relato concreto não vira cortesia só por começar com bom dia.
  const relato = /\b(?:morreu|morreram|morte|acidente|tragedia|caiu|invadiu|alagou|desabou|sem luz|sem agua)\b/.test(t);
  // "Deus" solto não é bênção (a Beatriz Maria, 23/11/2026: "com nosso Deus à frente" fez a IA reprovar
  // duas vezes por não "retribuir a bênção"). Bênção é abençoar, ou Deus desejado a alguém.
  const bencao = /\b(?:abenco\w*|bencaos?)\b/.test(t) || /\bdeus\s+(?:te|lhe|vos|o|a|os|as|nos)?\s*(?:abencoe|proteja|guarde|ilumine|ajude)\b/.test(t);
  return { ativo: carinho && !demanda && !relato, demanda, texto, bencao };
}

export const TOM_CORTESIA = 'CORTESIA AFETUOSA: a intenção desta rajada é saudação, bênção ou carinho, mesmo com tema público citado de passagem. Responda na primeira pessoa do candidato: retribua a bênção e agradeça o carinho; o abraço no fim é opcional, e não se repete se a nossa última já fechou com ele. No máximo 3 frases, sem pergunta. Não comente nem parafraseie temas incidentais (clima, soluções, estado, governo, enchente). Não use o nome do contato, equipe, urgência/prioridade, notas internas ou promessa de levar ao deputado. Saudação somente pelo horário real. Nunca devolva beijo, bjs ou beijão. Perguntas e pedidos reais devem receber resposta ao conteúdo, não este encerramento.';

export function falhasTomCortesia(texto, contexto) {
  if (!contexto?.ativo) return [];
  const t = normalizarLugar(texto);
  const origem = normalizarLugar(contexto.texto);
  const falhas = [];
  const palavras = origem.match(/\b\w+\b/g) || [];
  const expressoes = palavras.slice(1).map((p, i) => palavras[i] + ' ' + p);
  if (expressoes.some(e => TEMA.test(e) && t.includes(e))) falhas.push('paráfrase de expressão do contato');
  if (TEMA.test(t)) falhas.push('retomou tema incidental da cortesia');
  if (/\?/.test(t)) falhas.push('não faça pergunta na cortesia');
  if (contarFrases(texto) > 3) falhas.push('máximo de 3 frases');
  // "carinho" era obrigatório e virou o mesmo "obrigado pelo carinho" em toda resposta (a Simone,
  // 23/11/2026: ele aprovou "Muito obrigado pelas palavras..."). Agradecer basta; o objeto varia.
  if (!/\b(?:obrigado|obrigada|agradeco|grato|grata)\b/.test(t)) falhas.push('agradeça em primeira pessoa');
  // Retribuir ("você também") só o que ela desejou: a Simone agradeceu, não abençoou.
  if (!contexto.bencao && /\b(?:abencoe|abencoad[ao])\b.{0,40}\btambem\b/.test(t)) falhas.push('não retribua bênção que ela não deu');
  // "Abençoada segunda-feira para você também" também retribui (o Kayan, 23/11/2026: a IA reprovou
  // duas vezes, e esse foi o texto que ele aprovou).
  if (contexto.bencao && !/\b(?:deus.{0,30}abencoe|abencoe.{0,30}deus|abencoad[ao]s?\b.{0,40}\b(?:para|pra)\s+(?:voce|vc|ti|o\s+senhor|a\s+senhora))\b/.test(t)) falhas.push('retribua a bênção');
  return falhas;
}

export function semBeijos(texto) {
  return String(texto || '').replace(/\b(?:(?:um|uma)\s+)?(?:grande\s+)?(?:beij(?:o|os|ão|ao|ões|oes)|bjs)\b/giu, 'um grande abraço');
}
