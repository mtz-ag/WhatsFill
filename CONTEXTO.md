# Contexto para outra sessão — WhatsFill

Cole isto (ou aponte para este arquivo) numa aba nova do Claude. Ele existe para a próxima
sessão não redescobrir o que já foi decidido, nem "consertar" o que já está consertado.

---

## 1. Antes de qualquer coisa: você está olhando o código certo?

O trabalho de 09 a 12/08/2026 está em:

- repositório **`github.com/mtz-ag/WhatsFill`**
- branch **`claude/extensao-claude-analise-i9spxw`** (é o único branch; **não existe `main`**)

**A pasta local do Thiago pode estar desatualizada.** Confira antes de mexer — dois marcadores
que só existem na versão nova:

```bash
ls tools/simular-fila.mjs          # existe? então a pasta está atualizada
grep -c "primeiro_nome" src/lib/store.js   # tem que dar 0
```

Se der errado, é código velho: qualquer análise vai apontar bugs já corrigidos.

> Nota: o `registro.md` menciona `github.com/thiagokcw-coder/WhatsFill`, que é o repositório
> original dele. O trabalho recente está no `mtz-ag`, acima.

---

## 2. O que é a extensão, em cinco linhas

Extensão Chrome (MV3, JavaScript puro, **sem build step**) que acelera o atendimento político
no **mobiliza.app**: lê o que o contato escreveu, classifica (nome, cidade, COREDE, etiquetas),
grava no CRM e envia respostas prontas ou modelos aprovados. Painel encaixado na borda direita.

**Leia, nesta ordem, antes de implementar qualquer coisa:** `registro.md` (log de decisões, o
mais recente no topo), `CLAUDE.md` (regras e armadilhas — é curto de propósito) e `README.md`.

---

## 3. O laço de trabalho hoje — três rodadas na aba Automatizado

1. **Novos: pedir os dados** — assume, manda o formulário (nome/cidade/link de grupo), conclui.
2. **Conferir e responder a fila** ("Meus" e "Outros") — classifica e **pergunta contato a
   contato**. Teclas: `1` modelo do conteúdo, `2` pular, `3` concluir, `4` agradecer
   informações, `5` mensagem do momento, `6` responder à mão, `7` perguntar interesse + pedir
   dados, `Esc` parar. Conclui sozinho **só** quem foi respondido há menos de 12h.
3. **Sem retorno: reabrir e perguntar** — sobre a lista de **concluídos** filtrada por ele:
   Reiniciar → modelo aprovado → concluir → volta para a lista → próximo.

---

## 4. O que mudou nesta leva (20 commits) — em uma linha cada

**Parser e cidade**
- "Capitão Martim" casava com o município **Capitão**, com confiança `exata` (a que grava sem
  clique). Duas travas em `cities.js`. **Contatos já gravados com cidade Capitão estão errados.**
- "Rio Grande do Sul" casava com a cidade **Rio Grande**.
- Encurtamento de uma palavra passa a valer ("Caxias" → Caxias do Sul), exata só quando é a
  resposta inteira.
- Sigla sai do nome ("Jeane do PL" → "Jeane"); "srn" (sem vogal) deixa de virar nome.
- Mensagem que é **só** o nome do município conta como informada e **substitui** a cidade do
  CRM, trocando a etiqueta de COREDE junto.
- Cadastro "Nome - Cidade" passa a ser lido (antes só "Cidade - Nome").

**Respostas**
- **Nenhuma resposta chama o contato pelo nome.** Regra do projeto, com migração que reescreve
  as já salvas. O nome do CRM erra demais e ainda bloqueia o envio quando falta.
- Pergunta dos grupos pede o **link de convite**, não o nome.
- Pergunta de interesse pede **"Sim / Nome completo / Cidade"** na mesma mensagem.

**Rodada**
- Pergunta **arrastável**, sem escurecer nem bloquear a conversa; respostas rápidas dentro dela.
- Atalho de tecla ignora evento vindo de campo de texto (senão o "2" digitado conclui alguém).
- `chrome.power` impede o **computador** de suspender (o áudio só impedia a aba de congelar).
- Anti-duplicata passou a ser **por contato** (olhando a conversa), não por modelo — era o que
  deixava a mesma pessoa receber resposta pronta e modelo em 32 minutos.
- Conclusão automática só para quem foi respondido há pouco; silêncio longo **para e pergunta**.

**Sinais de tela (`dom.js`)**
- "Concluído" tem **dois** retratos, e um deles não tem botão "Reiniciar".
- A lista de concluídos é o único gancho de fila **sem `data-cy` conhecido** — a rodada
  descobre por tentativa verificada.

---

## 5. Pendências que dependem do Thiago (nenhuma é código)

1. **`data-cy` da lista de concluídos.** Aba Automatizado → botão **"Achar a lista de
   concluídos"** → mandar o texto que aparece. Com ele, `CY_CONCLUIDOS` em `dom.js` deixa de
   depender de tentativa.
2. **"Etiquetas quando responder sim"** (aba Config) está **vazio**. Enquanto estiver, quem
   responde "sim" à pergunta de interesse não recebe etiqueta nenhuma.
3. **Tabela "Modelo por conteúdo"** (aba Config) está vazia — é o pré-requisito da tecla 1.
4. **Rever na base os contatos com cidade "Capitão"** — vieram do anúncio, não moram lá.
5. **Diálogo de "motivo de conclusão"** da plataforma trava a rodada no primeiro contato. Ou
   desliga na plataforma, ou ele decide um motivo padrão para a rodada escolher.

---

## 6. O que fazer primeiro se esta sessão tiver acesso ao navegador

Isto é o que a sessão remota **não** consegue fazer, e é onde ela mais ajuda:

1. Abrir o mobiliza com a extensão carregada, aba Automatizado → **"Achar a lista de
   concluídos"** e anotar o `data-cy` do ícone de caixa ao lado de "Outros".
2. Rodar a rodada "Sem retorno" com **limite 2** e relatar em que passo ela para.
3. Conferir os sinais de tela: `node tools/checar-dom.mjs` (precisa de Playwright).

---

## 7. Como saber que não quebrou nada

```bash
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && \
node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs
```

Seis suítes, Node puro, sem dependência, **offline**. Fora delas (precisam de navegador):
`tools/checar-dom.mjs` (sinais de tela), `tools/checar-pergunta.mjs` (a caixa da rodada não
pode voltar a bloquear a conversa), `tools/simular-fila.mjs` (o laço de posição da fila).

---

## 8. As regras que não se negociam

Estão inteiras no `CLAUDE.md`. As que mais custaram:

- **Dados reais de eleitores; toda escrita é em produção.** Contato de teste: "Thiago Tim".
- **Sem IA na extração.** Parser determinístico. Na dúvida, **recusar com o motivo na tela**.
- **Nunca sobrescrever o CRM**, com uma exceção: a cidade que a própria pessoa informou.
- **Escolha explícita dele não se substitui por dedução**, nem quando a dedução está certa.
- **Regra que trata dois contatos de forma diferente tem que dizer o porquê na tela** — senão
  vira "alguns funcionam e outros não".
- **Nunca escrever telefone ou nome real de eleitor** em arquivo do repositório.
- Commits em português sem acentos, `tipo(escopo): resumo`, e **todo commit leva o
  `registro.md` junto**.

---

## 9. O que a sessão remota não alcança

Container na nuvem: sem acesso ao Chrome dele, sem `mobiliza.app` (bloqueado pela rede) e sem
`servicodados.ibge.gov.br`. Por isso os testes rodam offline e o diagnóstico de tela depende de
print ou de uma sessão local. Isso **não** impede ler código, achar causa raiz e corrigir — foi
assim que saíram os 20 commits desta leva.
