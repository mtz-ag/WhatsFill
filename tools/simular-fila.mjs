/**
 * simular-fila.mjs — o laço de posição do `percorrerFila`, contra uma fila que se reordena.
 *
 * Nasceu de uma pergunta dele que valia mais que um palpite: *"após a mensagem o contato voltou
 * para o topo da lista, verifique se vai pegar novamente o mesmo"*. A resposta não estava óbvia
 * no código — a posição anda por conta própria e a lista muda embaixo dela —, e responder de
 * memória seria chute sobre envio para gente real.
 *
 * Reproduz só a aritmética da posição (o resto do laço é rede, plataforma e tela). Rode quando
 * mexer em `percorrerFila`, em `continuaNaFila` ou no `visitados`.
 *
 *   node tools/simular-fila.mjs
 *
 * O que ele mostra hoje:
 *  - contato que volta ao TOPO (o que a plataforma faz): ninguém repetido, ninguém pulado;
 *  - lista que não reordena: idem;
 *  - lista embaralhada a cada volta (pior caso imaginável): ninguém repetido — `visitados`
 *    segura —, mas ALGUÉM FICA PARA TRÁS. É por isso que o veredito da rodada conta quantos da
 *    lista não chegaram a ser abertos.
 */

const SAI_DA_FILA = new Set(['triado', 'concluido']);

function rodar({ fila, limite = 100, reordena, processar }) {
  const visitados = new Set();
  let posicao = 0, enviados = 0, aberturas = 0;
  const ordem = [];
  let lista = [...fila];

  while (enviados < limite) {
    if (posicao >= lista.length) return { ordem, enviados, aberturas, fim: `fila acabou em ${posicao}` };
    const id = lista[posicao];
    aberturas++;

    if (visitados.has(id)) { posicao++; continue; }
    visitados.add(id);

    const r = processar(id);
    ordem.push(id);
    if (r.resultado === 'enviado') enviados++;
    lista = reordena(lista, id, r);

    if (r.resultado === 'enviado' && r.continuaNaFila) posicao++;
    else if (r.resultado !== 'enviado' && !SAI_DA_FILA.has(r.resultado)) posicao++;
  }
  return { ordem, enviados, aberturas, fim: 'limite' };
}

// A plataforma: concluir de novo joga o contato para o topo (mais recente primeiro).
const paraOTopo = (lista, id) => [id, ...lista.filter((x) => x !== id)];
const naoMexe = (lista) => lista;

const fila = ['A', 'B', 'C', 'D', 'E', 'F'];

for (const [nome, reordena] of [['volta para o TOPO', paraOTopo], ['lista NÃO reordena', naoMexe]]) {
  const r = rodar({ fila, reordena, processar: () => ({ resultado: 'enviado', continuaNaFila: true }) });
  const repetidos = r.ordem.filter((x, i) => r.ordem.indexOf(x) !== i);
  const faltando = fila.filter((x) => !r.ordem.includes(x));
  console.log(`\n${nome}`);
  console.log(`  ordem visitada: ${r.ordem.join(' → ')}`);
  console.log(`  repetidos: ${repetidos.length ? repetidos.join(',') : '(nenhum)'}`);
  console.log(`  pulados:   ${faltando.length ? faltando.join(',') : '(nenhum)'}`);
  console.log(`  aberturas: ${r.aberturas} para ${fila.length} contatos`);
}

// E se a plataforma reordenar de um jeito que eu não previ? (embaralha tudo a cada volta)
let semente = 7;
const embaralha = (lista) => {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    const j = semente % (i + 1);
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
};
const r = rodar({ fila, reordena: embaralha, processar: () => ({ resultado: 'enviado', continuaNaFila: true }) });
console.log('\nlista embaralhada a cada volta (pior caso)');
console.log(`  ordem visitada: ${r.ordem.join(' → ')}`);
console.log(`  repetidos: ${r.ordem.filter((x, i) => r.ordem.indexOf(x) !== i).join(',') || '(nenhum)'}`);
console.log(`  pulados:   ${fila.filter((x) => !r.ordem.includes(x)).join(',') || '(nenhum)'}`);
console.log(`  fim: ${r.fim}`);
