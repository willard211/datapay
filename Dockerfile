FROM node:20-alpine

WORKDIR /app

# 先复制 package.json 利用 Docker 缓存
COPY package*.json ./
RUN npm ci --only=production

# 复制 Prisma schema 并生成 client
COPY prisma ./prisma
RUN npx prisma generate

# 复制源码并编译
COPY . .
RUN npm run build

EXPOSE 4021

CMD ["node", "dist/cli.js", "serve"]
