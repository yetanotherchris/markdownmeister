# markdownmeister

Can AI create a Markdown editor using Electron and OSS frameworks? Milkdown, React

## Installation

Install the latest release without building from source.

### macOS / Linux (Homebrew)

```sh
brew install yetanotherchris/tap/markdownmeister
```

### Windows (Scoop)

```sh
scoop bucket add markdownmeister https://github.com/yetanotherchris/markdownmeister
scoop install markdownmeister
```

Launch the editor with `markdownmeister` on every platform.

## Opening folders from your file manager

On Windows, right-click a folder and choose **Open in MarkdownMeister** (on Windows 11, under "Show more options"). Uninstalling removes that entry together with the **Open with MarkdownMeister** entries for `.md`/`.markdown` files.

On macOS, hand a folder to the app via a Dock drop, `open -a MarkdownMeister <folder>`, or Open With in third-party file managers; Finder itself offers no context-menu entry for folders.

On Linux, launching the AppImage registers a user-level **Open With** entry for folders in desktop environments that follow the freedesktop desktop-entry mechanism (Nautilus, Dolphin); it never becomes the default folder handler. Remove it with `markdownmeister --remove-folder-action`. Desktop environments without a standard mechanism for third-party folder actions are unsupported — no menu entry is created there.
