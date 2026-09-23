import { Request } from "express";

// Paginacao padronizada para listas do sistema (rolagem infinita: 15 por vez).
// Estrategia "limit + 1": buscamos 1 a mais que o limite para saber se ha
// proxima pagina SEM precisar de uma query de count separada.

export interface PageParams {
  limit: number;
  offset: number;
  // limite + 1, para passar direto ao .limit() do Mongoose e detectar hasMore
  fetchLimit: number;
}

// Le limit/offset da querystring com defaults seguros.
export function pageParams(
  req: Request,
  defLimit = 15,
  maxLimit = 100
): PageParams {
  const q = (req.query || {}) as Record<string, unknown>;
  let limit = parseInt(String(q.limit ?? defLimit), 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = defLimit;
  if (limit > maxLimit) limit = maxLimit;
  let offset = parseInt(String(q.offset ?? 0), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset, fetchLimit: limit + 1 };
}

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
  nextOffset: number;
}

// Recebe as linhas buscadas com fetchLimit (limit + 1) e monta a resposta:
// se veio 1 a mais, corta e marca hasMore = true.
export function pageResult<T>(
  rows: T[],
  params: PageParams
): PageResult<T> {
  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;
  return {
    items,
    hasMore,
    nextOffset: params.offset + items.length,
  };
}
