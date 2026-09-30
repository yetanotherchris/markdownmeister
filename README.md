# markdownmeister

Can AI create a Markdown editor using Electron and OSS frameworks? Milkdown, React

## Installation

Install the latest release without building from source.

### macOS / Linux (Homebrew)

```sh
brew tap markdownmeister https://github.com/yetanotherchris/markdownmeister
brew install markdownmeister
```

Launch the app via your terminal window.

### Windows (Scoop)

```sh
scoop bucket add markdownmeister https://github.com/yetanotherchris/markdownmeister
scoop install markdownmeister
```

Launch the app via the start menu.

### Windows (Microsoft Store)

Search for **MarkdownMeister** in the Microsoft Store, or open the [Store search page](https://apps.microsoft.com/search?query=MarkdownMeister). Installing from the Store carries Microsoft's own signing, so there is no developer-certificate or SmartScreen warning. Requires Windows 10 version 2004 (build 19041) or later; the File Explorer folder action described below requires Windows 11.

## Opening folders from your file manager

On Windows, right-click a folder and choose **Open in MarkdownMeister** (from the installer and Scoop builds this appears on Windows 11 under "Show more options"; the Microsoft Store build places it in the first-level menu). Uninstalling removes that entry together with the **Open with MarkdownMeister** entries for `.md`/`.markdown` files. The folder action requires Windows 11; on Windows 10, open folders from the app's own **Open Folder** command.

On macOS, hand a folder to the app via a Dock drop, `open -a MarkdownMeister <folder>`, or Open With in third-party file managers; Finder itself offers no context-menu entry for folders.

On Linux, launching the AppImage registers a user-level **Open With** entry for folders in desktop environments that follow the freedesktop desktop-entry mechanism (Nautilus, Dolphin); it never becomes the default folder handler. Remove it with `markdownmeister --remove-folder-action`. Desktop environments without a standard mechanism for third-party folder actions are unsupported — no menu entry is created there.
