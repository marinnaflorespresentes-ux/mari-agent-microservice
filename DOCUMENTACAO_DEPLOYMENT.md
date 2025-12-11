# Documentação de Instalação e Deployment da Agente Mari (v2.0 - Real AI Integration)

Este documento fornece as instruções passo a passo para o *deployment* do Microservice Mari Agent, com foco no uso do **Coolify** e em um ambiente Docker.

## 1. Pré-requisitos

*   **Node.js:** Versão 20+ (para desenvolvimento local).
*   **Docker & Docker Compose:** Para *build* e execução local.
*   **Coolify:** Uma instância do Coolify configurada e acessível.
*   **n8n:** Uma instância do n8n configurada.
*   **Chatwoot:** Uma instância do Chatwoot configurada.

## 2. Configuração do Microservice (Local e Produção)

### 2.1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto, baseado no `.env.example`, e preencha as variáveis:

\`\`\`bash
# Conteúdo do .env.example
PORT=3000
NODE_ENV=production 

# Configuração de Integração com OpenAI (Obrigatório)
OPENAI_API_KEY=SUA_CHAVE_OPENAI

# Configuração de Integração com Woocommerce
WOO_CONSUMER_KEY=SEU_CONSUMER_KEY
WOO_CONSUMER_SECRET=SEU_CONSUMER_SECRET
WOO_STORE_URL=https://sua-loja.com.br

# Configuração de Integração com API de Pagamento (Exemplo: Mercado Pago)
PAYMENT_API_KEY=SUA_CHAVE_API
PAYMENT_API_SECRET=SEU_SEGREDO_API
PAYMENT_WEBHOOK_SECRET=SEGREDO_WEBHOOK_PAGAMENTO
PAYMENT_WEBHOOK_URL=URL_PUBLICA_DO_SEU_WEBHOOK_DE_PAGAMENTO

# Configuração de Segurança
WEBHOOK_SECRET=SEGREDO_COMPARTILHADO_N8N
\`\`\`

### 2.2. Instalação de Dependências (Local)

\`\`\`bash
cd mari-agent-microservice
npm install
\`\`\`

### 2.3. Execução Local

Para testar o microservice localmente:

\`\`\`bash
npm start
# Ou para desenvolvimento com reinício automático (nodemon)
npm run dev
\`\`\`

## 3. Deployment com Docker (Geral)

O projeto inclui um `Dockerfile` e um `docker-compose.yml` para facilitar o *deployment* em qualquer ambiente compatível com Docker.

### 3.1. Build da Imagem

\`\`\`bash
docker build -t mari-agent-microservice:latest .
\`\`\`

### 3.2. Execução com Docker Compose

\`\`\`bash
docker-compose up -d
\`\`\`

## 4. Deployment com Coolify (Recomendado)

O Coolify simplifica o *deployment* de aplicações baseadas em Docker.

### 4.1. Configuração do Projeto no Coolify

1.  **Conecte o Repositório:** Conecte o Coolify ao seu repositório Git (GitHub, GitLab, etc.) onde o código do microservice está hospedado.
2.  **Tipo de Aplicação:** Selecione **"Docker Compose"** ou **"Docker File"**.
    *   Se usar **Docker File**, o Coolify usará o `Dockerfile` na raiz.
    *   Se usar **Docker Compose**, o Coolify usará o `docker-compose.yml`.
3.  **Variáveis de Ambiente:** No painel do Coolify, insira todas as variáveis de ambiente listadas no `.env.example`. **Não comite o arquivo `.env` para o repositório.**
4.  **Porta:** Certifique-se de que a porta `3000` está exposta e mapeada corretamente.
5.  **Deployment:** Inicie o *deployment*. O Coolify fará o *build* da imagem e a execução do container.

### 4.2. Configuração do n8n

Após o *deployment* no Coolify, você terá uma URL pública (ex: `https://mari-agent.coolify.app`).

1.  **Variável de Ambiente no n8n:** Defina a variável de ambiente `MICROSERVICE_URL` na sua instância do n8n para a URL pública do Coolify.
    *   `MICROSERVICE_URL=https://mari-agent.coolify.app`
2.  **Importar Fluxo:** Importe o arquivo `n8n_flow_initial.json` para o seu n8n.
3.  **Configurar Credenciais:** Configure as credenciais do Chatwoot no nó "Chatwoot: Enviar Resposta" e "Chatwoot: Abrir Conversa (Handoff)".
4.  **Ativar Webhook:** Ative o fluxo. O n8n fornecerá a URL do *webhook* (ex: `https://n8n.sua-instancia.com/webhook/chatwoot-inbound`).

## 5. Integração Final com Chatwoot

1.  No Chatwoot, vá em **Configurações -> Integrações -> Webhooks**.
2.  Crie um novo *webhook* e insira a URL do *webhook* do n8n (obtida no passo 4.2).
3.  Selecione os eventos que devem disparar o *webhook* (ex: `message_created`).

Com esta configuração, o fluxo de comunicação estará completo: **Chatwoot -> n8n -> Microservice Mari Agent -> n8n -> Chatwoot**.

## 6. Exemplos de Chamadas (Para Teste)

Você pode testar o *endpoint* `/api/process-message` diretamente (após o *deployment*) usando um cliente HTTP (ex: cURL, Postman) para simular o n8n.

### 6.1. Teste de Handoff Humano

\`\`\`bash
curl -X POST https://mari-agent.coolify.app/api/process-message \\
-H "Content-Type: application/json" \\
-d '{
    "conversation_id": 999,
    "content": "Preciso falar com humano urgente",
    "attachments": []
}'
\`\`\`

### 6.2. Teste de Lógica de Negócio (Carrinho e Pagamento)

A lógica de negócio agora é baseada na **interpretação da IA**. O corpo da mensagem deve ser o mais natural possível.

\`\`\`bash
# Teste de Carrinho Real (A IA deve interpretar a intenção 'add_to_cart')
curl -X POST https://mari-agent.coolify.app/api/process-message \\
-H "Content-Type: application/json" \\
-d '{
    "conversation_id": 1000,
    "content": "Quero adicionar o tênis de corrida azul tamanho 42 ao meu carrinho",
    "attachments": []
}'

# Teste de Pagamento PIX Real (A IA deve interpretar a intenção 'initiate_payment')
curl -X POST https://mari-agent.coolify.app/api/process-message \\
-H "Content-Type: application/json" \\
-d '{
    "conversation_id": 1000,
    "content": "Quero pagar com PIX agora",
    "attachments": []
}'
\`\`\`

### 6.3. Teste de Mídia (Visão)

Para testar a visão, o Chatwoot enviaria um anexo. Simule um anexo de imagem.

\`\`\`bash
curl -X POST https://mari-agent.coolify.app/api/process-message \\
-H "Content-Type: application/json" \\
-d '{
    "conversation_id": 1001,
    "content": "O que é isso?",
    "attachments": [
        {
            "type": "image",
            "url": "https://url-publica-da-imagem.com/produto.jpg"
        }
    ]
}'
\`\`\`

### 6.2. Teste de Compliance (Bloqueio de Dados Sensíveis)

\`\`\`bash
curl -X POST https://mari-agent.coolify.app/api/process-message \\
-H "Content-Type: application/json" \\
-d '{
    "conversation_id": 999,
    "content": "Meu CPF é 123.456.789-00",
    "attachments": []
}'
# Espera-se uma resposta 400 com o aviso legal amigável.
\`\`\`

### 6.3. Teste de Health Check

\`\`\`bash
curl https://mari-agent.coolify.app/health
# Espera-se uma resposta 200 (ou 503 se degradado) com o JSON detalhado.
\`\`\`
