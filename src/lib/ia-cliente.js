/**
 * ia-cliente.js — a ponte entre o painel e a API da Anthropic.
 *
 * **A chave da API nunca entra na página, e essa é a razão de este arquivo existir.**
 * O `page-hook.js` roda no mundo MAIN, o mesmo contexto JS do Angular do mobiliza. Tudo o que
 * está na página, a plataforma (e qualquer script que ela carregue) consegue ler. Uma chave de
 * API ali é uma chave publicada. Por isso a requisição sai do **service worker**: ele tem as
 * `host_permissions`, roda fora de qualquer página, e o painel só lhe manda o pedido.
 *
 * O painel usa `avaliar()`. O service worker usa `atender()`. As duas metades da mesma conversa.
 */

import { montarSistema, montarContato, montarRequisicao, validarDecisao, MODELO_PADRAO } from './ia.js';

export const MSG_IA = 'whatsfill-ia';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSAO_API = '2023-06-01';

// ---------------------------------------------------------------------------
// Lado do painel
// ---------------------------------------------------------------------------

/**
 * Pede ao service worker que avalie este contato.
 *
 * Nunca lança: falha de IA não pode derrubar rodada. Sem resposta, sem rede, sem chave, sem
 * crédito — tudo vira `{acao: 'incerto'}`, que é o painel se comportando como antes da IA
 * existir. É a mesma disciplina do resto: na dúvida, quem decide é ele.
 *
 * @returns {Promise<{acao:string, templateId:string, motivo:string, confianca:number,
 *                    aviso:string, custo?:object}>}
 */
export async function avaliar({ templates, regras, mensagens, campos, etiquetas, modelo }) {
  const ids = (templates || []).map((t) => t.id);
  try {
    const r = await chrome.runtime.sendMessage({
      type: MSG_IA,
      sistema: montarSistema({ templates, regras }),
      contato: montarContato({ mensagens, campos, etiquetas }),
      ids,
      modelo: modelo || MODELO_PADRAO,
    });

    if (!r?.ok) {
      return { acao: 'incerto', templateId: '', motivo: '', confianca: 0, aviso: r?.motivo || 'a IA não respondeu' };
    }
    return { ...validarDecisao(r.decisao, ids), custo: r.custo };
  } catch (err) {
    return { acao: 'incerto', templateId: '', motivo: '', confianca: 0, aviso: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Lado do service worker
// ---------------------------------------------------------------------------

/**
 * Faz a chamada de verdade. Só o service worker executa isto.
 *
 * `anthropic-dangerous-direct-browser-access` é necessário porque a origem aqui é a da extensão,
 * não um servidor. O nome do cabeçalho é um aviso legítimo — chamar a API direto do navegador
 * expõe a chave a quem tiver acesso ao navegador. Vale aqui porque a extensão é interna, é
 * carregada descompactada e a chave fica no armazenamento da própria extensão, que outra
 * extensão não lê. **Não vale para nada que seja distribuído.**
 *
 * @param {object} pedido    o que o painel montou
 * @param {string} chave     a chave da API, lida do armazenamento pelo chamador
 * @returns {Promise<{ok:boolean, decisao?:object, custo?:object, motivo?:string}>}
 */
export async function atender(pedido, chave) {
  if (!chave) return { ok: false, motivo: 'sem chave da API — preencha na aba Config' };

  const corpo = montarRequisicao({
    sistema: pedido.sistema,
    contato: pedido.contato,
    ids: pedido.ids,
    modelo: pedido.modelo,
  });

  let resposta;
  try {
    resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': VERSAO_API,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(corpo),
    });
  } catch (err) {
    return { ok: false, motivo: `não consegui falar com a API: ${err?.message || err}` };
  }

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => '');
    return { ok: false, motivo: traduzirErro(resposta.status, texto) };
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (_) {
    return { ok: false, motivo: 'a API devolveu algo que não é JSON' };
  }

  // A decisão vem como texto no primeiro bloco; o esquema garante que é JSON válido, mas quem
  // decide se dá para usar é `validarDecisao`, do lado do painel.
  const bloco = (dados.content || []).find((b) => b.type === 'text');
  return {
    ok: true,
    decisao: bloco?.text ?? null,
    custo: resumoDeCusto(dados.usage),
  };
}

/**
 * O que a chamada custou, em tokens, para a tela poder mostrar.
 *
 * `cache_read` separado de propósito: é o número que diz se o cache está funcionando. Zero nele
 * em chamadas seguidas significa que alguma coisa no prompt de sistema passou a variar, e a
 * conta fica 3,5× maior sem nenhum erro aparecer.
 */
function resumoDeCusto(usage) {
  if (!usage) return null;
  return {
    entrada: usage.input_tokens || 0,
    cacheEscrito: usage.cache_creation_input_tokens || 0,
    cacheLido: usage.cache_read_input_tokens || 0,
    saida: usage.output_tokens || 0,
  };
}

/** Erro de API vira frase que diz o que fazer, não código HTTP. */
function traduzirErro(status, texto) {
  if (status === 401) return 'a chave da API foi recusada — confira na aba Config';
  if (status === 429) return 'limite de uso da API atingido — espere um pouco';
  if (status === 400 && /credit balance|insufficient/i.test(texto)) return 'a conta da API está sem crédito';
  if (status >= 500) return `a API está com problema (${status}) — tente de novo daqui a pouco`;

  let detalhe = '';
  try {
    detalhe = JSON.parse(texto)?.error?.message || '';
  } catch (_) {
    detalhe = texto.slice(0, 200);
  }
  return `a API recusou (${status})${detalhe ? `: ${detalhe}` : ''}`;
}
