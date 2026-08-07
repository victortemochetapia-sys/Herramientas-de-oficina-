import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiRouter } from "./routes/ai.js";
import { convertRouter } from "./routes/convert.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/ai", aiRouter);
app.use("/api/convert", convertRouter);

app.listen(PORT, () => {
  console.log(`Servidor de Herramientas de Oficina escuchando en http://localhost:${PORT}`);
});
