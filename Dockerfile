# Dockerfile para o Microservice Mari Agent (Node.js)

# Usa a imagem oficial do Node.js como base
FROM node:20-slim

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos package.json e package-lock.json (se existir)
# para instalar as dependências
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install --omit=dev

# Copia o restante do código-fonte
COPY . .

# Expõe a porta que o aplicativo escuta
EXPOSE 3000

# Comando para iniciar o aplicativo
CMD [ "node", "server.js" ]
