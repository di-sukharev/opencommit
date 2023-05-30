<div align="center">
  <div>
    <img src=".github/logo-grad.svg" alt="OpenCommit logo"/>
    <h1 align="center">OpenCommit</h1>
    <h4 align="center">Follow the bird <a href="https://twitter.com/io_Y_oi"><img src="https://img.shields.io/twitter/follow/io_Y_oi?style=flat&label=io_Y_oi&logo=twitter&color=0bf&logoColor=fff" align="center"></a>
    </h4>
  </div>
	<h2>Auto-generate meaningful commits in 1 second</h2>
	<p>Killing lame commits with AI 🤯🔫</p>
	<a href="https://www.npmjs.com/package/opencommit"><img src="https://img.shields.io/npm/v/opencommit" alt="Current version"></a>
</div>

---

<div align="center">
    <img src=".github/opencommit-example.png" alt="OpenCommit example"/>
</div>

All the commits in this repo are authored by OpenCommit — look at [the commits](https://github.com/di-sukharev/opencommit/commit/eae7618d575ee8d2e9fff5de56da79d40c4bc5fc) to see how OpenCommit works. Emojis and long commit descriptions are configurable.

## Setup OpenCommit as a GitHub Action 🔥

OpenCommit is now available as a GitHub Action which automatically improves all new commits messages when you push to remote!

This is great if you want to make sure all of the commits in all of your repository branches are meaningful and not lame like `fix1` or `done2`.

Create a file `.github/workflows/opencommit.yml` with the contents below:

```yml
name: 'OpenCommit Action'

on:
  push:
    # this list of branches is often enough,
    # but you may still ignore other public branches
    branches-ignore: [main master dev development release]

jobs:
  opencommit:
    timeout-minutes: 10
    name: OpenCommit
    runs-on: ubuntu-latest
    permissions: write-all
    steps:
      - name: Setup Node.js Environment
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: di-sukharev/opencommit@github-action-v1.0.4
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

        env:
          # set openAI api key in repo actions secrets,
          # for openAI keys go to: https://platform.openai.com/account/api-keys
          # for repo secret go to: <your_repo_url>/settings/secrets/actions
          OCO_OPENAI_API_KEY: ${{ secrets.OCO_OPENAI_API_KEY }}

          # customization
          OCO_OPENAI_MAX_TOKENS: 500
          OCO_OPENAI_BASE_PATH: ''
          OCO_DESCRIPTION: false
          OCO_EMOJI: false
          OCO_MODEL: gpt-3.5-turbo
          OCO_LANGUAGE: en
```

That is it. Now when you push to any branch in your repo — all NEW commits are being improved by your never-tired AI.

Make sure you exclude public collaboration branches (`main`, `dev`, `etc`) in `branches-ignore`, so OpenCommit does not rebase commits there while improving the messages.

Interactive rebase (`rebase -i`) changes commits' SHA, so the commit history in remote becomes different from your local branch history. This is okay if you work on the branch alone, but may be inconvenient for other collaborators.

## Setup OpenCommit as a CLI tool

You can use OpenCommit by simply running it via the CLI like this `oco`. 2 seconds and your staged changes are committed with a meaningful message.

1. Install OpenCommit globally to use in any repository:

   ```sh
   npm install -g opencommit
   ```

2. Get your API key from [OpenAI](https://platform.openai.com/account/api-keys). Make sure that you add your payment details, so the API works.

3. Set the key to OpenCommit config:

   ```sh
   opencommit config set OCO_OPENAI_API_KEY=<your_api_key>
   ```

   Your API key is stored locally in the `~/.opencommit` config file.

## Usage

You can call OpenCommit directly to generate a commit message for your staged changes:

```sh
git add <files...>
opencommit
```

You can also use the `oco` shortcut:

```sh
git add <files...>
oco
```

## Configuration

### Local per repo configuration

Create a `.env` file and add OpenCommit config variables there like this:

```env
OCO_OPENAI_API_KEY=<your OpenAI API token>
OCO_OPENAI_MAX_TOKENS=<max response tokens from OpenAI API>
OCO_OPENAI_BASE_PATH=<may be used to set proxy path to OpenAI api>
OCO_DESCRIPTION=<postface a message with ~3 sentences description>
OCO_EMOJI=<add GitMoji>
OCO_MODEL=<either gpt-3.5-turbo or gpt-4>
OCO_LANGUAGE=<locale, scroll to the bottom to see options>
```

### Global config for all repos

Local config still has more priority than Global config, but you may set `OCO_MODEL` and `OCO_LOCALE` globally and set local configs for `OCO_EMOJI` and `OCO_DESCRIPTION` per repo which is more convenient.

Simply set any of the variables above like this:

```sh
oco config set OCO_OPENAI_API_KEY=gpt-4
```

Configure [GitMoji](https://gitmoji.dev/) to preface a message.

```sh
oco config set OCO_EMOJI=true
```

To remove preface emojis:

```sh
oco config set OCO_EMOJI=false
```

### Switch to GPT-4

By default, OpenCommit uses GPT-3.5-turbo (ChatGPT).

You may switch to GPT-4 which performs better, but costs ~x15 times more 🤠

```sh
oco config set OCO_MODEL=gpt-4
```

Make sure that you spell it `gpt-4` (lowercase) and that you have API access to the 4th model. Even if you have ChatGPT+, that doesn't necessarily mean that you have API access to GPT-4.

## Locale configuration

To globally specify the language used to generate commit messages:

```sh
# de, German ,Deutsch
oco config set OCO_LANGUAGE=de
oco config set OCO_LANGUAGE=German
oco config set OCO_LANGUAGE=Deutsch

# fr, French, française
oco config set OCO_LANGUAGE=fr
oco config set OCO_LANGUAGE=French
oco config set OCO_LANGUAGE=française
```

The default language setting is **English**
All available languages are currently listed in the [i18n](https://github.com/di-sukharev/opencommit/tree/master/src/i18n) folder

### Git flags

The `opencommit` or `oco` commands can be used in place of the `git commit -m "${generatedMessage}"` command. This means that any regular flags that are used with the `git commit` command will also be applied when using `opencommit` or `oco`.

```sh
oco --no-verify
```

is translated to :

```sh
git commit -m "${generatedMessage}" --no-verify
```

### Remove files

You can remove files from being sent to OpenAI by creating a `.opencommitignore` file. For example:

```ignorelang
path/to/large-asset.zip
**/*.jpg
```

This helps prevent opencommit from uploading artifacts and large files.

By default, opencommit ignores files matching: `*-lock.*` and `*.lock`

## Git hook (KILLER FEATURE)

You can set OpenCommit as Git [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. Hook integrates with your IDE Source Control and allows you to edit the message before committing.

To set the hook:

```sh
oco hook set
```

To unset the hook:

```sh
oco hook unset
```

To use the hook:

```sh
git add <files...>
git commit
```

Or follow the process of your IDE Source Control feature, when it calls `git commit` command — OpenCommit will integrate into the flow.

## Payments

You pay for your requests to OpenAI API. OpenCommit uses ChatGPT (3.5-turbo) official model, which is ~15x times cheaper than GPT-4.