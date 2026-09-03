/**
 * exportar-fluxo.mjs — escreve o FLUXO PADRÃO atual num arquivo que a janela do fluxo importa.
 *
 * **Por que isto existe.** O quadro de trabalho dele é uma **cópia** do padrão, e nada entra nela
 * sozinho — no quadro a posição é a prioridade, e enfiar caixa por conta própria mudaria a rodada
 * sem ninguém escolher onde. A consequência é que toda melhoria no `fluxoPadrao` fica invisível
 * para ele até que alguém a leve. Em 03/09/2026 isso custou duas prints do mesmo defeito no mesmo
 * dia: a regra que o impedia existia e não alcançava o quadro dele.
 *
 * Pedido dele, no mesmo dia: *"arrume o ramo, eu vou importar. Todas as mudanças feitas aqui, se
 * afetarem o ramo, você deve me passar o ramo atual"*.
 *
 * **É um gerador, não um retrato guardado.** Snapshot commitado envelhece no primeiro commit que
 * mexe no `fluxoPadrao`, e um arquivo de fluxo velho é pior que nenhum: ele reimporta e volta no
 * tempo sem perceber. Aqui o arquivo é sempre o de agora.
 *
 * O arquivo sai FORA do repositório de propósito: a pasta do repositório é a extensão que o Chrome
 * carrega.
 *
 * Rode:
 *   node tools/exportar-fluxo.mjs [caminho-de-saida.json]
 */
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import * as arv from '../src/lib/arvore.js';

const versao = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')).version;
const saida = process.argv[2] || `fluxo-padrao-${versao}.json`;

const arvore = arv.arrumar(arv.fluxoPadrao());
const arquivo = arv.paraArquivo({ arvore, teclas: {} }, `fluxo padrão ${versao}`);

/**
 * **Confere relendo, antes de entregar.** É a mesma disciplina da escrita no CRM: a peneira do
 * `deArquivo` descarta regra que sumiu do código, sinal desconhecido e tecla inventada — e um
 * arquivo que perde ramos na importação chegaria a ele como "o fluxo veio faltando pedaço".
 */
const volta = arv.deArquivo(JSON.stringify(arquivo));
if (!volta.ok) {
  console.error(`o arquivo gerado não passa na própria peneira: ${volta.erro}`);
  process.exit(1);
}

const antes = arv.todosOsNos(arvore).length;
const depois = arv.todosOsNos(volta.arvore).length;
const problemas = arv.problemas(volta.arvore);

writeFileSync(saida, JSON.stringify(arquivo, null, 2), 'utf8');

console.log(`\n${saida}`);
console.log(`  ${antes} caixa(s)` + (depois === antes ? ', todas sobrevivem à importação' : ` → ${depois} depois da peneira (PERDEU ${antes - depois})`));
if (volta.avisos?.length) for (const a of volta.avisos) console.log(`  ⚠ ${a}`);
console.log(problemas.length ? `  ⚠ ${problemas.length} problema(s) no quadro` : '  sem problemas no quadro');

if (depois !== antes || problemas.length) process.exit(1);

console.log('\n--- o fluxo em texto, para conferir antes de mandar ---\n');
console.log(arv.paraTexto(arvore));
