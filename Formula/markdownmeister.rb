class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.8.62"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.62/markdownmeister-1.8.62-macos-arm64.zip"
      sha256 "8194af9c1606590b08e0c79d0bc6866efbb14aceda82860a06d08288ff2f3ffa"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.62/markdownmeister-1.8.62-macos-x64.zip"
      sha256 "83fa39982d71ce44a895c8efb7c2d796ac4caf78c930ba3b3d7c01a83cbf1534"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.8.62/markdownmeister-1.8.62-linux-x64.AppImage"
      sha256 "404a3c3f580609e9f050f90246307a19203d88f3ffd5accd4612c5808a0adbb1"
    end
  end

  def install
    if OS.mac?
      prefix.install "markdownmeister.app" => "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.8.62-linux-x64.AppImage" => "markdownmeister"
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
