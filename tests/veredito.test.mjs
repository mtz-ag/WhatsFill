/**
 * O VEREDITO da rodada conta CONTATOS, nunca linhas de serviço (03/11/2026).
 *
 * O caso real, medido numa rodada das Minhas: o veredito disse *"0 enviado(s), 14 pulado(s)"* com
 * **cinco** contatos pulados no Andamento — e antes disso, *"2 pulado(s)"* numa rodada que tocou
 * um contato só. Sempre o dobro, e a causa é que `resultado: 'pulado'` virou o rótulo genérico de
 * linha informativa: o custo de cada chamada da IA, o aviso do keepalive, o status do canal, o
 * "carreguei mais da fila" e o próprio botão Parar entram no log com ele.
 *
 * O veredito é justamente a linha que deveria distinguir *"a rodada trabalhou"* de *"a rodada não
 * conseguiu fazer nada"* (25/09). Inflado, ele deixa de distinguir.
 *
 * O que este arquivo trava é a parte que ENVELHECE: a lista de nomes de serviço. Linha de serviço
 * nova com nome novo volta a ser contada como gente, e nada na tela avisa — então o teste varre os
 * nomes fixos de `registrarNaRodada` no próprio `panel.js` e exige que cada um esteja na lista.
 *
 * Rode: node tests/veredito.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim } from './_harness.mjs';

const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');

/** A lista declarada no painel, lida do código — não copiada para cá. */
const declarados = (() => {
  const i = painel.indexOf('const NOMES_DE_SERVICO = new Set([');
  if (i < 0) return null;
  const bloco = painel.slice(i, painel.indexOf(']);', i));
  return new Set([...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]));
})();

{
  grupo('a lista de nomes de serviço existe e é usada pela conta');

  check(!!declarados && declarados.size > 0, `achei NOMES_DE_SERVICO (${declarados ? declarados.size : 0} nomes)`);
  check(declarados.has('IA'), 'a linha da IA é serviço — é ela que dobrava a conta');
  check(declarados.has('rodada'), 'a linha da própria rodada é serviço (keepalive, Parar, avisos)');

  /** O filtro tem de estar na conta do veredito, senão a lista não decide nada. */
  check(/const conta = \(tipo\) => state\.auto\.log\.filter\(\(l\) => l\.resultado === tipo && !ehLinhaDeServico\(l\)\)/.test(painel),
    'o veredito conta só o que NÃO é linha de serviço');

  /** E no motivo dominante, que é a outra leitura dos pulados. */
  check(/l\.resultado === 'pulado' && l\.motivo && !ehLinhaDeServico\(l\)/.test(painel),
    'o motivo dominante também ignora as linhas de serviço');
}

{
  grupo('nenhum nome fixo de registrarNaRodada ficou de fora da lista');

  /**
   * Os dois formatos que o painel usa: tudo numa linha e o nome na linha seguinte ao `(`.
   * Nome vindo de variável (o contato) não casa com nenhum dos dois, que é o que queremos.
   */
  const fixos = new Set([
    ...[...painel.matchAll(/registrarNaRodada\('([^']+)'/g)].map((m) => m[1]),
    ...[...painel.matchAll(/registrarNaRodada\(\s*\n\s*'([^']+)',/g)].map((m) => m[1]),
  ]);

  check(fixos.size >= 7, `achei os nomes fixos do log (${fixos.size})`);

  for (const nome of fixos) {
    check(declarados.has(nome),
      `"${nome}" está em NOMES_DE_SERVICO — senão volta a contar como contato pulado`);
  }

  /**
   * E o contrário: nome na lista que ninguém mais registra é lista envelhecendo para o outro lado.
   * Não derruba o teste por si — é aviso —, mas um nome a mais esconderia um contato de verdade
   * se algum dia alguém se chamasse assim.
   */
  const orfaos = [...declarados].filter((n) => !fixos.has(n));
  check(orfaos.length === 0, `nenhum nome sobrando na lista${orfaos.length ? ` (sobrou: ${orfaos.join(', ')})` : ''}`);
}

fim();
