import { useEffect, useState } from "react";
import { DashboardResponse, getDashboard } from "../api";

function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getDashboard()
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar o dashboard.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="page center">
        <div className="spinner" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="page center">
        <p>{error ?? "Erro inesperado."}</p>
      </section>
    );
  }

  return (
    <section className="page fade-in">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <p className="dashboard-greeting">
              Olá, <span>{data.hero_name}</span>
            </p>
            <p className="dashboard-level">
              Nível {data.level} – Construtor de Legados
            </p>
          </div>
          <div className="dashboard-flow">
            <p>Flow hoje</p>
            <p className="dashboard-flow-value">{data.flow_today}%</p>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${data.flow_today}%` }}
              />
            </div>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-panel">
            <h2>Prática de hoje</h2>
            <p className="dashboard-practice-title">
              {data.practice_of_the_day.title}
            </p>
            <p className="dashboard-practice-duration">
              ⏱️ {data.practice_of_the_day.duration_minutes} minutos
            </p>
            <button className="btn btn-primary">Começar agora</button>
          </div>
          <div className="dashboard-panel">
            <h2>Seus 7 corpos</h2>
            <ul className="bodies-list">
              {data.bodies.map((body) => (
                <li key={body.id}>
                  <span>{body.label}</span>
                  <div className="bodies-meter">
                    <div
                      className="bodies-meter-fill"
                      style={{ width: `${body.value}%` }}
                    />
                  </div>
                  <span className="bodies-value">{body.value}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="dashboard-panel">
            <h2>Conquistas recentes</h2>
            <ul className="achievements-list">
              {data.achievements.map((achievement) => (
                <li key={achievement.id}>{achievement.title}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;

