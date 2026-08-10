import { Server, Socket } from "socket.io";
import http from "http";
import { env } from "../config/env";
import { verifyToken } from "../utils/token";

let io: Server;

export const initSocket = (server: http.Server): Server => {
  io = new Server(server, {
    cors: { origin: env.clientUrl, methods: ["GET", "POST"] },
  });

  // autentica o socket pelo token JWT enviado no handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Token ausente"));
    try {
      const decoded = verifyToken(token);
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error("Token invalido"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    // cada usuario entra na sua sala para receber notificacoes direcionadas
    socket.join(`user:${userId}`);
    console.log(`🔌 Usuario conectado: ${userId}`);

    // chat simples entre cliente e prestador (sala por agendamento)
    socket.on("chat:join", (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
    });

    socket.on(
      "chat:message",
      (payload: { bookingId: string; text: string }) => {
        io.to(`booking:${payload.bookingId}`).emit("chat:message", {
          from: userId,
          text: payload.text,
          at: new Date().toISOString(),
        });
      }
    );

    socket.on("disconnect", () => {
      console.log(`🔌 Usuario desconectado: ${userId}`);
    });
  });

  return io;
};

// usado pelos controllers para emitir eventos
export const getIO = (): Server => {
  if (!io) throw new Error("Socket.IO nao inicializado");
  return io;
};
