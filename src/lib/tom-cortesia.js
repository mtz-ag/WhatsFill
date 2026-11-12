const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const normalizarLugar = (s) => normalizar(s).replace(/\b(?:nosso estado|rio grande do sul|rs|gauch[oa]s?)\b/g, 'estado');
const TEMA = /\b(?:soluco\w*|clim\w*|estado|enchent\w*|governo|alagament\w*)\b/;

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
  return { ativo: carinho && !demanda && !relato, demanda, texto, bencao: /\b(?:abenco\w*|deus|bencaos?)\b/.test(t) };
}

export const TOM_CORTESIA = 'CORTESIA AFETUOSA: a intenção desta rajada é saudação, bênção ou carinho, mesmo com tema público citado de passagem. Responda na primeira pessoa do candidato: retribua a bênção, agradeça o carinho e encerre com um grande abraço ou um abraço. No máximo 3 frases, sem pergunta. Não comente nem parafraseie temas incidentais (clima, soluções, estado, governo, enchente). Não use o nome do contato, equipe, urgência/prioridade, notas internas ou promessa de levar ao deputado. Saudação somente pelo horário real. Nunca devolva beijo, bjs ou beijão. Perguntas e pedidos reais devem receber resposta ao conteúdo, não este encerramento.';

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
  if ((texto.match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter(v => v.trim()).length > 3) falhas.push('máximo de 3 frases');
  if (!/\b(?:obrigado|agradeco)\b/.test(t) || !/\bcarinho\b/.test(t)) falhas.push('agradeça o carinho em primeira pessoa');
  if (contexto.bencao && !/\b(?:deus.{0,30}abencoe|abencoe.{0,30}deus)\b/.test(t)) falhas.push('retribua a bênção');
  if (!/\babraco\b/.test(t)) falhas.push('encerre com abraço');
  return falhas;
}

export function semBeijos(texto) {
  return String(texto || '').replace(/\b(?:(?:um|uma)\s+)?(?:grande\s+)?(?:beij(?:o|os|ão|ao|ões|oes)|bjs)\b/giu, 'um grande abraço');
}
