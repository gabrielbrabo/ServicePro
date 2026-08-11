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
  }) => Promise<void>;
  logout: () => void;
  loginWithGoogle: (credential: string) => Promise<User>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  }) => {
    const { token, user } = await authApi.register(data);
    localStorage.setItem("token", token);
    setUser(user);
    connectSocket();
  };

  const logout = () => {
    localStorage.removeItem("token");
    disconnectSocket();
    setUser(null);
  };

  const loginWithGoogle = async (credential: string): Promise<User> => {
    const { token, user } = await authApi.google(credential);
    localStorage.setItem("token", token);
    setUser(user);
    connectSocket();
    return user;
  };

  // atualiza o user no estado apos editar o perfil (sem recarregar a pagina)
  const updateUser = (patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateUser }}>
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