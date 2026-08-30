# Índices econômicos

## Provedores

A sincronização aceita dois provedores:

- `debit-api`: API oficial do Debit; a chave é lida exclusivamente de `DEBIT_API_KEY` no backend.
- `playwright`: lê as tabelas históricas públicas do Debit, sem login e sem baixar PDFs.

Com `INDEX_PROVIDER=auto`, a API é priorizada quando `DEBIT_API_KEY` existe; caso contrário, o Playwright é usado. Para forçar o coletor público, use `INDEX_PROVIDER=playwright`.

Índices iniciais:

- IPCA;
- IPCA-E;
- INPC;
- IGP-M;
- TR.

## Execução com Playwright

Após configurar `DATABASE_URL` e `DIRECT_URL`, instale o navegador uma única vez:

```bash
npm run playwright:install --workspace=@contabil/api
npm run sync:indices --workspace=@contabil/api
```

O coletor abre uma página pública por vez, respeita um intervalo mínimo configurável, não autentica e interrompe a coleta se detectar bloqueio ou mudança no formato da tabela. Cada valor mantém a URL de origem e o conteúdo bruto da célula para auditoria. O uso em produção deve ser revisto caso as [condições de uso do Debit](https://www.debit.com.br/menu/termos-de-uso) ou o layout do site mudem; a API oficial continua sendo o caminho preferencial.

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
