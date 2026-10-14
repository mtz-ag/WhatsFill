## 2026-10-14 - v3.151.0 - a opcao de concluir existia e nunca era alcancada

**Relato dele, com print:** *"nao esta concluindo"* - a plataforma marcando **"Canal removido"** em
vermelho, o atendimento dizendo *"iniciado em 01/10/2026 as 19:59 no canal null"*, e as duas caixas
da v3.150.0 marcadas.

### A causa e de ORDEM, e estava visivel no proprio print

O painel mostrava a tarja vermelha certa: *"o numero deste atendimento nao esta em nenhum candidato
(...) **A rodada nao vai tratar este contato**"*.

Essa e a **barreira do candidato**, de 25/09, e ela roda **antes** do bloco do canal removido. Como
**numero removido da conta nao esta em candidato nenhum por definicao**, ele caia em `desconhecido`
e era **pulado antes de o bloco novo existir para ele**. A opcao de concluir estava escrita, a caixa
estava marcada, e o codigo nunca chegava la.

**E o pior da forma:** a mensagem mandava *"some o numero ao candidato certo na aba Config"* - ou
seja, mandava arrumar um cadastro que **nao tem conserto**, porque o numero nao existe mais.

### O conserto

O bloco do canal removido subiu para **antes da barreira do candidato**, logo depois do `load()`. A
barreira continua certa para o que ela foi escrita: numero que existe e e de OUTRO candidato, ou que
ele ainda nao cadastrou. **Removido nao e cadastro faltando.**

Os dois lados ficaram escritos: o bloco diz por que vem antes, e a barreira diz que o removido nao
chega ate ela.

### A licao, que este projeto ja pagou tres vezes

**Guarda nova so vale onde ela e ALCANCADA.** E a mesma familia do *"excecao escrita dentro de uma
regra so vale onde aquela regra alcanca"* (09/09) e do *"a caixa pode CASAR e mesmo assim perder"*
(06/09): **medir o SINAL nao basta - tem de medir a ORDEM**. O veredito estava certo; quem decidia
era outra coisa, tres mil linhas acima.

### O que continua sendo ponto unico de falha, e foi dito a ele

A conferencia depende de ler a lista de numeros da conta pela API. Falhando a leitura, o veredito e
`nao-da-para-saber` e a rodada se comporta como antes - **de proposito**, porque concluir por erro de
rede tiraria a pessoa da fila por engano. **A plataforma mostra um selo "Canal removido" na propria
tela**, que serviria de segundo sinal sem depender da API; nao entrou porque **nao da para conferir
o seletor sem a pagina aberta**, e chutar seletor e o que este projeto nao faz.

