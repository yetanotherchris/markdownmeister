class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.5.2"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.2/markdownmeister-1.5.2-macos-arm64.zip"
      sha256 "8fd7e44072f982ff7949faeabd534012ab6a2473978b55a3fd75475f4ed04e12"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.2/markdownmeister-1.5.2-macos-x64.zip"
      sha256 "80af40ac9149989c993704b86eb48ae6aa419d4f69aa7aa2c420af28a6839184"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.2/markdownmeister-1.5.2-linux-x64.AppImage"
      sha256 "68430740ce86346654eedcde673549c980e2b16dd2e6041506c5c673912c63a5"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.5.2-linux-x64.AppImage" => "markdownmeister"
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
