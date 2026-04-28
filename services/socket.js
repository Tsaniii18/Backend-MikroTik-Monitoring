import { Server } from "socket.io";

export const initSocket = (httpServer, corsOrigin = "*") => {
  const io = new Server(httpServer, { cors: { origin: corsOrigin, methods: ["GET", "POST"] } });

  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true });
  });

  return io;
};
