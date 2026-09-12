/**
 * exportar-fluxo.mjs — escreve o FLUXO PADRÃO atual no arquivo que a janela do fluxo importa.
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
 * **O arquivo é VERSIONADO desde 12/09/2026, a pedido dele** (*"o fluxo ficou fora do GitHub"*).
 * Até então a saída ia para fora do repositório, com o argumento de que retrato commitado envelhece
 * — *"ele reimporta e volta no tempo sem perceber"*. O argumento era verdadeiro e deixou de ser: o
 * `tests/arvore.test.mjs` confere que `SAIDA` é o `fluxoPadrao` de agora, então **arquivo velho não
 * passa nos testes**. O que sobrava contra era o arquivo ficar junto da extensão que o Chrome
 * carrega, e um `.json` em `tools/` não atrapalha nada (o que quebra o carregamento é nome
 * começando com `_`, na RAIZ).
 *
 * Rode:
 *   node tools/exportar-fluxo.mjs              escreve tools/fluxo-padrao.json
 *   node tools/exportar-fluxo.mjs --conferir   só confere, não escreve (é o que o teste chama)
 *   node tools/exportar-fluxo.mjs <caminho>    escreve noutro lugar (para mandar a ele à mão)
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as arv from '../src/lib/arvore.js';

/** O arquivo versionado. Caminho FIXO de propósito: é o link que ele guarda. */
export const SAIDA = new URL('./fluxo-padrao.json', import.meta.url);

const versao = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')).version;

/**
 * **Ids estáveis nas caixas de AGRUPAMENTO.** As caixas de regra já nascem com id falante
 * (`r:conteudo-pedido:chegada`); as que só agrupam recebiam `novoId()`, que carrega o relógio —
 * então dois exports do mesmo quadro davam arquivos diferentes e o `git diff` acusava mudança onde
 * não houve nenhuma. Com o id derivado do rótulo, **o diff só mexe quando o quadro mexe**, que é o
 * que torna o arquivo versionado útil: dá para ver no GitHub o que mudou no fluxo.
 *
 * Não foi feito dentro de `arvore.fluxoPadrao()` de propósito — aquilo é documento dele.
 */
function idsEstaveis(arvore) {
  const usados = new Set();
  const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'grupo';
  const anda = (nos) => {
    for (const no of nos) {
      if (/^n[0-9a-z]+$/.test(no.id)) {
        const base = `g:${slug(no.rotulo)}`;
        let id = base;
        for (let n = 2; usados.has(id); n += 1) id = `${base}-${n}`;
        no.id = id;
      }
      usados.add(no.id);
      anda(no.filhos || []);
    }
  };
  anda(arvore);
  return arvore;
}

/** O arquivo de agora, pronto para escrever ou comparar. */
export function gerar() {
  const arvore = idsEstaveis(arv.arrumar(arv.fluxoPadrao()));
  // A versão vai em campo PRÓPRIO, e não só no nome: o nome é texto que ele pode reescrever, e a
  // janela precisa dela para dizer de quando é o quadro que está no ar.
  return arv.paraArquivo({ arvore, teclas: {} }, `fluxo padrão ${versao}`, versao);
}

/**
 * **O quadro do arquivo é o do código?** Compara só a ÁRVORE: o carimbo da versão não entra, senão
 * todo `manifest.json` novo obrigaria a regerar um arquivo que não mudou — e o carimbo passaria a
 * mentir sobre quando o quadro mudou, que é justamente o que ele quer ler ali.
 */
export function conferir() {
  if (!existsSync(SAIDA)) return { ok: false, erro: 'o arquivo do fluxo não existe — rode node tools/exportar-fluxo.mjs' };
  let noDisco;
  try {
    noDisco = JSON.parse(readFileSync(SAIDA, 'utf8'));
  } catch (e) {
    return { ok: false, erro: `o arquivo do fluxo não é JSON válido: ${e.message}` };
  }
  const agora = gerar();
  if (JSON.stringify(noDisco.arvore) !== JSON.stringify(agora.arvore)) {
    return { ok: false, erro: 'o quadro do codigo mudou e o arquivo nao — rode node tools/exportar-fluxo.mjs e commite' };
  }
  return { ok: true, extensao: noDisco.extensao };
}

// ---- linha de comando -------------------------------------------------------

const chamadoDireto = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (chamadoDireto) {
  const arg = process.argv[2];

  if (arg === '--conferir') {
    const r = conferir();
    console.log(r.ok ? `tools/fluxo-padrao.json em dia (carimbado ${r.extensao})` : `⚠ ${r.erro}`);
    process.exit(r.ok ? 0 : 1);
  }

  const arquivo = gerar();
  const saida = arg ? arg : SAIDA;

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

  const antes = arv.todosOsNos(arquivo.arvore).length;
  const depois = arv.todosOsNos(volta.arvore).length;
  const problemas = arv.problemas(volta.arvore);

  writeFileSync(saida, JSON.stringify(arquivo, null, 2), 'utf8');

  console.log(`\n${typeof saida === 'string' ? saida : 'tools/fluxo-padrao.json'}`);
  console.log(`  ${antes} caixa(s)` + (depois === antes ? ', todas sobrevivem à importação' : ` → ${depois} depois da peneira (PERDEU ${antes - depois})`));
  if (volta.avisos?.length) for (const a of volta.avisos) console.log(`  ⚠ ${a}`);
  console.log(problemas.length ? `  ⚠ ${problemas.length} problema(s) no quadro` : '  sem problemas no quadro');

  if (depois !== antes || problemas.length) process.exit(1);

  console.log('\n--- o fluxo em texto, para conferir antes de mandar ---\n');
  console.log(arv.paraTexto(arquivo.arvore));
}
