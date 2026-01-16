import os
import json
import uuid
from datetime import date, datetime, timedelta
from functools import wraps
from typing import Any, Dict, List, Optional, TypedDict

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import jwt
from werkzeug.security import check_password_hash, generate_password_hash


db = SQLAlchemy()


class UserPublic(TypedDict):
    id: str
    email: str
    name: str
    is_admin: bool
    xp: int
    streak: int


class TrailPublic(TypedDict):
    id: str
    icon: str
    title: str
    modules: List[str]
    duration_weeks_min: int
    duration_weeks_max: int
    format: str
    enrolled: bool


class VideoLessonPublic(TypedDict):
    id: str
    title: str
    provider: str
    url: str
    duration_minutes: int
    completed: bool


class ProgressTrailStats(TypedDict):
    total_videos: int
    completed_videos: int


class ProgressResponse(TypedDict):
    user: UserPublic
    enrolled_trails: List[str]
    completed_videos: int
    per_trail: Dict[str, ProgressTrailStats]


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False, index=True)
    name = db.Column(db.String, nullable=False, default="")
    password_hash = db.Column(db.String, nullable=False)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)

    xp = db.Column(db.Integer, nullable=False, default=0)
    streak = db.Column(db.Integer, nullable=False, default=0)
    last_activity_date = db.Column(db.Date, nullable=True)

    enrollments = db.relationship(
        "Enrollment", backref="user", lazy=True, cascade="all, delete-orphan"
    )
    video_progress = db.relationship(
        "VideoProgress", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    def to_public_dict(self) -> UserPublic:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "is_admin": self.is_admin,
            "xp": self.xp,
            "streak": self.streak,
        }


class Trail(db.Model):
    id = db.Column(db.String, primary_key=True)
    icon = db.Column(db.String, nullable=False)
    title = db.Column(db.String, nullable=False)
    format = db.Column(db.String, nullable=False)
    duration_weeks_min = db.Column(db.Integer, nullable=False)
    duration_weeks_max = db.Column(db.Integer, nullable=False)

    modules = db.relationship(
        "TrailModule", backref="trail", lazy=True, cascade="all, delete-orphan"
    )
    videos = db.relationship(
        "VideoLesson", backref="trail", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        ordered_modules = sorted(self.modules, key=lambda m: m.position)
        return {
            "id": self.id,
            "icon": self.icon,
            "title": self.title,
            "modules": [m.name for m in ordered_modules],
            "duration_weeks_min": self.duration_weeks_min,
            "duration_weeks_max": self.duration_weeks_max,
            "format": self.format,
        }


class TrailModule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    trail_id = db.Column(db.String, db.ForeignKey("trail.id"), nullable=False)
    name = db.Column(db.String, nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)


class VideoLesson(db.Model):
    id = db.Column(db.String, primary_key=True)
    trail_id = db.Column(db.String, db.ForeignKey("trail.id"), nullable=False)
    title = db.Column(db.String, nullable=False)
    provider = db.Column(db.String, nullable=False, default="external")
    url = db.Column(db.String, nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False, default=0)
    position = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "provider": self.provider,
            "url": self.url,
            "duration_minutes": self.duration_minutes,
        }


class Enrollment(db.Model):
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=False, index=True)
    trail_id = db.Column(db.String, db.ForeignKey("trail.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("user_id", "trail_id", name="uq_enrollment"),)


class VideoProgress(db.Model):
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=False, index=True)
    video_id = db.Column(
        db.String, db.ForeignKey("video_lesson.id"), nullable=False, index=True
    )
    trail_id = db.Column(db.String, db.ForeignKey("trail.id"), nullable=False, index=True)
    completed_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    xp_awarded = db.Column(db.Integer, nullable=False, default=10)

    __table_args__ = (
        db.UniqueConstraint("user_id", "video_id", name="uq_video_progress"),
    )


class DailyCheckIn(db.Model):
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    data_json = db.Column(db.Text, nullable=False)


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.config["SECRET_KEY"] = (
        os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET") or "dev-secret"
    )

    database_url = os.environ.get("DATABASE_URL")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url or "sqlite:///app.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    def _make_token(user):
        payload = {
            "sub": user.id,
            "exp": datetime.utcnow() + timedelta(days=30),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")

    def _current_user(optional=False):
        auth_header = request.headers.get("authorization") or ""
        if not auth_header.lower().startswith("bearer "):
            return None if optional else None
        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return None if optional else None
        try:
            payload = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            user_id = payload.get("sub")
            if not user_id:
                return None if optional else None
            return User.query.filter_by(id=user_id).first()
        except Exception:
            return None if optional else None

    def require_auth(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _current_user(optional=False)
            if not user:
                return jsonify(error="Não autorizado"), 401
            request.current_user = user
            return fn(*args, **kwargs)

        return wrapper

    def require_admin(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _current_user(optional=False)
            if not user:
                return jsonify(error="Não autorizado"), 401
            if not user.is_admin:
                return jsonify(error="Acesso negado"), 403
            request.current_user = user
            return fn(*args, **kwargs)

        return wrapper

    with app.app_context():
        db.create_all()

        if Trail.query.count() == 0:
            seeds = [
                {
                    "id": "protagonismo-lideranca",
                    "icon": "🎭",
                    "title": "Trilha 1: Protagonismo e Liderança",
                    "modules": [
                        "Comunicação Eficaz",
                        "Delegação e Conflitos",
                        "Trabalho em Equipe",
                        "Liderança 2025",
                    ],
                    "duration_weeks_min": 4,
                    "duration_weeks_max": 8,
                    "format": "Microlearning diário (5-10 min)",
                    "videos": [
                        {
                            "title": "Introdução ao Protagonismo",
                            "provider": "youtube",
                            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            "duration_minutes": 10,
                        },
                        {
                            "title": "Comunicação com o Coração",
                            "provider": "youtube",
                            "url": "https://www.youtube.com/watch?v=ysz5P8qQr6I",
                            "duration_minutes": 8,
                        },
                    ],
                },
                {
                    "id": "nr1-cultura-organizacional",
                    "icon": "🏢",
                    "title": "Trilha 2: NR1 e Cultura Organizacional",
                    "modules": [
                        "Conhecer o Negócio",
                        "Valores",
                        "Propósito",
                        "Working Capital",
                    ],
                    "duration_weeks_min": 4,
                    "duration_weeks_max": 4,
                    "format": "Cases empresariais e reflexões diárias",
                    "videos": [
                        {
                            "title": "Cultura Organizacional na Prática",
                            "provider": "youtube",
                            "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                            "duration_minutes": 12,
                        }
                    ],
                },
                {
                    "id": "cuidado-humanizado",
                    "icon": "❤️",
                    "title": "Trilha 3: Cuidado Humanizado",
                    "modules": [
                        "Equilíbrio dos Corpos",
                        "Ética do Cuidado",
                        "Empatia Tripla",
                        "Compaixão em Ação",
                    ],
                    "duration_weeks_min": 6,
                    "duration_weeks_max": 6,
                    "format": "Meditações guiadas e práticas contemplativas",
                    "videos": [
                        {
                            "title": "Meditação: Equilíbrio dos Corpos",
                            "provider": "youtube",
                            "url": "https://www.youtube.com/watch?v=2OEL4P1Rz04",
                            "duration_minutes": 15,
                        }
                    ],
                },
                {
                    "id": "jornada-heroi-rocky",
                    "icon": "⚡",
                    "title": "Trilha 4: Jornada do Herói (Rocky Balboa)",
                    "modules": ["Do Ambiente ao Legado"],
                    "duration_weeks_min": 12,
                    "duration_weeks_max": 12,
                    "format": "Storytelling imersivo e desafios progressivos",
                    "videos": [
                        {
                            "title": "Introdução à Jornada do Herói",
                            "provider": "youtube",
                            "url": "https://www.youtube.com/watch?v=gbRDCWKqvEc",
                            "duration_minutes": 14,
                        }
                    ],
                },
            ]

            for seed in seeds:
                trail = Trail(
                    id=seed["id"],
                    icon=seed["icon"],
                    title=seed["title"],
                    format=seed["format"],
                    duration_weeks_min=seed["duration_weeks_min"],
                    duration_weeks_max=seed["duration_weeks_max"],
                )
                db.session.add(trail)

                for idx, module_name in enumerate(seed["modules"]):
                    db.session.add(
                        TrailModule(
                            trail_id=trail.id,
                            name=module_name,
                            position=idx,
                        )
                    )

                for idx, video in enumerate(seed["videos"]):
                    db.session.add(
                        VideoLesson(
                            id=uuid.uuid4().hex,
                            trail_id=trail.id,
                            title=video["title"],
                            provider=video.get("provider") or "external",
                            url=video["url"],
                            duration_minutes=int(video.get("duration_minutes") or 0),
                            position=idx,
                        )
                    )

            db.session.commit()

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify(status="ok")

    @app.route("/api/auth/signup", methods=["POST"])
    def signup():
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""
        name = (payload.get("name") or "").strip()

        if not email:
            return jsonify(error="Email é obrigatório"), 400
        if not password or len(password) < 8:
            return jsonify(error="Senha precisa ter pelo menos 8 caracteres"), 400
        if User.query.filter_by(email=email).first():
            return jsonify(error="Email já cadastrado"), 409

        is_first_user = User.query.count() == 0
        user = User(
            id=uuid.uuid4().hex,
            email=email,
            name=name or email.split("@")[0],
            password_hash=generate_password_hash(password),
            is_admin=is_first_user,
        )
        db.session.add(user)
        db.session.commit()

        token = _make_token(user)
        return jsonify(token=token, user=user.to_public_dict()), 201

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        if not email or not password:
            return jsonify(error="Email e senha são obrigatórios"), 400

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify(error="Credenciais inválidas"), 401

        token = _make_token(user)
        return jsonify(token=token, user=user.to_public_dict())

    @app.route("/api/me", methods=["GET"])
    @require_auth
    def me():
        user = request.current_user
        return jsonify(user=user.to_public_dict())

    @app.route("/api/dashboard", methods=["GET"])
    def dashboard():
        user = _current_user(optional=True)
        query = DailyCheckIn.query
        if user:
            query = query.filter_by(user_id=user.id)
        latest = query.order_by(DailyCheckIn.created_at.desc()).first()
        if latest:
            try:
                payload = json.loads(latest.data_json)
                return jsonify(payload)
            except Exception:
                pass

        return jsonify(
            hero_name="Nome do Herói",
            level=7,
            flow_today=78,
            practice_of_the_day={"title": "Comunicação com o Coração", "duration_minutes": 8},
            bodies=[
                {"id": "fisico", "label": "Físico", "value": 85},
                {"id": "emocional", "label": "Emocional", "value": 72},
                {"id": "energetico", "label": "Energético", "value": 80},
                {"id": "mental_inferior", "label": "Mental Inferior", "value": 88},
                {"id": "mente_superior", "label": "Mente Superior", "value": 65},
                {"id": "intuitivo", "label": "Intuitivo", "value": 58},
                {"id": "atmico", "label": "Átmico", "value": 75},
            ],
            achievements=[
                {"id": "escuta_ativa", "title": "Mestre da Escuta Ativa"},
                {"id": "flow_7_dias", "title": "7 dias em Estado de Flow"},
            ],
        )

    @app.route("/api/checkins", methods=["POST"])
    @require_auth
    def create_checkin():
        user = request.current_user
        payload = request.get_json(silent=True) or {}
        db.session.add(
            DailyCheckIn(
                id=uuid.uuid4().hex,
                user_id=user.id,
                data_json=json.dumps(payload, ensure_ascii=False),
            )
        )
        db.session.commit()
        return jsonify(status="ok")

    @app.route("/api/trails", methods=["GET"])
    def list_trails():
        trails = Trail.query.all()
        user = _current_user(optional=True)
        enrolled_by_trail = set()
        if user:
            enrolled_by_trail = {
                e.trail_id for e in Enrollment.query.filter_by(user_id=user.id).all()
            }
        result = []
        for t in trails:
            item = t.to_dict()
            if user:
                item["enrolled"] = t.id in enrolled_by_trail
            result.append(item)
        return jsonify(trails=result)

    @app.route("/api/trails/<trail_id>/enroll", methods=["POST"])
    @require_auth
    def enroll_trail(trail_id):
        user = request.current_user
        trail = Trail.query.filter_by(id=trail_id).first()
        if not trail:
            return jsonify(error="Trilha não encontrada"), 404

        existing = Enrollment.query.filter_by(user_id=user.id, trail_id=trail_id).first()
        if existing:
            return jsonify(status="ok", enrollment_id=existing.id)

        enrollment = Enrollment(
            id=uuid.uuid4().hex,
            user_id=user.id,
            trail_id=trail_id,
        )
        db.session.add(enrollment)
        db.session.commit()
        return jsonify(status="ok", enrollment_id=enrollment.id), 201

    @app.route("/api/trails/<trail_id>/videos", methods=["GET"])
    def list_trail_videos(trail_id):
        user = _current_user(optional=True)
        videos = (
            VideoLesson.query.filter_by(trail_id=trail_id)
            .order_by(VideoLesson.position.asc(), VideoLesson.created_at.asc())
            .all()
        )
        completed_ids = set()
        if user:
            completed_ids = {
                vp.video_id
                for vp in VideoProgress.query.filter_by(
                    user_id=user.id, trail_id=trail_id
                ).all()
            }
        payload_videos = []
        for v in videos:
            item = v.to_dict()
            if user:
                item["completed"] = v.id in completed_ids
            payload_videos.append(item)
        return jsonify(trail_id=trail_id, videos=payload_videos)

    @app.route("/api/trails/<trail_id>/videos", methods=["POST"])
    @require_admin
    def create_trail_video(trail_id):
        trail = Trail.query.filter_by(id=trail_id).first()
        if not trail:
            return jsonify(error="Trilha não encontrada"), 404

        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        url = (payload.get("url") or "").strip()
        duration_minutes = payload.get("duration_minutes")

        if not title:
            return jsonify(error="Título é obrigatório"), 400
        if not url:
            return jsonify(error="URL é obrigatória"), 400

        provider = (payload.get("provider") or "").strip().lower()
        if not provider:
            if "youtube.com" in url or "youtu.be" in url:
                provider = "youtube"
            else:
                provider = "external"

        max_position = (
            db.session.query(db.func.max(VideoLesson.position))
            .filter_by(trail_id=trail_id)
            .scalar()
        )
        next_position = int(max_position or 0) + 1

        video = VideoLesson(
            id=uuid.uuid4().hex,
            trail_id=trail_id,
            title=title,
            provider=provider,
            url=url,
            duration_minutes=int(duration_minutes or 0),
            position=next_position,
        )
        db.session.add(video)
        db.session.commit()

        return jsonify(video=video.to_dict()), 201

    @app.route("/api/videos/<video_id>/complete", methods=["POST"])
    @require_auth
    def complete_video(video_id):
        user = request.current_user
        video = VideoLesson.query.filter_by(id=video_id).first()
        if not video:
            return jsonify(error="Vídeo não encontrado"), 404

        existing = VideoProgress.query.filter_by(user_id=user.id, video_id=video_id).first()
        if existing:
            return jsonify(status="ok", user=user.to_public_dict())

        xp_awarded = 10
        progress = VideoProgress(
            id=uuid.uuid4().hex,
            user_id=user.id,
            video_id=video_id,
            trail_id=video.trail_id,
            xp_awarded=xp_awarded,
        )
        db.session.add(progress)

        today = date.today()
        if user.last_activity_date == today:
            pass
        elif user.last_activity_date == (today - timedelta(days=1)):
            user.streak = int(user.streak or 0) + 1
        else:
            user.streak = 1
        user.last_activity_date = today
        user.xp = int(user.xp or 0) + xp_awarded

        db.session.add(user)
        db.session.commit()

        return jsonify(status="ok", user=user.to_public_dict())

    @app.route("/api/progress", methods=["GET"])
    @require_auth
    def progress():
        user = request.current_user
        enrollments = Enrollment.query.filter_by(user_id=user.id).all()
        enrolled_trails = [e.trail_id for e in enrollments]

        total_completed = VideoProgress.query.filter_by(user_id=user.id).count()

        per_trail = {}
        for trail_id in enrolled_trails:
            total_videos = VideoLesson.query.filter_by(trail_id=trail_id).count()
            completed_videos = VideoProgress.query.filter_by(
                user_id=user.id, trail_id=trail_id
            ).count()
            per_trail[trail_id] = {
                "total_videos": total_videos,
                "completed_videos": completed_videos,
            }

        return jsonify(
            user=user.to_public_dict(),
            enrolled_trails=enrolled_trails,
            completed_videos=total_completed,
            per_trail=per_trail,
        )

    @app.route("/api/admin/trails", methods=["POST"])
    @require_admin
    def admin_create_trail():
        payload = request.get_json(silent=True) or {}
        trail_id = (payload.get("id") or "").strip()
        title = (payload.get("title") or "").strip()
        icon = (payload.get("icon") or "").strip() or "📌"
        format_text = (payload.get("format") or "").strip()
        modules = payload.get("modules") or []

        if not trail_id:
            return jsonify(error="ID é obrigatório"), 400
        if Trail.query.filter_by(id=trail_id).first():
            return jsonify(error="ID já existe"), 409
        if not title:
            return jsonify(error="Título é obrigatório"), 400
        if not format_text:
            return jsonify(error="Formato é obrigatório"), 400

        duration_weeks_min = int(payload.get("duration_weeks_min") or 0)
        duration_weeks_max = int(payload.get("duration_weeks_max") or 0)
        if duration_weeks_min <= 0:
            return jsonify(error="Duração mínima inválida"), 400
        if duration_weeks_max <= 0:
            return jsonify(error="Duração máxima inválida"), 400

        trail = Trail(
            id=trail_id,
            icon=icon,
            title=title,
            format=format_text,
            duration_weeks_min=duration_weeks_min,
            duration_weeks_max=duration_weeks_max,
        )
        db.session.add(trail)

        if not isinstance(modules, list):
            modules = []
        for idx, module_name in enumerate(modules):
            module_name = (str(module_name) or "").strip()
            if module_name:
                db.session.add(
                    TrailModule(trail_id=trail.id, name=module_name, position=idx)
                )

        db.session.commit()
        return jsonify(trail=trail.to_dict()), 201

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
