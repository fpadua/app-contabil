# Índices econômicos

## Fonte principal

A sincronização foi preparada para a API REST oficial do Debit, em `https://mcp.debit.com.br/v1`. A chave é lida exclusivamente de `DEBIT_API_KEY` no backend.

Índices iniciais:

- IPCA;
- IPCA-E;
- INPC;
- IGP-M;
- TR.

## Execução

Após configurar `DATABASE_URL`, `DIRECT_URL` e `DEBIT_API_KEY`:

```bash
npm run sync:indices --workspace=@contabil/api
```

O job consulta os últimos seis meses para capturar publicações novas e eventuais revisões. A primeira carga histórica pode ser solicitada pela API:

```http
POST /api/indices/sync
Content-Type: application/json

{
  "from": "1989-01",
  "to": "2026-08"
}
```

## Idempotência e auditoria

- Uma competência é única por índice.
- Valores iguais não são gravados novamente.
- Inclusões e alterações geram histórico.
- Cada execução registra totais, período, solicitante, falhas e horários.
- Meses não publicados permanecem distintos de valores negativos ou zero.

## Proteção do cálculo

Antes de calcular, o serviço enumera todas as competências do período e consulta somente valores publicados. Se faltar algum mês, retorna `409 MISSING_INDEX_PERIODS` e não produz resultado parcial.
