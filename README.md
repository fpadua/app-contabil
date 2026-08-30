# Contábil

Aplicação para cálculos contábeis e judiciais com memória de cálculo, atualização de índices econômicos e rastreabilidade entre planilhas, regras de negócio, código e testes.

## Estrutura

- `apps/web`: interface Next.js baseada no protótipo aprovado.
- `apps/api`: API Node.js/Fastify.
- `packages/database`: modelo Prisma para PostgreSQL/Supabase.
- `packages/calculation-engine`: regras matemáticas isoladas e testáveis.
- `docs/rastreabilidade`: matriz entre planilhas e implementação.

## Executar localmente

Requisitos: Node.js 20.9 ou superior e PostgreSQL. O arquivo `.env` deve permanecer na raiz do projeto; a API e os jobs dos workspaces carregam esse arquivo automaticamente.

```bash
cp .env.example .env
npm install
npm run dev:web
```

A interface ficará disponível em `http://localhost:3000`.

Para executar a API em outro terminal:

```bash
npm run dev:api
```

Para sincronizar índices sem chave da API, instale o Chromium do Playwright uma vez. Com `INDEX_PROVIDER=auto`, o backend usa a API quando houver chave e as tabelas públicas quando ela estiver ausente:

```bash
npm run playwright:install --workspace=@contabil/api
npm run sync:indices --workspace=@contabil/api
```

Consulte [docs/indices-economicos.md](docs/indices-economicos.md) para detalhes de carga histórica, auditoria e bloqueio por competências ausentes.

## Validação

```bash
npm test
npm run build
```

> Esta primeira entrega implementa o fluxo visual completo e a fundação técnica. Cada motor contábil será incorporado somente depois da comparação centavo a centavo com suas planilhas de referência.
