class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.6.58"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.6.58/markdownmeister-1.6.58-macos-arm64.zip"
      sha256 "ecd8f02d1d47600263138047777992e949ead96b89a6a468e75336f7d8545e0e"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.6.58/markdownmeister-1.6.58-macos-x64.zip"
      sha256 "549e974243708a7d46cf8825e25104026d44cd003097ebe4a860818cfb2c99bd"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.6.58/markdownmeister-1.6.58-linux-x64.AppImage"
      sha256 "7919ac426fb6986c9da8dfbaa622956542102ef6372d597229f463bb64a73a4a"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.6.58-linux-x64.AppImage" => "markdownmeister"
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
