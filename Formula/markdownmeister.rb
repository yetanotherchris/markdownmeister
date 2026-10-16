class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.8.2"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.2/markdownmeister-1.8.2-macos-arm64.zip"
      sha256 "41b3a3846346dd89874117fe7ea258ebc4b9512e9bd04bc194a15ea01e7aab19"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.2/markdownmeister-1.8.2-macos-x64.zip"
      sha256 "6fb5df85297bfe80a761b95516fa3b1f13a84a0372659ebdbf3745afc658f0c7"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.2/markdownmeister-1.8.2-linux-x64.AppImage"
      sha256 "7f7f2c288535b14b4122730f7dfaef7c24d4f0f02a8a52dd25d23b02b034a598"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.8.2-linux-x64.AppImage" => "markdownmeister"
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
