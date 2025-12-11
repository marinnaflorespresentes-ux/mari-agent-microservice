# Documentação do Fluxo n8n da Agente Mari (WhatsApp/Chatwoot)

Este documento detalha o fluxo de automação do n8n (`n8n_flow_final.json`), que orquestra a comunicação entre o Chatwoot (WhatsApp) e o Microservice Mari Agent.

## 1. Visão Geral do Fluxo

O fluxo é projetado para garantir a **sequencialidade** das mensagens por conversa (Fila), aplicar filtros de **spam** e utilizar o **Microservice** para a lógica de negócio complexa e a **Inteligência Artificial**.

| Recurso | Implementação no n8n | Detalhes |
| :--- | :--- | :--- |
| **Fila por Conversa** | Nó `Lock` (Lock/Unlock) | Garante que apenas uma mensagem por `conversation_id` seja processada por vez, evitando respostas fora de ordem. |
| **Bloqueio de Spam** | Nó `Function` (Preparar Dados) | Filtra mensagens de sistema e aplica regras básicas de bloqueio (ex: links suspeitos). |
| **Delay de Digitação** | Nó `Delay` | Simula um atraso de 1 segundo antes de enviar a resposta, melhorando a experiência do usuário (UX). |
| **Reconhecimento de Mídia** | Nó `Function` (Preparar Dados) | Extrai URLs de áudio e imagem do webhook do Chatwoot e as envia para o Microservice. |
| **Lógica de Negócio** | Nó `HTTP Request` (Microservice) | Delega a IA (linguagem, visão, áudio, recomendação), Woocommerce (carrinho, estoque) e PIX (pagamento) para o Microservice. |
| **Handoff Humano** | Nó `If` e Nó `Chatwoot` | Se o Microservice retornar `handoff_required: true`, o fluxo envia a mensagem de transferência e abre a conversa no Chatwoot. |
| **Saudação/Follow-up** | Nó `Function` (Preparar Dados/Tratamento de Resposta) | Lógica para identificar o primeiro contato e *placeholders* para agendamento de *follow-up* (ex: se o PIX não for pago). |

## 2. Configuração Necessária

Antes de importar o JSON, você deve garantir as seguintes configurações:

### 2.1. Variáveis de Ambiente do n8n

Defina a URL pública do seu Microservice Mari Agent (deployado no Coolify ou similar) como uma variável de ambiente no n8n:

| Variável | Valor |
| :--- | :--- |
| `MICROSERVICE_URL` | `https://mari-agent.coolify.app` (ou sua URL) |

### 2.2. Credenciais do Chatwoot

Você precisará de uma credencial de API do Chatwoot configurada no n8n.

1.  No n8n, vá em **Credentials**.
2.  Crie uma nova credencial do tipo **Chatwoot API**.
3.  Preencha o `Account ID`, `Access Token` e `Base URL`.
4.  O nome da credencial deve ser **"Chatwoot Mari Agent"** (ou ajuste o JSON do fluxo).

## 3. Passos para Importação e Ativação

1.  **Importar:** No seu n8n, clique em **"New"** -> **"Import from JSON"** e cole o conteúdo do arquivo `n8n_flow_final.json`.
2.  **Conectar Credenciais:** No nó **"Chatwoot: Enviar Resposta (Final)"** e **"Chatwoot: Abrir Conversa (Handoff)"**, selecione a credencial **"Chatwoot Mari Agent"**.
3.  **Ativar Webhook:** Ative o fluxo. O n8n fornecerá a URL do *webhook* para o nó **"Webhook Chatwoot (WhatsApp)"**.
4.  **Configurar Chatwoot:** No Chatwoot, vá em **Configurações -> Integrações -> Webhooks** e insira a URL do *webhook* do n8n.

## 4. Lógica de Fila (Nós Lock/Unlock)

O nó `Lock` usa o `conversation_id` como chave. Se uma nova mensagem chegar enquanto a conversa anterior ainda estiver sendo processada (entre o `Lock` e o `Unlock`), a nova mensagem será **bloqueada** até que o processamento anterior seja concluído, garantindo a ordem cronológica das respostas.

## 5. Delay de Digitação (UX)

O nó `Delay` introduz um atraso de 1 segundo. Para uma experiência mais realista, você pode adicionar um nó **Chatwoot** antes do `Delay` para enviar o status de **"digitando"** (`toggleTyping` operation), e outro nó **Chatwoot** para remover o status de **"digitando"** após o `Delay`.

## 6. Linguagem Amigável e Delicada

A **linguagem amigável e delicada** é garantida pelo *System Prompt* configurado na função `processWithAI` dentro do Microservice Mari Agent, que instrui o GPT a adotar essa persona.

---

Com este fluxo e o Microservice Mari Agent, você tem uma solução robusta e profissional para a automação de atendimento via WhatsApp.
