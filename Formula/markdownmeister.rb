class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/another-markdown-editor"
  version "0.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/another-markdown-editor/releases/download/v0.1.0/markdownmeister-0.1.0-macos-arm64.zip"
      sha256 "0bf528d65b81d4346812c24c7e3f472227cc5005ab947b4839ac216e1d74036f"
    else
      url "https://github.com/yetanotherchris/another-markdown-editor/releases/download/v0.1.0/markdownmeister-0.1.0-macos-x64.zip"
      sha256 "981d18d131e56cac8d6f4971fe45427aa557196604ef2a70cc129bc87c8f1d4d"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/another-markdown-editor/releases/download/v0.1.0/markdownmeister-0.1.0-linux-x64.AppImage"
      sha256 "5ed7b7859a45a63c3cf33cf32d2751dbb4d0aca7ac64f804f4619aa39f57caa2"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-0.1.0-linux-x64.AppImage" => "markdownmeister"
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
