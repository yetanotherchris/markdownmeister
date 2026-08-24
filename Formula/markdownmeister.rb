class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.3.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.3.1/markdownmeister-1.3.1-macos-arm64.zip"
      sha256 "11c0997d1d672d138614cc80b061d590e16fb669aaa5a8dc9aab17099159e4da"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.3.1/markdownmeister-1.3.1-macos-x64.zip"
      sha256 "836b569356e9346b21b50bb807209363f714bbc787813591b90e4895e0115990"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.3.1/markdownmeister-1.3.1-linux-x64.AppImage"
      sha256 "31e4c1c6a3a38bfbfaa042cd018c6fcb3272522c6c509d6702499c6cafef37dd"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.3.1-linux-x64.AppImage" => "markdownmeister"
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
