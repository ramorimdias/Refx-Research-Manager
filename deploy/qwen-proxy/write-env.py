#!/usr/bin/env python3

"""Create the VM-only Qwen proxy env file from JSON supplied on stdin."""

import json
import os
import sys


DESTINATION = "/opt/docker/apps/refx-qwen-proxy/.env.qwen"
REQUIRED_KEYS = (
    "CF_ACCESS_CLIENT_ID",
    "CF_ACCESS_CLIENT_SECRET",
    "QWEN_ENABLER_PASSWORD",
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError
        if any(not isinstance(payload.get(key), str) or not payload[key] for key in REQUIRED_KEYS):
            raise ValueError
        if any("\n" in payload[key] or "\r" in payload[key] for key in REQUIRED_KEYS):
            raise ValueError

        entries = {
            **{key: payload[key] for key in REQUIRED_KEYS},
            "QWEN_API_BASE_URL": "https://llm.667764.xyz/v1",
            "QWEN_MODEL": "qwen3.6:35b",
        }
        data = "".join(f"{key}={value}\n" for key, value in entries.items())
        descriptor = os.open(DESTINATION, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
    except FileExistsError:
        print("Refusing to overwrite an existing Qwen env file.", file=sys.stderr)
        return 2
    except Exception:
        print("Credential payload was invalid; no credential values were displayed.", file=sys.stderr)
        return 1

    print("Qwen server env file created with mode 0600.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
