/**
 * A PREVISÃO do fluxo: a mesma função que decide, parada antes de agir (03/11/2026).
 *
 * O buraco que ela fecha: até aqui a única forma de ler o que o fluxo decidiria era **iniciar uma
 * rodada de verdade**, e a rodada age. Medindo um caso na tela dele, ela concluiu cinco
 * atendimentos no caminho. E todo diagnóstico deste projeto começa igual — *medi o sinal, medi a
 * ordem* —, então esse primeiro passo custava uma rodada em produção.
 *
 * **Por que simular dentro de `processarRespondido` e não numa função nova:** a decisão depende de
 * ~28 valores que ela calcula ao longo de 900 linhas. Remontá-los noutro lugar é a armadilha de
 * 14/10 (*"reconstrução de contexto COPIA a composição do painel, nunca a função de nome
 * parecido"*) — a previsão mediria a minha suposição e divergiria na primeira regra nova.
 *
 * **O que este arquivo trava é o que ENVELHECE:** a lista do que age antes da decisão. Uma escrita
 * nova acrescentada ali passa a acontecer em TODO contato que ele abre, em silêncio — então o
 * teste conta os pontos que agem e exige que cada um conhecido esteja gateado. Apareceu um
 * décimo-primeiro, a contagem quebra e alguém vem ler isto.
 *
 * Rode: node tests/previsao-do-fluxo.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim } from './_harness.mjs';

const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');

/** Do começo de `processarRespondido` até o ponto em que a previsão devolve. */
const regiao = (() => {
  const a = painel.indexOf('async function processarRespondido');
  const b = painel.indexOf('          paraAIA:', a);
  if (a < 0 || b < 0) return '';
  return painel
    .slice(a, b)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
})();

{
  grupo('simular existe, e o load não roda duas vezes');

  check(!!regiao, 'achei a região entre o começo da função e a previsão');
  check(/const simular = !!ctx\?\.simular;/.test(painel), 'a simulação entra pelo ctx, como o resto da rodada');
  check(/if \(!simular\) await load\(sessionId\);/.test(regiao),
    'simulando, o load NÃO roda: quem está carregado é o contato que ele abriu');
  check(/resultado: 'previsao'/.test(painel),
    "a previsão sai com um resultado próprio, que nenhuma rodada produz");
}

{
  grupo('NADA que age sobrevive antes da decisão');

  /**
   * A lista é do que ESCREVE, ENVIA, PERGUNTA ou PAGA. Logar entra junto: uma linha de Andamento
   * escrita por previsão apareceria em todo contato aberto, e o Andamento é o log da rodada.
   */
  const ATOS = {
    'removerEtiquetasListadas(': 1,
    'saveClassification(': 2,
    'concluirPeloPainel(': 2,
    'perguntarNaRodada(': 2,
    'etiquetarEndereco(': 2,
    'aplicarEtiquetaDePedido(': 1,
    'registrarNaRodada(': 6,
  };

  for (const [nome, esperado] of Object.entries(ATOS)) {
    const achou = regiao.split(nome).length - 1;
    check(achou === esperado,
      `${nome} aparece ${esperado}× antes da decisão (achei ${achou}) — mudou? confira se o novo está gateado por simular`);
  }

  /** Os gates, um a um, pelo texto que os faz existir. */
  check(/const falhouARemocao = simular \? null : await removerEtiquetasListadas\(nome\);/.test(painel),
    'a remoção de etiquetas não acontece na previsão — ela escreve no CRM');
  check(/if \(!simular && !\(await etiquetaDeEndereco\(\)\)\)/.test(painel),
    'a etiqueta de material não é marcada na previsão (e ela passa pela IA, que é paga)');
  check(/if \(!simular && motivoDoPedido/.test(painel),
    'a etiqueta de pedido não é marcada na previsão');
  check(/if \(!simular\) registrarNaRodada\(nome, 'info', doAnuncio\.motivo\);/.test(painel),
    'a linha do anúncio não vai para o Andamento na previsão');
  check(/\} else if \(!simular && state\.anuncio\) \{/.test(painel),
    'nem a linha do anúncio reconhecido que não decidiu nada');

  /**
   * São QUATRO saídas de previsão: as três que agiriam (canal removido, canal fora do ar, "já
   * respondi há pouco") mais a do fim, que é a decisão do fluxo. Uma saída que age sem virar
   * previsão quebra a contagem dos ATOS acima; uma previsão a mais tem de ser explicada aqui.
   */
  const prever = regiao.split('return prever(').length - 1;
  check(prever === 4, `as três saídas que agiriam viram previsão, mais a do fim (achei ${prever})`);
}

{
  grupo('a previsão é a decisão FINAL, e para antes da IA');

  const iDecide = painel.indexOf('let sugestao = sugerirAcaoComFluxo(sinaisDoContato');
  const iAnuncio = painel.indexOf('sugestao = doAnuncio;');
  const iPrever = painel.indexOf('          paraAIA:');
  const iIA = painel.indexOf('const iaEntra = !!state.ia?.ligada');

  check(iDecide > 0 && iAnuncio > iDecide, 'o anúncio ainda pode TROCAR o desfecho depois da tabela');
  check(iPrever > iAnuncio,
    'a previsão para DEPOIS do ajuste do anúncio — parar antes mostraria a primeira decisão, não a que sairia');
  const iCortesia = painel.indexOf('const fechoDeCortesia =');
  check(iCortesia > iAnuncio && iPrever > iCortesia, 'a previsão inclui o fechamento por cortesia');
  check(/if \(!simular && fechoDeCortesia.id/.test(painel), 'a cortesia simulada não escreve no Andamento');
  check(/if \(simular\) throw err;/.test(painel), 'erro de simulação não fecha diálogos da plataforma');
  check(iIA > iPrever,
    'e para ANTES da IA: prever não pode gastar dinheiro, que é o que a chamada custa');
}

{
  grupo('prever não mexe na medida que ela existe para ajudar a ler');

  check(/function sugerirAcaoComFluxo\(ctx, \{ contar = true \} = \{\}\)/.test(painel),
    'sugerirAcaoComFluxo aceita não contar');
  check(/if \(contar && r\?\.id\)/.test(painel),
    'e as vitórias só sobem quando ele manda contar');
  check(/sugerirAcaoComFluxo\(sinaisDoContato, \{ contar: !simular \}\)/.test(painel),
    'a previsão não conta vitória — senão o número dobraria contra as rodadas de verdade');
}

{
  grupo('quem chama, e as três guardas');

  const fn = painel.slice(painel.indexOf('async function preverOFluxo'), painel.indexOf('async function preverOFluxo') + 700);
  check(!!fn, 'achei preverOFluxo');
  check(/if \(state\.auto\.rodando \|\| !state\.contact\) return;/.test(fn),
    'não prevê durante a rodada (lá a decisão de verdade vem logo depois) nem sem contato carregado');
  check(/catch \(err\)/.test(fn) && /console\.warn/.test(fn),
    'falha de previsão é silenciosa: é uma linha informativa, não pode derrubar o load');
  check(/await preverOFluxo\(sessionId\);/.test(painel), 'o load chama a previsão no fim');
  check(/state\.previsao = null;/.test(painel.slice(0, painel.indexOf('async function load'))) ||
    /state\.previsao = null;/.test(painel),
    'e a previsão é zerada na troca de contato — a do anterior na tela do próximo é a armadilha da pergunta de cidade');
}

{
  grupo('a linha na tela');

  const i = painel.indexOf('`O fluxo faria: ${state.previsao.motivo}`');
  check(i > 0, 'a linha existe');
  const bloco = painel.slice(i - 400, i + 300);
  check(/'data-fica': '1'/.test(bloco),
    "a linha é DADO e leva data-fica — sem ela o 'detalhes' a recolhe, o defeito cometido duas vezes em 03/11");
  check(/if \(state\.previsao\) \{/.test(painel),
    'e ela se cala quando não há previsão, em vez de dizer "não sei" em toda conversa');

  /** O rótulo sai da tabela das teclas, e não de um texto meu ao lado dela. */
  const desc = painel.slice(painel.indexOf('function descreverPrevisao'), painel.indexOf('function descreverPrevisao') + 1300);
  check(/sugestaoLib\.TECLAS\[sugestao\.tecla\]/.test(desc),
    'o rótulo vem de TECLAS — duas descrições do mesmo desfecho divergem na primeira tecla nova');
  check(/nenhuma regra decide este caso/.test(desc),
    'e o caso em que ninguém decide é dito, em vez de sair em branco');
}

{
  grupo('executa a decisão final simulada sem log nem IA');
  const inicio = painel.indexOf('      const fechoDeCortesia =');
  const fimBloco = painel.indexOf('      const regraPedeGente =', inicio);
  const executar = new Function('sugestao', 'state', 'sugestaoLib', 'simular',
    'sinaisDoContato', 'registrarNaRodada', 'nome', 'prever', 'descreverPrevisao',
    painel.slice(inicio, fimBloco));
  const cortesia = { tecla: '3', id: 'cortesia', motivo: 'só agradeceu' };
  const r = executar({ tecla: '5', id: 'momento' }, { auto: { cfg: {} }, ia: { ligada: true } },
    { fecharPorCortesia: () => cortesia }, true, {},
    () => { throw new Error('simulação escreveu no log'); }, 'Contato fictício',
    (o) => o, (o) => o.motivo);
  check(r.tecla === '3' && r.regra === 'cortesia', 'mostra concluir quando a cortesia substitui a mensagem');
  check(!r.paraAIA && r.motivo === 'só agradeceu', 'preserva o motivo sem pedir IA');
}

fim();
