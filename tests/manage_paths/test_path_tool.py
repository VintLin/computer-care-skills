from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "skills" / "manage-paths" / "scripts" / "path_tool.py"


class PathToolListTests(unittest.TestCase):
    def run_tool(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_when_called_with_directory_should_print_recursive_file_paths_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            nested = root / "nested"
            nested.mkdir()
            first = root / "first.txt"
            second = nested / "second.txt"
            first.write_text("first", encoding="utf-8")
            second.write_text("second", encoding="utf-8")

            result = self.run_tool("list", str(root))

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), [str(first), str(second)])

    def test_when_include_dirs_is_set_should_print_directories_and_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            nested = root / "nested"
            nested.mkdir()
            file_path = nested / "file.txt"
            file_path.write_text("content", encoding="utf-8")

            result = self.run_tool("list", "--include-dirs", str(root))

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), [str(nested), str(file_path)])

    def test_when_path_is_smb_url_should_explain_mount_requirement(self) -> None:
        result = self.run_tool("list", "smb://server/share/folder")

        self.assertEqual(result.returncode, 1)
        self.assertIn("Mount the SMB share first", result.stderr)


if __name__ == "__main__":
    unittest.main()
