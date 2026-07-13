#!/usr/bin/env bash
# Mock codexbar CLI for widget development and screenshots.
# Returns static-but-fresh usage JSON with example.com accounts, so real
# account emails never end up in screenshots. Supports the subset of the
# CLI surface the widget uses:
#   mock-codexbar.sh usage --format json --no-color [--provider <id>]
set -euo pipefail

# Simulate a slow CLI (e.g. Claude PTY probe) to test that cached numbers
# stay on screen during background refreshes.
if [ -n "${MOCK_CODEXBAR_DELAY:-}" ]; then
    sleep "$MOCK_CODEXBAR_DELAY"
fi

provider="all"
subcommand="usage"
prev=""
for arg in "$@"; do
    case "$arg" in
        usage|cost) subcommand="$arg" ;;
    esac
    if [ "$prev" = "--provider" ]; then
        provider="$arg"
    fi
    prev="$arg"
done

if [ "$subcommand" = "cost" ]; then
    d() { date -u -d "-$1 days" +%Y-%m-%d; }
    cat <<EOF
[
  {
    "provider": "codex",
    "sessionCostUSD": 0.42, "sessionTokens": 118000,
    "last30DaysCostUSD": 6.28, "last30DaysTokens": 3376947,
    "daily": [
      {"date": "$(d 6)", "totalCost": 0.9, "totalTokens": 400000},
      {"date": "$(d 4)", "totalCost": 0.35, "totalTokens": 220000},
      {"date": "$(d 2)", "totalCost": 1.2, "totalTokens": 600000},
      {"date": "$(d 0)", "totalCost": 0.42, "totalTokens": 118000}
    ]
  },
  {
    "provider": "claude",
    "sessionCostUSD": 84.2, "sessionTokens": 62800000,
    "last30DaysCostUSD": 2881.95, "last30DaysTokens": 2472054411,
    "daily": [
      {"date": "$(d 6)", "totalCost": 120.5, "totalTokens": 90000000},
      {"date": "$(d 5)", "totalCost": 40.1, "totalTokens": 35000000},
      {"date": "$(d 3)", "totalCost": 210.7, "totalTokens": 170000000},
      {"date": "$(d 1)", "totalCost": 95.0, "totalTokens": 81000000},
      {"date": "$(d 0)", "totalCost": 84.2, "totalTokens": 62800000}
    ]
  }
]
EOF
    exit 0
fi

iso() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }

session_reset=$(iso "+2 hours 41 minutes")
weekly_reset_claude=$(iso "+3 days 22 hours")
weekly_reset_codex=$(iso "+6 days 23 hours")
now=$(iso "now")

codex_payload() {
cat <<EOF
{
  "provider": "codex",
  "version": "0.144.1",
  "source": "oauth",
  "credits": { "remaining": 25.5, "updatedAt": "$now" },
  "usage": {
    "primary": null,
    "secondary": {
      "usedPercent": 37,
      "windowMinutes": 10080,
      "resetsAt": "$weekly_reset_codex"
    },
    "tertiary": null,
    "extraRateWindows": [
      {
        "id": "codex-spark",
        "title": "Codex Spark Weekly",
        "window": {
          "usedPercent": 4,
          "windowMinutes": 10080,
          "resetsAt": "$weekly_reset_codex"
        }
      },
      {
        "id": "code-review",
        "title": "Code review",
        "window": {
          "usedPercent": 15,
          "windowMinutes": null,
          "resetsAt": null
        }
      }
    ],
    "identity": {
      "providerID": "codex",
      "accountEmail": "user@example.com",
      "loginMethod": "plus"
    },
    "accountEmail": "user@example.com",
    "loginMethod": "plus",
    "updatedAt": "$now"
  }
}
EOF
}

claude_payload() {
cat <<EOF
{
  "provider": "claude",
  "version": "2.1.197",
  "source": "claude",
  "usage": {
    "primary": {
      "usedPercent": 33,
      "windowMinutes": 300,
      "resetsAt": "$session_reset"
    },
    "secondary": {
      "usedPercent": 25,
      "windowMinutes": 10080,
      "resetsAt": "$weekly_reset_claude"
    },
    "tertiary": null,
    "identity": {
      "providerID": "claude",
      "accountEmail": "dev@example.com",
      "loginMethod": "max"
    },
    "updatedAt": "$now"
  },
  "pace": {
    "primary": {
      "stage": "farBehind",
      "deltaPercent": -14,
      "expectedUsedPercent": 47,
      "willLastToReset": true,
      "summary": "14% in reserve | Expected 47% used | Lasts until reset"
    },
    "secondary": {
      "stage": "farBehind",
      "deltaPercent": -19,
      "expectedUsedPercent": 44,
      "willLastToReset": true,
      "summary": "19% in reserve | Expected 44% used | Lasts until reset"
    }
  }
}
EOF
}

case "$provider" in
    codex) printf '[%s]\n' "$(codex_payload)" ;;
    claude) printf '[%s]\n' "$(claude_payload)" ;;
    *) printf '[%s,%s]\n' "$(codex_payload)" "$(claude_payload)" ;;
esac
