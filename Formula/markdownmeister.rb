class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.0.2"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.0.2/markdownmeister-1.0.2-macos-arm64.zip"
      sha256 "9896e2624b945a8dcef0bbccfb306311752b8322d8f41dee23d4e01a4014797b"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.0.2/markdownmeister-1.0.2-macos-x64.zip"
      sha256 "d80dcd55cbce4e4bc44ba08376aed714391f731b85c21ae8162714f9b58d040c"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.0.2/markdownmeister-1.0.2-linux-x64.AppImage"
      sha256 "7fce30e4633473cc042712e8ea2415bb83015a9b05d9eac7ab219b9a41e8c8ab"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.0.2-linux-x64.AppImage" => "markdownmeister"
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
