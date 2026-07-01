import { useState } from "react";
import { api } from "../../data/api";
import { setSesion } from "../../data/auth";
import { reiniciarLastSync } from "../../data/sync";
import { btnPrimario, inputCls, labelCls } from "../../ui/clases";

export function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const s = await api.login(usuario.trim(), password);
      reiniciarLastSync(); // sesión nueva → descarga completa
      setSesion(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-2xl">
            ⛺
          </div>
          <h1 className="text-lg font-semibold text-slate-100">Sala Situacional</h1>
          <p className="text-xs text-slate-400">Refugio Parque del Oeste</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Usuario</label>
            <input
              className={inputCls}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className={labelCls}>Contraseña</label>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando || !usuario || !password}
            className={btnPrimario + " w-full"}
          >
            {cargando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
