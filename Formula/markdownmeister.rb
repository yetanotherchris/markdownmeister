class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.0.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.0.0/markdownmeister-1.0.0-macos-arm64.zip"
      sha256 "b9c7120cee15b42fc5155f38f7bdd980718fec0045a3f01538973adab81ed9ef"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.0.0/markdownmeister-1.0.0-macos-x64.zip"
      sha256 "2f7669d7d43c37eec2f49002050192a51c0c9f89244a00afd2701611b8575ad9"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.0.0/markdownmeister-1.0.0-linux-x64.AppImage"
      sha256 "16d853122abed6ffe0c13621bbc5c20d0f1331fffa7592557805580b5aa74055"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.0.0-linux-x64.AppImage" => "markdownmeister"
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
