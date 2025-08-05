import sys
import winrm

def executar_script(ip, usuario, senha, comando):
    try:
        sessao = winrm.Session(ip, auth=(usuario, senha))
        resultado = sessao.run_cmd(comando)
        return resultado.std_out.decode()
    except Exception as e:
        return f"Erro: {str(e)}"

if __name__ == "__main__":
    ip = sys.argv[1]
    usuario = sys.argv[2]
    senha = sys.argv[3]
    comando = sys.argv[4]
    resultado = executar_script(ip, usuario, senha, comando)
    print(resultado)
