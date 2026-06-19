---
description: Lier cette machine à Mon Agence Web (OAuth device flow) pour le logging Claude Code
---

Lance le device-flow login du plugin events pour (re)lier cette machine.

Exécute, avec l'outil Bash, la commande suivante (elle affiche une URL + un
code, ouvre le navigateur, puis attend l'autorisation) :

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/login.mjs"
```

Relaie à l'utilisateur l'URL et le code affichés, et confirme une fois que la
machine est autorisée. Si `${CLAUDE_PLUGIN_ROOT}` n'est pas résolu, le script
se trouve dans le dossier `scripts/` du plugin `events` installé.
