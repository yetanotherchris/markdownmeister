class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.3.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.3.0/markdownmeister-1.3.0-macos-arm64.zip"
      sha256 "59f9a0b4a36f7d927db1533b88f54d8c1fd8aa7f845054ddd740f34ef8ed3f92"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.3.0/markdownmeister-1.3.0-macos-x64.zip"
      sha256 "ed5d7e83c02a2d3eecdee1b015f66ade4ab48b13f36b07b453cd9269de18ec55"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.3.0/markdownmeister-1.3.0-linux-x64.AppImage"
      sha256 "215e478905ba9d80b7d6e32261f6aff7c96c27bd8032a22dfd6fecfb500da160"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.3.0-linux-x64.AppImage" => "markdownmeister"
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
