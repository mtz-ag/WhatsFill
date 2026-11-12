/** Tom de comentários públicos: só a rajada ainda não respondida, nunca anúncios. */
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const termos = (s) => new Set((normalizar(s).match(/\b(?:fios?|enchentes?|postes?|ruas?|alagamentos?|acidentes?|buracos?|esgotos?|motoqueiros?|degolad[oa]s?)\b/g) || []).map((t) => t.replace(/s$/, '')));

export function contextoPublico(mensagens = []) {
  let inicio = 0;
  mensagens.forEach((m, i) => { if (m?.de === 'nos') inicio = i + 1; });
  const texto = mensagens.slice(inicio).filter((m) => m && m.de !== 'nos' && !m.anuncio && !m.semConteudo).map((m) => m.texto || '').join('\n');
  const t = normalizar(texto);
  // Perguntas explícitas e indiretas continuam recebendo resposta ao conteúdo.
  const pergunta = /\?|(?:^|[\n.!])\s*(como|onde|qual|quais|quando|por que|quem|quanto)\b|\b(quero saber|gostaria de saber|me diga|me informe|pode explicar|poderia explicar)\b/.test(t);
  const publico = /\b(infraestrutura|rede eletrica|iluminacao publica|enchentes?|postes?|alagamentos?|acidentes?|esgotos?|buracos?|tragedia)\b/.test(t);
  return { ativo: publico && !pergunta, texto };
}

export const TOM_PUBLICO = 'COMENTÁRIO SOBRE PROBLEMA PÚBLICO OU TRAGÉDIA: acolha em primeira pessoa, na voz do candidato, em uma frase curta (ex.: "Lamento muito, uma vida perdida assim não pode ser tratada com descaso."). Mostre preocupação ou posicionamento sem explicar o problema de volta e sem inventar ações já realizadas. Agradeça e encerre, sem perguntas, em no máximo 3 frases. Nunca repita nem parafraseie os detalhes do contato (fio, enchente, poste, rua etc.). Proibido abrir com "É muito triste/perigoso quando..." seguido do fato. Preserve todas as demais regras, inclusive saudação pelo horário real, sem urgência/prioridade, promessa de chegar ao deputado, equipe, nome do contato ou notas internas. Se houver pergunta real, responda ao conteúdo dela; não substitua a resposta por este encerramento.';

export function falhasTomPublico(texto, contexto) {
  if (!contexto?.ativo) return [];
  const t = normalizar(texto);
  const origem = termos(contexto.texto);
  const repetidos = [...termos(texto)].filter((v) => origem.has(v));
  const falhas = [];
  if (repetidos.length >= 2 || repetidos.some((v) => ['fio', 'enchente', 'rua'].includes(v))) falhas.push('paráfrase dos detalhes do contato: ' + repetidos.join(', '));
  if (/\be muito (triste|perigoso) quando\b/.test(t)) falhas.push('abertura que reconta o fato');
  if (!/\b(lamento|sinto muito|me entristece|fico triste|me solidarizo)\b/.test(t)) falhas.push('falta acolhimento em primeira pessoa');
  if (!/\b(me preocupa|preocupo|defendo|cobro|cobrando|descaso|seguranca|inaceitavel|compromisso)\b/.test(t)) falhas.push('falta posicionamento ou preocupação');
  if (!/\b(obrigado|agradeco)\b/.test(t)) falhas.push('falta agradecimento');
  if (/\?/.test(t)) falhas.push('não faça perguntas');
  if ((texto.match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter((v) => v.trim()).length > 3) falhas.push('máximo de 3 frases');
  return falhas;
}
