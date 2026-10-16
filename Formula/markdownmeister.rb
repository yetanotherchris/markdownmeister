class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.8.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.1/markdownmeister-1.8.1-macos-arm64.zip"
      sha256 "352bad9f30b0ceaaabf75b55d56a21c1fcfd00e6f515401233a35b566a328399"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.1/markdownmeister-1.8.1-macos-x64.zip"
      sha256 "f7399fdf03acbefe2098cf57577a056e6994d670308b5ea10a6aa020fcf6c044"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.1/markdownmeister-1.8.1-linux-x64.AppImage"
      sha256 "bbfc7a199aa00348277b8c1c34b214c894776135d337f571004d1607252a1386"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.8.1-linux-x64.AppImage" => "markdownmeister"
    end
  end

  test do
    if OS.mac?
      assert_predicate prefix/"MarkdownMeister.app", :exist?
    else
      assert_predicate bin/"markdownmeister", :exist?
    end
  end
end
