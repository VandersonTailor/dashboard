import express from "express";
import session from "express-session";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec, execFile, spawn } from "child_process"; // <- spawn adicionado aqui
import cors from "cors";



const pastaLogs = path.join(process.cwd(), 'logs');

if (!fs.existsSync(pastaLogs)) {
  fs.mkdirSync(pastaLogs, { recursive: true });
}
const app = express();

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const SCRIPTS_DIR = path.join(__dirname, "scripts"); // ADICIONADO
const LOG_FILE = path.join(__dirname, "logs", "execucao.log"); // ADICIONADO
const configPath = path.join(publicDir, "config.json");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:3000', // onde seu front roda
  credentials: true,
}));



app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// Usuários e nomes
const usuarios = new Map([
  ["admin", process.env.ADMIN_PASSWORD || "change-me"],
]);

const nomesFormatados = new Map([
  ["admin", "Administrador"],
]);

function autenticar(usuario, senha) {
  return usuarios.get(usuario) === senha;
}

// Middleware de autenticação
function checkAuth(req, res, next) {
  if (req.session.usuario) {
    return next();
  } else {
    console.log(`🚫 Tentativa de acesso sem login. IP: ${req.ip}`);
    return res.status(401).send("Não autorizado");
  }
}

// Endpoint de login
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (autenticar(usuario, senha)) {
    req.session.usuario = usuario;
    req.session.nome = nomesFormatados.get(usuario);
    res.json({ sucesso: true, nome: req.session.nome });
  } else {
    res.status(401).json({ erro: "Usuário ou senha inválidos." });
  }
});


// Retorna o conteúdo dos logs
app.get("/logs", checkAuth, (req, res) => {
  if (!fs.existsSync(LOG_FILE)) {
    return res.send("Nenhum log encontrado.");
  }

  const conteudo = fs.readFileSync(LOG_FILE, "utf-8");
  res.send(conteudo);
});

app.get("/relatorio", checkAuth, (req, res) => {
  const relatorioSimulado = ` ... `;

  const relatoriosDir = path.join(__dirname, "relatorios");
  if (!fs.existsSync(relatoriosDir)) {
    fs.mkdirSync(relatoriosDir, { recursive: true });
  }

  const relatorioPath = path.join(relatoriosDir, "relatorio.txt");
  fs.writeFileSync(relatorioPath, relatorioSimulado);

  res.json({ conteudo: relatorioSimulado });
});


// Pasta para armazenar logs e dados
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const logsFile = path.join(dataDir, "logs.json");
// Função para ler logs do arquivo JSON
function lerLogs() {
  if (!fs.existsSync(logsFile)) return {};
  return JSON.parse(fs.readFileSync(logsFile, "utf-8"));
}

// Função para salvar logs no arquivo JSON
function salvarLogs(logs) {
  fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2), "utf-8");
}

// Rota para receber logs de máquinas
app.post("/logs", (req, res) => {
  const { nome, usuario, hora, atividade } = req.body;
  if (!nome || !usuario || !hora || !atividade) {
    return res.status(400).json({ erro: "Campos obrigatórios faltando." });
  }

  const logs = lerLogs();

  if (!logs[nome]) logs[nome] = [];
  logs[nome].push({ usuario, hora, atividade });

  salvarLogs(logs);

  res.json({ sucesso: true, mensagem: "Log recebido." });
});

// Rota para listar usuários (nomes das máquinas que enviaram logs)
app.get("/usuarios", (req, res) => {
  const logs = lerLogs();
  const usuarios = Object.keys(logs);
  res.json(usuarios);
});

// Rota para obter relatório completo de uma máquina
app.get("/relatorios/:nomePc", (req, res) => {
  const nomePc = req.params.nomePc;
  const logs = lerLogs();

  if (!logs[nomePc]) {
    return res.status(404).json({ erro: "Máquina não encontrada." });
  }

  // Você pode processar e resumir aqui, ou enviar os logs crus
  res.json({ nomePc, registros: logs[nomePc] });
});

let scripts = [];
const scriptsFile = path.join(process.cwd(), "data", "scripts.json");
if (fs.existsSync(scriptsFile)) {
  scripts = JSON.parse(fs.readFileSync(scriptsFile, "utf-8"));
}
console.log("Pasta data:", fs.readdirSync(path.join(process.cwd(), "data")));
console.log("Conteúdo bruto do scripts.json:", fs.readFileSync(scriptsFile, "utf-8"));


app.post('/', (req, res) => {
  const { nomePc, scriptId } = req.body;

  // Pegando dados da sessão
  const usuario = req.session.usuario;
  if (!usuario) {
    return res.status(401).send("Não autorizado");
  }

  const scriptPython = path.join(__dirname, '..', 'scripts', 'executar_winrm.py');

  const args = [nomePc, 'admin', 'senha', scriptId];

  execFile('python', [scriptPython, ...args], (error, stdout, stderr) => {
    if (error) {
      console.error("Erro ao executar script:", error);
      return res.status(500).json({ erro: 'Erro ao executar script' });
    }

    res.json({ resultado: stdout });
  });
});

app.post("/executar", async (req, res) => {
  const { nomePc, scriptId } = req.body;
  
  const python = spawn('python', ['winrm_exec.py', nomePc, 'admin', 'senha', scriptId]);

  python.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  python.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  python.on('close', (code) => {
    if (code === 0) {
      res.json({ sucesso: true, mensagem: "Script executado com sucesso!" });
    } else {
      res.status(500).json({ sucesso: false, mensagem: "Erro na execução do script." });
    }
  });
});


// Rota para testar conexão
app.post('/verificar-maquina', (req, res) => {
  const { alvo } = req.body;

  if (!alvo) return res.status(400).json({ status: 'erro', mensagem: 'Alvo não informado' });

  exec(`ping -n 1 ${alvo}`, (err, stdout, stderr) => {
    if (err) {
      return res.json({ status: 'falha', mensagem: 'Máquina não encontrada' });
    }
    res.json({ status: 'ok', mensagem: 'Máquina acessível' });
  });
});
// ✅ Verifica sessão ativa
app.get('/check-session', (req, res) => {
  if (req.session.usuario) {
    res.status(200).json({ usuario: req.session.usuario, nome: req.session.nome });
  } else {
    res.status(401).json({ erro: 'Não autenticado' });
  }
});


function executarComandoWinRM(ip, usuario, senha, scriptBlock) {
  return new Promise((resolve, reject) => {
    // Escapa aspas simples no scriptBlock para evitar erro na linha de comando
    const scriptBlockEscapado = scriptBlock.replace(/'/g, "''");

    // Comando PowerShell para executar remotamente via Invoke-Command
    const comando = `powershell.exe -Command "Invoke-Command -ComputerName ${ip} -Credential (New-Object System.Management.Automation.PSCredential('${usuario}', (ConvertTo-SecureString '${senha}' -AsPlainText -Force))) -ScriptBlock { ${scriptBlockEscapado} }"`;

    exec(comando, (erro, stdout, stderr) => {
      if (erro) {
        return reject(erro);
      }
      if (stderr) {
        console.error("Erro PowerShell:", stderr);
      }
      resolve(stdout.trim());
    });
  });
}


app.get("/relatorio-computador/:ip", checkAuth, async (req, res) => {
  const ip = req.params.ip;
  const dominio = '';
  try {
    const relatorio = await executarComandoWinRM(
  ip,
  "",     // usuário remoto com barra dupla para escapar
  "",           // senha remota
  "Get-Process | Select-Object -First 5 | Format-Table -AutoSize"
);

    res.json({ ip, relatorio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Falha ao obter relatório via WinRM." });
  }
});
app.use(express.static("public")); // sua pasta HTML/CSS/JS

app.get("/relatorio", (req, res) => {
  const host = req.query.host;

  if (!host) return res.status(400).send("Host não informado");

  // Chama script Python passando o IP como argumento
  exec(`python3 winrm_relatorio.py ${host}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).send(`Erro: ${stderr || error.message}`);
    }
    res.send(stdout);
  });
});


// ✅ Servir arquivos estáticos (por último)
app.use(express.static(publicDir));

// ✅ Inicializa servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});


