## 2026-10-19 - v3.175.0 - ESTADO DE AGORA - o Facebook pelo DOM: a base, medida na pagina de verdade

**Pergunta dele:** *"vamos continuar com o facebook, qual o proximo passo?"*

O caminho do DOM estava parado em duas medicoes que eu dizia que so ele podia dar. **Fiz as duas
sozinho**, no Chrome dele, que continua logado como a propria pagina do Capitao Martim — e a
segunda, a que eu tinha pedido permissao para fazer, era o unico bloqueio de verdade.

### O que entrou

- **`src/lib/dom-facebook.js`** — o irmao do `dom.js`: o UNICO arquivo que sabe como a pagina do
  Facebook e montada por dentro. Cabecalho com os doze fatos medidos, cada um com o que ele impede.
- **`tests/dom-facebook.test.mjs`** — 45 assercoes, a suite **23**. Protege quem FICA SEM RESPOSTA.

**Nada chama a lib ainda** — e de proposito, e esta escrito aqui para nao virar codigo orfao: o
chamador e o content script no `facebook.com`, que ainda nao existe. Ver *O que falta* no fim.

### As medicoes, todas na pagina dele

**O `aria-label` e a camada estavel, e ele da o sinal que eu nao sabia como ler.** Comentario e
resposta sao os dois `[role="article"][aria-label]`, em duas formas:

```
Comentario de <AUTOR> ha <TEMPO>
Resposta de <AUTOR> ao comentario de <PAI> ha <TEMPO>
```

A forma da resposta **nomeia o comentario-pai** — e dai sai *"este comentario ja foi respondido"*,
o equivalente ao `from.id === pageId` da Graph API.

**RESPOSTA DE TERCEIRO NAO CONTA, e isso apareceu medido:** ha *"Resposta de \<um eleitor\> ao
comentario de \<outro eleitor\>"* na pagina. Tratar como nossa deixaria o eleitor sem resposta
**parecendo atendido** — o defeito que nao se ve. O que separa e o NOME DA PAGINA, e ele se le do
proprio DOM, sem token nenhum: o composer e `aria-label="Comente como <NOME DA PAGINA>"`.

**INSERIR FUNCIONA, APAGAR NAO.** Era o bloqueio. `document.execCommand('insertText')` com o cursor
colapsado no fim **entra e preserva a mencao** — medido com texto neutro, sem nunca disparar Enter,
e conferido depois que nada foi publicado. No mesmo teste: `selectAll` + `delete` **nao apagou
nada**, e `delete` colapsado comeu **um caractere de CADA ponta**. Por isso a lib **nao limpa
caixa**: ela so acrescenta, e quem desfaz e ele. Para limpar de verdade o unico caminho medido e
recarregar a pagina.

**A CAIXA JA VEM COM A MENCAO DENTRO.** Clicar em "Responder" abre
`[contenteditable][data-lexical-editor][aria-label="Responder a <AUTOR>"]`, ja focada e **ja
contendo o nome da pessoa**. Escrever ali e ACRESCENTAR: atribuir apagaria a mencao e a resposta
sairia sem marcar ninguem.

**HA VARIAS CAIXAS NA TELA.** Medidas tres ao mesmo tempo (a da resposta e dois composters de posts
diferentes). `querySelector('[contenteditable]')` pega a errada — **a caixa certa se acha pelo NOME
no `aria-label`**, e e por isso que `caixaDeResposta` recebe o autor.

**O DOM E VIRTUALIZADO, e isso mata o desenho que eu tinha em mente.** No feed da pagina **nunca
mais de QUATRO** comentarios existem na arvore ao mesmo tempo (12 acumulados em 14 rolagens), e dos
30 posts com `aria-posinset` quase todos estao **vazios**. Nao ha como montar "todos os comentarios
sem resposta" pelo feed. **A rodada trabalha no POST ABERTO** — que e exatamente o que ele descreveu
em 16/10 (*"eu abro o post e mando a extensao inserir o texto na caixa de resposta"*).

**"MAIS RELEVANTES" E O PADRAO E ESCONDE GENTE.** No post aberto o botao de comentar dizia **5** e o
DOM tinha **4**. Por isso `contagemDoPost` e `ordenacaoEsconde` existem: a lista nunca e afirmada
como completa.

**A IDENTIDADE e o `comment_id`, e ele e BASE64**, nao numero — `comment:<post>_<comentario>`
codificado. Serve para comparar e nunca para fazer conta. O `aria-label` **nao** e identidade: ele
carrega o tempo, que muda sozinho (*"Ha 4 minutos"* vira *"ha uma hora"*).

### Dois erros meus, os dois registrados no codigo

**Peguei o primeiro href com `comment_id` para abrir o post e cai no perfil de uma eleitora.** O
`comment_id` esta nos **TRES** links do article — a foto, o nome e o carimbo de hora —, e **so o
carimbo** tem o post no pathname. O link do nome serve para identificar e nunca para abrir.

**E o carimbo com o caminho do post SO EXISTE NO FEED:** nos quatro comentarios do post aberto
`linkDoPost` devolveu null, porque ali os links sao so de perfil e o permalink do post e a propria
URL. Dai `postDaPagina()` e `postDoComentario()`, numa funcao so.

### O que o TESTE pegou e a medicao nao

Eu medi um **reel**, que mora na raiz (`/reel/<id>`), e escrevi o padrao exigindo a raiz. **O post
comum de foto e texto da pagina mora embaixo dela** (`/capitaomartim/posts/<id>`) e ficaria de fora
— a forma mais comum de todas. Hoje o padrao casa as duas, e o segmento tem de ser inteiro, senao
um perfil chamado `/joana.videos.123` passaria por post.

### Validado contra o DOM real, nao so no teste

As consultas foram rodadas na pagina: `nomeDaPagina` deu **"Capitao Martim"**, `somosAdmin` **true**
(o menu *"Excluir, ocultar ou denunciar"* so existe para quem administra), `contagemDoPost` **5**,
`ordenacaoEsconde` **true**, e o id e o botao "Responder" foram achados nos **quatro de quatro**
comentarios. O unico que falhou foi `linkDoPost`, pelo motivo acima, que virou funcao nova.

### O que falta, e e tudo meu menos uma linha

1. **O manifesto.** A extensao so roda em `mobiliza.app` — content script, recursos, tudo. O
   Facebook precisa de `content_scripts` e `web_accessible_resources` proprios, e **o Chrome vai
   pedir a permissao do host novo a ele** quando recarregar a extensao.
2. **O painel na aba do Facebook.** O painel de hoje vive na aba do mobiliza e depende da API dele;
   o do Facebook e outro, enxuto, encaixado na aba do Facebook. E a unica forma coerente: ler o DOM
   do Facebook exige estar nele.
3. **A rodada:** proximo comentario sem resposta nossa -> rascunho da IA pelo worker -> inserir ->
   esperar ELE enviar -> proximo. A espera reusa `esperarVoceConcluir`, que ja trata "a tela e
   dele".
4. **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando o caminho do DOM funcionar.
   Enquanto as duas existirem, a de cima e a que ele escolheu.

**O que ele precisa fazer na mao:** nada agora. Quando o item 1 entrar, recarregar a extensao e
aceitar a permissao do `facebook.com`.
