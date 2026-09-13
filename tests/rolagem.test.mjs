/**
 * O painel nao perde o lugar quando um botao redesenha a aba.
 *
 * Relato dele (13/09/2026): *"varios botoes da extensao ao serem clicados rolam pagina da extensao e eu
 * tenho que procurar toda vez onde eu estava"*. **Medido num navegador:** redesenhar tudo na mesma
 * tarefa nao perde a rolagem (1500 -> 1500); o que perde e o conteudo que chega DEPOIS do desenho —
 * o corpo fica curto, o navegador puxa a rolagem, e ela nao volta (1500 -> 240).
 *
 * A caixa abaixo imita o navegador: `scrollTop` nunca passa de `altura - visivel`.
 *
 * Rode: node tests/rolagem.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import { criarGuardaDeRolagem, JANELA_MS, TECLAS_QUE_ROLAM } from '../src/panel/rolagem.js';

function caixa({ visivel = 400, conteudo = 3000 } = {}) {
  return {
    clientHeight: visivel,
    _h: conteudo,
    _top: 0,
    get scrollHeight() {
      return this._h;
    },
    get scrollTop() {
      return this._top;
    },
    set scrollTop(v) {
      this._top = Math.max(0, Math.min(v, Math.max(0, this._h - this.clientHeight)));
    },
    /** O conteudo mudou de altura: o navegador reencaixa a rolagem. */
    conteudo(h) {
      this._h = h;
      this.scrollTop = this._top;
    },
  };
}

function relogio() {
  let t = 1000;
  return { agora: () => t, andar: (ms) => (t += ms) };
}

grupo('o conteudo que chega depois do desenho nao leva a rolagem embora');
{
  const el = caixa();
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('automatizado'); // primeiro desenho da aba
  el.scrollTop = 1500;

  // o clique: esvazia, desenha a parte sincrona (curta), o resto chega depois
  g.antesDeDesenhar('automatizado');
  el.conteudo(640);
  check(el.scrollTop === 240, 'reproduz o defeito: o corpo curto puxa a rolagem para 240');
  g.devolver();
  check(el.scrollTop === 240, 'enquanto o corpo e curto, nao ha para onde devolver');
  el.conteudo(3000);
  check(el.scrollTop === 240, 'sem a guarda, ela ficaria ali quando o resto chega');
  check(g.devolver() === true, 'a guarda devolve quando o conteudo cresce');
  check(el.scrollTop === 1500, 'e ele volta exatamente onde estava');
}

grupo('desenho inteiro de uma vez: nada a fazer');
{
  const el = caixa();
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('config');
  el.scrollTop = 900;
  g.antesDeDesenhar('config');
  el.conteudo(3000);
  check(g.devolver() === false && el.scrollTop === 900, 'a posicao ficou, e a guarda nao mexe');
}

grupo('dois desenhos seguidos antes de o conteudo voltar');
{
  /**
   * `withBusy` redesenha no `finally`, e a mesma acao chama `setStatus` e outros desenhos: o segundo
   * leria a posicao JA puxada para cima e a guardaria como se fosse a dele.
   */
  const el = caixa();
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('automatizado');
  el.scrollTop = 1500;
  g.antesDeDesenhar('automatizado');
  el.conteudo(500);
  r.andar(50);
  g.antesDeDesenhar('automatizado'); // segundo desenho, com a rolagem encolhida em 100
  el.conteudo(500);
  r.andar(50);
  el.conteudo(3000);
  g.devolver();
  check(el.scrollTop === 1500, 'o alvo continua sendo 1500, e nao o 100 encolhido');
}

grupo('quem manda na rolagem e ele');
{
  const el = caixa();
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('config');
  el.scrollTop = 1500;
  g.antesDeDesenhar('config');
  el.conteudo(600);
  g.soltar(); // rodou o mouse enquanto carregava
  el.scrollTop = 50;
  el.conteudo(3000);
  check(g.devolver() === false && el.scrollTop === 50, 'rolou por conta propria: a guarda nao puxa de volta');

  for (const tecla of ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']) {
    check(TECLAS_QUE_ROLAM.has(tecla), `a tecla "${tecla}" solta a guarda`);
  }
  check(!TECLAS_QUE_ROLAM.has('a') && !TECLAS_QUE_ROLAM.has('Enter'), 'digitar nao conta como rolar');
}

grupo('trocar de aba comeca do topo');
{
  const el = caixa();
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('automatizado');
  el.scrollTop = 1500;
  g.antesDeDesenhar('config');
  check(el.scrollTop === 0, 'a aba nova abre no topo');
  el.conteudo(3000);
  check(g.devolver() === false && el.scrollTop === 0, 'e nao recebe a posicao da aba anterior');
}

grupo('a janela acaba');
{
  const el = caixa();
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('config');
  el.scrollTop = 1500;
  g.antesDeDesenhar('config');
  el.conteudo(600);
  r.andar(JANELA_MS + 1);
  el.conteudo(3000);
  check(g.devolver() === false && el.scrollTop === 200, 'conteudo que chega muito depois nao arrasta a tela');
  check(JANELA_MS >= 2000 && JANELA_MS <= 10000, 'a janela e curta, mas cobre uma leitura lenta do armazenamento');
}

grupo('a ancoragem do navegador empurra para BAIXO, e a guarda devolve (13/09/2026)');
{
  /**
   * Relato dele: *"ao adicionar anuncio novo nas configuracoes ele rola toda vez pro fim"*. Medido numa
   * pagina com o corpo do painel: a lista de anuncios some e volta ACIMA do que esta na tela, e a
   * ancoragem do Chrome leva a rolagem de 1764 para 2765. A guarda da v3.58 so devolvia a QUEDA.
   */
  const el = caixa({ conteudo: 5000 });
  const r = relogio();
  const g = criarGuardaDeRolagem(el, { agora: r.agora });
  g.antesDeDesenhar('config');
  el.scrollTop = 1764;
  g.antesDeDesenhar('config');
  el.scrollTop = 2765; // a ancoragem empurrou
  check(g.devolver() === true && el.scrollTop === 1764, 'a rolagem empurrada para baixo volta ao lugar');

  // segundo desenho enquanto empurrada: o alvo continua o dele
  g.antesDeDesenhar('config');
  el.scrollTop = 2765;
  g.devolver();
  check(el.scrollTop === 1764, 'e um segundo desenho nao troca o alvo pelo valor empurrado');

  // ele rola para baixo por conta propria: a guarda solta e nao puxa
  g.soltar();
  el.scrollTop = 3000;
  check(g.devolver() === false && el.scrollTop === 3000, 'rolagem dele para baixo nao e desfeita');
}

fim();
