/**
 * O Esc para a rodada TAMBEM com o foco no campo da conversa (03/11/2026).
 *
 * Medido na tela dele: *"o Parar e o Esc nao encerram a espera de 'responda a mao'"*. O ■ exige
 * ponteiro de verdade (`detail !== 0`, guarda de 29/10) e funciona; o Esc nao pegava.
 *
 * A causa era uma guarda copiada de onde ela faz sentido para onde ela nao faz. `ehCampoDeTexto`
 * existe para nao roubar tecla de quem esta DIGITANDO — e ela que impede o "2" digitado na
 * conversa de virar a tecla Pular. Nos dois escutadores de Esc ela barrava o Escape tambem, e o
 * Escape nao digita nada.
 *
 * O preco era o atalho morrer exatamente onde ele serve: nas duas esperas longas o painel sai da
 * frente e o foco dele vive no campo da conversa, que e onde ele le e responde. A caixa da
 * pergunta ja fechou, entao nao ha outro Esc escutando.
 *
 * Este recorte ja e o do painel do Facebook (21/10/2026): *"passam so as setas e o Escape; os
 * DIGITOS continuam barrados"*.
 *
 * Rode: node tests/parar-rodada.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim } from './_harness.mjs';

const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');

/** O escutador do controle flutuante, lido do codigo — a janelinha do ■ e do ▶. */
const controle = (() => {
  const i = painel.indexOf('function abrirControleDaRodada()');
  const f = painel.indexOf('function fecharControleDaRodada()', i);
  if (i < 0 || f < 0) return '';
  const bloco = painel.slice(i, f);
  const j = bloco.indexOf('function aoTeclar(ev)');
  return j < 0 ? '' : bloco.slice(j, bloco.indexOf('document.addEventListener(', j));
})();

/** O escutador da caixa da pergunta, onde Esc significa parar e os digitos sao as teclas dele. */
const caixa = (() => {
  const i = painel.indexOf('// Você está digitando na conversa');
  if (i < 0) return '';
  return painel.slice(i, painel.indexOf('fechar(opcao ? opcao.valor', i));
})();

{
  grupo('o controle flutuante: Esc para a rodada de onde quer que o foco esteja');

  check(!!controle, 'achei o escutador de Esc do controle flutuante');

  /**
   * **A assercao do defeito.** Reintroduzindo a linha `ehCampoDeTexto` aqui, esta cai — e com ela
   * volta o caso dele: Esc no campo da conversa nao faz nada, e o unico caminho e achar o ■.
   */
  check(!/ehCampoDeTexto/.test(controle),
    'o Esc do controle NAO consulta ehCampoDeTexto: ele nao digita nada, e o foco dele vive no campo');

  /** O que NAO afrouxou, e nao pode afrouxar. */
  check(/ev\.key !== 'Escape' \|\| ev\.defaultPrevented/.test(controle),
    'quem tratou o Esc primeiro continua vencendo (os editores fecham sem salvar na captura)');
  check(/if \(!ev\.isTrusted\) return;/.test(controle),
    'Esc sintetico continua fora: a propria extensao dispara um em toda passada que envia');
  check(/if \(!state\.auto\.rodando\) return;/.test(controle),
    'e so enquanto a rodada anda — fora dela o Esc nao e nosso');
  check(/state\.auto\.parar = true/.test(controle),
    'e o que ele faz e a mesma bandeira do botao Parar do cartao');
}

{
  grupo('a caixa da pergunta: o Esc passa, os digitos continuam barrados');

  check(!!caixa, 'achei o escutador da caixa da pergunta');

  /** A guarda pergunta a TECLA antes do campo: e isso que separa o Escape dos digitos. */
  check(/const ehEsc = ev\.key === 'Escape';/.test(caixa),
    'a caixa reconhece o Escape antes de olhar o campo');
  check(/if \(!ehEsc && ehCampoDeTexto\(/.test(caixa),
    'campo de texto so barra tecla que NAO e Escape');

  /**
   * **A outra metade, e ela e a razao da guarda existir.** Sem `ehCampoDeTexto` nenhum, o "2" que
   * ele digita na conversa viraria a tecla Pular e o atendimento fecharia no meio de uma frase.
   */
  check(/ehCampoDeTexto\(ev\.composedPath\?\.\(\)\[0\] \|\| ev\.target\)/.test(caixa),
    'a guarda dos digitos continua de pe — e ela que impede o "2" da conversa de decidir');
  check(/if \(ehEsc && !ev\.isTrusted\) return;/.test(caixa),
    'e o Esc sintetico continua fora tambem aqui');
}

{
  grupo('e parar encerra as DUAS esperas longas');

  /**
   * A bandeira so serve se quem espera a ler. Sao as duas esperas em que o painel sai da frente —
   * e sao elas que o relato dele nomeia ("a espera de responda a mao").
   */
  const enviar = painel.slice(
    painel.indexOf('async function esperarVoceEnviar'),
    painel.indexOf('async function esperarVoceEnviar') + 9000
  );
  const concluir = painel.slice(
    painel.indexOf('async function esperarVoceConcluir'),
    painel.indexOf('async function esperarVoceConcluir') + 3000
  );
  check(/if \(state\.auto\.parar\)/.test(enviar),
    'esperarVoceEnviar le state.auto.parar a cada volta');
  check(/if \(state\.auto\.parar\)/.test(concluir),
    'esperarVoceConcluir le state.auto.parar a cada volta');
}

fim();
