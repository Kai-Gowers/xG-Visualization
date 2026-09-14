from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

STARTER_LIBRARY = Path("artifacts/library/starter")
FULL_LIBRARY = Path("data/library/full")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="XG_", extra="ignore")

    model_dir: Path = Path("artifacts/models/current")
    library_dir: Path | None = None
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    def resolved_library_dir(self) -> Path | None:
        if self.library_dir is not None:
            return self.library_dir
        if (FULL_LIBRARY / "shot_library.parquet").exists():
            return FULL_LIBRARY
        if (STARTER_LIBRARY / "shot_library.parquet").exists():
            return STARTER_LIBRARY
        return None
