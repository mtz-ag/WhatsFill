/**
 * Testa o guarda-corpo principal do envio: nunca mandar template com variável não
 * resolvida (em especial {{link_grupo}}).
 *
 * Rode: node tests/vars.test.mjs
 */

import { check, grupo, fim, lib, mem } from './_harness.mjs';

const vars = await lib('vars.js');

// Dados fictícios de propósito: teste nenhum carrega contato real de eleitor.
const contact = { name: 'Ana Paula Ribeiro', phonenumberFormatted: '(51) 90000-0001' };
const TEMPLATE = 'Prontinho, {{primeiro_nome}}! Grupo de {{cidade}}:\n{{link_grupo}}';

grupo('sem cidade classificada → bloqueia');
{
  const r = vars.render(TEMPLATE, await vars.buildContext({ contact, cidade: '' }));
  check(r.missing.includes('cidade') && r.missing.includes('link_grupo'), `faltando = ${JSON.stringify(r.missing)}`);
  check(r.text.includes('{{link_grupo}}'), 'marcador continua visível no preview');
  check(/Cidade ainda não classificada/.test(vars.explainMissing(r.missing, r.reasons)), 'motivo explica o bloqueio');
}

grupo('cidade sem grupo e sem link padrão → bloqueia');
{
  mem.cityLinks = {};
  mem.defaultGroupLink = '';
  const r = vars.render(TEMPLATE, await vars.buildContext({ contact, cidade: 'Pelotas' }));
  check(r.missing.includes('link_grupo') && !r.missing.includes('cidade'), `faltando = ${JSON.stringify(r.missing)}`);
  check(/Sem grupo cadastrado para "Pelotas"/.test(vars.explainMissing(r.missing, r.reasons)), 'motivo nomeia a cidade');
}

grupo('cidade com grupo → libera e interpola');
{
  mem.cityLinks = { 'santo angelo': { label: 'Santo Ângelo', link: 'https://chat.whatsapp.com/AAA' } };
  const r = vars.render(TEMPLATE, await vars.buildContext({ contact, cidade: 'Santo Ângelo' }));
  check(r.missing.length === 0, 'nada faltando');
  check(r.text.startsWith('Prontinho, Ana!'), `primeiro nome = ${r.text.split('\n')[0]}`);
  check(r.text.includes('https://chat.whatsapp.com/AAA'), 'link entrou');
  check(!/\{\{/.test(r.text), 'nenhum marcador sobrou');
}

grupo('variável desconhecida');
{
  const r = vars.render('Oi {{nao_existe}}', await vars.buildContext({ contact, cidade: 'Santo Ângelo' }));
  check(r.missing.includes('nao_existe'), 'entra na lista de faltantes');
}

grupo('nome de cadastro do anúncio nunca vira saudação');
{
  // Contato que chega do anúncio: o CRM cadastra assim.
  const novo = { name: '[NOVO] (11) 95213-4567', phonenumberFormatted: '(11) 95213-4567' };
  check(vars.looksLikePlaceholder('[NOVO] (11) 95213-4567'), 'reconhece "[NOVO] ..."');
  check(vars.looksLikePlaceholder('NOVO'), 'reconhece "NOVO"');
  check(vars.looksLikePlaceholder('(51) 99999-9999'), 'reconhece nome que é só telefone');
  check(vars.looksLikePlaceholder(''), 'reconhece vazio');
  check(!vars.looksLikePlaceholder('Thiago Tim'), 'nome de verdade não é apelido automático');

  const r = vars.render('{{saudacao}}, {{primeiro_nome}}!', await vars.buildContext({ contact: novo }));
  check(!r.text.includes('NOVO'), `não escreveu "NOVO" na mensagem: ${JSON.stringify(r.text)}`);
  check(r.missing.includes('primeiro_nome'), 'bloqueia o envio em vez de mandar errado');
  check(
    /apelido automático/.test(vars.explainMissing(r.missing, r.reasons)),
    `motivo = ${vars.explainMissing(r.missing, r.reasons)}`
  );
}

grupo('nome informado pelo contato tem prioridade sobre o cadastro');
{
  const novo = { name: '[NOVO] (51) 90000-0002' };
  const ctx = await vars.buildContext({ contact: novo, nome: 'Thiago Kellermann' });
  const r = vars.render('{{saudacao}}, {{primeiro_nome}}!', ctx);
  check(r.missing.length === 0, 'liberado');
  check(/, Thiago!$/.test(r.text), `usou o nome informado = ${JSON.stringify(r.text)}`);
}

grupo('motivo repetido não aparece duas vezes');
{
  const r = vars.render('{{nome}} {{primeiro_nome}}', await vars.buildContext({ contact: { name: '[NOVO] x' } }));
  const motivo = vars.explainMissing(r.missing, r.reasons);
  check((motivo.match(/apelido automático/g) || []).length === 1, `mensagem enxuta = ${motivo}`);
}

grupo('nome do perfil do WhatsApp não vence o nome que a pessoa escreveu');
{
  const { nomeVeioDoPerfil } = await lib('vars.js');

  // Caso real: cadastro "Zane" (nome do perfil) e a pessoa respondeu "Rosane Requia". O
  // agradecimento sairia "Obrigado pela atenção, Zane!".
  check(nomeVeioDoPerfil({ name: 'Zane', nameWhatsapp: 'Zane' }), 'cadastro igual ao perfil = veio do perfil');
  check(nomeVeioDoPerfil({ name: 'zane', nameWhatsapp: 'Zane' }), 'diferença de caixa não engana');
  check(nomeVeioDoPerfil({ name: 'José', nameWhatsapp: 'Jose' }), 'diferença de acento não engana');

  // Nome que um operador digitou tem que continuar ganhando do palpite.
  check(!nomeVeioDoPerfil({ name: 'Rosane Requia', nameWhatsapp: 'Zane' }), 'cadastro curado não é do perfil');
  check(!nomeVeioDoPerfil({ name: 'Zane', nameWhatsapp: '' }), 'sem nome de perfil não dá para afirmar');
  check(!nomeVeioDoPerfil({}), 'contato sem nome nenhum não quebra');
}

grupo('saudação por horário');
check(vars.saudacao(new Date(2026, 7, 5, 9)) === 'Bom dia', 'manhã');
check(vars.saudacao(new Date(2026, 7, 5, 15)) === 'Boa tarde', 'tarde');
check(vars.saudacao(new Date(2026, 7, 5, 21)) === 'Boa noite', 'noite');

fim();
