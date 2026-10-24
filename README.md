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

The v1.7.0 through v1.8.2 macOS releases have defective disk images, and the v1.8.2 app bundles are unsigned and unnotarized. A replacement release is pending. Future releases must pass Developer ID signature, notarization-ticket, and Gatekeeper checks after artifact download before publication.

### Windows (Microsoft Store)

Search for **MarkdownMeister** in the Microsoft Store, or open the [Store search page](https://apps.microsoft.com/search?query=MarkdownMeister). Installing from the Store carries Microsoft's own signing, so there is no developer-certificate or SmartScreen warning.

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
