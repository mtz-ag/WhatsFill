/**
 * composer.js — escreve e envia pelo composer nativo da plataforma.
 *
 * Por que não POST /chat/v2/message: passar pelo composer usa o fluxo já validado do app
 * (janela de 24h, regras do canal, render correto na conversa) sem depender do formato
 * exato do body da API.
 *
 * O truque necessário é o native value setter: atribuir `textarea.value = x` direto não
 * notifica o Angular. Com o setter do protótipo + evento `input`, o app reconhece o texto
 * e o botão paper-airplane aparece — isso foi verificado na plataforma.
 */

import { getComposer, getSendButton, isPending, getSessionId } from './dom.js';

const nativeSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  'value'
).set;

export function setComposerText(text) {
  const ta = getComposer();
  if (!ta) {
    throw new Error(
      isPending()
        ? 'Este atendimento está Pendente e ainda não tem campo de texto. Clique em Iniciar primeiro.'
        : 'Campo de mensagem não encontrado. Abra um atendimento antes.'
    );
  }
  ta.focus();
  nativeSetter.call(ta, text);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return ta;
}

/**
 * Insere o texto e clica em enviar. Espera o botão aparecer (ele só existe com texto).
 *
 * Tudo é amarrado ao atendimento em que o envio COMEÇOU. Sem isso, trocar de conversa no meio
 * (um clique na fila enquanto o envio corre) passava batido de dois jeitos, os dois ruins:
 * o clique de enviar iria para o composer de outra pessoa, e a conferência de "composer
 * esvaziou" daria positiva na hora — porque o composer do atendimento recém-aberto está vazio.
 * Era assim que um envio virava registro no contato errado.
 */
export async function sendText(text, { timeoutMs = 4000 } = {}) {
  const sessaoInicial = getSessionId();
  setComposerText(text);

  const btn = await waitFor(() => {
    const b = getSendButton();
    return b && !b.disabled ? b : null;
  }, timeoutMs);

  if (!btn) {
    throw new Error('Botão de enviar não apareceu. O texto ficou no composer para você enviar à mão.');
  }
  if (getSessionId() !== sessaoInicial) {
    throw new Error('O atendimento mudou antes de eu clicar em enviar. Nada foi enviado.');
  }

  btn.click();

  // Confirma que o composer esvaziou — é o sinal de que o app aceitou o envio.
  const emptied = await waitFor(() => {
    if (getSessionId() !== sessaoInicial) return 'trocou';
    const ta = getComposer();
    return ta && ta.value === '' ? true : null;
  }, 4000);

  if (emptied === 'trocou') {
    throw new Error('O atendimento mudou no meio do envio. Confira a conversa antes de repetir.');
  }
  if (!emptied) throw new Error('Cliquei em enviar mas o composer não esvaziou. Confira a conversa.');
  return true;
}

async function waitFor(fn, timeoutMs, stepMs = 80) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}
