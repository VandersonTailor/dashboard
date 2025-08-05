const form = document.getElementById("loginForm");
const inputs = form.querySelectorAll("input");
const msg = document.getElementById("error");
const btn = form.querySelector("button");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Limpa erros anteriores
  inputs.forEach(input => input.classList.remove("error"));
  msg.textContent = "";
  msg.style.display = "none";

  // Validação simples de campos preenchidos
  let hasError = false;
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add("error");
      hasError = true;
    }
  });

  if (hasError) {
    msg.textContent = "Por favor, preencha todos os campos.";
    msg.classList.add("error");
    msg.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Entrando...";

  try {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // MUITO IMPORTANTE para manter sessão
      body: JSON.stringify({ usuario: username, senha: password }),
    });

    const data = await response.json();

    if (response.ok && data.sucesso) {
      sessionStorage.setItem("usuarioLogado", username);
      sessionStorage.setItem("usuarioNome", data.nome || username);
      msg.textContent = "Login efetuado com sucesso! Redirecionando...";
      msg.classList.remove("error");
      msg.classList.add("success");
      msg.style.display = "block";

      setTimeout(() => {
        window.location.href = "/index.html"; // redireciona para o painel/sistema
      }, 1500);
    } else {
      msg.textContent = data.erro || "Usuário ou senha inválidos.";
      msg.classList.add("error");
      msg.style.display = "block";
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
    msg.textContent = "Erro na comunicação com o servidor.";
    msg.classList.add("error");
    msg.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});
