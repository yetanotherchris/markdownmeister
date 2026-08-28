class Markdownmeister < Formula
  desc "A WYSIWYG markdown editor for Windows, macOS, and Linux, built with Electron and Milkdown."
  homepage "https://github.com/yetanotherchris/markdownmeister"
  version "1.5.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.1/markdownmeister-1.5.1-macos-arm64.zip"
      sha256 "683c4462abf937f4800d22a8a9342e534c88f39f3bd8532b486ea75fcd92fdb6"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.1/markdownmeister-1.5.1-macos-x64.zip"
      sha256 "8e44f3636cef5277352a18ea13dae5cf55055ff34f50520574fe43f15e3f1b50"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      odie "MarkdownMeister does not provide a Linux arm64 build"
    else
      url "https://github.com/yetanotherchris/markdownmeister/releases/download/v1.5.1/markdownmeister-1.5.1-linux-x64.AppImage"
      sha256 "32e2eff65e5f61b57d9265fd337422af39458243cfdbf55b610f648176004f89"
    end
  end

  def install
    if OS.mac?
      app.install "MarkdownMeister.app"
    else
      bin.install "markdownmeister-1.5.1-linux-x64.AppImage" => "markdownmeister"
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
