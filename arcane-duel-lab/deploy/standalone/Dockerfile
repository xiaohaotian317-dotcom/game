FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DUEL_DB_PATH=/app/.local-data/duel.sqlite
COPY --chown=node:node package.json ./
COPY --chown=node:node dist/ ./dist/
COPY --chown=node:node server/ ./server/
COPY --chown=node:node scripts/serve.mjs ./scripts/serve.mjs
COPY --chown=node:node drizzle/ ./drizzle/
RUN mkdir -p /app/.local-data && chown node:node /app/.local-data
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4173/healthz',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","scripts/serve.mjs"]
