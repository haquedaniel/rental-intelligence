from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def _find_repo_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in here.parents:
        if (candidate / "apps" / "cleaner-web" / "config" / "message_templates" / "cleaning_sms.fr.json").exists():
            return candidate
    raise FileNotFoundError("Could not find apps/cleaner-web/config/message_templates/cleaning_sms.fr.json")


_TEMPLATE_PATH = (
    _find_repo_root()
    / "apps"
    / "cleaner-web"
    / "config"
    / "message_templates"
    / "cleaning_sms.fr.json"
)


def render_sms_template(
    key: str,
    variables: dict[str, Any] | None = None,
    *,
    is_test: bool = False,
) -> str:
    variables = variables or {}

    with _TEMPLATE_PATH.open("r", encoding="utf-8") as f:
        templates = json.load(f)

    if key not in templates:
        raise KeyError(f"Unknown SMS template: {key}")

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        value = variables.get(name)
        return "" if value is None else str(value)

    lines: list[str] = []
    for line in templates[key]:
        rendered = re.sub(r"\{\{([a-zA-Z0-9_]+)\}\}", replace, line).strip()
        if rendered:
            lines.append(rendered)

    if is_test and lines:
        lines[0] = f"TEST · {lines[0]}"

    return "\n".join(lines)
