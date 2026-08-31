# Matriz de rastreabilidade inicial

Esta matriz impede que uma fórmula seja implementada sem origem conhecida e sem teste de comparação.

| Regra | Planilha | Aba/células de referência | Comportamento observado | Implementação | Situação |
|---|---|---|---|---|---|
| REGRA-CM-001 | Base comum dos modelos | Colunas de fator/correção | Aplicar fator acumulado ao principal e arredondar em centavos | `packages/calculation-engine/src/index.js` | Fundação implementada |
| REGRA-SAC-001 | `FONTE-SAC-IPCA-001` | `SAC 163 mil!D13`, colunas C:J | Amortização constante, juros sobre saldo e correção mensal | `packages/calculation-engine/src/amortization.js` + `apps/api/src/services/calculation-service.js` | Núcleo implementado, pendente comparação com planilha |
| REGRA-SAC-002 | `FONTE-SAC-TR-001` | `Plan1!H11`, colunas C:Q | SAC corrigido pela TR | `packages/calculation-engine/src/index.js` (reuso do SAC com série TR) | Núcleo implementado, pendente comparação com planilha |
| REGRA-PRICE-001 | `FONTE-PRICE-IGPM-001` | `Plan1`, colunas C:P | Price com correção por IGP-M | `packages/calculation-engine/src/amortization.js` + `apps/api/src/services/calculation-service.js` | Núcleo implementado, pendente comparação com planilha |
| REGRA-INPC-001 | `FONTE-CORRECAO-INPC-001` | `Plan1!C18:F19` | INPC, juros anuais proporcionais e cálculo por dias | A implementar | Mapeada |
| REGRA-JUD-001 | `FONTE-DIF-SALARIAL-001` | `Plan 1!F12:M12` | IPCA-E e poupança até 08/12/2021; Selic após 09/12/2021 | `packages/calculation-engine/src/judicial.js` + `apps/api/src/services/calculation-service.js` | Núcleo implementado (IPCA-E + fator Selic informado), pendente série Selic e comparação com planilha |
| REGRA-DIF-001 | Proposta de negócio | Documento de escopo | Corrigir diferença salarial com reflexos de 13º e férias | `packages/calculation-engine/src/salary.js` + `apps/api/src/services/calculation-service.js` | Núcleo implementado, aguardando fonte original para comparação |
| REGRA-ACORDO-001 | `FONTE-ACORDOS-001` | `Plan 1`, `Acordo 1`, `Acordo 2` | Separar períodos por acordos e aplicar IGP-M/INPC conforme marco | A implementar | Mapeada |

## Critério de aceite

1. Origem identificada por arquivo, aba e células.
2. Fórmula explicada em linguagem de negócio.
3. Regra implementada fora da interface e da camada HTTP.
4. Teste unitário e teste de regressão com a planilha.
5. Diferença máxima de R$ 0,01, explicada pela regra de arredondamento.
6. Revisão profissional antes da ativação em produção.

## Proteção das fontes

Os nomes originais dos arquivos, clientes, contratos e processos não são versionados. A associação entre `FONTE-*` e o documento original deverá ser armazenada em ambiente privado, com controle de acesso e registro de auditoria.
