class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.7.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.7.0/markdownmeister-1.7.0-macos-arm64.zip"
      sha256 "a98ed982b8822ea4f04cb0277141b0b0fd5208e0d0fb2424064555d21c5d4872"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.7.0/markdownmeister-1.7.0-macos-x64.zip"
      sha256 "b3e7a920342df650f74697112e2e6617ae58c2437eff63c5f6267690dc486af9"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.7.0/markdownmeister-1.7.0-linux-x64.AppImage"
      sha256 "89013bf49a42d973ab7c1c17fd171b62b51e66a23cb614195fb4bab3f5c4e654"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.7.0-linux-x64.AppImage" => "markdownmeister"
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
