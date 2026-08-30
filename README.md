# Contábil

Aplicação para cálculos contábeis e judiciais com memória de cálculo, atualização de índices econômicos e rastreabilidade entre planilhas, regras de negócio, código e testes.

## Estrutura

- `apps/web`: interface Next.js baseada no protótipo aprovado.
- `apps/api`: API Node.js/Fastify.
- `packages/database`: modelo Prisma para PostgreSQL/Supabase.
- `packages/calculation-engine`: regras matemáticas isoladas e testáveis.
- `docs/rastreabilidade`: matriz entre planilhas e implementação.

## Executar localmente

Requisitos: Node.js 20.9 ou superior e PostgreSQL.

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

## Validação

```bash
npm test
npm run build
```

> Esta primeira entrega implementa o fluxo visual completo e a fundação técnica. Cada motor contábil será incorporado somente depois da comparação centavo a centavo com suas planilhas de referência.
