/**
 * memoria.js — o que sobrevive quando a conversa se perde de novo.
 *
 * O histórico do mobiliza.app não voltou na migração. O que dá para guardar daqui para a
 * frente é o telefone: o id da conversa muda, o número não. Etiqueta que já marca trabalho
 * feito (Sem Retorno, Sem Interesse) também conta. Origem não conta sozinha — helena são
 * 513 de 600 contatos medidos, e tratar isso como "já atendemos" repetiria o erro da
 * importação (132), quatro vezes maior. `importacao` nunca conta.
 */

import { semAcentoNemCaixa } from './cities.js';

/** Pergunta não é entrega. A Ivone (09/09): pedir o cadastro não prova que já respondemos. */
const PERGUNTAS = new Set(['pedir-dados', 'interesse-conteudo', 'perguntar-como-ajudar']);

const ETIQUETAS_PADRAO = ['Sem Retorno', 'Sem Interesse'];

export function chaveDeRotulo(rotulo) {
  return semAcentoNemCaixa(String(rotulo || ''))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/^\d+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 55 + DDD + últimos 8 dígitos. O 9 do celular fica de fora, então o mesmo aparelho
 * gravado com ou sem ele cai na mesma chave. Menos de 10 dígitos não é telefone.
 */
export function chaveDoTelefone(telefone) {
  let n = String(telefone || '').replace(/\D/g, '');
  if (n.startsWith('55') && n.length >= 12) n = n.slice(2);
  if (n.length < 10) return '';
  return n.slice(0, 2) + n.slice(2).slice(-8);
}

function prefixo(telefone) {
  const chave = chaveDoTelefone(telefone);
  return chave ? `tel:${chave}|` : '';
}

export function enviosDoTelefone(log, telefone) {
  const prefixoDoTel = prefixo(telefone);
  if (!prefixoDoTel || !log) return [];
  return Object.keys(log).filter((k) => k.startsWith(prefixoDoTel) && !PERGUNTAS.has(k.slice(prefixoDoTel.length)));
}

export function pedimosDados(log, telefone) {
  const prefixoDoTel = prefixo(telefone);
  if (!prefixoDoTel || !log) return false;
  return Object.keys(log).some((k) => k.startsWith(prefixoDoTel) && PERGUNTAS.has(k.slice(prefixoDoTel.length)));
}

/**
 * @returns {{ retorno: boolean, motivos: string[] }}
 * Motivos não levam dígito de telefone: eles podem ir para o prompt.
 */
export function provasDeRetorno({ telefone = '', etiquetas = [], origem = '', cfg = {}, log = {} } = {}) {
  const motivos = [];
  const origens = Array.isArray(cfg?.origens) ? cfg.origens : [];
  const etCfg = Array.isArray(cfg?.etiquetas) ? cfg.etiquetas : ETIQUETAS_PADRAO;
  const o = String(origem || '').trim().toLowerCase();
  if (o && o !== 'importacao' && origens.some((x) => String(x).trim().toLowerCase() === o)) {
    motivos.push('origem ' + o);
  }
  const permitidas = new Set(etCfg.map(chaveDeRotulo).filter(Boolean));
  for (const e of etiquetas || []) {
    const k = chaveDeRotulo(e);
    if (k && permitidas.has(k)) motivos.push('etiqueta ' + String(e).trim());
  }
  if (enviosDoTelefone(log, telefone).length) motivos.push('já mandamos mensagem para este telefone');
  return { retorno: motivos.length > 0, motivos };
}
