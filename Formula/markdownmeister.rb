class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.8.64"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.64/markdownmeister-1.8.64-macos-arm64.zip"
      sha256 "5a4254d1c7b8b8d1dbc51bccc9f7606feefdbae138221be6598ba63dc34a5fa2"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.64/markdownmeister-1.8.64-macos-x64.zip"
      sha256 "82dece7b9f20d33633771de4fb56ac4b07922c3ba2244694d1b9d57aa76d1f1b"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.64/markdownmeister-1.8.64-linux-x64.AppImage"
      sha256 "b63b86e4fe6ffa3577bab42135d9b6b0ffa366714586b82198df821bbe8b1c82"
    end
  end

  def install
    if OS.mac?
      prefix.install "markdownmeister.app" => "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.8.64-linux-x64.AppImage" => "markdownmeister"
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
