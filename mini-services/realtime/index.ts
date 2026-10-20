/**
 * BMC Realtime — socket.io fan-out service on :3003 (gateway: /?XTransformPort=3003)
 * • Rooms: display (queue screens), staff (notifications), flow (patient flow board)
 * • POST /emit {event, room?, payload} — internal relay for the Next.js API (localhost only)
 */
import { Server } from "socket.io";
import { createServer } from "http";

const PORT = 3003;
const INTERNAL_KEY = process.env.BMC_INTERNAL_KEY ?? "bmc-dev-internal";

const http = createServer((req, res) => {
  // CORS for the gateway origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-bmc-internal");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "bmc-realtime", clients: io.engine.clientsCount }));
    return;
  }

  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers["x-bmc-internal"] !== INTERNAL_KEY) { res.writeHead(403); res.end("{}"); return; }
      try {
        const { event, room, payload } = JSON.parse(body);
        if (room) io.to(room).emit(event, payload); else io.emit(event, payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch {
        res.writeHead(400); res.end("{}");
      }
    });
    return;
  }

  res.writeHead(404); res.end("{}");
});

const io = new Server(http, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  socket.on("room:join", (room: string) => {
    if (typeof room === "string" && /^[\w:-]{1,40}$/.test(room)) socket.join(room);
  });
  socket.on("queue:call", (p) => io.to("display").emit("queue:called", p));
  socket.on("notif", (p) => io.to("staff").emit("notif:new", p));
});

http.listen(PORT, () => {
  console.log(`[bmc-realtime] listening on :${PORT}`);
});
