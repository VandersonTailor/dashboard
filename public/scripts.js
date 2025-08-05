// Elementos principais
const inputAlvo = document.getElementById('alvo');
const btnExecutar = document.getElementById('btnExecutar');
const scriptsSection = document.getElementById('scripts');
const navButtons = document.querySelectorAll('.nav-btn');
const sections = ['scripts', 'logs', 'relatorios'];

// Util: Valida input não vazio
function validarAlvo(texto) {
  return texto.trim().length > 0;
}

// Alterna seções visíveis e o botão ativo
function showSection(sectionId) {
  const alvo = inputAlvo.value.trim();

  if (sectionId === 'scripts' && !validarAlvo(alvo)) {
    alert("Por favor, insira o IP ou nome da máquina antes de acessar os scripts.");
    return;
  }

  // Mostra a seção escolhida e esconde as outras
  sections.forEach(id => {
    const section = document.getElementById(id);
    section.style.display = (id === sectionId) ? 'block' : 'none';
  });

  // Atualiza botão de navegação ativo
  navButtons.forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[onclick="showSection('${sectionId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

// Monitora input para verificar se a máquina está acessível
inputAlvo.addEventListener('input', async () => {
  const alvo = inputAlvo.value.trim();

  if (!validarAlvo(alvo)) {
    btnExecutar.disabled = true;
    scriptsSection.style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/verificar-maquina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alvo }),
    });

    const data = await res.json();

    if (data.status === 'ok') {
      btnExecutar.disabled = false;
    } else {
      btnExecutar.disabled = true;
      scriptsSection.style.display = 'none';
    }
  } catch (err) {
    console.error('Erro ao verificar máquina:', err);
    btnExecutar.disabled = true;
    scriptsSection.style.display = 'none';
  }
});

// Ao clicar no botão "Executar Script"
btnExecutar.addEventListener('click', () => {
  const alvo = inputAlvo.value.trim();
  if (validarAlvo(alvo)) {
    showSection('scripts');
  } else {
    alert('Por favor, informe um IP ou nome válido.');
  }
});

// Executa script remotamente
function executarScript(scriptId) {
  const alvo = inputAlvo.value.trim();

  if (!validarAlvo(alvo)) {
    alert("Por favor, informe o IP ou nome da máquina.");
    return;
  }

  fetch('http://localhost:3000/executar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // enviar cookies da sessão
    body: JSON.stringify({
      nomePc: alvo,
      scriptId: scriptId
    }),
  })
  .then(response => response.json())
  .then(data => {
    console.log(data);
    if (data.resultado) {
      alert("Script executado com sucesso!");
      atualizarLogs();
      document.getElementById('logOutput').innerText = data.resultado;
    } else {
      alert(`Erro ao executar script: ${data.erro || JSON.stringify(data)}`);
    }
  })
  .catch(err => {
    console.error(err);
    alert("Erro na comunicação com o servidor.");
  });
}




// Atualiza logs
function atualizarLogs() {
  fetch("/logs")
    .then(res => res.text())
    .then(texto => {
      document.getElementById("logOutput").textContent = texto;
    })
    .catch(() => {
      document.getElementById("logOutput").textContent = "Erro ao carregar logs.";
    });
}

// Gera relatório com IA
function gerarRelatorio() {
  fetch("/relatorio")
    .then(res => res.json())
    .then(data => {
      document.getElementById("relatorioOutput").innerText = data.conteudo || "Nenhum relatório disponível.";
    })
    .catch(() => {
      document.getElementById("relatorioOutput").innerText = "Erro ao carregar relatório.";
    });
} 

document.addEventListener("DOMContentLoaded", () => {
  fetch('/check-session', {
    credentials: 'include'
  })
  .then(res => {
    if (res.status === 401) {
      window.location.href = '/login.html';
    } else if (res.ok) {
      iniciarPainel(); // chama seu setup principal
    } else {
      throw new Error("Erro inesperado na verificação da sessão");
    }
  })
  .catch(() => {
    window.location.href = '/login.html';
  });
});

function iniciarPainel() {
  showSection("logs");
  btnExecutar.disabled = true;
  gerarRelatorio();
}
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




// Inicialização ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  showSection("logs"); // Aba padrão ao iniciar
  btnExecutar.disabled = true;
  gerarRelatorio(); // Pré-carrega relatório (opcional)
});
