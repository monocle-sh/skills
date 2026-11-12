<img width="1500" height="500" alt="Monocle" src="https://github.com/user-attachments/assets/45d9a45e-2b49-40c3-86af-1fe3ce26858d" />

# Monocle skills

Agent skills that set up [Monocle](https://monocle.sh) in your application and check its telemetry.

| Skill | What it does |
| --- | --- |
| [onboarding-monocle](skills/onboarding-monocle/SKILL.md) | Installs Monocle in an existing application: traces, logs, metrics, errors, user attribution, and source maps. Uses the official Monocle SDK when the stack has one, and OpenTelemetry otherwise. |
| [auditing-monocle](skills/auditing-monocle/SKILL.md) | Reviews an existing installation and finds why a signal is missing or wrong. Changes nothing unless you ask. |

## Install

```sh
npx skills add monocle-sh/skills
```

The CLI asks which skills and which agents to install. To install by hand, copy each `skills/<name>/` directory, including its `references/` folder, into your agent's skills directory.

## Use

Ask your agent, for example:

- "Set up Monocle in this AdonisJS app."
- "Connect this Go API to Monocle. I already have a DSN."
- "Audit this Monocle installation without editing files."
- "Find why PostgreSQL queries do not appear in Monocle for staging."

The agent asks before it enables analytics, session replay, or browser network tracing. It adds the source-map upload to your CI with a `MONOCLE_API_KEY` secret, and never asks you to paste a token. It does not deploy or push.

## Contribute

Run `python3 scripts/validate.py` after editing a skill. [evals/](evals/README.md) runs the onboarding skill against AdonisJS starters with [AXIS](https://www.npmjs.com/package/@netlify/axis). See [CONTRIBUTING.md](CONTRIBUTING.md).
