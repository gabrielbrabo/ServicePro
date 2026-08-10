import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

export function GoogleLoginButton({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}) {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="flex w-full justify-center">
      <GoogleLogin
        onSuccess={async (cred) => {
          if (!cred.credential) {
            onError?.("Não foi possível obter os dados da conta Google.");
            return;
          }
          try {
            await loginWithGoogle(cred.credential);
            onSuccess?.();
          } catch {
            onError?.("Não foi possível entrar com o Google.");
          }
        }}
        onError={() => onError?.("Falha ao conectar com o Google.")}
        text="continue_with"
        locale="pt-BR"
        width="320"
      />
    </div>
  );
}