/**
 * rpc.js — contrato de mensagens entre a janela do painel e a aba do mobiliza.
 *
 * O painel virou uma janela separada, então ele não tem mais acesso direto ao DOM da
 * plataforma: tudo que mexe na página (escrever no composer, clicar em Iniciar/Concluir) e
 * o token de acesso vêm por aqui. As chamadas de API e o parser continuam rodando no
 * painel, que tem host_permissions e faz fetch direto.
 */

export const RPC = 'wf-rpc';

/** A aba avisa o painel quando a sessão aberta (ou o estado dela) muda. */
export const EVENT_PAGE_STATE = 'wf-page-state';

export const MOBILIZA_TAB_QUERY = 'https://mobiliza.app/*';

export async function callTab(tabId, method, args = []) {
  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, { type: RPC, method, args });
  } catch (err) {
    throw new Error(
      'Não consegui falar com a aba do mobiliza.app. Recarregue a aba (F5) e tente de novo.'
    );
  }
  if (!response) throw new Error('A aba do mobiliza.app não respondeu.');
  if (response.error) throw new Error(response.error);
  return response.result;
}

/** Acha a aba do mobiliza para conversar: prioriza a que está ativa. */
export async function findMobilizaTab() {
  const tabs = await chrome.tabs.query({ url: MOBILIZA_TAB_QUERY });
  if (!tabs.length) return null;
  return tabs.find((t) => t.active) || tabs[0];
}
