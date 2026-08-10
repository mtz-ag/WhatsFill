/**
 * keepalive.js — mantém a aba acordada enquanto uma rodada em lote roda.
 *
 * Medido no Chrome do Thiago, com a aba escondida: um `setInterval` de 120ms disparou **zero
 * vezes** em mais de um minuto, e um `setTimeout` de 12s não voltou em 45s. Não é
 * estrangulamento, é **congelamento**.
 *
 * O detalhe que decide o desenho: o congelamento atinge o JavaScript da **própria plataforma**.
 * O Angular para de renderizar, então não adiantaria mover só as nossas esperas para fora da
 * aba (service worker, alarms) — depois de clicar em Iniciar, o campo de mensagem simplesmente
 * não nasceria. Quem precisa continuar viva é a página inteira.
 *
 * O que o Chromium não congela nem estrangula é aba **tocando áudio**. Daí este WAV em loop com
 * amplitude mínima: silêncio absoluto não conta como "tocando" em todas as versões, por isso a
 * amplitude é baixa mas diferente de zero.
 *
 * Autoplay exige gesto do usuário: `ligar()` só funciona a partir do clique que inicia a
 * rodada. Se falhar, devolve o motivo em vez de fingir que deu certo — rodada que morre
 * calada no meio é pior do que rodada que avisa que precisa da aba visível.
 */

let audio = null;

/** WAV de 1s, mono, 8kHz, amplitude 2 de 32767. Gerado aqui para não depender de arquivo. */
function gerarWav() {
  const taxa = 8000;
  const amostras = taxa;
  const buffer = new ArrayBuffer(44 + amostras * 2);
  const v = new DataView(buffer);
  const texto = (pos, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };

  texto(0, 'RIFF');
  v.setUint32(4, 36 + amostras * 2, true);
  texto(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, amostras * 2, true);
  for (let i = 0; i < amostras; i++) v.setInt16(44 + i * 2, (i % 2 ? 1 : -1) * 2, true);

  let bin = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

/**
 * @returns {Promise<{ok:boolean, motivo?:string}>} `ok:false` traz o motivo para a tela.
 */
export async function ligar() {
  if (audio && !audio.paused) return { ok: true };
  try {
    audio = new Audio(gerarWav());
    audio.loop = true;
    audio.volume = 0.01;
    await audio.play();
    return { ok: true };
  } catch (err) {
    audio = null;
    return {
      ok: false,
      motivo:
        err?.name === 'NotAllowedError'
          ? 'o Chrome bloqueou o áudio que mantém a aba acordada (é preciso iniciar a rodada por um clique na página)'
          : `não consegui manter a aba acordada: ${err?.message || err}`,
    };
  }
}

export function desligar() {
  if (!audio) return;
  try {
    audio.pause();
    audio.src = '';
  } catch (_) {
    /* aba já sumiu */
  }
  audio = null;
}

export function ativo() {
  return !!audio && !audio.paused;
}
