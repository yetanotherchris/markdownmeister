class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.2.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.2.0/markdownmeister-1.2.0-macos-arm64.zip"
      sha256 "0727d4adb048e87f1464b5f1ffc1455cd64ad47e3e7b69ae31c6ccf87437dc7c"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.2.0/markdownmeister-1.2.0-macos-x64.zip"
      sha256 "17ba1bef932e1f97df6979234e9e20247ddb54d09ba70dd7f2019593428ef3e5"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.2.0/markdownmeister-1.2.0-linux-x64.AppImage"
      sha256 "cf86deabed5bed782e535c3f526b4006ef8eaf0e201c81292a694831c101e2f8"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.2.0-linux-x64.AppImage" => "markdownmeister"
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
