import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, name);
      navigate("/dashboard");
    } catch {
      setError("Não foi possível criar a conta. Verifique os dados.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page fade-in auth-page">
      <div className="auth-card">
        <h1>Criar conta</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? "Criando..." : "Criar conta"}
          </button>
          {error && <p className="form-error">{error}</p>}
        </form>
        <p className="auth-footer">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </section>
  );
}

export default SignupPage;

