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

{
  grupo('controle manual antes de concluir');
  const inicio = painel.indexOf("if (decisao?.acao === 'concluir')");
  const gravacao = painel.indexOf('await saveClassification', inicio);
  const trecho = painel.slice(inicio, gravacao);
  check(trecho.includes('if (!rodadaAutomatica())'), 'modo manual exige confirmação para contato respondido');
  check(trecho.includes("if (confirmacao !== 'concluir')"), 'pular ou parar sai antes de gravar ou concluir');
  check(painel.includes('if (rodadaAutomatica() && sugestao && !ramoChamaIA)'), 'cortesia só pode escolher automaticamente no modo automático');
  check(painel.includes('if (state.auto.parar) controleDaRodada?.pintar();'), 'parada solicitada mantém o controle com reinício');
}

{
  grupo('parada pela pergunta preserva o controle: execução do fechamento real');
  const inicio = painel.indexOf('      function fechar(valor) {', painel.indexOf('function perguntarNaRodada'));
  const fimCorpo = painel.indexOf('      fecharDeFora = fechar;', inicio);
  const executar = new Function('state', 'document', 'fundo', 'resolve', 'aoTeclar', 'perguntasAbertas', 'valor',
    painel.slice(inicio, fimCorpo) + '\nperguntasAbertas.set(fechar, "parar");\nfechar(valor);');
  for (const valor of ['parar', 'pular', 'concluir']) {
    const state = { auto: { rodando: true, parar: false } };
    let devolvido;
    let removido = false;
    const abertas = new Map();
    executar(state, { removeEventListener() {} }, { remove() { removido = true; } },
      (v) => { devolvido = v; }, () => {}, abertas, valor);
    check(state.auto.parar === (valor === 'parar'), `${valor}: só parar marca a parada`);
    check(removido && devolvido === valor, `${valor}: fecha a pergunta e devolve a escolha`);
    check(abertas.size === 0, `${valor}: sai do registro que o ■ percorre`);
  }
}

/**
 * **Os quadros da rodada tomam o LUGAR do painel** (10/11/2026). Pedido dele: *"substitua o painel
 * atual da extensao pelo do automatizado e ao parar retorna o painel normal"*, e com a print da
 * primeira versao: *"ficou solto, era pra substituir o painel pra nao ficar em cima da conversa"*.
 *
 * A v3.284 escondia o painel e tirava o empurrao da pagina: o controle e as teclas, que moram numa
 * camada fixa, ficavam flutuando por cima da conversa. Agora o empurrao fica e as caixas entram
 * numa coluna encaixada onde o painel estava.
 */
const css = readFileSync(new URL('../src/panel/panel.css', import.meta.url), 'utf8');
// A ULTIMA regra que comeca a linha com este seletor: ele aparece tambem no fim da lista das
// variaveis de cor, que vem antes no arquivo, e pegar a primeira leria a regra errada.
const regraCss = (seletor) => {
  const i = css.lastIndexOf(`\n${seletor} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
};

grupo('a rodada troca o painel pela coluna ao comecar e devolve no finally');
{
  const i = painel.indexOf('async function rodar(');
  const rodar = painel.slice(i, painel.indexOf('const conta = (tipo)', i));
  const comeco = rodar.slice(0, rodar.indexOf('keepalive.ligar()'));
  const fimDaRodada = rodar.slice(rodar.indexOf('} finally {'));

  check(/naColuna\s*=\s*mode === 'dock'[^;]*entrarNaColunaDaRodada\(\)/.test(comeco),
    'ao comecar entra na coluna, so no modo encaixado');
  check(/!root\.classList\.contains\('wf-collapsed'\)/.test(comeco),
    'so com o painel aberto: escondido pelo icone, nao ha lugar encaixado para ocupar');
  check(comeco.indexOf('entrarNaColunaDaRodada()') < comeco.indexOf('abrirControleDaRodada()'),
    'a coluna nasce ANTES do controle, para ele ja abrir dentro dela');
  check(/if \(naColuna\) sairDaColunaDaRodada\(\)/.test(fimDaRodada),
    'o painel volta no FINALLY: parada por ele, fila no fim ou erro');
  check(fimDaRodada.indexOf('fecharControleDaRodada()') < fimDaRodada.indexOf('sairDaColunaDaRodada()'),
    'e DEPOIS de decidir o controle: parado, ele sai da coluna e volta a flutuar com o ▶');
  check(!/onToggle\(|mostrarPainel\(/.test(rodar),
    'a rodada nao mexe no empurrao da pagina: e isso que impede os quadros de cobrir a conversa');
}

grupo('toda caixa aberta na rodada vai para a coluna, e sai dela no fim');
{
  check(/function destinoDaCaixa\(\)\s*\{\s*return colunaDaRodada \|\| root\.parentNode \|\| root;/.test(painel),
    'destinoDaCaixa e o lugar unico: com a coluna ativa, controle, teclas e perguntas entram nela');
  const entrar = painel.slice(painel.indexOf('function entrarNaColunaDaRodada()'), painel.indexOf('function sairDaColunaDaRodada()'));
  check(/wf-oculto-na-rodada/.test(entrar), 'o painel some da tela enquanto a coluna esta no lugar dele');
  check(/wf-pergunta-fundo/.test(entrar) && /colunaDaRodada\.append\(fundo\)/.test(entrar),
    'o controle que ja flutuava (rodada parada e retomada pelo ▶) entra na coluna');
  const sair = painel.slice(painel.indexOf('function sairDaColunaDaRodada()'));
  check(/pai\.append\(fundo\)/.test(sair.slice(0, 400)),
    'ao sair, o que sobrou na coluna volta a flutuar — senao sumiria junto com ela');
  const arrastar = painel.slice(painel.indexOf('function tornarArrastavel('), painel.indexOf('function aplicarPosicao('));
  check(/closest\('\.wf-coluna-rodada'\)/.test(arrastar),
    'na coluna nao se arrasta: gravaria uma posicao de flutuar que ele nunca escolheu');
}

grupo('o CSS encaixa a coluna onde o painel estava');
{
  const coluna = regraCss('.wf-coluna-rodada');
  check(/position:\s*fixed/.test(coluna) && /right:\s*0/.test(coluna) && /var\(--wf-width/.test(coluna),
    'mesma borda e mesma largura do painel encaixado');
  check(/display:\s*none/.test(regraCss('.wf-root.wf-oculto-na-rodada')), 'o painel some enquanto ela esta la');
  const caixa = regraCss('.wf-coluna-rodada .wf-pergunta');
  check(/position:\s*static !important/.test(caixa) && /left:\s*auto !important/.test(caixa),
    'a caixa deixa de flutuar mesmo com a posicao arrastada escrita em linha');
  check(/pointer-events:\s*auto/.test(regraCss('.wf-coluna-rodada .wf-pergunta-fundo')),
    'a camada dentro da coluna e clicavel (fora dela ela e transparente de proposito)');
  check(/\.wf-root\.wf-dark ~ \.wf-coluna-rodada \.wf-pergunta-fundo/.test(css),
    'no tema escuro as caixas da coluna tambem ficam escuras');
}

/**
 * **O ■ fecha a pergunta aberta** (10/11/2026, print dele: *"eu parei mas nao retornou ao
 * painel"*). O ■ so marcava a bandeira, e a rodada estava parada no `await` da caixa da tecla 6:
 * ela so terminava quando ele respondesse, e e o fim da rodada que devolve o painel.
 */
grupo('o ■ fecha a pergunta aberta, e a rodada termina');
{
  const i = painel.indexOf('function abrirControleDaRodada()');
  const bloco = painel.slice(i, painel.indexOf('function fecharControleDaRodada()', i));
  const clique = bloco.slice(bloco.indexOf("parar.addEventListener('click'"), bloco.indexOf("seguir.addEventListener('click'"));
  check(/fecharPerguntasAoParar\(\)/.test(clique), 'o clique no ■ fecha as perguntas que a rodada espera');

  const pergunta = painel.slice(painel.indexOf('function perguntarNaRodada('), painel.indexOf('function ehCampoDeTexto('));
  check(/perguntasAbertas\.set\(fechar, aoParar\)/.test(pergunta), 'toda pergunta aberta se registra com o seu valor de "parei"');
  check(/perguntasAbertas\.delete\(fechar\)/.test(pergunta), 'e sai do registro ao fechar, por qualquer caminho');
  check(/aoParar = 'parar'/.test(pergunta), "o padrao e 'parar', o mesmo valor do Esc que os chamadores ja tratam");

  const cidade = painel.slice(painel.indexOf("titulo: doCadastro ? 'Cidade do cadastro'"), painel.indexOf('let escolha;', painel.indexOf("titulo: doCadastro ? 'Cidade do cadastro'")));
  check(/aoParar: CANCELADA/.test(cidade),
    "a da cidade fecha CANCELADA: 'parar' cairia no ramo que recusa e anota a recusa da cidade");
}
// O Andamento dentro da coluna da rodada (12/11/2026): cada linha nova chega la tambem.
{
  const reg = painel.slice(painel.indexOf('function registrarNaRodada'), painel.indexOf('function modeloDaRodada'));
  check(/controleDaRodada\?\.pintarLog\(\)/.test(reg), 'registrarNaRodada repinta o log da coluna');
  // 13/11/2026: dentro do controle (a 1a caixa), o log empurrava as teclas para fora da vista.
  const abrir = painel.slice(painel.indexOf('function abrirControleDaRodada'), painel.indexOf('function fecharControleDaRodada'));
  check(!/caixa\.append\(logDaRodada\)/.test(abrir), 'o log NAO mora dentro do controle');
  check(/colunaDaRodada\.append\(logDaRodada\)/.test(abrir), 'o log e filho direto da coluna');
  check(/\.wf-coluna-log \{\s*order: 99; flex: 1 1 auto; min-height: 120px;/.test(css), 'o log vem por ultimo e ocupa so o que sobra');
  check(/\.wf-coluna-rodada > \.wf-pergunta-fundo \{ flex: 0 0 auto; \}/.test(css), 'as caixas de decidir nao encolhem');
  const sair = painel.slice(painel.indexOf('function sairDaColunaDaRodada'), painel.indexOf('function abrirEditorDeVariantesDoMomento'));
  check(/classList\?\.contains\('wf-pergunta-fundo'\)\) pai\.append/.test(sair), 'ao sair, so as caixas voltam a flutuar');
}

fim();
