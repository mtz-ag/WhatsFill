/**
 * vars.js — interpolação das variáveis dos templates.
 *
 * Guarda-corpo principal da extensão: `render` devolve também a lista de variáveis que
 * NÃO puderam ser resolvidas. Quem chama nunca deve enviar quando essa lista não está
 * vazia — é o que impede um "{{link_grupo}}" cru chegar no contato.
 */

import * as cities from './cities.js';

export const KNOWN_VARS = [
  ['{{saudacao}}', 'Bom dia / Boa tarde / Boa noite, conforme a hora'],
  // As duas do nome continuam funcionando, mas saíram das respostas: ver `semVocativo`.
  ['{{nome}}', 'Nome completo do contato (evite: o cadastro erra, e sem valor trava o envio)'],
  ['{{primeiro_nome}}', 'Só o primeiro nome (evite, mesmo motivo)'],
  ['{{cidade}}', 'Cidade classificada do contato'],
  ['{{link_grupo}}', 'Link do grupo da cidade (tabela em Config)'],
  ['{{telefone}}', 'Telefone formatado'],
  ['{{funcao}}', 'Função classificada'],
  ['{{partido}}', 'Partido classificado'],
];

/**
 * Tira o vocativo de nome de um texto de resposta — "Obrigado, {{primeiro_nome}}!" vira
 * "Obrigado!".
 *
 * Chamar o contato pelo nome saiu do fluxo por decisão do Thiago (10/08), e o motivo é o
 * cadastro: o nome que está no CRM erra com frequência alta demais para ir num texto que a
 * pessoa lê. Já vimos apelido do perfil no lugar do nome ("Zane" por "Rosane Requia"), cidade
 * no campo do nome ("Santa Cruz - Serlei"), sigla de partido colada ("Jeane do PL"), abreviação
 * ("srn") e o apelido automático do anúncio ("[NOVO] (51) 9…"). Errar o nome de alguém é o tipo
 * de erro que o contato percebe na hora — e o acerto não vale nada perto disso.
 *
 * De quebra some o outro lado do problema: `{{primeiro_nome}} `sem valor **bloqueia o envio**, e
 * esse bloqueio já tirou opção da pergunta da rodada duas vezes.
 *
 * Puro e exportado para ter teste: ele reescreve texto que vai para eleitor real.
 */
const VAR_NOME = String.raw`\{\{\s*(?:primeiro_nome|nome)\s*\}\}`;

export function semVocativo(texto) {
  return String(texto || '')
    // "…, {{primeiro_nome}}!" / "…, {{nome}}:" — o vocativo entre vírgula e pontuação.
    .replace(new RegExp(String.raw`,\s*${VAR_NOME}\s*(?=[!?.,:;])`, 'gi'), '')
    // "Olá {{primeiro_nome}}, tudo bem?" — a vírgula é do resto da frase, então fica.
    .replace(new RegExp(String.raw`\s+${VAR_NOME}\s*(?=,)`, 'gi'), '')
    // "{{primeiro_nome}}, agradeço…" — começo de frase.
    .replace(new RegExp(String.raw`^${VAR_NOME}\s*,\s*`, 'gim'), '')
    // Qualquer sobra solta.
    .replace(new RegExp(String.raw`\s*${VAR_NOME}`, 'gi'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([!?.,:;])/g, '$1')
    .replace(/[ \t]+$/gm, '');
}

/** O texto ainda chama o contato pelo nome? Usado para avisar no editor de respostas. */
export function usaNome(texto) {
  return new RegExp(VAR_NOME, 'i').test(String(texto || ''));
}

export function saudacao(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return parts[0] || '';
}

/**
 * O contato que chega do anúncio vem cadastrado como "[NOVO] (51) 99999-9999", e mandar
 * "Boa noite, [NOVO]!" é pior do que não usar nome nenhum. Aqui a extensão reconhece esses
 * apelidos automáticos e trata como "sem nome" — o que faz o envio travar em vez de sair
 * errado, até o parser (ou você) preencher o nome de verdade.
 */
export function looksLikePlaceholder(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (/^\[/.test(s)) return true; // "[NOVO] ...", "[SEM NOME]"
  if (/^novo\b/i.test(s)) return true;
  const letras = s.replace(/[^\p{L}]/gu, '');
  return letras.length < 3; // sobrou basicamente um telefone
}

/**
 * O nome do cadastro é só o apelido do perfil do WhatsApp?
 *
 * Caso real: o cadastro dizia "Zane" (nome do perfil) e a pessoa respondeu "Rosane Requia" no
 * formulário. A regra "nunca sobrescrever o CRM" descartava a resposta dela, e o agradecimento
 * sairia "Obrigado pela atenção, Zane!" — erro que o contato percebe na hora.
 *
 * A distinção que resolve: cadastro **igual** ao nome do perfil quer dizer que ninguém digitou
 * nada ali; foi o WhatsApp que preencheu. Nome que um operador escreveu continua ganhando do
 * palpite, como sempre.
 */
export function nomeVeioDoPerfil(contact) {
  const cadastro = String(contact?.name || '').trim();
  const perfil = String(contact?.nameWhatsapp || '').trim();
  if (!cadastro || !perfil) return false;
  return cadastro.localeCompare(perfil, 'pt-BR', { sensitivity: 'base' }) === 0;
}

/**
 * Monta o dicionário de variáveis a partir do contexto do atendimento.
 * @param {object} ctx { contact, nome, cidade, funcao, partido }
 *   `nome` é o que está na aba Dados (parser ou digitado) e tem prioridade sobre o cadastro.
 */
export async function buildContext(ctx = {}) {
  const doCadastro = ctx.contact?.name || ctx.contact?.nameWhatsapp || '';
  const nome = ctx.nome || (looksLikePlaceholder(doCadastro) ? '' : doCadastro);
  const cidade = ctx.cidade || '';

  let linkGrupo = '';
  let linkReason = null;
  if (cidade) {
    const resolved = await cities.linkFor(cidade);
    linkGrupo = resolved.link || '';
    linkReason = resolved.reason || null;
  } else {
    linkReason = 'Cidade ainda não classificada — preencha na aba Dados.';
  }

  return {
    values: {
      saudacao: saudacao(),
      nome,
      primeiro_nome: firstName(nome),
      cidade,
      link_grupo: linkGrupo,
      telefone: ctx.contact?.phonenumberFormatted || ctx.contact?.phonenumber || '',
      funcao: ctx.funcao || '',
      partido: ctx.partido || '',
    },
    reasons: {
      link_grupo: linkReason,
      nome: nome ? null : 'Nome ainda não preenchido (o cadastro está com apelido automático) — preencha na aba Dados.',
      primeiro_nome: nome
        ? null
        : 'Nome ainda não preenchido (o cadastro está com apelido automático) — preencha na aba Dados.',
    },
  };
}

/**
 * @returns {{text:string, missing:string[], reasons:object}}
 */
export function render(template, context) {
  const missing = [];
  const text = String(template || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, rawName) => {
    const name = rawName.toLowerCase();
    const value = context.values[name];
    if (value === undefined) {
      missing.push(name);
      return full; // mantém o marcador visível no preview
    }
    if (value === '') {
      missing.push(name);
      return full;
    }
    return value;
  });

  return { text, missing: [...new Set(missing)], reasons: context.reasons || {} };
}

/** Mensagem curta explicando por que o envio está bloqueado. */
export function explainMissing(missing, reasons) {
  const vistos = new Set();
  return missing
    .map((name) => reasons[name] || `Variável {{${name}}} sem valor.`)
    .filter((motivo) => {
      if (vistos.has(motivo)) return false; // {{nome}} e {{primeiro_nome}} têm o mesmo motivo
      vistos.add(motivo);
      return true;
    })
    .join(' ');
}
