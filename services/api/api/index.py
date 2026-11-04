"""Vercel entrypoint: Vercel runs Python files under api/ as functions and serves the
ASGI `app` they expose. vercel.json routes every path here, so FastAPI handles routing."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402,F401
