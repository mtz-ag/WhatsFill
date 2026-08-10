# Política de Privacidade — WhatsFill

**Última atualização:** 6 de agosto de 2026
**Contato:** thiagokcw@gmail.com

O WhatsFill é uma extensão de uso interno que auxilia o atendimento na plataforma
**mobiliza.app**. Esta política descreve exatamente o que ela acessa, o que guarda e para onde
(não) envia.

## Resumo

**Nenhum dado sai do seu navegador.** A extensão não possui servidor, não tem analytics, não
tem telemetria e não envia informação para o autor nem para terceiros. Toda comunicação é entre
o seu navegador e a plataforma que você já usa.

## O que a extensão acessa

Enquanto você está com uma aba do `mobiliza.app` aberta, e apenas nela:

| Dado | Para quê | Sai do navegador? |
|---|---|---|
| Nome, telefone e campos do contato aberto | Preencher a classificação e as variáveis das respostas | Não. Só volta para o próprio `api.mobiliza.app` |
| Mensagens recebidas do contato | Extrair cidade, nome, função e tema por regra local (regex e listas) | Não. A análise é 100% local |
| Token de acesso da sua sessão no mobiliza.app | Autenticar as chamadas à API da própria plataforma | Não. Fica **apenas em memória**, nunca é gravado em disco |
| Etiquetas e campos personalizados da conta | Sugerir e aplicar a classificação | Não |

## O que a extensão grava no seu computador

Em `chrome.storage.local`, no seu perfil do Chrome:

- respostas prontas e modelos que você cadastrou;
- tabela de grupos por cidade e regras de etiqueta;
- preferências (envio automático, largura do painel, intervalo entre envios);
- o "contrato de escrita" aprendido — o formato de requisição que a plataforma usa;
- cache da lista de municípios do RS;
- registro local de quais respostas já foram enviadas a quais contatos, para avisar duplicata.

Esses dados ficam só na sua máquina. Desinstalar a extensão os remove.

## Conexões de rede

A extensão fala com apenas dois destinos:

1. **`api.mobiliza.app`** — a API da própria plataforma que você já usa, autenticada com a sua
   sessão. É a mesma comunicação que o site faz.
2. **`servicodados.ibge.gov.br`** — uma única vez, para baixar a lista pública de municípios do
   Rio Grande do Sul (dado aberto do IBGE). Depois disso fica em cache e não é consultada de
   novo. Nenhuma informação sua é enviada nessa requisição.

Não há nenhum outro destino. Não há código carregado remotamente: todo o JavaScript executado
vem empacotado na extensão.

## Permissões e por que cada uma existe

- **`storage`** — guardar suas respostas prontas e preferências localmente.
- **`https://mobiliza.app/*`** — montar o painel dentro da página e ler o atendimento aberto.
- **`https://api.mobiliza.app/*`** — ler e gravar os dados do contato na API da plataforma.

A extensão não pede acesso a outros sites, ao histórico, aos downloads, à área de transferência
nem à sua identidade.

## Dados sensíveis

A extensão é usada em um contexto que envolve dados pessoais de terceiros (contatos de uma
campanha). Ela **não coleta** esses dados para o autor: apenas os exibe e os grava de volta na
plataforma onde já estavam. A responsabilidade pelo tratamento desses dados, nos termos da LGPD,
é do controlador que opera a conta do mobiliza.app.

## Alterações

Mudanças nesta política acompanham as versões da extensão e ficam registradas no repositório
do projeto.
