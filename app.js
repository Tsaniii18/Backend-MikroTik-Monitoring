import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { createSequelize } from "./client/database.js";
import { initModels } from "./models/Model.js";
import { MikroTikClient } from "./client/mikrotik.js";
import { RuleEngine } from "./engine/ruleEngine.js";
import { CorrelationEngine } from "./engine/correlationEngine.js";
import { Poller } from "./services/poller.js";
import { initSocket } from "./services/socket.js";
import { buildApiRouter } from "./services/api.js";

const env = process.env;

const app = express();
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "1mb" }));

const sequelize = createSequelize(env);
const models = initModels(sequelize);

await sequelize.authenticate();
await sequelize.sync();

const server = http.createServer(app);
const io = initSocket(server, "*");

const state = {
  running: false,
  pingTarget: env.PING_TARGET || "8.8.8.8",
  router: { name: "", ip: "" },
  dynamic: { uptime: "", interfaces: [] },
  initialInterfacesSet: false
};

const mikrotik = new MikroTikClient();
const ruleEngine = new RuleEngine(models, mikrotik);
const correlationEngine = new CorrelationEngine(models);

const poller = new Poller({ mikrotik, ruleEngine, correlationEngine, models, io, state });

ruleEngine.setPoller(poller);
ruleEngine.setCorrelationEngine(correlationEngine);
correlationEngine.start();

app.use("/api", buildApiRouter({ mikrotik, poller, state, models }));

app.get("/", (_, res) => res.send("ok"));

const port = Number(env.PORT || 3000);
server.listen(port, () => console.log(`backend listening on :${port}`));