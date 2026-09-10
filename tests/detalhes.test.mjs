/**
 * O resumo do painel: o que fica à vista e o que vai para "ⓘ detalhes".
 *
 * Pedido dele (10/09/2026): *"continua com muito texto no frontend, pode resumir mais e botar o resto
 * pros detalhes"*. `partir` decide onde um rótulo ou um aviso é cortado — e o risco dele é o corte que
 * leva o sentido junto (*"Perguntar (em vez de concluir) após quantas horas"* virando só "Perguntar").
 * Os textos abaixo são os rótulos e avisos REAIS do painel, medidos montando-o numa página de teste.
 *
 * O recolhimento em si (`recolherExplicacoes`) mede altura no navegador e não roda no Node.
 */
import { check, grupo, fim } from './_harness.mjs';
import { partir } from '../src/panel/detalhes.js';

grupo('rotulo: fica o nome do controle, o resto vai para os detalhes');
{
  const r = (t) => partir(t, { rotulo: true });

  const a = r('Automatizar a rodada: envia sozinha o que as REGRAS decidem — e, com a IA ligada, o que ela escrever');
  check(a?.cabeca === 'Automatizar a rodada', 'dois-pontos: fica o nome');
  check(a?.resto.startsWith('Envia sozinha'), 'e o resto comeca com maiuscula');

  check(r('Usar a IA nas rodadas (custa por contato em que ela entra)')?.cabeca === 'Usar a IA nas rodadas',
    'parentese no FIM sai');
  check(r('Enviar automático (um clique manda a mensagem)')?.resto === 'Um clique manda a mensagem',
    'e vira o detalhe');

  const g = r('Gravar sozinho, ao abrir o contato, o que bate exato (COREDE e etiquetas de conteúdo). A cidade pergunta antes, sempre.');
  check(g?.cabeca === 'Gravar sozinho, ao abrir o contato, o que bate exato', 'frase e parentese cortados em duas passadas');
  check(g?.resto === 'COREDE e etiquetas de conteúdo. A cidade pergunta antes, sempre.', 'e os pedacos do resto nao colam sem ponto');

  check(r('Usar o dossiê do arquivo (src/data/gabinete.md)')?.resto === 'src/data/gabinete.md',
    'caminho de arquivo nao ganha maiuscula');
}

grupo('rotulo: o que NAO pode ser cortado');
{
  const r = (t) => partir(t, { rotulo: true });
  check(r('Perguntar (em vez de concluir) após quantas horas de silêncio') === null,
    'parentese no MEIO nao corta: sobraria so "Perguntar"');
  check(r('Avisar quando o template já foi enviado ao contato') === null, 'rotulo sem corte natural fica inteiro');
  check(r('Hora: 12') === null, 'dois-pontos cedo demais nao corta');
  check(partir('Usar a IA nas rodadas (custa por contato)') === null, 'fora de rotulo, o parentese final nao corta');
}

grupo('aviso: a primeira frase fica');
{
  const b = partir('NÃO há chave salva para a Anthropic (Claude) — sem ela a IA não escreve nada, e a rodada segue só com o fluxo.');
  check(b?.cabeca === 'NÃO há chave salva para a Anthropic (Claude)', 'o ESTADO fica a vista');
  check(b?.resto.startsWith('Sem ela'), 'a consequencia vai para os detalhes');
  check(partir('A avaliação por IA está DESLIGADA. O interruptor fica na aba Automatizado.')?.cabeca ===
    'A avaliação por IA está DESLIGADA.', 'fim de frase corta, com o ponto');
  check(partir('Nenhum modelo aprovado carregado.') === null, 'aviso de uma frase fica inteiro');

  const l = partir('Ligue o "Enviar automático" na aba Config: sem ele nada é enviado de verdade.');
  check(l?.cabeca === 'Ligue o "Enviar automático" na aba Config', 'dois-pontos corta aviso com cabeca que se sustenta');
  check(partir('Guardadas: Anthropic e OpenAI, as duas.') === null, 'mas nao "Guardadas:", cedo demais');
  check(partir('Variáveis: {{saudacao}} {{nome}} {{cidade}}') === null, 'nem "Variáveis:"');
  const e = partir('O reserva é o MESMO modelo do titular — repetir a mesma casa não é failsafe.');
  check(e?.cabeca === 'O reserva é o MESMO modelo do titular', 'o aviso marcado para ficar mantem o ESTADO');
}

fim();
