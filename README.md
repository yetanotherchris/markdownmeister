<p>
  <img src="docs/site/public/assets/logo.png" alt="MarkdownMeister" width="112" />
</p>

# MarkdownMeister

A free markdown editor for Windows, macOS and Linux. Write with a live preview or the raw source, browse a folder in the sidebar, and keep several documents open in tabs. Your files stay plain markdown on disk.

[Project site](https://yetanotherchris.github.io/markdownmeister/) · [Releases](https://github.com/yetanotherchris/markdownmeister/releases/latest) · [Issues](https://github.com/yetanotherchris/markdownmeister/issues)

![The MarkdownMeister main window with the folder explorer on the left and the markdown editor on the right](docs/site/public/assets/screenshot-1.png)

## Install

### Windows (Scoop)

```sh
scoop bucket add markdownmeister https://github.com/yetanotherchris/markdownmeister
scoop install markdownmeister
```

### macOS and Linux (Homebrew)

```sh
brew tap markdownmeister https://github.com/yetanotherchris/markdownmeister
brew install yetanotherchris/markdownmeister/markdownmeister
```

### macOS (Direct Download)

Download the matching macOS DMG or ZIP from [Releases](https://github.com/yetanotherchris/markdownmeister/releases/latest).

### Windows (Microsoft Store)

Available on the [Microsoft Store](https://apps.microsoft.com/detail/9pjx3zxlfh6k?hl=en-GB&gl=GB)

### Linux (Snap Store)

Available on the [Snap Store](https://snapcraft.io/markdownmeister) and installs with:

```sh
sudo snap install markdownmeister
```

### Linux (Debian, Ubuntu, Mint)

```sh
# .deb for x86-64 Debian, Ubuntu, Mint, and Pop!_OS
curl -fsSL https://raw.githubusercontent.com/yetanotherchris/markdownmeister/main/scripts/install-linux.sh | sh
```

```sh
# AppImage
curl -fsSL https://raw.githubusercontent.com/yetanotherchris/markdownmeister/main/scripts/install-linux.sh | sh -s -- --appimage
```

```sh
sudo apt remove markdownmeister
```

## Technology

- Milkdown for the WYSIWYG editor, CodeMirror for the source view.
- Electron and TypeScript.
- Built spec-first with [Spec Kit](https://github.com/github/spec-kit): the specification is the source of truth, and code follows it.
- Developed with DeepSeek, Claude, Grok, GPT, and GLM.

## Learn more

Features, keyboard shortcuts, settings, and folder actions are documented on the [project site](https://yetanotherchris.github.io/markdownmeister/). MarkdownMeister is free and open source under the [MIT licence](LICENSE).
