class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.1.0/markdownmeister-1.1.0-macos-arm64.zip"
      sha256 "2899d301212449e416ab2bea1c342da7ecc9bc9b8dbba5a5ae5130b90df2ff59"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.1.0/markdownmeister-1.1.0-macos-x64.zip"
      sha256 "bc1ea4400a02d8884b482c11cdb6dce5aafa48f615e4519b6cf09441363a4448"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.1.0/markdownmeister-1.1.0-linux-x64.AppImage"
      sha256 "94b88db92eab096e4866bf8624dfc6aee0220b2df804b3a411dbb43ce19f49f1"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.1.0-linux-x64.AppImage" => "markdownmeister"
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
