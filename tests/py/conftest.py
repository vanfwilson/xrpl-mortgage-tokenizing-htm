import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from mortgageos import SUCCESS_STRING  # noqa: E402


def pytest_sessionfinish(session, exitstatus):
    if exitstatus == 0 and getattr(session.config, "mos_live_pass", False):
        print(f"\n{SUCCESS_STRING}")
