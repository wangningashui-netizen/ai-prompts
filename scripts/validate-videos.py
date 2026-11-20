#!/usr/bin/env python3
"""Validate the video-prompt daily files.

Image data under data/*.json and images/ is not part of this check.
Run from anywhere:

    python3 scripts/validate-videos.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}-\d{2} \d{2}:\d{2}$")
AUTHOR_RE = re.compile(r"^[A-Za-z0-9_]{1,30}$")
ID_RE = re.compile(r"^\d{5,25}$")
HOSTS = {"x.com", "twitter.com"}

errors: list[str] = []
warnings: list[str] = []


def error(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def load_json(path: Path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        error(f"{path.relative_to(ROOT)}: {exc}")
        return None, ""
    try:
        return json.loads(text), text
    except json.JSONDecodeError as exc:
        error(f"{path.relative_to(ROOT)}: invalid JSON ({exc})")
        return None, text


def rel_path(value: object, label: str) -> str:
    if not isinstance(value, str) or not value or value.startswith("/") or "\\" in value or ".." in value.split("/"):
        error(f"{label}: expected a site-relative path, got {value!r}")
        return ""
    if "://" in value:
        error(f"{label}: path must not be a URL ({value})")
        return ""
    return value


def is_jpeg(path: Path) -> bool:
    try:
        return path.read_bytes()[:3] == b"\xff\xd8\xff"
    except OSError:
        return False


def is_mp4(path: Path) -> bool:
    try:
        head = path.read_bytes()[:32]
    except OSError:
        return False
    return len(head) >= 12 and head[4:8] == b"ftyp"


def faststart(path: Path) -> bool:
    try:
        data = path.read_bytes()
    except OSError:
        return False
    moov = data.find(b"moov")
    mdat = data.find(b"mdat")
    return moov >= 0 and mdat >= 0 and moov < mdat


def split_models(model: str) -> list[str] | None:
    if model == "未注明":
        return ["未注明"]
    if " / " in model:
        parts = [part.strip() for part in model.split(" / ")]
        if any(not part for part in parts) or len(parts) < 2:
            return None
        return parts
    return [model]


def check_day(item: dict, seen_ids: set[str], seen_files: set[str]) -> None:
    date = item.get("date")
    file_value = item.get("file")
    if not isinstance(date, str) or not DATE_RE.match(date):
        error(f"index date is not YYYY-MM-DD: {date!r}")
        return
    expected = f"data/videos/{date}.json"
    if file_value != expected:
        error(f"{date}: file should be {expected}, got {file_value!r}")
        return
    path = ROOT / expected
    data, raw = load_json(path)
    if data is None:
        return
    if re.search(r'"id"\s*:\s*\d', raw):
        error(f"{expected}: id must be a JSON string, not a number")
    if data.get("schemaVersion") != 1:
        error(f"{expected}: schemaVersion must be 1")
    if data.get("date") != date:
        error(f"{expected}: date {data.get('date')!r} does not match the file name")
    if data.get("timezone") != "Asia/Shanghai":
        error(f"{expected}: timezone must be Asia/Shanghai")
    entries = data.get("entries")
    if not isinstance(entries, list):
        error(f"{expected}: entries must be an array")
        return
    if item.get("count") != len(entries):
        error(f"{date}: index count is {item.get('count')}, entries.length is {len(entries)}")

    referenced: set[Path] = set()
    for index, entry in enumerate(entries):
        where = f"{date} entries[{index}]"
        if not isinstance(entry, dict):
            error(f"{where}: must be an object")
            continue
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not ID_RE.match(entry_id):
            error(f"{where}: id must be a digit string")
        elif entry_id in seen_ids:
            error(f"{where}: duplicate id {entry_id}")
        else:
            seen_ids.add(entry_id)
        author = entry.get("author")
        if not isinstance(author, str) or not AUTHOR_RE.match(author):
            error(f"{where}: author must be an X handle without @")
        if not isinstance(entry.get("authorName"), str):
            error(f"{where}: authorName must be a string")
        title = entry.get("title")
        if not isinstance(title, str) or not title.strip():
            error(f"{where}: title must be a non-empty string")
        model = entry.get("model")
        if not isinstance(model, str) or not model.strip():
            error(f"{where}: model must be a non-empty string")
            expected_models = None
        else:
            expected_models = split_models(model.strip())
            if expected_models is None:
                error(f"{where}: model {model!r} does not split cleanly on ' / '")
        models = entry.get("models")
        if not isinstance(models, list) or not models or not all(isinstance(name, str) and name.strip() for name in models):
            error(f"{where}: models must be a non-empty string array")
        elif expected_models is not None and models != expected_models:
            error(f"{where}: models {models!r} does not match model {model!r}")
        if not isinstance(entry.get("note"), str):
            error(f"{where}: note must be a string")
        if not isinstance(entry.get("needsReference"), bool):
            error(f"{where}: needsReference must be a boolean")
        if not isinstance(entry.get("time"), str) or not TIME_RE.match(entry.get("time", "")):
            error(f"{where}: time must be MM-DD HH:mm")
        for key in ("likes", "bookmarks"):
            value = entry.get(key)
            if not is_int(value) or value < 0:
                error(f"{where}: {key} must be an integer >= 0")
        url = entry.get("url")
        if not isinstance(url, str):
            error(f"{where}: url must be a string")
        elif url:
            parts = urlparse(url)
            host = parts.netloc.lower().removeprefix("www.")
            if parts.scheme != "https" or host not in HOSTS:
                error(f"{where}: url must be an https://x.com or https://twitter.com link, or empty")
        if not isinstance(entry.get("prompt"), str):
            error(f"{where}: prompt must be a string")
        videos = entry.get("videos")
        if not isinstance(videos, list) or not videos:
            error(f"{where}: videos must be a non-empty array")
            continue
        labels_required = (
            isinstance(models, list)
            and len(videos) > 1
            and len(models) == len(videos)
            and models != ["未注明"]
        )
        for video_index, video in enumerate(videos):
            slot = f"{where} videos[{video_index}]"
            if not isinstance(video, dict):
                error(f"{slot}: must be an object")
                continue
            src = rel_path(video.get("src"), f"{slot} src")
            poster = rel_path(video.get("poster"), f"{slot} poster")
            if src:
                if not src.startswith(f"videos/{date}/") or not src.endswith(".mp4"):
                    error(f"{slot}: src must be videos/{date}/*.mp4")
                src_path = ROOT / src
                if src in seen_files:
                    error(f"{slot}: duplicate src {src}")
                seen_files.add(src)
                referenced.add(src_path)
                if not src_path.is_file():
                    error(f"{slot}: missing file {src}")
                elif not is_mp4(src_path):
                    error(f"{slot}: {src} is not an MP4")
                elif not faststart(src_path):
                    warn(f"{src}: moov atom is after mdat; prefer faststart so playback can begin sooner")
            if poster:
                if not poster.startswith(f"videos/{date}/") or not poster.lower().endswith(".jpg"):
                    error(f"{slot}: poster must be videos/{date}/*.jpg")
                poster_path = ROOT / poster
                if poster in seen_files:
                    error(f"{slot}: duplicate poster {poster}")
                seen_files.add(poster)
                referenced.add(poster_path)
                if not poster_path.is_file():
                    error(f"{slot}: missing file {poster}")
                elif not is_jpeg(poster_path):
                    error(f"{slot}: {poster} is not a JPEG")
            if src and poster and Path(src).stem != Path(poster).stem:
                error(f"{slot}: poster basename should match the mp4")
            duration = video.get("duration")
            if isinstance(duration, bool) or not isinstance(duration, (int, float)) or duration < 0:
                error(f"{slot}: duration must be a number of seconds >= 0")
            elif duration > 15:
                warn(f"{slot}: duration {duration}s is longer than the usual 15s clip")
            for key in ("width", "height"):
                value = video.get(key)
                if not is_int(value) or value <= 0:
                    error(f"{slot}: {key} must be a positive integer")
            label = video.get("label", "")
            if "label" in video and not isinstance(label, str):
                error(f"{slot}: label must be a string when present")
            elif labels_required and isinstance(models, list) and label != models[video_index]:
                error(f"{slot}: label should be {models[video_index]!r} so the clip order matches models")
            elif len(videos) == 1 and isinstance(label, str) and label and isinstance(models, list) and label != models[0]:
                error(f"{slot}: single-clip label {label!r} does not match {models!r}")

    folder = ROOT / "videos" / date
    if folder.is_dir():
        for media in sorted(folder.iterdir()):
            if not media.is_file():
                continue
            if media.suffix.lower() not in {".mp4", ".jpg"}:
                warn(f"unexpected file in {folder.relative_to(ROOT)}: {media.name}")
                continue
            if media not in referenced:
                error(f"unreferenced media file {media.relative_to(ROOT)}")
    elif entries:
        error(f"missing media directory videos/{date}/")


def main() -> int:
    index_path = ROOT / "data" / "videos" / "index.json"
    index, _raw = load_json(index_path)
    if not isinstance(index, dict):
        error("data/videos/index.json must be an object")
        return finish()
    if index.get("schemaVersion") != 1:
        error("data/videos/index.json schemaVersion must be 1")
    dates = index.get("dates")
    if not isinstance(dates, list):
        error("data/videos/index.json dates must be an array")
        return finish()
    date_strings = [item.get("date") for item in dates if isinstance(item, dict)]
    if date_strings != sorted((item for item in date_strings if isinstance(item, str)), reverse=True):
        error("data/videos/index.json dates must be newest first")
    if len(date_strings) != len(set(date_strings)):
        error("data/videos/index.json has duplicate dates")
    seen_ids: set[str] = set()
    seen_files: set[str] = set()
    for item in dates:
        if not isinstance(item, dict):
            error(f"index entry must be an object, got {item!r}")
            continue
        check_day(item, seen_ids, seen_files)
    return finish()


def finish() -> int:
    for message in errors:
        print(f"error: {message}", file=sys.stderr)
    for message in warnings:
        print(f"warning: {message}", file=sys.stderr)
    if errors:
        print(f"{len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1
    print(f"ok: video data valid ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
