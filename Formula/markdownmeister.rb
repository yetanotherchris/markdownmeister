class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.6.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.6.0/markdownmeister-1.6.0-macos-arm64.zip"
      sha256 "e4a839febc2b86782aff714bc38d7aaeb8b2519105ea7bca34ab5f1e90ecfb62"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.6.0/markdownmeister-1.6.0-macos-x64.zip"
      sha256 "039c2e10d38d5939969936317254ed6fc904959ec20b21ddca6e155964a1f200"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.6.0/markdownmeister-1.6.0-linux-x64.AppImage"
      sha256 "83f8cd4beb3c756cad28de4b38f611f8ff6f2cfddbdda3e0469903665421ea65"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.6.0-linux-x64.AppImage" => "markdownmeister"
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
