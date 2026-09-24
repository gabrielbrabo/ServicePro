import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { authApi, User } from "../api/auth";
import { connectSocket, disconnectSocket } from "../lib/socket";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    ref?: string;
    acceptTerms: boolean;
  }) => Promise<void>;
  logout: () => void;
  loginWithGoogle: (credential: string) => Promise<User>;
  updateUser: (patch: Partial<User>) => void;
  // adota uma sessao obtida FORA deste contexto (login/cadastro do afiliado):
  // guarda o token (se vier), carrega o usuario e liga o socket
  adoptSession: (token?: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// lê o ?ref guardado no cadastro por link de afiliado/representante
function readRef(): string | undefined {
  try {
    return localStorage.getItem("sp_ref") || undefined;
  } catch {
    return undefined;
  }
}
function clearRef(): void {
  try {
    localStorage.removeItem("sp_ref");
  } catch {
    // ignora
  }
}

// area atual (app do cliente/dono x painel do afiliado). Usada no refresh para
// devolver o usuario para onde ele estava, em vez de sempre cair no app.
function markArea(area: "app" | "affiliate"): void {
  try {
    localStorage.setItem("sp_area", area);
  } catch {
    // ignora
  }
}
function clearArea(): void {
  try {
    localStorage.removeItem("sp_area");
  } catch {
    // ignora
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ao carregar o app, se ha token, busca o usuario
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => {
        setUser(u);
        connectSocket();
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login({ email, password });
    localStorage.setItem("token", token);
    markArea("app");
    setUser(user);
    connectSocket();
    return user; // permite ao chamador decidir o redirect
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    ref?: string;
    acceptTerms: boolean;
  }) => {
    // garante que a indicacao (?ref) do link do afiliado vai pro back mesmo
    // que a pagina de cadastro nao a tenha passado explicitamente.
    const ref = data.ref ?? readRef();
    const { token, user } = await authApi.register({ ...data, ref });
    localStorage.setItem("token", token);
    markArea("app");
    setUser(user);
    connectSocket();
  };

  const logout = () => {
    localStorage.removeItem("token");
    clearArea();
    disconnectSocket();
    setUser(null);
  };

  const loginWithGoogle = async (credential: string): Promise<User> => {
    // leva a indicacao (?ref) para o back vincular contas Google novas
    const ref = readRef();
    const { token, user } = await authApi.google(credential, ref);
    localStorage.setItem("token", token);
    clearRef();
    markArea("app"); // area do afiliado sobrescreve isto ao abrir /afiliado
    setUser(user);
    connectSocket();
    return user;
  };

  // Login/cadastro do afiliado usam endpoints proprios (/affiliates/*) e so
  // devolvem o token. Sem isto o contexto ficava com user = null e qualquer
  // rota protegida (ex.: /perfil) mandava o afiliado para o login do app.
  const adoptSession = async (token?: string): Promise<User> => {
    if (token) localStorage.setItem("token", token);
    const u = await authApi.me();
    setUser(u);
    connectSocket();
    return u;
  };

  // atualiza o user no estado apos editar o perfil (sem recarregar a pagina)
  const updateUser = (patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateUser, adoptSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
