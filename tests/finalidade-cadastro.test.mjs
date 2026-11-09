import { mem } from './_harness.mjs';
import assert from 'node:assert/strict';
import { finalidadeCadastro, migrarFinalidadeCadastro, saudacaoNeutra } from '../src/lib/templates.js';
const antigo = 'E, se puder, me informe para eu atender melhor:';
const novo = 'Para eu salvar seu contato e melhorar o atendimento, me informe, por favor:';
mem.migracoes = { boasVindasNeutras: true };
mem.templates = [
  { id: 'boas-vindas', text: `Meu inicio\n${antigo}\nNome , Cidade`, variantes: [`Outra abertura\n${antigo}`] },
  { id: 'pessoal', text: 'Texto personalizado', extra: 42 },
];
assert.deepEqual(await migrarFinalidadeCadastro(), ['boas-vindas']);
assert.equal(mem.templates[0].text, `Meu inicio\n${novo}\nNome , Cidade`);
assert.equal(mem.templates[0].variantes[0], `Outra abertura\n${novo}`);
assert.deepEqual(mem.templates[1], { id: 'pessoal', text: 'Texto personalizado', extra: 42 });
assert.deepEqual(await migrarFinalidadeCadastro(), []);
assert.equal(finalidadeCadastro(novo), novo);
assert.equal(saudacaoNeutra(antigo), novo);
console.log('Migracao de textos e variantes, preservacao e insercao: OK');
