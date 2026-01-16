function LandingPage() {
  return (
    <section className="page fade-in">
      <div className="hero">
        <h1>Seu Herói Interior em Versão Digital</h1>
        <p>
          Um ambiente imersivo de desenvolvimento humano baseado na Jornada do
          Herói, neurociência, PNL e coaching comportamental.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/dashboard">
            Entrar na Jornada
          </a>
          <a className="btn btn-secondary" href="/trilhas">
            Explorar Trilhas
          </a>
        </div>
      </div>
      <div className="hero-grid">
        <div className="hero-card">
          <h2>Avatarização do Eu</h2>
          <p>
            Acompanhe o equilíbrio dos sete corpos e evolua o nível de
            consciência com práticas diárias.
          </p>
        </div>
        <div className="hero-card">
          <h2>Jornadas Personalizadas</h2>
          <p>
            Trilhas para liderança, cultura organizacional, cuidado humanizado e
            a Jornada do Herói completa.
          </p>
        </div>
        <div className="hero-card">
          <h2>Flow AI-Powered</h2>
          <p>
            Check-ins de estado emocional e sugestões inteligentes para manter o
            flow ao longo da semana.
          </p>
        </div>
      </div>
    </section>
  );
}

export default LandingPage;

