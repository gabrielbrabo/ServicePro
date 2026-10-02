import { useEffect, useState } from "react";
import { favoritesApi } from "../api/favorites";
import { useAuth } from "../context/AuthContext";

// Estado global (simples) dos favoritos: um Set de ids compartilhado por todos
// os coracoes da tela. Carrega uma vez por usuario logado.

let ids = new Set<string>();
let loadedFor: string | null = null; // id do usuario cujos favoritos estao carregados
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function load(userId: string): Promise<void> {
  if (loadedFor === userId) return Promise.resolve();
  if (loading) return loading;
  loading = favoritesApi
    .ids()
    .then((list) => {
      ids = new Set(list);
      loadedFor = userId;
      notify();
    })
    .catch(() => {
      /* sem favoritos carregados: coracoes ficam vazios */
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function reset() {
  ids = new Set();
  loadedFor = null;
  notify();
}

export function useFavorites() {
  const { user } = useAuth();
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // troca de usuario (login/logout): recarrega ou limpa
  useEffect(() => {
    if (user?.id) void load(user.id);
    else if (loadedFor) reset();
  }, [user?.id]);

  const isFavorite = (id: string) => ids.has(id);

  // adiciona/remove com atualizacao otimista (desfaz se a API falhar).
  // Retorna o novo estado.
  const setFavorite = async (id: string, fav: boolean): Promise<boolean> => {
    const before = ids.has(id);
    if (before === fav) return fav;
    const next = new Set(ids);
    if (fav) next.add(id);
    else next.delete(id);
    ids = next;
    notify();
    try {
      if (fav) await favoritesApi.add(id);
      else await favoritesApi.remove(id);
      // reaplica: um load() que terminou no meio (ex.: logo apos o login)
      // pode ter trocado o Set pela lista antiga do servidor
      if (ids.has(id) !== fav) {
        const fix = new Set(ids);
        if (fav) fix.add(id);
        else fix.delete(id);
        ids = fix;
        notify();
      }
      return fav;
    } catch {
      const undo = new Set(ids);
      if (before) undo.add(id);
      else undo.delete(id);
      ids = undo;
      notify();
      return before;
    }
  };

  return { isFavorite, setFavorite };
}
