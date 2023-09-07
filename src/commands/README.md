# @commitlint Module for opencommit

1. Load commitlint configuration within tree.
2. Generate a commit with commitlint prompt:
   - Will not run if hash is the same.
   - Infer a prompt for each commitlint rule.
   - Ask OpenAI to generate consistency with embedded commitlint rules.
   - Store configuration close to commitlint configuration.
3. Replace conventional-commit prompt with commitlint prompt.
