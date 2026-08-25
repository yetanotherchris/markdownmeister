class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.5.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.0/markdownmeister-1.5.0-macos-arm64.zip"
      sha256 "447435a61250d71c1995f590be59f6a7fea51a08c85de0140fe124f74e93307a"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.0/markdownmeister-1.5.0-macos-x64.zip"
      sha256 "e19347b0660b162418b43951d3c145f490c3128394fa31672751710bf9bc7185"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.0/markdownmeister-1.5.0-linux-x64.AppImage"
      sha256 "b04a9168dbd02e86ffae6aff7e2993e517fdd7f25cdc6e58e95e264b9c5840bb"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.5.0-linux-x64.AppImage" => "markdownmeister"
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
