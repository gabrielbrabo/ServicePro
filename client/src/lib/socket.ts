import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// callbacks aguardando o socket ficar disponível
const readyWaiters: ((s: Socket) => void)[] = [];

function notifyReady(s: Socket) {
  while (readyWaiters.length) {
    const cb = readyWaiters.shift();
    cb?.(s);
  }
}

// conecta usando o token JWT; chamado após login
export function connectSocket(): Socket | null {
  const token = localStorage.getItem("token");
  if (!token) return null;

  // ja conectado: reaproveita
  if (socket?.connected) {
    notifyReady(socket);
    return socket;
  }

  // instancia existe mas caiu: reconecta em vez de devolver socket morto
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    notifyReady(socket);
    return socket;
  }

  socket = io(baseURL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  notifyReady(socket);
  return socket;
}

// garante um socket: se ainda não existe mas há token, conecta agora.
// útil para componentes que montam cedo (antes/junto do login).
export function ensureSocket(): Socket | null {
  if (socket) return socket;
  return connectSocket();
}

export function getSocket(): Socket | null {
  return socket;
}

// executa cb assim que o socket existir (imediatamente, se já existe).
// retorna uma função para cancelar a espera.
export function onSocketReady(cb: (s: Socket) => void): () => void {
  const existing = ensureSocket();
  if (existing) {
    cb(existing);
    return () => { };
  }
  readyWaiters.push(cb);
  return () => {
    const i = readyWaiters.indexOf(cb);
    if (i >= 0) readyWaiters.splice(i, 1);
  };
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}