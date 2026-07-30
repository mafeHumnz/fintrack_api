# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# 1. ETAPA DE DEPENDENCIAS Y COMPILACIÓN (Builder)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
# libssl es fundamental para los binarios de Prisma en Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Montamos caché para instalaciones ultrarrápidas
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Generamos el cliente de Prisma (en Alpine)
RUN npx prisma generate

COPY . .

ARG NODE_ENV=production
ARG DATABASE_URL
ARG JWT_SECRET

ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_URL=${DATABASE_URL}
ENV JWT_SECRET=${JWT_SECRET}

# Compilamos TypeScript a /dist
RUN npm run build

# Limpiamos las devDependencies de node_modules manteniendo Prisma Client intacto
RUN npm prune --production

# -----------------------------------------------------------------------------
# 2. ETAPA FINAL (Runner)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
# En la imagen final solo necesitamos openssl para ejecutar el motor de Prisma
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copiamos solo lo estrictamente necesario para correr la app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["npm", "start"]