const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Autoria para o rascunho; citar um comentarista não basta para atribuir a mensagem a ele. */
export function repasseParaIA(m) {
  if (!m || m.de === 'nos' || m.anuncio || m.geradaPeloAnuncio) return false;
  if (m.encaminhado || m.repassado || String(m.tipo || '').toUpperCase() === 'VIDEO') return true;
  const t = normalizar(m.texto).trim();
  if (/^(?:https?:\/\/\S+|www\.\S+)(?:\s+(?:https?:\/\/\S+|www\.\S+))*$/.test(t)) return true;
  if (/\b(?:repasse|encaminhe|compartilhe)\s+(?:para|com|nos|em)\s+(?:os?\s+|seus?\s+|todos\s+os\s+)?grupos\b/.test(t)) return true;
  if (/^\((?:audio encaminhado|video que ela mandou)/.test(t)) return true;
  // Assinatura de boletim, não simples menção ao nome numa opinião própria.
  return /\bde brasilia,?\s+alexandre garcia\b/.test(t) ||
    (/\bno nosso encontro de hoje\b/.test(t) && /\balexandre garcia[.!\s]*$/.test(t)) ||
    /\b(?:aqui e|eu sou|quem fala e)\s+(?:o\s+)?(?:jornalista|comentarista)\b/.test(t);
}

export function contextoDeAutoria(mensagens = []) {
  const lista = mensagens.map(m => typeof m === 'string' ? { de: 'contato', texto: m } : m).filter(Boolean);
  let ultimaNossa = -1;
  lista.forEach((m, i) => { if (m.de === 'nos') ultimaNossa = i; });
  const pendentes = lista.slice(ultimaNossa + 1).filter(m => m.de !== 'nos' && !m.anuncio && !m.geradaPeloAnuncio);
  const repasses = pendentes.filter(repasseParaIA);
  const proprias = pendentes.filter(m => !repasseParaIA(m) && !m.semConteudo && String(m.texto || '').trim());
  const texto = proprias.map(m => m.texto).join('\n');
  const t = normalizar(texto);
  const politico = /\b(?:voto aberto|transparencia|senado|camara|direita|esquerda|deputad\w*|politic\w*|governo)\b/.test(t);
  const pergunta = /\?|\b(?:quero saber|gostaria|queria saber|me explique|me diga|qual|quais)\b/.test(t);
  return { proprias, repasses, texto, politico: politico && !pergunta,
    soRepasse: repasses.length > 0 && proprias.length === 0 && pendentes.every(repasseParaIA) };
}

export function instrucaoDeAutoria(contexto) {
  const base = 'AUTORIA: FALA DELA é texto próprio; REPASSADO é material de terceiro, nunca opinião atribuível ao contato. Priorize a fala própria mais recente ainda sem resposta e o ponto central da sequência dela, mesmo que links ou áudios repassados tenham chegado depois. Não resuma o repasse nem responda ao comentarista. Nunca copie ou parafraseie a sequência de argumentos dela. Preserve primeira pessoa, saudação pelo horário real, sem nome, equipe, urgência/prioridade ou promessa de levar ao deputado.';
  if (contexto.soRepasse) return base + ' Só há REPASSADO pendente: agradeça brevemente por mandar e encerre com um abraço, sem resumir assuntos, atribuir preocupações ou fazer pergunta; no máximo 3 frases.';
  if (contexto.politico) return base + ' COMPARTILHAMENTO POLÍTICO PRÓPRIO: uma frase de posição em primeira pessoa sobre o ponto central (concordo, defendo, sigo firme), sem inventar ações nem endossar acusações contra terceiros. Agradeça calorosamente o apoio quando declarado e feche com abraço, sem pergunta, no máximo 3 frases. Não liste temas, não escreva "Questões como...", "precisam continuar sendo", "devem ser acompanhadas" nem "Obrigado por compartilhar suas preocupações".' +
    (/\b(?:voto aberto|transparencia)\b/.test(normalizar(contexto.texto)) ? ' O ponto próprio é a transparência do voto: posicione-se sobre ela, sem repetir acusações contra terceiros.' : '');
  return base;
}

export function falhasDeAutoria(texto, contexto) {
  const t = normalizar(texto);
  const falhas = [];
  if (contexto.politico || contexto.soRepasse) {
    if (/\b(?:questoes como|precisam continuar sendo|devem ser acompanhad\w*|precisam ser acompanhad\w*|obrigado por compartilhar suas preocupacoes)\b/.test(t)) falhas.push('voz impessoal ou agradecimento genérico');
    if (/\?/.test(t)) falhas.push('não faça pergunta');
    if ((texto.match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter(v => v.trim()).length > 3) falhas.push('máximo de 3 frases');
    if (!/\b(?:obrigado|agradeco)\b/.test(t) || !/\babraco\b/.test(t)) falhas.push('agradeça e encerre com abraço');
  }
  if (contexto.politico) {
    if (!/\b(?:concordo|defendo|sigo|acredito|considero|sou a favor|me posiciono)\b/.test(t)) falhas.push('falta posição em primeira pessoa');
    if (/\b(?:voto aberto|transparencia)\b/.test(normalizar(contexto.texto)) && !/\b(?:transparencia|voto aberto|como cada um vota|votacoes publicas)\b/.test(t)) falhas.push('responda ao ponto central: transparência do voto');
  }
  // Comparação lexical de temas exclusivos do repasse: não bloqueia assunto que ela também trouxe.
  const termos = s => new Set((normalizar(s).match(/[a-z]{4,}/g) || []).filter(p => !['para','como','hoje','nosso','nossa','voce','voces','sobre','isso','mais','muito','obrigado','grande','abraco','compartilhar','mandar','tambem','sempre'].includes(p)));
  const dela = termos(contexto.texto);
  const terceiros = termos(contexto.repasses.map(m => m.texto).join(' '));
  const repetidos = [...termos(texto)].filter(p => terceiros.has(p) && !dela.has(p));
  const temasDeTerceiro = normalizar(contexto.repasses.map(m => m.texto).join(' ')).match(/\b(?:aposentad\w*|paraguai|cop\d*)\b/g) || [];
  if (contexto.repasses.length && (repetidos.length >= 2 || temasDeTerceiro.some(p => t.includes(p) && !normalizar(contexto.texto).includes(p)))) falhas.push('resumiu assunto exclusivo de terceiro');
  if (contexto.soRepasse && /\b(?:preocupac\w*|concordo|defendo|aposentad\w*|paraguai|cop\d*)\b/.test(t)) falhas.push('só agradeça o envio, sem atribuir opinião');
  return falhas;
}

/** O prazo não apaga uma fala própria que ficou sem resposta antes dos repasses recentes. */
export function preservarFalasPendentes(mensagens, recentes) {
  const ordenadas = [...mensagens].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  const contexto = contextoDeAutoria(ordenadas);
  if (!contexto.proprias.length || !recentes.some(repasseParaIA)) return recentes;
  const manter = new Set([...recentes, ...contexto.proprias]);
  const ultimaNossa = ordenadas.findLast(m => m.de === 'nos');
  if (ultimaNossa) manter.add(ultimaNossa);
  return ordenadas.filter(m => manter.has(m));
}
