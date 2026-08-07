// Copia los archivos .env.example a .env la primera vez, para que el
// usuario no tenga que hacerlo a mano. Si ya existen, no los toca.
const fs = require("node:fs");
const path = require("node:path");

function ensureEnv(dir) {
  const examplePath = path.join(dir, ".env.example");
  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(examplePath)) return;
  if (fs.existsSync(envPath)) {
    console.log(`✓ ${path.relative(process.cwd(), envPath)} ya existe, no se toca.`);
    return;
  }
  fs.copyFileSync(examplePath, envPath);
  console.log(`✓ Creado ${path.relative(process.cwd(), envPath)}`);
}

ensureEnv(path.join(__dirname, "..", "server"));
ensureEnv(path.join(__dirname, "..", "client"));

console.log("");
console.log("Listo. Para activar el asistente de IA, abre el archivo");
console.log("server/.env con cualquier editor de texto y pega tu clave");
console.log("de Anthropic después de ANTHROPIC_API_KEY=");
console.log("");
console.log("Luego ejecuta: npm run dev");
