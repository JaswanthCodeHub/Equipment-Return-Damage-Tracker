from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import secrets
import smtplib
import sqlite3
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from flask import Flask, Response, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "equipment_tracker.db"
VALID_CONDITIONS = {"excellent", "good", "fair", "damaged", "lost"}
RETURN_STATUSES = {"due", "overdue", "returned", "inspection", "claim_pending", "closed"}
BOOKING_STATUSES = {"pending", "approved", "active", "return_requested", "returned", "rejected", "cancelled"}
DEFAULT_SETTINGS = {
    "company_name": "SD Digitals",
    "support_email": "admin@sd-digitals.com",
    "support_phone": "+91 90000 00000",
    "notify_booking_approvals": True,
    "notify_return_inspections": True,
    "notify_payment_refunds": True,
    "notify_damage_escalation": True,
}


def normalize_image_url(value: str | None) -> str:
    image_url = str(value or "").strip()
    if not image_url:
        return ""
    parsed = urlparse(image_url)
    params = parse_qs(parsed.query)
    for key in ("imgurl", "mediaurl", "url"):
        candidate = params.get(key, [""])[0]
        if candidate:
            return unquote(candidate).strip()
    return image_url


def normalize_phone(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    prefix = "+" if raw.startswith("+") else ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    return f"{prefix}{digits}" if digits else ""


def is_email_identifier(value: str) -> bool:
    return "@" in value and "." in value.split("@")[-1]


def load_env_file() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file()


# PostgreSQL Drop-in Wrapper for SQLite compatibility using pure-Python pg8000
class PostgresRow:
    def __init__(self, row_dict):
        self._dict = row_dict

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self._dict.values())[key]
        return self._dict[key]

    def keys(self):
        return self._dict.keys()

class PostgresCursorWrapper:
    def __init__(self, cur):
        self.cur = cur
        self._lastrowid = None

    def execute(self, sql, params=None):
        if params is None:
            params = ()
        sql = sql.replace("?", "%s")
        if "INSERT OR IGNORE INTO users" in sql:
            sql = sql.replace("INSERT OR IGNORE INTO users", "INSERT INTO users")
            sql += " ON CONFLICT (email) DO NOTHING"
        elif "INSERT OR IGNORE INTO app_settings" in sql:
            sql = sql.replace("INSERT OR IGNORE INTO app_settings", "INSERT INTO app_settings")
            sql += " ON CONFLICT (key) DO NOTHING"
        
        is_insert = sql.strip().upper().startswith("INSERT INTO")
        skip_returning = "app_settings" in sql or "ON CONFLICT" in sql
        if is_insert and "RETURNING" not in sql.upper() and not skip_returning:
            sql += " RETURNING id"
            self.cur.execute(sql, params)
            try:
                row = self.cur.fetchone()
                if row:
                    self._lastrowid = row[0]
            except Exception:
                pass
        else:
            self.cur.execute(sql, params)
        return self

    def executemany(self, sql, seq_of_parameters):
        sql = sql.replace("?", "%s")
        if "INSERT OR IGNORE INTO users" in sql:
            sql = sql.replace("INSERT OR IGNORE INTO users", "INSERT INTO users")
            sql += " ON CONFLICT (email) DO NOTHING"
        elif "INSERT OR IGNORE INTO app_settings" in sql:
            sql = sql.replace("INSERT OR IGNORE INTO app_settings", "INSERT INTO app_settings")
            sql += " ON CONFLICT (key) DO NOTHING"
        for params in seq_of_parameters:
            self.cur.execute(sql, params)
        return self

    def _convert_row(self, row):
        if row is None:
            return None
        cols = [col[0] for col in self.cur.description]
        row_dict = dict(zip(cols, row))
        return PostgresRow(row_dict)

    def fetchone(self):
        row = self.cur.fetchone()
        return self._convert_row(row)

    def fetchall(self):
        rows = self.cur.fetchall()
        cols = [col[0] for col in self.cur.description]
        return [PostgresRow(dict(zip(cols, row))) for row in rows]

    @property
    def rowcount(self):
        return self.cur.rowcount

    @property
    def lastrowid(self):
        return self._lastrowid

class PostgresConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        cur = self.conn.cursor()
        return PostgresCursorWrapper(cur)

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def executemany(self, sql, seq_of_parameters):
        cur = self.cursor()
        cur.executemany(sql, seq_of_parameters)
        return cur

    def executescript(self, sql_script):
        sql_script = sql_script.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
        cur = self.cursor()
        for statement in sql_script.split(";"):
            statement = statement.strip()
            if statement:
                if statement.upper().startswith("PRAGMA"):
                    continue
                cur.execute(statement)
        self.conn.commit()
        return cur

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(ROOT / "frontend" / "templates"),
        static_folder=str(ROOT / "frontend" / "static"),
    )
    db_path = os.environ.get("DATABASE_URL") or os.environ.get("TRACKER_DB")
    if not db_path:
        if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
            db_path = "/tmp/equipment_tracker.db"
        else:
            db_path = str(DEFAULT_DB)

    app.config.update(
        DATABASE=db_path,
        SECRET_KEY=os.environ.get("SECRET_KEY", "sd-digitals-development-key"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    if test_config:
        app.config.update(test_config)
    
    db_conn_str = app.config["DATABASE"]
    is_postgres = db_conn_str.startswith("postgresql://") or db_conn_str.startswith("postgres://")

    if not is_postgres:
        try:
            Path(db_conn_str).parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            app.config["DATABASE"] = "/tmp/equipment_tracker.db"
            Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)

    def now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def get_db():
        if "db" not in g:
            if is_postgres:
                import pg8000.dbapi
                url = db_conn_str
                result = urlparse(url)
                username = result.username
                password = unquote(result.password or "")
                database = result.path[1:]
                hostname = result.hostname
                port = result.port or 5432
                conn = pg8000.dbapi.connect(
                    user=username,
                    password=password,
                    host=hostname,
                    port=port,
                    database=database,
                    ssl_context=True
                )
                g.db = PostgresConnectionWrapper(conn)
            else:
                g.db = sqlite3.connect(app.config["DATABASE"])
                g.db.row_factory = sqlite3.Row
                g.db.execute("PRAGMA foreign_keys = ON")
        return g.db

    @app.teardown_appcontext
    def close_db(_error=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    def add_missing_column(table: str, column: str, definition: str) -> None:
        if is_postgres:
            row = get_db().execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name=%s AND column_name=%s",
                (table, column)
            ).fetchone()
            if row is None:
                get_db().execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        else:
            columns = {row["name"] for row in get_db().execute(f"PRAGMA table_info({table})")}
            if column not in columns:
                get_db().execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def init_db() -> None:
        db = get_db()
        if is_postgres:
            # Check if tables already exist to avoid slow re-initialization on every cold start
            check = db.execute(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users'"
            ).fetchone()
            tables_exist = check[0] > 0 if check else False
            if not tables_exist:
                schema_sql = (ROOT / "backend" / "schema.sql").read_text(encoding="utf-8")
                schema_sql = schema_sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
                schema_sql = schema_sql.replace("REAL", "DOUBLE PRECISION")
                for statement in schema_sql.split(";"):
                    statement = statement.strip()
                    if statement and not statement.upper().startswith("PRAGMA"):
                        try:
                            db.execute(statement)
                        except Exception:
                            db.rollback()
                            db.execute(statement)
                db.commit()
                for column, definition in {
                    "image_url": "TEXT DEFAULT ''",
                }.items():
                    add_missing_column("equipment", column, definition)
                for column, definition in {
                    "user_id": "INTEGER REFERENCES users(id)",
                    "booking_id": "INTEGER REFERENCES bookings(id)",
                    "return_request_status": "TEXT NOT NULL DEFAULT 'pending'",
                    "deduction_status": "TEXT NOT NULL DEFAULT 'pending'",
                }.items():
                    add_missing_column("equipment_returns", column, definition)
                seed_core_data()
                db.commit()
        else:
            db.executescript((ROOT / "backend" / "schema.sql").read_text(encoding="utf-8"))
            for column, definition in {
                "image_url": "TEXT DEFAULT ''",
            }.items():
                add_missing_column("equipment", column, definition)
            for column, definition in {
                "user_id": "INTEGER REFERENCES users(id)",
                "booking_id": "INTEGER REFERENCES bookings(id)",
                "return_request_status": "TEXT NOT NULL DEFAULT 'pending'",
                "deduction_status": "TEXT NOT NULL DEFAULT 'pending'",
            }.items():
                add_missing_column("equipment_returns", column, definition)
            seed_core_data()
            db.commit()

    def seed_core_data() -> None:
        db = get_db()
        accounts = [
            ("System Administrator", "admin@sd-digitals.com", "+91 90000 00001", "Admin@123", "admin"),
            ("Rahul", "user@sd-digitals.com", "+91 90000 00002", "User@123", "user"),
        ]
        for name, email, phone, password, role in accounts:
            db.execute(
                "INSERT OR IGNORE INTO users (name,email,phone,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                (name, email, phone, generate_password_hash(password), role, now(), now()),
            )
        db.execute("UPDATE users SET name=?, updated_at=? WHERE lower(email)=?", ("Rahul", now(), "user@sd-digitals.com"))
        if db.execute("SELECT COUNT(*) FROM equipment").fetchone()[0] == 0:
            inventory = [
                ("CAM-104", "Sony A7 IV", "Camera", "https://img.sanishtech.com/u/d8014da5839dc5f745735faa0d258c4c.png", "33 MP full-frame hybrid camera", 2500, 30000, 2, 2),
                ("CAM-210", "Canon EOS R6 Mark II", "Camera", "https://img.sanishtech.com/u/0d8884127f2719bb117b75190796e3b5.png", "Full-frame mirrorless camera", 2800, 32000, 2, 2),
                ("LEN-208", "Canon RF 70-200mm", "Lens", "https://img.sanishtech.com/u/755e7618114c6b325c14b22ae7369cd8.png", "Professional telephoto zoom lens", 1400, 18000, 3, 3),
                ("GIM-312", "DJI RS 4 Pro", "Gimbal", "https://img.sanishtech.com/u/afe2af4e797933cc83a950c8bc28a122.png", "Cinema camera stabilizer", 1200, 15000, 2, 2),
                ("AUD-118", "Rode Wireless PRO", "Audio", "https://img.sanishtech.com/u/43e091aacefff4f2fd317e373bf79cc7.png", "Dual-channel wireless microphone", 850, 10000, 4, 4),
                ("LGT-410", "Aputure 300D II", "Lighting", "https://img.sanishtech.com/u/062eff6a077389025fe08b8b5635bb73.png", "Daylight LED studio light", 1100, 14000, 2, 2),
            ]
            db.executemany(
                "INSERT INTO equipment (code,name,category,image_url,description,daily_rate,deposit_amount,stock_total,stock_available,condition,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?, 'excellent','available',?,?)",
                [(*item, now(), now()) for item in inventory],
            )
        for key, value in DEFAULT_SETTINGS.items():
            db.execute(
                "INSERT OR IGNORE INTO app_settings (key,value,updated_at) VALUES (?,?,?)",
                (key, json.dumps(value), now()),
            )

    def get_settings() -> dict:
        rows = get_db().execute("SELECT key,value FROM app_settings").fetchall()
        settings = DEFAULT_SETTINGS.copy()
        for row in rows:
            try:
                settings[row["key"]] = json.loads(row["value"])
            except json.JSONDecodeError:
                settings[row["key"]] = row["value"]
        return settings

    def save_settings(payload: dict) -> dict:
        allowed = DEFAULT_SETTINGS.keys()
        settings = get_settings()
        db = get_db()
        for key in allowed:
            if key not in payload:
                continue
            if key.startswith("notify_"):
                value = bool(payload.get(key))
            else:
                value = str(payload.get(key, "")).strip()
            settings[key] = value
            db.execute(
                "INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
                (key, json.dumps(value), now()),
            )
        db.commit()
        return settings

    def current_user():
        user_id = session.get("user_id")
        if not user_id:
            return None
        return get_db().execute("SELECT id,name,email,phone,role,active,created_at FROM users WHERE id=?", (user_id,)).fetchone()

    def auth_required(role: str | None = None):
        def decorator(func):
            @wraps(func)
            def wrapped(*args, **kwargs):
                user = current_user()
                if user is None or not user["active"]:
                    return jsonify(error="Authentication required"), 401
                if role and user["role"] != role:
                    return jsonify(error="Permission denied"), 403
                g.user = user
                return func(*args, **kwargs)
            return wrapped
        return decorator

    def parse_date(value: str, field: str) -> tuple[date | None, str | None]:
        try:
            return date.fromisoformat(value), None
        except (TypeError, ValueError):
            return None, f"{field} must be YYYY-MM-DD"

    def equipment_dict(row: sqlite3.Row) -> dict:
        item = dict(row)
        item["image_url"] = normalize_image_url(item.get("image_url"))
        return item

    def booking_dict(row: sqlite3.Row) -> dict:
        item = dict(row)
        item["is_overdue"] = item["status"] in {"approved", "active", "return_requested"} and item["end_date"] < date.today().isoformat()
        return item

    def return_dict(row: sqlite3.Row, history: bool = False) -> dict:
        item = dict(row)
        item["is_overdue"] = item["status"] not in {"returned", "closed"} and item["return_due_date"] < date.today().isoformat()
        item["balance_refund"] = round(item["deposit_amount"] - item["deposit_deduction"], 2)
        item.setdefault("booking_days", None)
        item.setdefault("rental_amount", None)
        if history:
            rows = get_db().execute("SELECT * FROM action_history WHERE return_id=? ORDER BY id DESC", (item["id"],)).fetchall()
            item["history"] = [dict(entry) for entry in rows]
        return item

    def add_history(return_id: int, action: str, from_status: str | None, to_status: str | None, note: str = "") -> None:
        get_db().execute(
            "INSERT INTO action_history (return_id,action,from_status,to_status,note) VALUES (?,?,?,?,?)",
            (return_id, action, from_status, to_status, note),
        )

    def hash_otp(email: str, otp: str) -> str:
        return hashlib.sha256(f"{email.lower()}:{otp}:{app.config['SECRET_KEY']}".encode("utf-8")).hexdigest()

    def send_reset_email(email: str, otp: str) -> bool:
        smtp_host = os.environ.get("SMTP_HOST", "").strip()
        smtp_user = os.environ.get("SMTP_USER", "").strip()
        smtp_password = os.environ.get("SMTP_PASSWORD", "").strip()
        smtp_from = os.environ.get("SMTP_FROM", smtp_user or "no-reply@sd-digitals.local").strip()
        smtp_port_value = os.environ.get("SMTP_PORT", "587").strip()
        try:
            smtp_port = int(smtp_port_value or "587")
        except ValueError:
            smtp_port = 587
        smtp_use_ssl = os.environ.get("SMTP_USE_SSL", "false").strip().lower() in {"1", "true", "yes"}
        smtp_use_tls = os.environ.get("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes"}
        if not smtp_host:
            app.logger.info("Password reset OTP for %s: %s", email, otp)
            return False
        message = EmailMessage()
        message["Subject"] = "SD Digitals password reset OTP"
        message["From"] = smtp_from
        message["To"] = email
        message.set_content(
            f"Your SD Digitals password reset OTP is {otp}.\n\n"
            "This OTP expires in 10 minutes. If you did not request this reset, ignore this email."
        )
        try:
            smtp_class = smtplib.SMTP_SSL if smtp_use_ssl else smtplib.SMTP
            with smtp_class(smtp_host, smtp_port, timeout=10) as smtp:
                if smtp_use_tls and not smtp_use_ssl:
                    smtp.starttls()
                if smtp_user:
                    smtp.login(smtp_user, smtp_password)
                smtp.send_message(message)
            return True
        except Exception as e:
            app.logger.error("Failed to send email to %s: %s", email, e)
            app.logger.info("Password reset OTP for %s: %s", email, otp)
            return False

    def portal_path_for_role(role: str) -> str:
        return url_for("admin_portal") if role == "admin" else url_for("user_portal")

    @app.get("/")
    def index():
        user = current_user()
        if user and user["active"]:
            return redirect(portal_path_for_role(user["role"]))
        return redirect(url_for("user_portal"))

    @app.get("/admin")
    def admin_portal():
        return render_template("admin.html")

    @app.get("/user")
    def user_portal():
        return render_template("user.html")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="Equipment Return & Damage Tracker")

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        identifier = str(payload.get("email", "")).strip().lower()
        expected_role = str(payload.get("portal", "")).strip().lower()
        if is_email_identifier(identifier):
            user = get_db().execute("SELECT * FROM users WHERE lower(email)=?", (identifier,)).fetchone()
        else:
            phone = normalize_phone(identifier)
            users = get_db().execute("SELECT * FROM users").fetchall()
            user = next((row for row in users if normalize_phone(row["phone"]) == phone), None)
        if user is None or not user["active"] or not check_password_hash(user["password_hash"], str(payload.get("password", ""))):
            return jsonify(error="Invalid email or password"), 401
        if expected_role in {"admin", "user"} and user["role"] != expected_role:
            portal_name = "admin" if user["role"] == "admin" else "user"
            return jsonify(error=f"Use the {portal_name} panel to sign in to this account"), 403
        session.clear()
        session["user_id"] = user["id"]
        return jsonify(user={key: user[key] for key in ("id", "name", "email", "phone", "role")})

    @app.post("/api/auth/register")
    def register():
        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        phone = str(payload.get("phone", "")).strip()
        password = str(payload.get("password", ""))
        errors = []
        if not name:
            errors.append("Full name is required")
        if "@" not in email or "." not in email.split("@")[-1]:
            errors.append("Valid email address is required")
        if len(password) < 6:
            errors.append("Password must be at least 6 characters")
        if errors:
            return jsonify(error="Registration failed", details=errors), 400
        db = get_db()
        if db.execute("SELECT id FROM users WHERE lower(email)=?", (email,)).fetchone():
            return jsonify(error="An account with this email already exists"), 409
        cursor = db.execute(
            "INSERT INTO users (name,email,phone,password_hash,role,created_at,updated_at) VALUES (?,?,?,?, 'user',?,?)",
            (name, email, phone, generate_password_hash(password), now(), now()),
        )
        db.commit()
        session.clear()
        session["user_id"] = cursor.lastrowid
        user = db.execute("SELECT id,name,email,phone,role FROM users WHERE id=?", (cursor.lastrowid,)).fetchone()
        return jsonify(user=dict(user), message="Account created successfully"), 201

    @app.post("/api/auth/google")
    def google_sign_in():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip().lower()
        name = str(payload.get("name", "")).strip() or email.split("@")[0].replace(".", " ").title()
        if "@" not in email or "." not in email.split("@")[-1]:
            return jsonify(error="Valid Google email address is required"), 400
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
        if user and user["role"] != "user":
            return jsonify(error="Use the admin panel to sign in to this account"), 403
        if user is None:
            cursor = db.execute(
                "INSERT INTO users (name,email,phone,password_hash,role,created_at,updated_at) VALUES (?,?,?,?, 'user',?,?)",
                (name, email, "", generate_password_hash(secrets.token_urlsafe(32)), now(), now()),
            )
            db.commit()
            user = db.execute("SELECT * FROM users WHERE id=?", (cursor.lastrowid,)).fetchone()
        elif not user["active"]:
            return jsonify(error="This account is disabled"), 403
        session.clear()
        session["user_id"] = user["id"]
        return jsonify(user={key: user[key] for key in ("id", "name", "email", "phone", "role")}, message="Signed in with Google")

    @app.post("/api/auth/forgot-password")
    def forgot_password():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip().lower()
        errors = []
        if "@" not in email or "." not in email.split("@")[-1]:
            errors.append("Valid email address is required")
        if errors:
            return jsonify(error="Password reset failed", details=errors), 400
        db = get_db()
        user = db.execute("SELECT id,email,active FROM users WHERE lower(email)=?", (email,)).fetchone()
        if user is None or not user["active"]:
            return jsonify(error="Account not found"), 404
        otp = f"{secrets.randbelow(900000) + 100000}"
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        db.execute("UPDATE password_reset_otps SET used=1 WHERE user_id=? AND used=0", (user["id"],))
        db.execute(
            "INSERT INTO password_reset_otps (user_id,email,otp_hash,expires_at,created_at) VALUES (?,?,?,?,?)",
            (user["id"], email, hash_otp(email, otp), expires_at, now()),
        )
        db.commit()
        sent = send_reset_email(user["email"], otp)
        response = {"message": "OTP sent to your email", "email_sent": sent}
        if not sent:
            response["dev_otp"] = otp
            response["message"] = "OTP generated. Configure SMTP to send email; dev OTP returned for local testing."
        return jsonify(response)

    @app.post("/api/auth/verify-otp")
    def verify_otp():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip().lower()
        otp = str(payload.get("otp", "")).strip()
        if not otp.isdigit() or len(otp) != 6:
            return jsonify(error="Valid 6 digit OTP is required"), 400
        db = get_db()
        user = db.execute("SELECT id,active FROM users WHERE lower(email)=?", (email,)).fetchone()
        if user is None or not user["active"]:
            return jsonify(error="Account not found"), 404
        otp_row = db.execute(
            "SELECT id,otp_hash,expires_at FROM password_reset_otps WHERE user_id=? AND email=? AND used=0 ORDER BY id DESC LIMIT 1",
            (user["id"], email),
        ).fetchone()
        if otp_row is None or otp_row["otp_hash"] != hash_otp(email, otp):
            return jsonify(error="Invalid OTP"), 400
        expires_at = datetime.fromisoformat(otp_row["expires_at"])
        if expires_at < datetime.now(timezone.utc):
            return jsonify(error="OTP expired"), 400
        return jsonify(message="OTP verified")

    @app.post("/api/auth/reset-password")
    def reset_password():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip().lower()
        otp = str(payload.get("otp", "")).strip()
        password = str(payload.get("password", ""))
        errors = []
        if "@" not in email or "." not in email.split("@")[-1]:
            errors.append("Valid email address is required")
        if not otp.isdigit() or len(otp) != 6:
            errors.append("Valid 6 digit OTP is required")
        if len(password) < 6:
            errors.append("Password must be at least 6 characters")
        if errors:
            return jsonify(error="Password reset failed", details=errors), 400
        db = get_db()
        user = db.execute("SELECT id,active FROM users WHERE lower(email)=?", (email,)).fetchone()
        if user is None or not user["active"]:
            return jsonify(error="Account not found"), 404
        otp_row = db.execute(
            "SELECT id,otp_hash,expires_at FROM password_reset_otps WHERE user_id=? AND email=? AND used=0 ORDER BY id DESC LIMIT 1",
            (user["id"], email),
        ).fetchone()
        if otp_row is None or otp_row["otp_hash"] != hash_otp(email, otp):
            return jsonify(error="Invalid OTP"), 400
        expires_at = datetime.fromisoformat(otp_row["expires_at"])
        if expires_at < datetime.now(timezone.utc):
            db.execute("UPDATE password_reset_otps SET used=1 WHERE id=?", (otp_row["id"],))
            db.commit()
            return jsonify(error="OTP expired"), 400
        db.execute("UPDATE users SET password_hash=?,updated_at=? WHERE id=?", (generate_password_hash(password), now(), user["id"]))
        db.execute("UPDATE password_reset_otps SET used=1 WHERE id=?", (otp_row["id"],))
        db.commit()
        return jsonify(message="Password reset successfully")

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify(message="Logged out")

    @app.get("/api/auth/me")
    @auth_required()
    def me():
        return jsonify(user=dict(g.user))

    @app.get("/api/profile")
    @auth_required()
    def get_profile():
        return jsonify(dict(g.user))

    @app.patch("/api/profile")
    @auth_required()
    def update_profile():
        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", g.user["name"])).strip()
        phone = str(payload.get("phone", g.user["phone"] or "")).strip()
        if not name:
            return jsonify(error="Name is required"), 400
        get_db().execute("UPDATE users SET name=?,phone=?,updated_at=? WHERE id=?", (name, phone, now(), g.user["id"]))
        get_db().commit()
        return jsonify(dict(get_db().execute("SELECT id,name,email,phone,role,active,created_at FROM users WHERE id=?", (g.user["id"],)).fetchone()))

    @app.get("/api/settings")
    @auth_required("admin")
    def get_app_settings():
        return jsonify(get_settings())

    @app.patch("/api/settings")
    @auth_required("admin")
    def update_app_settings():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("support_email", "")).strip()
        if email and ("@" not in email or "." not in email.split("@")[-1]):
            return jsonify(error="Support email must be valid"), 400
        return jsonify(save_settings(payload))

    @app.get("/api/equipment")
    @auth_required()
    def list_equipment():
        rows = get_db().execute("SELECT * FROM equipment ORDER BY status, category, name").fetchall()
        return jsonify([equipment_dict(row) for row in rows])

    @app.post("/api/equipment")
    @auth_required("admin")
    def create_equipment():
        payload = request.get_json(silent=True) or {}
        required = ["code", "name", "category", "daily_rate", "deposit_amount", "stock_total"]
        missing = [field for field in required if payload.get(field) in (None, "")]
        if missing:
            return jsonify(error="Missing required fields", details=missing), 400
        try:
            stock = int(payload["stock_total"])
            rate = float(payload["daily_rate"])
            deposit = float(payload["deposit_amount"])
            if min(stock, rate, deposit) < 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify(error="Stock and financial values must be non-negative numbers"), 400
        try:
            cursor = get_db().execute(
                "INSERT INTO equipment (code,name,category,image_url,description,daily_rate,deposit_amount,stock_total,stock_available,condition,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (str(payload["code"]).strip(), str(payload["name"]).strip(), payload["category"], normalize_image_url(payload.get("image_url")), payload.get("description", ""), rate, deposit, stock, stock, payload.get("condition", "excellent"), payload.get("status", "available"), now(), now()),
            )
        except Exception as e:
            if "IntegrityError" in type(e).__name__ or "UniqueViolation" in type(e).__name__:
                return jsonify(error="Equipment code already exists"), 409
            raise e
        return jsonify(equipment_dict(get_db().execute("SELECT * FROM equipment WHERE id=?", (cursor.lastrowid,)).fetchone())), 201

    @app.patch("/api/equipment/<int:equipment_id>")
    @auth_required("admin")
    def update_equipment(equipment_id: int):
        current = get_db().execute("SELECT * FROM equipment WHERE id=?", (equipment_id,)).fetchone()
        if current is None:
            return jsonify(error="Equipment not found"), 404
        payload = request.get_json(silent=True) or {}
        total = int(payload.get("stock_total", current["stock_total"]))
        available = int(payload.get("stock_available", current["stock_available"]))
        if total < 0 or available < 0 or available > total:
            return jsonify(error="Available stock must be between zero and total stock"), 400
        get_db().execute(
            "UPDATE equipment SET name=?,category=?,image_url=?,description=?,daily_rate=?,deposit_amount=?,stock_total=?,stock_available=?,condition=?,status=?,updated_at=? WHERE id=?",
            (payload.get("name", current["name"]), payload.get("category", current["category"]), normalize_image_url(payload.get("image_url", current["image_url"] or "")), payload.get("description", current["description"]), float(payload.get("daily_rate", current["daily_rate"])), float(payload.get("deposit_amount", current["deposit_amount"])), total, available, payload.get("condition", current["condition"]), payload.get("status", current["status"]), now(), equipment_id),
        )
        get_db().commit()
        return jsonify(equipment_dict(get_db().execute("SELECT * FROM equipment WHERE id=?", (equipment_id,)).fetchone()))

    @app.post("/api/bookings")
    @auth_required("user")
    def create_booking():
        payload = request.get_json(silent=True) or {}
        equipment = get_db().execute("SELECT * FROM equipment WHERE id=?", (payload.get("equipment_id"),)).fetchone()
        if equipment is None or equipment["status"] != "available" or equipment["stock_available"] < 1:
            return jsonify(error="Equipment is not available"), 400
        start, start_error = parse_date(payload.get("start_date"), "Start date")
        end, end_error = parse_date(payload.get("end_date"), "End date")
        if start_error or end_error:
            return jsonify(error=start_error or end_error), 400
        if end < start:
            return jsonify(error="End date cannot be before start date"), 400
        days = (end - start).days + 1
        cursor = get_db().execute(
            "INSERT INTO bookings (user_id,equipment_id,start_date,end_date,days,total_amount,deposit_amount,status,purpose,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?,?)",
            (g.user["id"], equipment["id"], start.isoformat(), end.isoformat(), days, days * equipment["daily_rate"], equipment["deposit_amount"], str(payload.get("purpose", "")).strip(), now(), now()),
        )
        get_db().commit()
        return jsonify(id=cursor.lastrowid, status="pending", message="Booking request submitted"), 201

    @app.get("/api/bookings")
    @auth_required()
    def list_bookings():
        sql = """SELECT b.*,u.name customer_name,u.email customer_email,e.name equipment_name,e.code equipment_code,e.category
                 FROM bookings b JOIN users u ON u.id=b.user_id JOIN equipment e ON e.id=b.equipment_id"""
        params = []
        if g.user["role"] == "user":
            sql += " WHERE b.user_id=?"
            params.append(g.user["id"])
        sql += " ORDER BY b.id DESC"
        return jsonify([booking_dict(row) for row in get_db().execute(sql, params).fetchall()])

    @app.patch("/api/bookings/<int:booking_id>/status")
    @auth_required("admin")
    def booking_status(booking_id: int):
        payload = request.get_json(silent=True) or {}
        status = payload.get("status")
        if status not in BOOKING_STATUSES:
            return jsonify(error="Invalid booking status"), 400
        db = get_db()
        booking = db.execute("SELECT * FROM bookings WHERE id=?", (booking_id,)).fetchone()
        if booking is None:
            return jsonify(error="Booking not found"), 404
        old = booking["status"]
        if old == status:
            return jsonify(message="Status unchanged")
        if status in {"approved", "active"} and old == "pending":
            changed = db.execute("UPDATE equipment SET stock_available=stock_available-1,updated_at=? WHERE id=? AND stock_available>0", (now(), booking["equipment_id"]))
            if changed.rowcount == 0:
                return jsonify(error="No stock is available"), 400
        if status in {"rejected", "cancelled"} and old in {"approved", "active"}:
            db.execute("UPDATE equipment SET stock_available=MIN(stock_total,stock_available+1),updated_at=? WHERE id=?", (now(), booking["equipment_id"]))
        db.execute("UPDATE bookings SET status=?,updated_at=? WHERE id=?", (status, now(), booking_id))
        db.commit()
        return jsonify(message="Booking status updated", status=status)

    @app.post("/api/returns/request")
    @auth_required("user")
    def request_return():
        payload = request.get_json(silent=True) or {}
        booking = get_db().execute(
            """SELECT b.*,u.name customer_name,u.phone customer_phone,u.email customer_email,
                      e.name equipment_name,e.code equipment_code,e.category
               FROM bookings b JOIN users u ON u.id=b.user_id JOIN equipment e ON e.id=b.equipment_id
               WHERE b.id=? AND b.user_id=?""",
            (payload.get("booking_id"), g.user["id"]),
        ).fetchone()
        if booking is None or booking["status"] not in {"approved", "active"}:
            return jsonify(error="This rental is not eligible for return"), 400
        existing = get_db().execute("SELECT id FROM equipment_returns WHERE booking_id=?", (booking["id"],)).fetchone()
        if existing:
            return jsonify(error="A return request already exists"), 409
        requested_date = payload.get("actual_return_date") or date.today().isoformat()
        _, error = parse_date(requested_date, "Return date")
        if error:
            return jsonify(error=error), 400
        cursor = get_db().execute(
            """INSERT INTO equipment_returns
               (user_id,booking_id,customer_name,customer_phone,customer_email,equipment_name,equipment_code,category,
                rental_start_date,return_due_date,actual_return_date,deposit_amount,owner,notes,status,
                return_request_status,deduction_status,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'inspection','pending','pending',?,?)""",
            (g.user["id"], booking["id"], booking["customer_name"], booking["customer_phone"] or "", booking["customer_email"], booking["equipment_name"], booking["equipment_code"], booking["category"], booking["start_date"], booking["end_date"], requested_date, booking["deposit_amount"], "Rental Admin", str(payload.get("notes", "")).strip(), now(), now()),
        )
        add_history(cursor.lastrowid, "Return requested", booking["status"], "inspection", payload.get("notes", ""))
        get_db().execute("UPDATE bookings SET status='return_requested',updated_at=? WHERE id=?", (now(), booking["id"]))
        get_db().commit()
        return jsonify(id=cursor.lastrowid, status="inspection", message="Return request submitted"), 201

    @app.get("/api/returns")
    @auth_required()
    def list_returns():
        clauses, params = [], []
        if g.user["role"] == "user":
            clauses.append("r.user_id=?")
            params.append(g.user["id"])
        status = request.args.get("status", "").strip()
        if status:
            clauses.append("r.status=?")
            params.append(status)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        rows = get_db().execute(
            f"""SELECT r.*,b.days booking_days,b.total_amount rental_amount
                FROM equipment_returns r LEFT JOIN bookings b ON b.id=r.booking_id
                {where} ORDER BY r.id DESC""",
            params,
        ).fetchall()
        return jsonify([return_dict(row) for row in rows])

    @app.get("/api/returns/<int:return_id>")
    @auth_required()
    def get_return(return_id: int):
        row = get_db().execute(
            """SELECT r.*,b.days booking_days,b.total_amount rental_amount
               FROM equipment_returns r LEFT JOIN bookings b ON b.id=r.booking_id WHERE r.id=?""",
            (return_id,),
        ).fetchone()
        if row is None or (g.user["role"] == "user" and row["user_id"] != g.user["id"]):
            return jsonify(error="Return record not found"), 404
        return jsonify(return_dict(row, True))

    @app.post("/api/returns/<int:return_id>/process")
    @auth_required("admin")
    def process_return(return_id: int):
        payload = request.get_json(silent=True) or {}
        condition = payload.get("condition")
        if condition not in VALID_CONDITIONS:
            return jsonify(error="Invalid condition"), 400
        try:
            repair_cost = float(payload.get("repair_cost", 0))
            if repair_cost < 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify(error="Repair cost must be non-negative"), 400
        db = get_db()
        current = db.execute("SELECT * FROM equipment_returns WHERE id=?", (return_id,)).fetchone()
        if current is None:
            return jsonify(error="Return record not found"), 404
        deduction = min(float(current["deposit_amount"]), repair_cost)
        if condition == "lost":
            deduction = float(current["deposit_amount"])
            status = "claim_pending"
            recommendation = "Escalate the lost equipment claim and deduct the held deposit."
        elif condition == "damaged" or repair_cost > 0:
            status = "claim_pending"
            recommendation = f"Repair claim requires review. Proposed deduction: INR {deduction:,.2f}."
        else:
            status = "closed"
            recommendation = "Inspection passed. Release the refundable deposit and close the rental."
        db.execute(
            """UPDATE equipment_returns SET actual_return_date=?,condition=?,damage_remarks=?,repair_cost=?,deposit_deduction=?,
               recommendation=?,status=?,return_request_status='processed',deduction_status=?,updated_at=? WHERE id=?""",
            (payload.get("actual_return_date") or current["actual_return_date"] or date.today().isoformat(), condition, str(payload.get("damage_remarks", "")).strip(), repair_cost, deduction, recommendation, status, "pending" if deduction else "not_required", now(), return_id),
        )
        add_history(return_id, "Inspection completed", current["status"], status, recommendation)
        if status == "closed" and current["booking_id"]:
            db.execute("UPDATE bookings SET status='returned',updated_at=? WHERE id=?", (now(), current["booking_id"]))
            booking = db.execute("SELECT equipment_id FROM bookings WHERE id=?", (current["booking_id"],)).fetchone()
            db.execute("UPDATE equipment SET stock_available=MIN(stock_total,stock_available+1),updated_at=? WHERE id=?", (now(), booking["equipment_id"]))
        db.commit()
        return jsonify(return_dict(db.execute("SELECT * FROM equipment_returns WHERE id=?", (return_id,)).fetchone(), True))

    @app.patch("/api/returns/<int:return_id>/deduction")
    @auth_required("admin")
    def update_deduction(return_id: int):
        payload = request.get_json(silent=True) or {}
        decision = payload.get("decision")
        if decision not in {"approved", "rejected"}:
            return jsonify(error="Decision must be approved or rejected"), 400
        db = get_db()
        current = db.execute("SELECT * FROM equipment_returns WHERE id=?", (return_id,)).fetchone()
        if current is None:
            return jsonify(error="Return record not found"), 404
        deduction = current["deposit_deduction"] if decision == "approved" else 0
        settlement_note = (
            "Deposit deduction approved. Claim settled and return closed."
            if decision == "approved"
            else "Deposit deduction rejected. Claim settled and full refundable balance restored."
        )
        db.execute(
            "UPDATE equipment_returns SET deposit_deduction=?,deduction_status=?,status='closed',recommendation=?,updated_at=? WHERE id=?",
            (deduction, decision, settlement_note, now(), return_id),
        )
        add_history(return_id, "Deposit deduction reviewed", current["status"], "closed", settlement_note)
        if current["booking_id"]:
            booking = db.execute("SELECT equipment_id,status FROM bookings WHERE id=?", (current["booking_id"],)).fetchone()
            if booking and booking["status"] != "returned":
                db.execute("UPDATE bookings SET status='returned',updated_at=? WHERE id=?", (now(), current["booking_id"]))
                db.execute("UPDATE equipment SET stock_available=MIN(stock_total,stock_available+1),updated_at=? WHERE id=?", (now(), booking["equipment_id"]))
        db.commit()
        return jsonify(message=f"Deduction {decision}; claim closed", deposit_deduction=deduction, status="closed")

    @app.patch("/api/returns/<int:return_id>/status")
    @auth_required("admin")
    def update_return_status(return_id: int):
        payload = request.get_json(silent=True) or {}
        status = payload.get("status")
        if status not in RETURN_STATUSES:
            return jsonify(error="Invalid return status"), 400
        db = get_db()
        current = db.execute("SELECT * FROM equipment_returns WHERE id=?", (return_id,)).fetchone()
        if current is None:
            return jsonify(error="Return record not found"), 404
        db.execute("UPDATE equipment_returns SET status=?,updated_at=? WHERE id=?", (status, now(), return_id))
        add_history(return_id, "Status updated", current["status"], status, str(payload.get("note", "")))
        if status == "closed" and current["status"] != "closed" and current["booking_id"]:
            booking = db.execute("SELECT equipment_id,status FROM bookings WHERE id=?", (current["booking_id"],)).fetchone()
            if booking and booking["status"] != "returned":
                db.execute("UPDATE bookings SET status='returned',updated_at=? WHERE id=?", (now(), current["booking_id"]))
                db.execute("UPDATE equipment SET stock_available=MIN(stock_total,stock_available+1),updated_at=? WHERE id=?", (now(), booking["equipment_id"]))
        db.commit()
        return jsonify(message="Return status updated", status=status)

    @app.get("/api/customers")
    @auth_required("admin")
    def customers():
        rows = get_db().execute(
            """SELECT u.id,u.name,u.email,u.phone,u.active,u.created_at,
                      COUNT(b.id) rental_count,COALESCE(SUM(b.total_amount),0) total_spend
               FROM users u LEFT JOIN bookings b ON b.user_id=u.id WHERE u.role='user'
               GROUP BY u.id ORDER BY u.id DESC"""
        ).fetchall()
        return jsonify([dict(row) for row in rows])

    @app.patch("/api/customers/<int:user_id>")
    @auth_required("admin")
    def update_customer(user_id: int):
        payload = request.get_json(silent=True) or {}
        active = payload.get("active")
        if active not in {True, False, 0, 1}:
            return jsonify(error="Active must be true or false"), 400
        customer = get_db().execute("SELECT id FROM users WHERE id=? AND role='user'", (user_id,)).fetchone()
        if customer is None:
            return jsonify(error="Customer not found"), 404
        get_db().execute("UPDATE users SET active=?,updated_at=? WHERE id=?", (1 if active else 0, now(), user_id))
        get_db().commit()
        return jsonify(message="Customer account updated", active=bool(active))

    @app.get("/api/dashboard")
    @auth_required()
    def dashboard():
        db = get_db()
        if g.user["role"] == "user":
            bookings = [booking_dict(row) for row in db.execute(
                """SELECT b.*,e.name equipment_name,e.code equipment_code,e.category,u.name customer_name,u.email customer_email
                   FROM bookings b JOIN equipment e ON e.id=b.equipment_id JOIN users u ON u.id=b.user_id
                   WHERE b.user_id=? ORDER BY b.id DESC""", (g.user["id"],)
            ).fetchall()]
            return jsonify(
                role="user", total_rentals=len(bookings), active=sum(x["status"] in {"approved", "active", "return_requested"} for x in bookings),
                pending=sum(x["status"] == "pending" for x in bookings), returned=sum(x["status"] == "returned" for x in bookings),
                overdue=sum(x["is_overdue"] for x in bookings), total_spend=round(sum(x["total_amount"] for x in bookings if x["status"] != "rejected"), 2), recent=bookings[:5],
            )
        returns = [return_dict(row) for row in db.execute("SELECT * FROM equipment_returns").fetchall()]
        return jsonify(
            role="admin", equipment=db.execute("SELECT COUNT(*) FROM equipment").fetchone()[0],
            available=db.execute("SELECT COALESCE(SUM(stock_available),0) FROM equipment WHERE status='available'").fetchone()[0],
            customers=db.execute("SELECT COUNT(*) FROM users WHERE role='user'").fetchone()[0],
            bookings=db.execute("SELECT COUNT(*) FROM bookings").fetchone()[0], pending_bookings=db.execute("SELECT COUNT(*) FROM bookings WHERE status='pending'").fetchone()[0],
            returns=len(returns), claims=sum(x["status"] == "claim_pending" for x in returns), overdue=sum(x["is_overdue"] for x in returns),
            repair_cost=round(sum(x["repair_cost"] for x in returns), 2), deductions=round(sum(x["deposit_deduction"] for x in returns), 2), recent=returns[:5],
        )

    @app.get("/api/reports/returns.csv")
    @auth_required("admin")
    def export_csv():
        fields = ["id", "customer_name", "equipment_name", "equipment_code", "return_due_date", "actual_return_date", "condition", "status", "repair_cost", "deposit_deduction", "deduction_status"]
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for row in get_db().execute("SELECT * FROM equipment_returns ORDER BY id"):
            writer.writerow({field: row[field] for field in fields})
        return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=equipment-returns.csv"})

    @app.cli.command("init-db")
    def init_db_command():
        init_db()
        print("Database initialized.")

    @app.cli.command("seed")
    def seed_command():
        init_db()
        print("Accounts and equipment are ready.")

    with app.app_context():
        init_db()
    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", "5000")))
