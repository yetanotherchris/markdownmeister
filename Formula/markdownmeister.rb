class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.8.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.0/markdownmeister-1.8.0-macos-arm64.zip"
      sha256 "18f45df4ee0efbd5a5942fc3b067575df8c1ce4576caa9420118223fd3bd73b3"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.0/markdownmeister-1.8.0-macos-x64.zip"
      sha256 "1e52ff882487d36de74bc7abb7c7f1623664147bb563872dd32701dbe75c0b1b"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.0/markdownmeister-1.8.0-linux-x64.AppImage"
      sha256 "6e644a7f17aa8a69973d68c2fdd8d1ea6a06a9ef790fbf8f371686a54779af2c"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.8.0-linux-x64.AppImage" => "markdownmeister"
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
