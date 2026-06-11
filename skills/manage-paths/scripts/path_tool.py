#!/usr/bin/env python3
from __future__ import annotations

import argparse
import platform
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Literal
from urllib.parse import unquote, urlparse

Target = Literal["mac", "windows"]


@dataclass(frozen=True)
class ConvertedPath:
    value: str
    kind: str


def split_windows_parts(path: str) -> list[str]:
    return [part for part in re.split(r"[\\/]+", path.strip()) if part]


def to_mac(path: str) -> ConvertedPath:
    raw = path.strip().strip('"').strip("'")

    if raw.startswith("smb://"):
        return ConvertedPath(raw, "mac-smb")

    if raw.startswith("/Volumes/") or raw.startswith("/Users/") or raw.startswith("/"):
        return ConvertedPath(raw, "mac-local")

    drive_match = re.match(r"^([A-Za-z]):[\\/]*(.*)$", raw)
    if drive_match:
        drive = drive_match.group(1).upper()
        rest = drive_match.group(2).replace("\\", "/")
        suffix = f"/{rest}" if rest else ""
        return ConvertedPath(f"/Volumes/{drive}{suffix}", "mac-drive-placeholder")

    parts = split_windows_parts(raw)
    if len(parts) >= 2:
        return ConvertedPath("smb://" + "/".join(parts), "mac-smb")

    raise ValueError(f"Cannot convert to mac path: {path}")


def to_windows(path: str) -> ConvertedPath:
    raw = path.strip().strip('"').strip("'")

    if raw.startswith("\\\\") or raw.startswith("\\"):
        parts = split_windows_parts(raw)
        if len(parts) >= 2:
            return ConvertedPath("\\\\" + "\\".join(parts), "windows-unc")

    drive_match = re.match(r"^[A-Za-z]:[\\/]", raw)
    if drive_match:
        return ConvertedPath(raw.replace("/", "\\"), "windows-local")

    if raw.startswith("smb://"):
        parsed = urlparse(raw)
        parts = [parsed.netloc] + [part for part in unquote(parsed.path).split("/") if part]
        if len(parts) >= 2:
            return ConvertedPath("\\\\" + "\\".join(parts), "windows-unc")

    if raw.startswith("/Volumes/"):
        parts = [part for part in raw.split("/") if part]
        if len(parts) >= 2:
            share = parts[1]
            rest = parts[2:]
            return ConvertedPath("\\\\" + "\\".join([share, *rest]), "windows-volume-placeholder")

    if raw.startswith("/"):
        return ConvertedPath(raw.replace("/", "\\"), "windows-local-placeholder")

    raise ValueError(f"Cannot convert to windows path: {path}")


def convert(path: str, target: Target) -> ConvertedPath:
    if target == "mac":
        return to_mac(path)
    if target == "windows":
        return to_windows(path)
    raise ValueError(f"Unsupported target: {target}")


def open_path(path: str, target: Target, print_command: bool) -> int:
    converted = convert(path, target)
    system = platform.system().lower()

    if target == "mac":
        command = ["open", converted.value]
        can_open = system == "darwin"
    else:
        command = ["explorer", converted.value]
        can_open = system == "windows"

    print(converted.value)

    if print_command or not can_open:
        print(shell_command(command))
        return 0 if print_command else 2

    subprocess.run(command, check=True)
    return 0


def shell_command(command: list[str]) -> str:
    if command[0] == "explorer":
        return "explorer " + command[1]
    return " ".join(sh_quote(part) for part in command)


def sh_quote(value: str) -> str:
    if re.match(r"^[A-Za-z0-9_./:@%+=,-]+$", value):
        return value
    return "'" + value.replace("'", "'\"'\"'") + "'"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Convert and open Windows/macOS file-system paths.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    convert_parser = subparsers.add_parser("convert")
    convert_parser.add_argument("--to", choices=["mac", "windows"], required=True)
    convert_parser.add_argument("path")

    open_parser = subparsers.add_parser("open")
    open_parser.add_argument("--to", choices=["mac", "windows"], required=True)
    open_parser.add_argument("--print-command", action="store_true")
    open_parser.add_argument("path")

    args = parser.parse_args(argv)

    try:
        if args.command == "convert":
            print(convert(args.path, args.to).value)
            return 0
        if args.command == "open":
            return open_path(args.path, args.to, args.print_command)
    except (ValueError, subprocess.CalledProcessError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
