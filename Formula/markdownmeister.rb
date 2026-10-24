class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.8.61"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.61/markdownmeister-1.8.61-macos-arm64.zip"
      sha256 "8b5ae12cc850a59b2a60c1026b498943e1b66137e6823614585aaa462b5f12c5"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.61/markdownmeister-1.8.61-macos-x64.zip"
      sha256 "dd8ceb8cda36947df59fda13e7258f6704f3c90a55f4711afd950002e94c4f30"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.61/markdownmeister-1.8.61-linux-x64.AppImage"
      sha256 "9cf326d59174dae9a5427b28d7d90c25bb439d3a22e6e607ff3b09fec3632b0d"
    end
  end

  def install
    if OS.mac?
      prefix.install "markdownmeister.app" => "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.8.61-linux-x64.AppImage" => "markdownmeister"
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
